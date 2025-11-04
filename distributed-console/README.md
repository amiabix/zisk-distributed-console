# ZisK Distributed Proving Dashboard

A professional real-time monitoring dashboard for ZisK's distributed proof generation system, built with React, TypeScript, and Tailwind CSS.

## Features

- **Real-time Monitoring**: Live updates every second
- **Worker Performance Metrics**: CPU, memory, network graphs per worker
- **Proof Generation Timeline**: Visual progress tracking across all phases
- **System-wide Metrics**: Capacity utilization, active jobs, worker status
- **Professional UI**: AWS CloudWatch-style interface with white theme

## Quick Start

### Development Mode (Mock Data)

```bash
npm install
npm run dev
```

The dashboard will run on `http://localhost:5173` with mock data.

### Production Mode (Real Coordinator)

**IMPORTANT**: The coordinator only exposes **gRPC endpoints**, not REST. You need a REST-to-gRPC gateway.

#### Option 1: Use the Gateway Server

1. Install gateway dependencies:
```bash
cd /path/to/project
npm install grpc @grpc/grpc-js @grpc/proto-loader express cors
```

2. Start the gateway:
```bash
export COORDINATOR_URL=localhost:50051
export GATEWAY_PORT=8080
node gateway-server.cjs
```

3. Start the dashboard:
```bash
# The dashboard now defaults to connecting to the gateway at http://localhost:8080
# Job ID is optional - dashboard will auto-discover if not provided
npm run dev
```

Or explicitly set environment variables:
```bash
export VITE_COORDINATOR_URL=http://localhost:8080
export VITE_USE_MOCK_DATA=false  # This is now the default
export VITE_JOB_ID=your-job-id   # Optional - dashboard auto-discovers if omitted
npm run dev
```

#### Option 2: Run with Mock Data

```bash
export VITE_USE_MOCK_DATA=true
npm run dev
```

## Environment Variables

- `VITE_COORDINATOR_URL`: Gateway or coordinator URL (default: `http://localhost:8080`)
- `VITE_JOB_ID`: Job ID to monitor (optional - dashboard auto-discovers if omitted)
- `VITE_USE_MOCK_DATA`: Use mock data instead of real coordinator (default: `false` - uses real coordinator)

## API Endpoints (via Gateway)

The gateway exposes these REST endpoints:

- `GET /api/job/{jobId}` - Get job status
- `GET /api/workers` - List all workers
- `GET /api/system/status` - Get system status
- `GET /api/jobs` - List all jobs

## Architecture

```
Frontend (React) 
    ↓ HTTP REST
Gateway Server (Express)
    ↓ gRPC
Coordinator (Rust)
```

## Keyboard Shortcuts

- `q` - Quit dashboard
- `p` - Pause polling
- `r` - Resume polling
- `↑/↓` - Scroll worker list
- `c` - Clear error message
- `?` - Show help
- `Esc` - Close help overlay

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Type checking
npm run typecheck

# Linting
npm run lint

# Build for production
npm run build
```

## Troubleshooting

### "Failed to fetch" or connection errors

1. **Check if gateway is running**: `curl http://localhost:8080/health`
2. **Verify coordinator URL**: Ensure coordinator is running on the specified port
3. **Check CORS**: Gateway includes CORS headers by default
4. **Use mock data**: Set `VITE_USE_MOCK_DATA=true` to test UI without coordinator

### No data showing

- Verify job ID exists: Check coordinator logs or use `JobsList` gRPC call
- Check browser console for API errors
- Verify gateway can connect to coordinator (check gateway logs)

## Notes

- The coordinator requires a REST-to-gRPC gateway for the frontend to work
- Mock data is provided for development and demos
- All timestamps are converted from protobuf format to ISO strings
- The dashboard gracefully handles missing data and connection failures

