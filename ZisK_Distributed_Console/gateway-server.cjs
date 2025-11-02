#!/usr/bin/env node

/**
 * REST-to-gRPC Gateway for ZisK Dashboard
 * 
 * This server translates REST API calls to gRPC calls to the coordinator.
 * 
 * Usage:
 *   npm install grpc @grpc/grpc-js @grpc/proto-loader express cors
 *   node gateway-server.js
 * 
 * Or use the Dockerfile to run in a container.
 */

const express = require('express');
const cors = require('cors');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const fs = require('fs');

const GATEWAY_PORT = process.env.GATEWAY_PORT || 8080;
const COORDINATOR_URL = process.env.COORDINATOR_URL || 'localhost:50051';

// Find proto file in multiple possible locations
// Searches common installation patterns without hardcoding user-specific paths
function findProtoPath() {
  // 1. Check environment variable first (highest priority)
  if (process.env.PROTO_PATH && fs.existsSync(process.env.PROTO_PATH)) {
    return process.env.PROTO_PATH;
  }
  
  // 2. Check relative to current working directory (if gateway is in zisk project)
  const cwd = process.cwd();
  const possiblePaths = [
    // Relative to project root (if gateway is in zisk/distributed or similar)
    path.join(cwd, 'distributed/crates/grpc-api/proto/zisk_distributed_api.proto'),
    path.join(cwd, '../distributed/crates/grpc-api/proto/zisk_distributed_api.proto'),
    path.join(cwd, '../../distributed/crates/grpc-api/proto/zisk_distributed_api.proto'),
    // Relative to gateway script location
    path.join(__dirname, '../zisk/distributed/crates/grpc-api/proto/zisk_distributed_api.proto'),
    path.join(__dirname, '../../zisk/distributed/crates/grpc-api/proto/zisk_distributed_api.proto'),
    path.join(__dirname, '../../../zisk/distributed/crates/grpc-api/proto/zisk_distributed_api.proto'),
    // Check common installation locations
    path.join(process.env.HOME || '', 'zisk/distributed/crates/grpc-api/proto/zisk_distributed_api.proto'),
    path.join(process.env.HOME || '', 'Downloads/ZisK_Data/zisk/distributed/crates/grpc-api/proto/zisk_distributed_api.proto'),
    path.join(process.env.HOME || '', 'Downloads/zisk/distributed/crates/grpc-api/proto/zisk_distributed_api.proto'),
    path.join(process.env.HOME || '', 'Documents/zisk/distributed/crates/grpc-api/proto/zisk_distributed_api.proto'),
    // Check if ZISK_ROOT or ZISK_HOME is set
    ...(process.env.ZISK_ROOT ? [path.join(process.env.ZISK_ROOT, 'distributed/crates/grpc-api/proto/zisk_distributed_api.proto')] : []),
    ...(process.env.ZISK_HOME ? [path.join(process.env.ZISK_HOME, 'distributed/crates/grpc-api/proto/zisk_distributed_api.proto')] : []),
  ];
  
  for (const protoPath of possiblePaths) {
    if (fs.existsSync(protoPath)) {
      console.log(`📄 Found proto file at: ${protoPath}`);
      return protoPath;
    }
  }
  
  // If not found, provide helpful error message
  console.error('❌ Proto file not found. Searched in:');
  possiblePaths.forEach(p => console.error(`   - ${p}`));
  console.error('\n💡 Set PROTO_PATH environment variable:');
  console.error(`   export PROTO_PATH=/path/to/zisk/distributed/crates/grpc-api/proto/zisk_distributed_api.proto\n`);
  
  throw new Error('Proto file not found. Please set PROTO_PATH environment variable.');
}

const PROTO_PATH = findProtoPath();

const app = express();
app.use(cors());
app.use(express.json());

let grpcClient = null;

// Initialize gRPC client
function initGrpcClient() {
  try {
    const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });

    const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
    const ziskApi = protoDescriptor.zisk.distributed.api.v1;

    grpcClient = new ziskApi.ZiskDistributedApi(
      COORDINATOR_URL,
      grpc.credentials.createInsecure()
    );

    console.log(`✅ Connected to coordinator at ${COORDINATOR_URL}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to initialize gRPC client:`, error.message);
    console.error(`   Proto path: ${PROTO_PATH}`);
    console.error(`   Coordinator: ${COORDINATOR_URL}`);
    return false;
  }
}

// Helper to convert protobuf to JSON
function protoToJSON(obj) {
  if (!obj) return null;
  
  const json = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === 'object') {
      // Handle protobuf Timestamp
      if (value.seconds !== undefined) {
        json[key] = new Date(value.seconds * 1000 + (value.nanos || 0) / 1000000).toISOString();
      } else if (Array.isArray(value)) {
        json[key] = value.map(protoToJSON);
      } else {
        json[key] = protoToJSON(value);
      }
    } else {
      json[key] = value;
    }
  }
  return json;
}

// Helper to wrap gRPC call in Promise
function grpcCall(method, request) {
  return new Promise((resolve, reject) => {
    if (!grpcClient) {
      return reject(new Error('gRPC client not initialized'));
    }

    grpcClient[method](request, (error, response) => {
      if (error) {
        reject(error);
      } else {
        resolve(response);
      }
    });
  });
}

// Health check
app.get('/health', async (req, res) => {
  try {
    // Try to check coordinator health via gRPC
    const response = await grpcCall('HealthCheck', {});
    res.json({ 
      status: 'ok', 
      coordinator: COORDINATOR_URL,
      gateway: 'running',
      gateway_port: GATEWAY_PORT,
      coordinator_host: COORDINATOR_URL.split(':')[0] || 'localhost',
      coordinator_port: COORDINATOR_URL.split(':')[1] || '50051'
    });
  } catch (error) {
    // Gateway is up but coordinator might be down
    res.status(503).json({ 
      status: 'error',
      coordinator: COORDINATOR_URL,
      gateway: 'running',
      gateway_port: GATEWAY_PORT,
      coordinator_host: COORDINATOR_URL.split(':')[0] || 'localhost',
      coordinator_port: COORDINATOR_URL.split(':')[1] || '50051',
      error: 'Coordinator unreachable',
      error_message: error.message
    });
  }
});

// Get coordinator info/details
app.get('/api/coordinator/info', async (req, res) => {
  try {
    // Try to get system status to verify coordinator is responsive
    const systemStatus = await grpcCall('SystemStatus', {});
    res.json({
      coordinator_url: COORDINATOR_URL,
      coordinator_host: COORDINATOR_URL.split(':')[0] || 'localhost',
      coordinator_port: parseInt(COORDINATOR_URL.split(':')[1] || '50051'),
      gateway_port: parseInt(GATEWAY_PORT),
      status: 'connected',
      // proto_path: PROTO_PATH, // Hidden for security/privacy
      // Include coordinator version info if available from system status
      total_workers: systemStatus.result?.status?.total_workers || systemStatus.status?.total_workers || 0,
      active_jobs: systemStatus.result?.status?.active_jobs || systemStatus.status?.active_jobs || 0,
    });
  } catch (error) {
    // Return info even if coordinator is not responding
    res.json({
      coordinator_url: COORDINATOR_URL,
      coordinator_host: COORDINATOR_URL.split(':')[0] || 'localhost',
      coordinator_port: parseInt(COORDINATOR_URL.split(':')[1] || '50051'),
      gateway_port: parseInt(GATEWAY_PORT),
      status: 'disconnected',
      error: error.message,
    });
  }
});

// Get job status
app.get('/api/job/:jobId', async (req, res) => {
  try {
    const response = await grpcCall('JobStatus', { job_id: req.params.jobId });
    
    // Handle gRPC response format: JobStatusResponse { result: { job: JobStatus } }
    // JobStatus: { job_id, data_id, phase, state, assigned_workers, start_time (u64), duration_ms (u64) }
    let job = null;
    if (response.result?.job) {
      job = response.result.job;
    } else if (response.job) {
      job = response.job;
    } else if (response.result?.error) {
      // Handle error response
      res.status(404).json({ error: response.result.error.message || 'Job not found' });
      return;
    }
    
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    
    // Convert protobuf to JSON
    // Note: start_time is u64 (milliseconds Unix timestamp), not protobuf Timestamp
    const jobJson = {
      job_id: job.job_id,
      data_id: job.data_id,
      phase: job.phase, // "Contributions", "Prove", "Aggregate", or "None"
      state: job.state, // "Created", "Running ({phase})", "Completed", "Failed"
      assigned_workers: job.assigned_workers || [],
      start_time: job.start_time, // u64 milliseconds
      duration_ms: job.duration_ms, // u64 milliseconds
    };
    
    res.json(jobJson);
  } catch (error) {
    console.error('JobStatus error:', error);
    if (error.code === grpc.status.NOT_FOUND || error.message.includes('not found')) {
      res.status(404).json({ error: `Job not found: ${req.params.jobId}` });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Get workers list
app.get('/api/workers', async (req, res) => {
  try {
    const availableOnly = req.query.available_only === 'true';
    const response = await grpcCall('WorkersList', { available_only: availableOnly });
    
    // Handle gRPC response format: WorkersListResponse { result: { workers_list: { workers: [...] } } }
    // WorkerInfo: { worker_id, state, compute_capacity: { compute_units }, connected_at: Timestamp, last_heartbeat: Timestamp }
    let workers = [];
    if (response.result?.workers_list?.workers) {
      workers = response.result.workers_list.workers;
    } else if (response.workers_list?.workers) {
      workers = response.workers_list.workers;
    } else if (Array.isArray(response.workers)) {
      workers = response.workers;
    }

    // Convert each worker, handling protobuf Timestamps
    const workersJson = workers.map((worker) => {
      const parseTimestamp = (ts) => {
        if (!ts) return null;
        // Protobuf Timestamp: { seconds: i64, nanos: i32 }
        if (ts.seconds !== undefined) {
          return new Date(ts.seconds * 1000 + (ts.nanos || 0) / 1000000).toISOString();
        }
        return ts; // Already a string or other format
      };

      return {
        worker_id: worker.worker_id,
        state: worker.state, // "Idle", "Computing({phase})", "Disconnected", "Connecting", "Error"
        compute_capacity: worker.compute_capacity?.compute_units || worker.compute_capacity || 0,
        connected_at: parseTimestamp(worker.connected_at),
        last_heartbeat: parseTimestamp(worker.last_heartbeat),
        metrics: worker.metrics ? {
          cpu_percent: worker.metrics.cpu_percent || 0,
          memory_used_gb: worker.metrics.memory_used_gb || 0,
          memory_total_gb: worker.metrics.memory_total_gb || 0,
          network_in_mbps: worker.metrics.network_in_mbps || 0,
          network_out_mbps: worker.metrics.network_out_mbps || 0,
        } : null,
      };
    });

    res.json({ workers: workersJson });
  } catch (error) {
    console.error('WorkersList error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get system status
app.get('/api/system/status', async (req, res) => {
  try {
    const response = await grpcCall('SystemStatus', {});
    
    // Handle gRPC response format: SystemStatusResponse { result: { status: SystemStatus } }
    // SystemStatus: { total_workers, compute_capacity, idle_workers, busy_workers, active_jobs }
    let status = null;
    if (response.result?.status) {
      status = response.result.status;
    } else if (response.status) {
      status = response.status;
    } else {
      status = response;
    }

    const statusJson = {
      total_workers: status.total_workers || 0,
      compute_capacity: status.compute_capacity || 0, // Already extracted from ComputeCapacity
      idle_workers: status.idle_workers || 0,
      busy_workers: status.busy_workers || 0,
      active_jobs: status.active_jobs || 0,
    };

    res.json(statusJson);
  } catch (error) {
    console.error('SystemStatus error:', error);
    res.status(500).json({ error: error.message });
  }
});

// List all jobs
app.get('/api/jobs', async (req, res) => {
  try {
    const activeOnly = req.query.active_only === 'true';
    const response = await grpcCall('JobsList', { active_only: activeOnly });
    
    let jobs = [];
    if (response.result?.jobs_list?.jobs) {
      jobs = response.result.jobs_list.jobs.map(protoToJSON);
    } else if (response.jobs_list?.jobs) {
      jobs = response.jobs_list.jobs.map(protoToJSON);
    } else if (Array.isArray(response.jobs)) {
      jobs = response.jobs.map(protoToJSON);
    }

    res.json({ jobs });
  } catch (error) {
    console.error('JobsList error:', error);
    res.status(500).json({ error: error.message });
  }
});

// List available proof files from disk
app.get('/api/proofs', async (req, res) => {
  try {
    const path = require('path');
    const fs = require('fs').promises;
    
    // Default proofs directory (can be configured)
    const proofsDir = process.env.PROOFS_DIR || path.join(process.cwd(), 'proofs');
    
    try {
      const files = await fs.readdir(proofsDir);
      
      // Filter for proof files and extract job IDs
      const proofs = [];
      for (const file of files) {
        // Match pattern: proof_{job-id}.fri or proof_{job-id}.fri.compressed
        const match = file.match(/^proof_([a-f0-9-]+)\.fri(\.compressed)?$/);
        if (match) {
          const jobId = match[1];
          const isCompressed = !!match[2];
          
          // Only add raw proof (not compressed) to avoid duplicates
          if (!isCompressed) {
            try {
              const filePath = path.join(proofsDir, file);
              const stats = await fs.stat(filePath);
              
              // Check if compressed version exists
              const compressedPath = filePath + '.compressed';
              let compressedSize = null;
              try {
                const compressedStats = await fs.stat(compressedPath);
                compressedSize = compressedStats.size;
              } catch {
                // Compressed version doesn't exist, that's okay
              }
              
              proofs.push({
                job_id: jobId,
                file_name: file,
                file_path: filePath,
                size_bytes: stats.size,
                size_mb: (stats.size / (1024 * 1024)).toFixed(2),
                compressed_size_bytes: compressedSize,
                compressed_size_mb: compressedSize ? (compressedSize / (1024 * 1024)).toFixed(2) : null,
                created_at: stats.birthtime.toISOString(),
                modified_at: stats.mtime.toISOString(),
              });
            } catch (statError) {
              console.warn(`Failed to stat proof file ${file}:`, statError.message);
            }
          }
        }
      }
      
      // Sort by creation time (newest first)
      proofs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      
      res.json({ proofs });
    } catch (readError) {
      if (readError.code === 'ENOENT') {
        // Proofs directory doesn't exist
        res.json({ proofs: [] });
      } else {
        throw readError;
      }
    }
  } catch (error) {
    console.error('Proofs list error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start server
const server = app.listen(GATEWAY_PORT, () => {
  console.log(`\n🚀 REST-to-gRPC Gateway running on http://localhost:${GATEWAY_PORT}`);
  console.log(`   Coordinating with: ${COORDINATOR_URL}\n`);
  
  if (initGrpcClient()) {
    console.log('📡 Ready to proxy requests!\n');
  } else {
    console.log('⚠️  Gateway started but gRPC connection failed. Check coordinator URL.\n');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down gateway...');
  server.close(() => {
    console.log('Gateway stopped');
    process.exit(0);
  });
});

