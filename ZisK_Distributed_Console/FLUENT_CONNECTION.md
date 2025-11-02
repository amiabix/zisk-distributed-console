# Fluent Dashboard Connection

The dashboard now provides a **seamless, automatic connection experience**. Simply start your coordinator and the dashboard will automatically discover and connect to it.

## ✨ Automatic Features

### 1. **Auto-Discovery**
- If no job ID is provided, the dashboard automatically discovers the most recent active job
- No manual configuration needed - just start the coordinator!

### 2. **Auto-Retry**
- Automatic connection retry with exponential backoff
- Graceful handling of coordinator startup delays
- Seamless reconnection if coordinator restarts

### 3. **URL Parameters**
You can customize via URL parameters:
```
http://localhost:5173/?coordinator=http://localhost:8080&job=job-123
```

### 4. **Environment Variables**
Or use environment variables (for development):
```bash
VITE_COORDINATOR_URL=http://localhost:8080
VITE_JOB_ID=job-123  # Optional - will auto-discover if not set
VITE_USE_MOCK_DATA=false
```

## 🚀 Usage

### Simplest Flow (Zero Configuration)

1. **Start Coordinator:**
```bash
cargo run --release --bin zisk-coordinator
```

2. **Start Gateway (in another terminal):**
```bash
node gateway-server.js
```

3. **Launch a Proof:**
```bash
cargo run --release --bin zisk-coordinator prove --input data.bin --compute-capacity 10
```

4. **Open Dashboard:**
```bash
npm run dev
# Opens http://localhost:5173
```

**That's it!** The dashboard will:
- ✅ Auto-detect the coordinator
- ✅ Auto-discover the active job
- ✅ Start monitoring immediately

## 🔄 Connection Flow

```
Dashboard Start
    ↓
Check Health (/health)
    ↓
Auto-Discover Jobs (/api/jobs?active_only=true)
    ↓
Select Most Recent Job
    ↓
Start Polling (1 second intervals)
    ↓
Display Real-time Data
```

## 📊 What Gets Auto-Discovered

- **Active Jobs**: Automatically finds running proof generation jobs
- **Workers**: Automatically lists all connected workers
- **System Status**: Automatically fetches system metrics

## 🎯 Smart Behavior

- **No Job ID**: Auto-discovers and connects to the most recent job
- **Job ID Provided**: Uses that specific job (if it exists)
- **Job Not Found**: Falls back to auto-discovery
- **Coordinator Down**: Retries with exponential backoff, shows connection status

## 💡 Tips

- The dashboard works best with the gateway server running
- If coordinator is slow to start, dashboard will wait and retry
- URL parameters override environment variables
- Job ID is optional - dashboard is smart enough to find active jobs


