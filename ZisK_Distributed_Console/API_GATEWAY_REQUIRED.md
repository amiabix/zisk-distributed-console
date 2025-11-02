# REST API Gateway Required

## Important Notice

**The ZisK coordinator only exposes gRPC endpoints, not REST/HTTP endpoints.**

The frontend dashboard is currently configured to call REST endpoints like:
- `GET /api/job/{job_id}`
- `GET /api/workers`
- `GET /api/system/status`

However, the coordinator only provides gRPC endpoints:
- `JobStatus(JobStatusRequest)`
- `WorkersList(WorkersListRequest)`
- `SystemStatus(SystemStatusRequest)`

## Solutions

### Option 1: Use Mock Data (Current Default)

The dashboard defaults to mock data when `VITE_USE_MOCK_DATA=true`. This works for development and demos but won't connect to a real coordinator.

### Option 2: Create a REST-to-gRPC Gateway

You need to run a proxy server that translates REST requests to gRPC calls. Here's a simple Node.js example:

```javascript
// gateway-server.js
const express = require('express');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const app = express();
app.use(express.json());

// Load gRPC client
const packageDefinition = protoLoader.loadSync('path/to/zisk_distributed_api.proto');
const proto = grpc.loadPackageDefinition(packageDefinition);
const client = new proto.zisk.distributed.api.v1.ZiskDistributedApi(
  'localhost:50051',
  grpc.credentials.createInsecure()
);

// REST endpoints
app.get('/api/job/:jobId', (req, res) => {
  client.JobStatus({ job_id: req.params.jobId }, (error, response) => {
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.json(response.job || response);
  });
});

app.get('/api/workers', (req, res) => {
  client.WorkersList({ available_only: false }, (error, response) => {
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.json(response.workers_list || { workers: [] });
  });
});

app.get('/api/system/status', (req, res) => {
  client.SystemStatus({}, (error, response) => {
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.json(response.status || response);
  });
});

app.listen(8080, () => {
  console.log('REST Gateway running on http://localhost:8080');
});
```

Then update your frontend to point to the gateway:
```bash
VITE_COORDINATOR_URL=http://localhost:8080
```

### Option 3: Use gRPC-Web in Frontend

Update the frontend to use gRPC-Web client library to call gRPC endpoints directly from the browser. This requires:
- gRPC-Web proxy server (Envoy or similar)
- @improbable-eng/grpc-web or similar library

### Option 4: Extend Coordinator with REST Support

Add REST endpoints directly to the coordinator using a web framework like `actix-web` or `axum` alongside the gRPC server.

## Current Status

The frontend client (`coordinatorClient.ts`) has been updated to:
1. ✅ Handle both direct JSON and wrapped gRPC response formats
2. ✅ Parse protobuf Timestamp format (`{seconds, nanos}`)
3. ✅ Handle nested response structures (`result.job`, `result.workers_list`, etc.)
4. ✅ Include clear documentation about the gRPC requirement

The client will work correctly once a REST gateway is deployed between the frontend and coordinator.


