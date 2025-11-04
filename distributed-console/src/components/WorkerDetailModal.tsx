import { WorkerData, getPhaseName, formatDuration, formatTimeAgo, getWorkerHealthStatus, ProofPhase } from '../types/models';
import { X, Activity, Cpu, HardDrive, Network, Clock } from 'lucide-react';

interface WorkerDetailModalProps {
  worker: WorkerData;
  history: Array<{ timestamp: number; workers: WorkerData[] }>;
  isOpen: boolean;
  onClose: () => void;
}

export default function WorkerDetailModal({
  worker,
  history,
  isOpen,
  onClose,
}: WorkerDetailModalProps) {
  if (!isOpen) return null;

  const healthStatus = getWorkerHealthStatus(worker);
  const healthIndicator = {
    ok: { color: 'text-green-700', bgColor: 'bg-green-100', borderColor: 'border-green-200', label: 'Healthy' },
    stale: { color: 'text-yellow-700', bgColor: 'bg-yellow-100', borderColor: 'border-yellow-200', label: 'Stale' },
    disconnected: { color: 'text-[#6b6560]', bgColor: 'bg-[#f5f3f0]', borderColor: 'border-[#e8e4e0]', label: 'Disconnected' },
  }[healthStatus];

  const uptime = Date.now() - worker.connected_at_unix_ms;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="glass rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-[#e8e4e0] px-6 py-5 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary-500 flex items-center justify-center">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-[#2d2926]">Worker Details</h2>
              <p className="text-xs font-mono text-[#6b6560] mt-0.5">{worker.worker_id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl border border-[#e8e4e0] bg-white hover:bg-[#f5f3f0] flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5 text-[#6b6560]" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Status Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#f5f3f0] border border-[#e8e4e0] rounded-xl p-3">
              <div className="text-xs text-[#6b6560] font-medium mb-1">Status</div>
              <div className={`text-sm font-semibold ${healthIndicator.color}`}>
                {healthIndicator.label}
              </div>
            </div>
            <div className="bg-[#f5f3f0] border border-[#e8e4e0] rounded-xl p-3">
              <div className="text-xs text-[#6b6560] font-medium mb-1">State</div>
              <div className="text-sm font-semibold text-[#2d2926]">{worker.state}</div>
            </div>
            <div className="bg-[#f5f3f0] border border-[#e8e4e0] rounded-xl p-3">
              <div className="text-xs text-[#6b6560] font-medium mb-1">Capacity</div>
              <div className="text-sm font-semibold text-[#2d2926]">{worker.compute_capacity} CU</div>
            </div>
            <div className="bg-[#f5f3f0] border border-[#e8e4e0] rounded-xl p-3">
              <div className="text-xs text-[#6b6560] font-medium mb-1">Uptime</div>
              <div className="text-sm font-semibold text-[#2d2926]">{formatDuration(uptime)}</div>
            </div>
          </div>

          {/* Current Job Info */}
          {(worker.current_job_id || worker.current_phase !== undefined) && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4 text-green-600" />
                <span className="text-sm font-semibold text-[#2d2926]">Current Task</span>
              </div>
              <div className="space-y-2">
                {worker.current_job_id && (
                  <div>
                    <span className="text-xs text-[#6b6560]">Job ID: </span>
                    <span className="text-xs font-mono font-semibold text-[#2d2926]">
                      {worker.current_job_id.substring(0, 16)}...
                    </span>
                  </div>
                )}
                {worker.current_phase !== undefined && (
                  <div>
                    <span className="text-xs text-[#6b6560]">Phase: </span>
                    <span className="text-xs font-semibold text-green-700">
                      {getPhaseName(worker.current_phase)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Metrics */}
          {worker.metrics && (
            <div className="space-y-4">
              <div className="text-sm font-semibold text-[#2d2926] mb-3">System Metrics</div>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-[#f5f3f0] border border-[#e8e4e0] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Cpu className="w-4 h-4 text-[#6b6560]" />
                    <div className="text-xs text-[#6b6560] font-medium">CPU</div>
                  </div>
                  <div className="text-xl font-semibold text-[#2d2926]">
                    {worker.metrics.cpu_percent.toFixed(1)}%
                  </div>
                </div>
                <div className="bg-[#f5f3f0] border border-[#e8e4e0] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <HardDrive className="w-4 h-4 text-[#6b6560]" />
                    <div className="text-xs text-[#6b6560] font-medium">Memory</div>
                  </div>
                  <div className="text-xl font-semibold text-[#2d2926]">
                    {worker.metrics.memory_used_gb.toFixed(1)} GB
                  </div>
                </div>
                <div className="bg-[#f5f3f0] border border-[#e8e4e0] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Network className="w-4 h-4 text-[#6b6560]" />
                    <div className="text-xs text-[#6b6560] font-medium">Network</div>
                  </div>
                  <div className="text-xl font-semibold text-[#2d2926]">
                    {(worker.metrics.network_in_mbps + worker.metrics.network_out_mbps).toFixed(1)} Mbps
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Connection Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#f5f3f0] border border-[#e8e4e0] rounded-xl p-4">
              <div className="text-xs text-[#6b6560] font-medium mb-1">Heartbeat</div>
              <div className="text-sm font-semibold text-[#2d2926]">
                {formatTimeAgo(worker.last_heartbeat_unix_ms)}
              </div>
            </div>
            <div className="bg-[#f5f3f0] border border-[#e8e4e0] rounded-xl p-4">
              <div className="text-xs text-[#6b6560] font-medium mb-1">Connected</div>
              <div className="text-sm font-semibold text-[#2d2926]">
                {formatTimeAgo(worker.connected_at_unix_ms)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
