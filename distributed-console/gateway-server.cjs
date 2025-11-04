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
const { spawn, exec, execSync } = require('child_process');
const os = require('os');

const GATEWAY_PORT = process.env.GATEWAY_PORT || 8080;
const COORDINATOR_URL = process.env.COORDINATOR_URL || 'localhost:50051';
const GRPC_TIMEOUT_MS = parseInt(process.env.GRPC_TIMEOUT_MS || '30000', 10);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:5173,http://localhost:8080').split(',');
const DEBUG = process.env.DEBUG === 'true';
const MAX_REQUEST_SIZE = '10mb';
const MAX_CAPACITY = parseInt(process.env.MAX_CAPACITY || '1000', 10);
const ALLOWED_INPUT_PATHS = process.env.ALLOWED_INPUT_PATHS ? process.env.ALLOWED_INPUT_PATHS.split(',') : null;
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '10', 10);

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
      console.log('Proto file found');
      return protoPath;
    }
  }
  
  console.error('Proto file not found. Set PROTO_PATH environment variable.');
  
  throw new Error('Proto file not found. Please set PROTO_PATH environment variable.');
}

const PROTO_PATH = findProtoPath();

function sanitizeError(error) {
  if (DEBUG) {
    console.error('[DEBUG] Full error details:', error);
  }
  
  if (!error) return 'Internal server error';
  
  if (error.code === grpc.status.NOT_FOUND) {
    return 'Resource not found';
  }
  
  if (error.code === grpc.status.UNAVAILABLE) {
    return 'Service unavailable - coordinator may be down';
  }
  
  if (error.code === grpc.status.DEADLINE_EXCEEDED) {
    return 'Request timeout - service is overloaded';
  }
  
  if (error.code === grpc.status.INVALID_ARGUMENT) {
    return 'Invalid request parameters';
  }
  
  if (error.code === grpc.status.PERMISSION_DENIED) {
    return 'Permission denied';
  }
  
  const message = error.message || String(error);
  
  if (message && message.includes('timeout')) {
    return 'Request timeout - service is not responding';
  }
  
  if (message.includes('PROTO_PATH') || message.includes('proto')) {
    return 'Configuration error';
  }
  
  if (message.includes('localhost') || message.includes('127.0.0.1') || message.includes(':')) {
    const safeMessage = message.replace(/localhost:\d+/g, 'server').replace(/127\.0\.0\.1:\d+/g, 'server');
    return safeMessage;
  }
  
  if (message.length > 200) {
    return message.substring(0, 200) + '...';
  }
  
  return 'Internal server error';
}

function validateJobId(jobId) {
  if (!jobId || typeof jobId !== 'string') {
    return { valid: false, error: 'Job ID is required and must be a string' };
  }
  
  if (jobId.length === 0 || jobId.length > 128) {
    return { valid: false, error: 'Job ID must be between 1 and 128 characters' };
  }
  
  if (!/^[a-zA-Z0-9_-]+$/.test(jobId)) {
    return { valid: false, error: 'Job ID contains invalid characters. Only alphanumeric, underscore, and hyphen are allowed' };
  }
  
  if (jobId === 'undefined' || jobId === 'null' || jobId === 'true' || jobId === 'false') {
    return { valid: false, error: 'Invalid job ID format' };
  }
  
  return { valid: true };
}

function validatePath(pathValue, pathType = 'input') {
  if (!pathValue || typeof pathValue !== 'string') {
    return { valid: false, error: 'Path is required and must be a string' };
  }
  
  if (pathValue.length === 0 || pathValue.length > 512) {
    return { valid: false, error: 'Path must be between 1 and 512 characters' };
  }
  
  if (pathValue.includes('..') || pathValue.includes('//')) {
    return { valid: false, error: 'Path contains invalid characters (.. or //). Path traversal is not allowed' };
  }
  
  if (!/^[a-zA-Z0-9/._-]+$/.test(pathValue)) {
    return { valid: false, error: 'Path contains invalid characters. Only alphanumeric, slashes, dots, underscores, and hyphens are allowed' };
  }
  
  if (pathValue.startsWith('/') && !pathValue.match(/^\/[a-zA-Z0-9/._-]+$/)) {
    return { valid: false, error: 'Absolute path must start with a valid directory name' };
  }
  
  if (ALLOWED_INPUT_PATHS && pathType === 'input') {
    const normalizedPath = path.resolve(pathValue);
    const allowed = ALLOWED_INPUT_PATHS.some(allowedPath => {
      const normalizedAllowed = path.resolve(allowedPath);
      return normalizedPath.startsWith(normalizedAllowed);
    });
    
    if (!allowed) {
      return { valid: false, error: `Input path must be within allowed directories: ${ALLOWED_INPUT_PATHS.join(', ')}` };
    }
  }
  
  return { valid: true };
}

function validateComputeCapacity(capacity) {
  const num = Number(capacity);
  if (isNaN(num) || num < 1) {
    return { valid: false, error: 'Compute capacity must be a number greater than 0' };
  }
  if (num > MAX_CAPACITY) {
    return { valid: false, error: `Compute capacity exceeds maximum allowed (${MAX_CAPACITY} CU). Please reduce the capacity requirement.` };
  }
  return { valid: true };
}

const rateLimitMap = new Map();

function rateLimit(req, res, next) {
  const key = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  
  if (!rateLimitMap.has(key)) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }
  
  const record = rateLimitMap.get(key);
  
  if (now > record.resetTime) {
    record.count = 1;
    record.resetTime = now + RATE_LIMIT_WINDOW_MS;
    return next();
  }
  
  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return res.status(429).json({ 
      error: `Rate limit exceeded. Maximum ${RATE_LIMIT_MAX_REQUESTS} requests per ${RATE_LIMIT_WINDOW_MS / 1000} seconds. Please try again later.` 
    });
  }
  
  record.count++;
  next();
}

setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, RATE_LIMIT_WINDOW_MS);

function logAuditEvent(event, data) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    event,
    timestamp,
    ...data
  };
  
  if (DEBUG) {
    console.log(`[AUDIT] ${JSON.stringify(logEntry)}`);
  } else {
    console.log(JSON.stringify(logEntry));
  }
}

const app = express();
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    if (ALLOWED_ORIGINS.indexOf(origin) !== -1 || ALLOWED_ORIGINS.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed for this origin: ' + origin));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  maxAge: 86400
}));
app.use(express.json({ limit: MAX_REQUEST_SIZE }));
app.use(express.urlencoded({ limit: MAX_REQUEST_SIZE, extended: true }));

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

    console.log('Connected to coordinator');
    return true;
  } catch (error) {
    console.error('gRPC client initialization failed');
    if (DEBUG) {
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

// Helper to wrap gRPC call in Promise with timeout
function grpcCall(method, request, timeoutMs = GRPC_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    if (!grpcClient) {
      return reject(new Error('gRPC client not initialized'));
    }

    let timeoutId = null;
    let completed = false;
    let call = null;

    const cleanup = (cancelCall = false) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (cancelCall && call && !completed) {
        try {
          if (typeof call.cancel === 'function') {
            call.cancel();
          }
        } catch (e) {
          // Ignore cancellation errors
        }
      }
    };

    const finish = (error, response) => {
      if (completed) return;
      completed = true;
      cleanup(false);
      
      if (error) {
        reject(error);
      } else {
        resolve(response);
      }
    };

    timeoutId = setTimeout(() => {
      if (!completed) {
        cleanup(true);
        finish(new Error(`gRPC call ${method} timed out after ${timeoutMs}ms`));
      }
    }, timeoutMs);

    try {
      if (typeof grpcClient[method] !== 'function') {
        cleanup(false);
        return reject(new Error(`gRPC method ${method} does not exist`));
      }
      
      const metadata = new grpc.Metadata();
      const options = {
        deadline: new Date(Date.now() + timeoutMs),
      };
      
      call = grpcClient[method](request, metadata, options, (error, response) => {
        if (!completed) {
          finish(error, response);
        }
      });
      
      if (call && typeof call.on === 'function') {
        call.on('error', (error) => {
          if (!completed) {
            finish(error, null);
          }
        });
        
        call.on('status', (status) => {
          if (status.code !== grpc.status.OK && !completed && status.code !== grpc.status.CANCELLED) {
            const errorMsg = status.details || `gRPC call failed with code ${status.code}`;
            finish(new Error(errorMsg), null);
          }
        });
      }
    } catch (error) {
      cleanup(false);
      finish(error, null);
    }
  });
}

// Health check
app.get('/health', async (req, res) => {
  try {
    // Try to check coordinator health via gRPC (quick timeout for health check)
    const response = await grpcCall('HealthCheck', {}, 5000);
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
      error_message: sanitizeError(error)
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
    res.json({
      coordinator_url: COORDINATOR_URL,
      coordinator_host: COORDINATOR_URL.split(':')[0] || 'localhost',
      coordinator_port: parseInt(COORDINATOR_URL.split(':')[1] || '50051'),
      gateway_port: parseInt(GATEWAY_PORT),
      status: 'disconnected',
      error: sanitizeError(error),
    });
  }
});

// Get job status
app.get('/api/job/:jobId', async (req, res) => {
  try {
    const jobIdValidation = validateJobId(req.params.jobId);
    if (!jobIdValidation.valid) {
      res.status(400).json({ error: jobIdValidation.error });
      return;
    }
    
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
      res.status(404).json({ error: 'Job not found' });
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
      block_id: job.block_id, // Include block_id
      data_id: job.data_id,
      phase: job.phase, // "Contributions", "Prove", "Aggregate", or "None"
      state: job.state, // "Created", "Running ({phase})", "Completed", "Failed"
      assigned_workers: job.assigned_workers || [],
      start_time: job.start_time, // u64 milliseconds
      duration_ms: job.duration_ms, // u64 milliseconds
    };
    
    res.json(jobJson);
  } catch (error) {
    if (DEBUG) console.error('[JobStatus] Error:', error);
    if (error.code === grpc.status.NOT_FOUND || (error.message && error.message.includes('not found'))) {
      res.status(404).json({ error: 'Job not found' });
    } else {
      res.status(500).json({ error: sanitizeError(error) });
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
    if (DEBUG) console.error('[WorkersList] Error:', error);
    res.status(500).json({ error: sanitizeError(error) });
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
      compute_capacity: status.compute_capacity?.compute_units || status.compute_capacity || 0, // Extract compute_units from ComputeCapacity
      idle_workers: status.idle_workers || 0,
      busy_workers: status.busy_workers || 0,
      active_jobs: status.active_jobs || 0,
    };

    res.json(statusJson);
  } catch (error) {
    if (DEBUG) console.error('[SystemStatus] Error:', error);
    res.status(500).json({ error: sanitizeError(error) });
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
    if (DEBUG) console.error('[JobsList] Error:', error);
    res.status(500).json({ error: sanitizeError(error) });
  }
});

// Get coordinator status info (version, uptime)
app.get('/api/status/info', async (req, res) => {
  try {
    const response = await grpcCall('StatusInfo', {});
    
    let statusInfo = null;
    if (response.result?.status_info) {
      statusInfo = response.result.status_info;
    } else if (response.status_info) {
      statusInfo = response.status_info;
    } else {
      statusInfo = response;
    }

    const infoJson = {
      service_name: statusInfo.service_name || 'ZisK Distributed Coordinator',
      version: statusInfo.version || 'unknown',
      uptime_seconds: statusInfo.uptime_seconds || 0,
      start_time: statusInfo.start_time ? protoToJSON(statusInfo.start_time) : null,
      metrics: statusInfo.metrics ? {
        active_connections: statusInfo.metrics.active_connections || 0,
      } : null,
    };

    res.json(infoJson);
  } catch (error) {
    if (DEBUG) console.error('[StatusInfo] Error:', error);
    res.status(500).json({ error: sanitizeError(error) });
  }
});

// Launch a new proof generation job
app.post('/api/proof/launch', rateLimit, async (req, res) => {
  let responseSent = false;
  
  const sendResponse = (data, statusCode = 200) => {
    if (!responseSent) {
      responseSent = true;
      res.status(statusCode).json(data);
    }
  };
  
  const sendError = (error, statusCode = 500) => {
    if (!responseSent) {
      responseSent = true;
      res.status(statusCode).json({ error: error });
    }
  };
  
  const endpointTimeout = setTimeout(() => {
    sendError('Launch proof request timed out. The coordinator may be slow to respond. Check coordinator logs and ensure workers are available.', 504);
  }, 95000);
  
  try {
    const clientIp = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
    const { block_id, compute_capacity, input_path, elf_path } = req.body;
    
    if (!block_id || !compute_capacity || !input_path) {
      clearTimeout(endpointTimeout);
      sendError('Missing required fields: block_id, compute_capacity, input_path', 400);
      logAuditEvent('proof_launch_rejected', {
        reason: 'missing_fields',
        block_id: block_id || 'none',
        client_ip: clientIp
      });
      return;
    }

    const blockIdValidation = validateJobId(block_id);
    if (!blockIdValidation.valid) {
      clearTimeout(endpointTimeout);
      sendError(`Invalid block_id: ${blockIdValidation.error}`, 400);
      logAuditEvent('proof_launch_rejected', {
        reason: 'invalid_block_id',
        block_id,
        client_ip: clientIp
      });
      return;
    }

    const capacityValidation = validateComputeCapacity(compute_capacity);
    if (!capacityValidation.valid) {
      clearTimeout(endpointTimeout);
      sendError(capacityValidation.error, 400);
      logAuditEvent('proof_launch_rejected', {
        reason: 'invalid_capacity',
        block_id,
        compute_capacity,
        client_ip: clientIp
      });
      return;
    }

    const pathValidation = validatePath(input_path, 'input');
    if (!pathValidation.valid) {
      clearTimeout(endpointTimeout);
      sendError(`Invalid input_path: ${pathValidation.error}`, 400);
      logAuditEvent('proof_launch_rejected', {
        reason: 'invalid_input_path',
        block_id,
        client_ip: clientIp
      });
      return;
    }

    if (elf_path) {
      const elfPathValidation = validatePath(elf_path, 'elf');
      if (!elfPathValidation.valid) {
        clearTimeout(endpointTimeout);
        sendError(`Invalid elf_path: ${elfPathValidation.error}`, 400);
        logAuditEvent('proof_launch_rejected', {
          reason: 'invalid_elf_path',
          block_id,
          client_ip: clientIp
        });
        return;
      }
    }

    try {
      const systemStatus = await grpcCall('SystemStatus', {}, 5000);
      const totalWorkers = systemStatus.result?.status?.total_workers || systemStatus.status?.total_workers || 0;
      const idleWorkers = systemStatus.result?.status?.idle_workers || systemStatus.status?.idle_workers || 0;
      
      if (totalWorkers === 0) {
        clearTimeout(endpointTimeout);
        sendError('No workers are connected to the coordinator. Please start a worker first using the Worker Management panel.', 503);
        logAuditEvent('proof_launch_rejected', {
          reason: 'no_workers_available',
          block_id,
          client_ip: clientIp
        });
        return;
      }
      
      if (idleWorkers === 0) {
        clearTimeout(endpointTimeout);
        sendError(`All ${totalWorkers} worker(s) are currently busy. Please wait for workers to become idle or start additional workers.`, 503);
        logAuditEvent('proof_launch_rejected', {
          reason: 'all_workers_busy',
          block_id,
          total_workers: totalWorkers,
          client_ip: clientIp
        });
        return;
      }
      
      const existingJobs = await grpcCall('JobsList', { active_only: true }, 5000);
      const jobs = existingJobs.result?.jobs_list?.jobs || existingJobs.jobs_list?.jobs || existingJobs.jobs || [];
      
      const duplicateBlockId = jobs.find(job => {
        const jobBlockId = job.block_id || job.block?.block_id;
        return jobBlockId === block_id;
      });
      
      if (duplicateBlockId) {
        clearTimeout(endpointTimeout);
        sendError(`A proof job with block_id "${block_id}" is already running. Please wait for it to complete or use a different block_id.`, 409);
        logAuditEvent('proof_launch_rejected', {
          reason: 'duplicate_block_id',
          block_id,
          existing_job_id: duplicateBlockId.job_id || 'unknown',
          client_ip: clientIp
        });
        return;
      }
    } catch (checkError) {
      if (DEBUG) console.error('[LaunchProof] Error checking system status:', checkError);
    }

    if (DEBUG) {
      console.log(`[LaunchProof] Request received: block_id=${block_id}, compute_capacity=${compute_capacity}`);
    }
    
    logAuditEvent('proof_launch_initiated', {
      block_id,
      compute_capacity: Number(compute_capacity),
      client_ip: clientIp,
      user_agent: req.headers['user-agent'] || 'unknown'
    });
    
    const launchRequest = {
      block_id: String(block_id),
      compute_capacity: Number(compute_capacity),
      input_path: String(input_path),
    };
    
    console.log(`[LaunchProof] Calling coordinator with:`, {
      block_id: launchRequest.block_id,
      compute_capacity: launchRequest.compute_capacity,
      input_path: '[REDACTED]'
    });
    
    const response = await grpcCall('LaunchProof', launchRequest, 90000);
    
    clearTimeout(endpointTimeout);
    
    let result = null;
    if (response.result?.launch_proof) {
      result = response.result.launch_proof;
    } else if (response.launch_proof) {
      result = response.launch_proof;
    } else if (response.result) {
      result = response.result;
    } else {
      result = response;
    }

    const jobId = result.job_id || result.result?.job_id || '';
    
    if (!jobId || jobId === '') {
      clearTimeout(endpointTimeout);
      sendError('Coordinator returned empty job_id. The launch may have failed. Check coordinator logs.', 500);
      return;
    }
    
    if (DEBUG) {
      console.log(`[LaunchProof] Success: job_id=${jobId}`);
    }
    
    logAuditEvent('proof_launch_success', {
      block_id,
      job_id: String(jobId),
      compute_capacity: Number(compute_capacity),
      client_ip: clientIp
    });
    
    sendResponse({
      job_id: String(jobId),
      success: true,
    });
  } catch (error) {
    clearTimeout(endpointTimeout);
    const sanitized = sanitizeError(error);
    const clientIp = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
    
    logAuditEvent('proof_launch_failed', {
      block_id: req.body?.block_id || 'unknown',
      error_code: error.code || 'unknown',
      error_message: sanitized,
      client_ip: clientIp
    });
    
    if (DEBUG) {
      console.error('[LaunchProof] Error:', {
        code: error.code,
        message: sanitized,
        details: error.details ? '[REDACTED]' : undefined
      });
    }
    
    let errorMessage = sanitized;
    let statusCode = 500;
    
    if (sanitized.includes('timed out') || sanitized.includes('timeout') || error.code === grpc.status.DEADLINE_EXCEEDED) {
      errorMessage = 'Launch proof request timed out after 90 seconds. The coordinator may be slow, workers may not be available, or the coordinator is not responding. Check: 1) Coordinator is running, 2) Workers are registered and idle, 3) Compute capacity requested is available.';
      statusCode = 504;
    } else if (sanitized.includes('CANCELLED') || error.code === 1) {
      errorMessage = 'The coordinator cancelled the request. This usually means no workers are connected or available. Check: 1) Workers are running and connected (check Worker Management), 2) Workers show "Idle" status, 3) Coordinator is running properly. If workers show "channel closed" errors, try restarting the worker.';
      statusCode = 503;
    } else if (sanitized.includes('No workers available') || sanitized.includes('insufficient')) {
      errorMessage = 'No workers available or insufficient compute capacity. Register workers first using the Worker Management panel.';
      statusCode = 503;
    } else if (sanitized.includes('not found') || sanitized.includes('file')) {
      errorMessage = 'File not found or invalid path';
      statusCode = 400;
    }
    
    sendError(errorMessage, statusCode);
  }
});

// Cancel a job
app.post('/api/job/:jobId/cancel', async (req, res) => {
  try {
    const jobIdValidation = validateJobId(req.params.jobId);
    if (!jobIdValidation.valid) {
      res.status(400).json({ error: jobIdValidation.error });
      return;
    }
    
    // Note: Coordinator may not have explicit cancel endpoint
    // This is a placeholder - implement when coordinator supports cancellation
    res.status(501).json({ error: 'Job cancellation not yet implemented in coordinator' });
  } catch (error) {
    if (DEBUG) console.error('[CancelJob] Error:', error);
    res.status(500).json({ error: sanitizeError(error) });
  }
});

// Download a proof file
app.get('/api/proofs/:jobId/download', async (req, res) => {
  try {
    const path = require('path');
    const fs = require('fs').promises;
    
    const jobIdValidation = validateJobId(req.params.jobId);
    if (!jobIdValidation.valid) {
      res.status(400).json({ error: jobIdValidation.error });
      return;
    }
    
    const jobId = req.params.jobId;
    // Check multiple possible locations for proof files
    const possibleDirs = [
      process.env.PROOFS_DIR,
      path.join(process.cwd(), 'proofs'),
      path.join(process.cwd(), 'distributed', 'proofs'),
      path.join(ZISK_REPO || '', 'proofs'),
      path.join(process.env.HOME || '', 'proofs'),
    ].filter(Boolean);
    
    // Try different filename patterns
    const possiblePatterns = [
      `proof_${jobId}.fri`,
      `proof_${jobId}.bin`,
      `vadcop_final_proof.bin`,
    ];
    
    const os = require('os');
    const homeDir = process.env.HOME || os.homedir();
    
    let proofFile = null;
    for (const dir of possibleDirs) {
      for (const pattern of possiblePatterns) {
        const candidate = path.join(dir, pattern);
        try {
          await fs.access(candidate);
          proofFile = candidate;
          break;
        } catch {
          // File doesn't exist, try next
        }
      }
      if (proofFile) break;
    }
    
    if (!proofFile) {
      // Try to find any proof file with this job ID in any directory
      for (const dir of possibleDirs) {
        try {
          const files = await fs.readdir(dir);
          const matchingFile = files.find(f => f.includes(jobId));
          if (matchingFile) {
            proofFile = path.join(dir, matchingFile);
            break;
          }
        } catch {
          // Directory doesn't exist or can't read
        }
      }
    }
    
    if (!proofFile) {
      res.status(404).json({ 
        error: `Proof file not found for job ${jobId}`,
        searched_locations: possibleDirs,
        searched_patterns: possiblePatterns
      });
      return;
    }
    
    try {
      const stats = await fs.stat(proofFile);
      
      // Determine content type based on file extension
      const ext = path.extname(proofFile);
      const contentType = ext === '.bin' ? 'application/octet-stream' : 
                         ext === '.fri' ? 'application/octet-stream' : 
                         'application/octet-stream';
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${path.basename(proofFile)}"`);
      res.setHeader('Content-Length', stats.size);
      
      const fileStream = require('fs').createReadStream(proofFile);
      fileStream.pipe(res);
    } catch (fileError) {
      if (fileError.code === 'ENOENT') {
        res.status(404).json({ error: `Proof file not found: ${proofFile}` });
      } else {
        throw fileError;
      }
    }
  } catch (error) {
    if (DEBUG) console.error('[ProofDownload] Error:', error);
    res.status(500).json({ error: sanitizeError(error) });
  }
});

// List available proof files from disk
app.get('/api/proofs', async (req, res) => {
  try {
    const path = require('path');
    const fs = require('fs').promises;
    
    // Check multiple possible locations for proof files
    const os = require('os');
    const homeDir = process.env.HOME || os.homedir();
    const possibleDirs = [
      process.env.PROOFS_DIR,
      path.join(process.cwd(), 'proofs'),
      path.join(process.cwd(), 'distributed', 'proofs'),
      path.join(ZISK_REPO || '', 'proofs'),
      path.join(homeDir, 'proofs'),
      path.join(homeDir, '.zisk', 'proofs'),
    ].filter(Boolean);
    
    const allProofs = [];
    
    // Scan all possible directories
    for (const proofsDir of possibleDirs) {
      try {
        const files = await fs.readdir(proofsDir);
        
        // Filter for proof files with multiple patterns
        for (const file of files) {
          // Pattern 1: proof_{job-id}.fri or proof_{job-id}.fri.compressed
          let match = file.match(/^proof_([a-f0-9-]+)\.fri(\.compressed)?$/);
          let jobId = null;
          let isCompressed = false;
          
          if (match) {
            jobId = match[1];
            isCompressed = !!match[2];
          } else {
            // Pattern 2: proof_{job-id}.bin
            match = file.match(/^proof_([a-f0-9-]+)\.bin$/);
            if (match) {
              jobId = match[1];
              isCompressed = false;
            } else {
              // Pattern 3: vadcop_final_proof.bin (use most recent job or timestamp)
              match = file.match(/^vadcop_final_proof(\.compressed)?\.bin$/);
              if (match) {
                // For generic proof files, try to get job ID from coordinator or use timestamp
                jobId = 'latest'; // Will be resolved later
                isCompressed = !!match[1];
              }
            }
          }
          
          if (jobId) {
            // Only add raw proof (not compressed) to avoid duplicates
            if (!isCompressed) {
              try {
                const filePath = path.join(proofsDir, file);
                const stats = await fs.stat(filePath);
                
                // Check if compressed version exists
                let compressedPath = null;
                let compressedSize = null;
                
                // Try different compressed filename patterns
                const compressedPatterns = [
                  filePath + '.compressed',
                  filePath.replace('.bin', '.compressed.bin'),
                  filePath.replace('.fri', '.fri.compressed'),
                ];
                
                for (const pattern of compressedPatterns) {
                  try {
                    const compressedStats = await fs.stat(pattern);
                    compressedPath = pattern;
                    compressedSize = compressedStats.size;
                    break;
                  } catch {
                    // Try next pattern
                  }
                }
                
                allProofs.push({
                  job_id: jobId === 'latest' ? 'latest' : jobId,
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
      } catch (readError) {
        if (readError.code !== 'ENOENT') {
          console.warn(`Failed to read proofs directory ${proofsDir}:`, readError.message);
        }
      }
    }
    
    // For 'latest' job_id, try to resolve from coordinator's active/completed jobs
    if (allProofs.some(p => p.job_id === 'latest')) {
      try {
        // Try to get jobs from coordinator to match proof file timestamp with job
        const jobsResponse = await grpcCall('JobsList', { active_only: false });
        const jobs = jobsResponse.result?.jobs_list?.jobs || jobsResponse.jobs_list?.jobs || [];
        
        if (jobs.length > 0) {
          // Match proof file by timestamp - find job that completed closest to proof file modification time
          const latestProofs = allProofs.filter(p => p.job_id === 'latest');
          latestProofs.forEach(proof => {
            // Find job that completed around the same time as the proof file was modified
            const proofModTime = new Date(proof.modified_at).getTime();
            let bestMatch = null;
            let minTimeDiff = Infinity;
            
            for (const job of jobs) {
              const jobTime = job.start_time ? (typeof job.start_time === 'string' ? parseInt(job.start_time) * 1000 : job.start_time * 1000) : 0;
              const timeDiff = Math.abs(proofModTime - jobTime);
              if (timeDiff < minTimeDiff) {
                minTimeDiff = timeDiff;
                bestMatch = job;
              }
            }
            
            if (bestMatch && minTimeDiff < 3600000) { // Within 1 hour
              proof.job_id = bestMatch.job_id;
            } else {
              // Fallback: use most recent job ID
              const recentJob = jobs.sort((a, b) => {
                const aTime = a.start_time || 0;
                const bTime = b.start_time || 0;
                return bTime - aTime;
              })[0];
              if (recentJob) {
                proof.job_id = recentJob.job_id;
              } else {
                // Last resort: use file modification timestamp as job ID
                proof.job_id = `latest-${Math.floor(proofModTime / 1000)}`;
              }
            }
          });
        } else {
          // No jobs found, use timestamp-based ID
          allProofs.forEach(proof => {
            if (proof.job_id === 'latest') {
              const proofModTime = new Date(proof.modified_at).getTime();
              proof.job_id = `latest-${Math.floor(proofModTime / 1000)}`;
            }
          });
        }
      } catch (error) {
        console.warn('Failed to resolve latest job ID:', error.message);
        // Fallback: use timestamp-based IDs
        allProofs.forEach(proof => {
          if (proof.job_id === 'latest') {
            const proofModTime = new Date(proof.modified_at).getTime();
            proof.job_id = `latest-${Math.floor(proofModTime / 1000)}`;
          }
        });
      }
    }
    
    // Deduplicate by job_id (keep most recent)
    const uniqueProofs = new Map();
    allProofs.forEach(proof => {
      const existing = uniqueProofs.get(proof.job_id);
      if (!existing || new Date(proof.created_at) > new Date(existing.created_at)) {
        uniqueProofs.set(proof.job_id, proof);
      }
    });
    
    // Sort by creation time (newest first)
    const proofs = Array.from(uniqueProofs.values()).sort((a, b) => 
      new Date(b.created_at) - new Date(a.created_at)
    );
    
    res.json({ proofs });
  } catch (error) {
    if (DEBUG) console.error('[ProofsList] Error:', error);
    res.status(500).json({ error: sanitizeError(error) });
  }
});

// ============================================================================
// Process Management
// ============================================================================

const processes = {
  coordinator: null,
  workers: new Map(), // Map<workerId, child_process>
};

// Find ZisK repository path
function findZiskRepo() {
  const possiblePaths = [
    process.env.ZISK_ROOT,
    process.env.ZISK_HOME,
    path.join(process.cwd(), '..'),
    path.join(process.cwd(), '../..'),
  ].filter(Boolean);

  for (const repoPath of possiblePaths) {
    const cargoToml = path.join(repoPath, 'Cargo.toml');
    const distributedDir = path.join(repoPath, 'distributed');
    if (fs.existsSync(cargoToml) && fs.existsSync(distributedDir)) {
      return repoPath;
    }
  }
  
  return null;
}

const ZISK_REPO = findZiskRepo();

// Helper to find coordinator binary
function findCoordinatorBinary() {
  // 1. Check if binary is in PATH
  try {
    const whichResult = execSync('which zisk-coordinator', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (whichResult && fs.existsSync(whichResult)) {
      return whichResult;
    }
  } catch (e) {
    // which command failed, continue
  }
  
  // 2. Check common installation locations
  const commonPaths = [
    path.join(process.env.HOME || '', '.zisk', 'bin', 'zisk-coordinator'),
    path.join(process.env.HOME || '', '.local', 'bin', 'zisk-coordinator'),
    '/usr/local/bin/zisk-coordinator',
    '/usr/bin/zisk-coordinator',
  ];
  
  for (const binPath of commonPaths) {
    if (fs.existsSync(binPath)) {
      return binPath;
    }
  }
  
  // 3. Check repository build directories (if repo found)
  if (ZISK_REPO) {
    const coordinatorBin = path.join(ZISK_REPO, 'target', 'release', 'zisk-coordinator');
    const coordinatorBinDebug = path.join(ZISK_REPO, 'target', 'debug', 'zisk-coordinator');
    
    if (fs.existsSync(coordinatorBin)) return coordinatorBin;
    if (fs.existsSync(coordinatorBinDebug)) return coordinatorBinDebug;
  }
  
  return null;
}

// Start coordinator
app.post('/api/coordinator/start', async (req, res) => {
  try {
    // Check if we're managing it
    if (processes.coordinator && !processes.coordinator.killed && processes.coordinator.exitCode === null) {
      return res.status(400).json({ error: 'Coordinator is already running (managed by dashboard)' });
    }

    // Check if coordinator is running externally
    const externalRunning = await new Promise((resolve) => {
      findCoordinatorProcess((pid) => resolve(pid !== null));
    });

    if (externalRunning) {
      return res.status(400).json({ 
        error: 'Coordinator is already running externally. Please stop it first or use the existing instance.' 
      });
    }

    const binPath = findCoordinatorBinary();
    
    if (!binPath) {
      return res.status(500).json({ 
        error: 'zisk-coordinator binary not found. Please build it first: cargo build --release --bin zisk-coordinator\n' +
               'Or install it globally: cargo install --path distributed --bin zisk-coordinator'
      });
    }
    
    // Determine working directory (prefer repo, fallback to binary directory)
    const cwd = ZISK_REPO || path.dirname(binPath);

    const coordinatorProcess = spawn(binPath, [], {
      cwd: cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });

    processes.coordinator = coordinatorProcess;

    coordinatorProcess.stdout.on('data', (data) => {
      console.log(`[Coordinator] ${data}`);
    });

    coordinatorProcess.stderr.on('data', (data) => {
      if (DEBUG) console.error(`[Coordinator Error] ${data}`);
    });

    coordinatorProcess.on('exit', (code) => {
      console.log(`Coordinator process exited with code ${code}`);
      processes.coordinator = null;
    });

    // Wait a moment to see if it starts successfully
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (coordinatorProcess.killed || coordinatorProcess.exitCode !== null) {
      return res.status(500).json({ error: 'Coordinator failed to start. Check logs.' });
    }

    res.json({ 
      success: true, 
      message: 'Coordinator started successfully',
      pid: coordinatorProcess.pid 
    });
  } catch (error) {
    if (DEBUG) console.error('Failed to start coordinator:', error);
    res.status(500).json({ error: sanitizeError(error) });
  }
});

// Stop coordinator
app.post('/api/coordinator/stop', async (req, res) => {
  try {
    // First, try to stop managed coordinator
    if (processes.coordinator) {
      processes.coordinator.kill('SIGTERM');
      processes.coordinator = null;
      return res.json({ success: true, message: 'Coordinator stopped' });
    }
    
    // If not managed, find and kill external coordinator
    findCoordinatorProcess((pid) => {
      if (!pid) {
        res.status(400).json({ error: 'Coordinator is not running' });
        return;
      }
      
      try {
        const platform = process.platform;
        console.log(`Attempting to stop external coordinator (PID: ${pid})`);
        
        if (platform === 'win32') {
          exec(`taskkill /PID ${pid} /F`, (error) => {
            if (error) {
              if (DEBUG) console.error('Failed to kill coordinator:', error);
              res.status(500).json({ error: 'Failed to stop coordinator' });
            } else {
              console.log(`Successfully stopped coordinator (PID: ${pid})`);
              res.json({ success: true, message: 'Coordinator stopped' });
            }
          });
        } else {
          // Send SIGTERM first (graceful shutdown)
          try {
            process.kill(pid, 'SIGTERM');
            console.log(`Sent SIGTERM to coordinator (PID: ${pid})`);
            
            // Wait a moment and verify it's stopped, then respond
            setTimeout(() => {
              findCoordinatorProcess((remainingPid) => {
                if (remainingPid === pid) {
                  // Still running, force kill with SIGKILL
                  console.log(`Coordinator still running, sending SIGKILL (PID: ${pid})`);
                  try {
                    process.kill(pid, 'SIGKILL');
                  } catch (killError) {
                    if (DEBUG) console.error('Failed to send SIGKILL:', killError);
                  }
                }
                if (!res.headersSent) {
                  res.json({ success: true, message: 'Coordinator stopped' });
                }
              });
            }, 1500);
          } catch (killError) {
            if (DEBUG) console.error('Failed to send SIGTERM:', killError);
            if (!res.headersSent) {
              res.status(500).json({ error: 'Failed to stop coordinator' });
            }
          }
        }
      } catch (error) {
        if (DEBUG) console.error('Failed to stop coordinator:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: sanitizeError(error) });
        }
      }
    });
  } catch (error) {
    if (DEBUG) console.error('Failed to stop coordinator:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  }
});

// Helper to find coordinator process
function findCoordinatorProcess(callback, timeoutMs = 5000) {
  const platform = process.platform;
  let command;
  
  if (platform === 'win32') {
    command = `tasklist /FI "IMAGENAME eq zisk-coordinator.exe" /FO CSV`;
  } else {
    command = `ps aux | grep -i "zisk-coordinator" | grep -v grep | grep -v "grep"`;
  }
  
  let callbackInvoked = false;
  let childProcess;
  
  const timeoutId = setTimeout(() => {
    if (!callbackInvoked) {
      callbackInvoked = true;
      // Kill the child process if it's still running
      if (childProcess) {
        try {
          childProcess.kill();
        } catch (e) {
          // Process may have already exited
        }
      }
      callback(null);
    }
  }, timeoutMs);
  
  childProcess = exec(command, { timeout: timeoutMs - 500 }, (error, stdout, stderr) => {
    clearTimeout(timeoutId);
    if (callbackInvoked) return;
    callbackInvoked = true;
    
    if (error || !stdout || stdout.trim().length === 0) {
      callback(null);
      return;
    }
    
    // Parse PID from output
    if (platform === 'win32') {
      // CSV format on Windows
      const lines = stdout.trim().split('\n');
      if (lines.length > 1) {
        const pid = lines[1].split(',')[1].replace(/"/g, '');
        callback(parseInt(pid, 10));
      } else {
        callback(null);
      }
    } else {
      // Unix format: parse PID from second column
      const lines = stdout.trim().split('\n');
      for (const line of lines) {
        if (line.includes('zisk-coordinator')) {
          const match = line.match(/^\S+\s+(\d+)/);
          if (match) {
            callback(parseInt(match[1], 10));
            return;
          }
        }
      }
      callback(null);
    }
  });
  
  // Ensure process is killed if it exceeds timeout
  childProcess.on('error', (error) => {
    clearTimeout(timeoutId);
    if (!callbackInvoked) {
      callbackInvoked = true;
      callback(null);
    }
  });
}

// Get coordinator status
app.get('/api/coordinator/process-status', (req, res) => {
  let responseSent = false;
  
  const sendResponse = (data) => {
    if (!responseSent) {
      responseSent = true;
      res.json(data);
    }
  };
  
  const sendError = (error) => {
    if (!responseSent) {
      responseSent = true;
      res.status(500).json({ error: error });
    }
  };
  
  // Set a timeout for this endpoint to prevent hanging
  const timeout = setTimeout(() => {
    sendError('Process status check timed out');
  }, 10000); // 10 second timeout

  try {
    // Check if we're managing it
    const managedRunning = processes.coordinator !== null && !processes.coordinator.killed && processes.coordinator.exitCode === null;
    
    if (managedRunning) {
      clearTimeout(timeout);
      sendResponse({
        running: true,
        pid: processes.coordinator.pid,
        managed: true,
      });
      return;
    }
  
    // Check if coordinator is running externally (with timeout)
    // Use 5 second timeout for the process check itself
    findCoordinatorProcess((externalPid) => {
      clearTimeout(timeout);
      if (externalPid) {
        sendResponse({
          running: true,
          pid: externalPid,
          managed: false,
        });
      } else {
        sendResponse({
          running: false,
          pid: null,
          managed: false,
        });
      }
    }, 5000); // 5 second timeout for process check
  } catch (error) {
    clearTimeout(timeout);
    if (DEBUG) console.error('Process status error:', error);
    sendError(sanitizeError(error));
  }
});

// Helper to find worker binary
function findWorkerBinary() {
  // 1. Check common installation locations first (most reliable)
  const commonPaths = [
    path.join(process.env.HOME || '', '.zisk', 'bin', 'zisk-worker'),
    path.join(process.env.HOME || '', '.local', 'bin', 'zisk-worker'),
    '/usr/local/bin/zisk-worker',
    '/usr/bin/zisk-worker',
  ];
  
  for (const binPath of commonPaths) {
    if (fs.existsSync(binPath)) {
      console.log('Found zisk-worker binary');
      return binPath;
    }
  }
  
  // 2. Check if binary is in PATH
  try {
    const whichResult = execSync('which zisk-worker', { 
      encoding: 'utf8', 
      stdio: ['ignore', 'pipe', 'ignore'],
      env: { ...process.env, PATH: process.env.PATH || '' }
    }).trim();
    if (whichResult && fs.existsSync(whichResult)) {
      console.log('Found zisk-worker in PATH');
      return whichResult;
    }
  } catch (e) {
    // which command failed, continue
    console.log('which command failed, trying other locations...');
  }
  
  // 3. Check repository build directories (if repo found)
  if (ZISK_REPO) {
    const workerBin = path.join(ZISK_REPO, 'target', 'release', 'zisk-worker');
    const workerBinDebug = path.join(ZISK_REPO, 'target', 'debug', 'zisk-worker');
    
    if (fs.existsSync(workerBin)) {
      console.log('Found zisk-worker in repo (release)');
      return workerBin;
    }
    if (fs.existsSync(workerBinDebug)) {
      console.log('Found zisk-worker in repo (debug)');
      return workerBinDebug;
    }
  }
  
  console.error('zisk-worker binary not found in any location');
  return null;
}

// Register/Start worker
app.post('/api/worker/start', async (req, res) => {
  try {
    const { workerId, elfPath, inputPath, provingKeyPath, computeCapacity } = req.body;

    if (!elfPath || !inputPath) {
      return res.status(400).json({ error: 'ELF path and input path are required' });
    }

    const binPath = findWorkerBinary();
    
    if (!binPath) {
      return res.status(500).json({ 
        error: 'zisk-worker binary not found. Please build it first: cargo build --release --bin zisk-worker\n' +
               'Or install it globally: cargo install --path distributed --bin zisk-worker'
      });
    }
    
    // Determine working directory (prefer repo, fallback to binary directory)
    const cwd = ZISK_REPO || path.dirname(binPath);

    // Validate paths
    if (!fs.existsSync(elfPath)) {
      return res.status(400).json({ error: `ELF file not found: ${elfPath}` });
    }

    // Worker expects --inputs-folder (directory), not --input-path (file)
    // Get the directory containing the input file
    const inputDir = path.dirname(inputPath);
    if (!fs.existsSync(inputDir)) {
      return res.status(400).json({ error: `Input directory not found: ${inputDir}` });
    }

    // Also validate the input file exists
    if (!fs.existsSync(inputPath)) {
      return res.status(400).json({ error: `Input file not found: ${inputPath}` });
    }

    const id = workerId || `worker-${Date.now()}`;

    // Build worker command
    // Note: worker expects --inputs-folder (directory), not --input-path (file)
    // gRPC requires http:// prefix for insecure connections
    const coordinatorUrl = COORDINATOR_URL.startsWith('http://') || COORDINATOR_URL.startsWith('https://') 
      ? COORDINATOR_URL 
      : `http://${COORDINATOR_URL}`;
    
    const args = [
      '--coordinator-url', coordinatorUrl,
      '--elf', elfPath,
      '--inputs-folder', inputDir, // Use directory, not file path
    ];

    // Add compute capacity if provided (defaults to 10 if not specified)
    if (computeCapacity) {
      const capacity = parseInt(computeCapacity, 10);
      if (isNaN(capacity) || capacity < 1) {
        return res.status(400).json({ error: 'Compute capacity must be a positive integer' });
      }
      args.push('--compute-capacity', String(capacity));
    } else {
      // Default to 10 if not specified
      args.push('--compute-capacity', '10');
    }

    if (provingKeyPath) {
      args.push('--proving-key', provingKeyPath);
    }

    const workerProcess = spawn(binPath, args, {
      cwd: cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
      env: { ...process.env, COORDINATOR_URL },
    });

    processes.workers.set(id, workerProcess);

    workerProcess.stdout.on('data', (data) => {
      console.log(`[Worker ${id}] ${data}`);
    });

    workerProcess.stderr.on('data', (data) => {
      if (DEBUG) console.error(`[Worker ${id} Error] ${data}`);
    });

    workerProcess.on('exit', (code) => {
      console.log(`Worker ${id} process exited with code ${code}`);
      processes.workers.delete(id);
    });

    // Wait a moment to see if it starts successfully
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (workerProcess.killed || workerProcess.exitCode !== null) {
      processes.workers.delete(id);
      return res.status(500).json({ error: 'Worker failed to start. Check logs.' });
    }

    res.json({ 
      success: true, 
      message: 'Worker started successfully',
      workerId: id,
      pid: workerProcess.pid 
    });
  } catch (error) {
    if (DEBUG) console.error('Failed to start worker:', error);
    res.status(500).json({ error: sanitizeError(error) });
  }
});

// Stop worker
app.post('/api/worker/stop/:workerId', (req, res) => {
  try {
    const { workerId } = req.params;
    const workerProcess = processes.workers.get(workerId);

    if (!workerProcess) {
      return res.status(404).json({ error: 'Worker not found' });
    }

    workerProcess.kill('SIGTERM');
    processes.workers.delete(workerId);

    res.json({ success: true, message: 'Worker stopped' });
  } catch (error) {
    if (DEBUG) console.error('Failed to stop worker:', error);
    res.status(500).json({ error: sanitizeError(error) });
  }
});

// Helper to check if a process by PID is still running
function isProcessRunning(pid, callback, timeoutMs = 3000) {
  const platform = process.platform;
  let command;
  
  if (platform === 'win32') {
    command = `tasklist /FI "PID eq ${pid}" /FO CSV`;
  } else {
    command = `ps -p ${pid} -o pid=`;
  }
  
  let callbackInvoked = false;
  let childProcess;
  
  const timeoutId = setTimeout(() => {
    if (!callbackInvoked) {
      callbackInvoked = true;
      if (childProcess) {
        try {
          childProcess.kill();
        } catch (e) {
          // Process may have already exited
        }
      }
      callback(false); // Timeout means process not found
    }
  }, timeoutMs);
  
  childProcess = exec(command, { timeout: timeoutMs - 500 }, (error, stdout, stderr) => {
    clearTimeout(timeoutId);
    if (callbackInvoked) return;
    callbackInvoked = true;
    
    if (error || !stdout || stdout.trim().length === 0) {
      callback(false);
      return;
    }
    
    // Process exists
    callback(true);
  });
  
  childProcess.on('error', (error) => {
    clearTimeout(timeoutId);
    if (!callbackInvoked) {
      callbackInvoked = true;
      callback(false);
    }
  });
}

// Get workers status (returns both workerId and PID for matching)
app.get('/api/worker/process-status', async (req, res) => {
  try {
    const cacheBuster = req.query._t || Date.now();
    
    // First check if coordinator is running - if not, clear all workers
    const coordinatorRunning = await new Promise((resolve) => {
      const managedCoordinator = processes.coordinator !== null && 
                                  !processes.coordinator.killed && 
                                  processes.coordinator.exitCode === null;
      
      if (managedCoordinator) {
        resolve(true);
        return;
      }
      
      // Check for external coordinator
      findCoordinatorProcess((pid) => {
        resolve(pid !== null);
      }, 2000);
    });
    
    if (!coordinatorRunning) {
      // Coordinator is not running - clear all workers as they won't be useful
      const clearedCount = processes.workers.size;
      if (clearedCount > 0) {
        if (DEBUG) console.log(`[Worker Status] Coordinator not running, clearing ${clearedCount} worker(s)`);
        processes.workers.clear();
      }
      return res.json({ 
        workers: [], 
        managedPids: [],
        coordinatorRunning: false,
        timestamp: Date.now()
      });
    }
    
    // Get managed workers
    const managedWorkers = Array.from(processes.workers.entries()).map(([id, proc]) => ({
      workerId: id,
      pid: proc.pid,
      proc: proc,
    }));
    
    // Check each managed worker's actual process status
    const workersWithStatus = await Promise.all(
      managedWorkers.map(async (worker) => {
        const procStatus = !worker.proc.killed && worker.proc.exitCode === null;
        
        return new Promise((resolve) => {
          if (!procStatus) {
            resolve({
              workerId: worker.workerId,
              running: false,
              pid: worker.pid,
            });
            return;
          }
          
          isProcessRunning(worker.pid, (isRunning) => {
            resolve({
              workerId: worker.workerId,
              running: isRunning && procStatus,
              pid: worker.pid,
            });
          }, 2000);
        });
      })
    );
    
    // Filter out workers that are no longer running
    const runningWorkers = workersWithStatus.filter(w => w.running);
    
    // Clean up dead workers from the processes map immediately
    workersWithStatus.forEach((worker) => {
      if (!worker.running) {
        const proc = processes.workers.get(worker.workerId);
        if (proc) {
          if (DEBUG) console.log(`[Worker Status] Removing dead worker ${worker.workerId} (PID: ${worker.pid})`);
          processes.workers.delete(worker.workerId);
        }
      }
    });
    
    res.json({ 
      workers: runningWorkers, 
      managedPids: runningWorkers.map(w => w.pid),
      coordinatorRunning: true,
      timestamp: Date.now()
    });
  } catch (error) {
    if (DEBUG) console.error('Worker process status error:', error);
    res.status(500).json({ error: sanitizeError(error) });
  }
});

// Start server
const server = app.listen(GATEWAY_PORT, () => {
  console.log(`\nREST-to-gRPC Gateway running on port ${GATEWAY_PORT}`);
  console.log('   Coordinating with coordinator service');
  if (ZISK_REPO) {
    console.log('   ZisK repository found. Process management enabled.\n');
  } else {
    console.log('   ZisK repository not found. Process management disabled.\n');
  }
  
  if (initGrpcClient()) {
    console.log('Ready to proxy requests!\n');
  } else {
    console.log('Gateway started but gRPC connection failed. Check coordinator URL.\n');
  }
});

process.on('SIGTERM', () => {
  console.log('Shutting down gateway...');
  
  if (grpcClient) {
    try {
      grpcClient.close();
      grpcClient = null;
    } catch (error) {
      if (DEBUG) console.error('Error closing gRPC client:', error);
    }
  }
  
  server.close(() => {
    console.log('Gateway stopped');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('Shutting down gateway...');
  
  if (grpcClient) {
    try {
      grpcClient.close();
      grpcClient = null;
    } catch (error) {
      if (DEBUG) console.error('Error closing gRPC client:', error);
    }
  }
  
  server.close(() => {
    console.log('Gateway stopped');
    process.exit(0);
  });
});

