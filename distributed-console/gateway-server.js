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
    // Check if ZISK_ROOT or ZISK_HOME is set
    ...(process.env.ZISK_ROOT ? [path.join(process.env.ZISK_ROOT, 'distributed/crates/grpc-api/proto/zisk_distributed_api.proto')] : []),
    ...(process.env.ZISK_HOME ? [path.join(process.env.ZISK_HOME, 'distributed/crates/grpc-api/proto/zisk_distributed_api.proto')] : []),
  ];
  
  for (const protoPath of possiblePaths) {
    if (fs.existsSync(protoPath)) {
      return protoPath;
    }
  }
  
  console.error('Proto file not found. Set PROTO_PATH environment variable.');
  
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
    if (process.env.DEBUG === 'true') {
      console.error(`   Proto path: ${PROTO_PATH}`);
      console.error(`   Coordinator: ${COORDINATOR_URL}`);
    }
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
      gateway: 'running'
    });
  } catch (error) {
    // Gateway is up but coordinator might be down
    res.status(503).json({ 
      status: 'error',
      coordinator: COORDINATOR_URL,
      gateway: 'running',
      error: 'Coordinator unreachable'
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

