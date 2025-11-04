import { useState, useEffect } from 'react';
import { Plus, PowerOff, RefreshCw, AlertCircle, FileText, FolderOpen, X } from 'lucide-react';

interface WorkerManagementProps {
  gatewayUrl: string;
}

interface WorkerProcess {
  workerId: string;
  running: boolean;
  pid: number | null;
}

export default function WorkerManagement({ gatewayUrl }: WorkerManagementProps) {
  const [workers, setWorkers] = useState<WorkerProcess[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddWorker, setShowAddWorker] = useState(false);
  const [elfPath, setElfPath] = useState('');
  const [inputPath, setInputPath] = useState('');
  const [provingKeyPath, setProvingKeyPath] = useState('');
  const [computeCapacity, setComputeCapacity] = useState('10');

  const fetchWorkers = async () => {
    try {
      setLoading(true);
      const cacheBuster = `_t=${Date.now()}`;
      const separator = gatewayUrl.includes('?') ? '&' : '?';
      const response = await fetch(`${gatewayUrl}/api/worker/process-status${separator}${cacheBuster}`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      });
      if (response.ok) {
        const data = await response.json();
        const freshWorkers = data.workers || [];
        setWorkers(freshWorkers);
        setError(null);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        setError(errorData.error || 'Failed to fetch workers');
      }
    } catch (err) {
      console.error('Failed to fetch workers status:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch workers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkers();
    const interval = setInterval(fetchWorkers, 2000);
    return () => clearInterval(interval);
  }, [gatewayUrl]);

  const handleAddWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!elfPath || !inputPath) {
      setError('ELF path and input path are required');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${gatewayUrl}/api/worker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          elfPath,
          inputPath,
          provingKeyPath: provingKeyPath || undefined,
          computeCapacity: computeCapacity ? parseInt(computeCapacity, 10) : undefined,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setElfPath('');
        setInputPath('');
        setProvingKeyPath('');
        setComputeCapacity('10');
        setShowAddWorker(false);
        setTimeout(fetchWorkers, 1000);
      } else {
        setError(data.error || 'Failed to start worker');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start worker');
    } finally {
      setLoading(false);
    }
  };

  const handleStopWorker = async (workerId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${gatewayUrl}/api/worker/stop/${workerId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        setTimeout(fetchWorkers, 500);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to stop worker');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop worker');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-500 flex items-center justify-center">
            <Plus className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[#2d2926]">Worker Management</h3>
            <p className="text-xs text-[#6b6560] font-medium">
              {workers.length} worker{workers.length !== 1 ? 's' : ''} registered
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchWorkers}
            disabled={loading}
            className="w-9 h-9 rounded-xl border border-[#e8e4e0] bg-white hover:bg-[#f5f3f0] flex items-center justify-center transition-colors"
          >
            <RefreshCw className={`w-4 h-4 text-[#6b6560] ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowAddWorker(!showAddWorker)}
            className="px-4 py-2 bg-primary-500 text-white rounded-xl border border-primary-600 hover:bg-primary-600 font-medium text-sm transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Worker
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-red-700 font-medium">{error}</div>
        </div>
      )}

      {showAddWorker && (
        <form onSubmit={handleAddWorker} className="bg-[#f5f3f0] border border-[#e8e4e0] rounded-xl p-4 mb-4 space-y-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-[#2d2926]">Register New Worker</h4>
            <button
              type="button"
              onClick={() => setShowAddWorker(false)}
              className="w-6 h-6 rounded-lg border border-[#e8e4e0] bg-white hover:bg-[#f5f3f0] flex items-center justify-center"
            >
              <X className="w-4 h-4 text-[#6b6560]" />
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#2d2926] mb-1.5 flex items-center gap-2">
              <FileText className="w-3 h-3" />
              ELF File Path <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={elfPath}
              onChange={(e) => setElfPath(e.target.value)}
              required
              className="w-full px-3 py-2 bg-white border border-[#e8e4e0] rounded-xl text-xs text-[#2d2926] placeholder-[#9c9488] focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono"
              placeholder="/path/to/program.elf"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#2d2926] mb-1.5 flex items-center gap-2">
              <FolderOpen className="w-3 h-3" />
              Input File Path <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={inputPath}
              onChange={(e) => setInputPath(e.target.value)}
              required
              className="w-full px-3 py-2 bg-white border border-[#e8e4e0] rounded-xl text-xs text-[#2d2926] placeholder-[#9c9488] focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono"
              placeholder="/path/to/input.bin"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#2d2926] mb-1.5">
              Proving Key Path (Optional)
            </label>
            <input
              type="text"
              value={provingKeyPath}
              onChange={(e) => setProvingKeyPath(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-[#e8e4e0] rounded-xl text-xs text-[#2d2926] placeholder-[#9c9488] focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono"
              placeholder="~/.zisk/provingKey"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#2d2926] mb-1.5">
              Compute Capacity (CU) <span className="text-red-600">*</span>
            </label>
            <input
              type="number"
              value={computeCapacity}
              onChange={(e) => setComputeCapacity(e.target.value)}
              required
              min="1"
              max="1000"
              className="w-full px-3 py-2 bg-white border border-[#e8e4e0] rounded-xl text-xs text-[#2d2926] placeholder-[#9c9488] focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="10"
            />
            <p className="text-xs text-[#6b6560] mt-1 ml-1">Number of compute units this worker can handle (default: 10)</p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 bg-primary-500 text-white rounded-xl border border-primary-600 hover:bg-primary-600 font-medium text-sm transition-colors disabled:opacity-50"
          >
            {loading ? 'Starting...' : 'Start Worker'}
          </button>
        </form>
      )}

      <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
        {workers.length === 0 ? (
          <div className="text-center py-6 text-[#6b6560] text-sm font-medium">
            No workers registered
          </div>
        ) : (
          workers.map((worker) => (
            <div
              key={worker.workerId}
              className="bg-white border border-[#e8e4e0] rounded-xl p-3 flex items-center justify-between"
            >
              <div className="flex-1 min-w-0">
                <div className="text-xs font-mono font-semibold text-[#2d2926] truncate">
                  {worker.workerId}
                </div>
                <div className="text-xs text-[#6b6560] mt-0.5">
                  {worker.running ? `Running (PID: ${worker.pid})` : 'Stopped'}
                </div>
              </div>
              <button
                onClick={() => handleStopWorker(worker.workerId)}
                disabled={loading || !worker.running}
                className="px-3 py-1.5 bg-white text-red-600 rounded-xl border border-red-300 hover:bg-red-50 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <PowerOff className="w-3 h-3" />
                Stop
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

