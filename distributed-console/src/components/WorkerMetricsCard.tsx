import { useMemo } from 'react';
import { WorkerData, WorkerMetrics, ProofPhase, getPhaseName } from '../types/models';
import { formatTimeAgo, getWorkerHealthStatus } from '../types/models';
import { Activity, Cpu, HardDrive, Network } from 'lucide-react';

interface WorkerMetricsCardProps {
  worker: WorkerData;
  history: Array<{ timestamp: number; workers: WorkerData[] }>;
  index: number;
  onClick?: () => void;
  isManaged?: boolean;
}

export default function WorkerMetricsCard({ worker, history, index, onClick, isManaged = false }: WorkerMetricsCardProps) {
  const healthStatus = getWorkerHealthStatus(worker);

  const metricsData = useMemo(() => {
    const cpuData: Array<{ time: string; value: number; timestamp: number }> = [];
    const memoryData: Array<{ time: string; value: number; timestamp: number }> = [];
    const networkData: Array<{ time: string; value: number; timestamp: number }> = [];

    history.forEach((snapshot) => {
      const workerSnapshot = snapshot.workers.find((w) => w.worker_id === worker.worker_id);
      if (workerSnapshot?.metrics) {
        const date = new Date(snapshot.timestamp);
        const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        const metrics = workerSnapshot.metrics;

        cpuData.push({ time, value: metrics.cpu_percent, timestamp: snapshot.timestamp });
        memoryData.push({ time, value: metrics.memory_used_gb, timestamp: snapshot.timestamp });
        networkData.push({ time, value: metrics.network_in_mbps + metrics.network_out_mbps, timestamp: snapshot.timestamp });
      }
    });

    return { cpuData, memoryData, networkData };
  }, [history, worker.worker_id]);

  const currentMetrics: WorkerMetrics | null = worker.metrics || null;

  const healthIndicator = {
    ok: { color: 'text-green-700', bgColor: 'bg-green-100', borderColor: 'border-green-200', label: 'Healthy' },
    stale: { color: 'text-yellow-700', bgColor: 'bg-yellow-100', borderColor: 'border-yellow-200', label: 'Stale' },
    disconnected: { color: 'text-[#6b6560]', bgColor: 'bg-[#f5f3f0]', borderColor: 'border-[#e8e4e0]', label: 'Disconnected' },
  }[healthStatus];

  const stateColor = {
    Idle: 'bg-[#f5f3f0] text-[#6b6560] border-[#e8e4e0]',
    Computing: 'bg-green-50 text-green-700 border-green-200',
    Disconnected: 'bg-[#f5f3f0] text-[#6b6560] border-[#e8e4e0]',
    Error: 'bg-red-50 text-red-700 border-red-200',
  }[worker.state];

  return (
    <div
      className={`glass ${onClick ? 'cursor-pointer card-hover' : ''}`}
      onClick={onClick}
    >
      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-[#e8e4e0]">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl bg-primary-500 flex items-center justify-center ${
              isManaged ? 'ring-2 ring-primary-300' : ''
            }`}>
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-[#2d2926]">
                  Worker {index}
                </h3>
                {!isManaged && (
                  <span className="text-xs px-2 py-0.5 rounded-lg bg-[#f5f3f0] text-[#6b6560] border border-[#e8e4e0] font-medium">
                    External
                  </span>
                )}
              </div>
              <p className="text-xs font-mono text-[#6b6560] truncate max-w-[200px] mt-0.5">
                {worker.worker_id.substring(0, 16)}...
              </p>
            </div>
          </div>
          <div className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${healthIndicator.bgColor} ${healthIndicator.color} ${healthIndicator.borderColor}`}>
            {healthIndicator.label}
          </div>
        </div>

        {/* Status Badges */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className={`px-3 py-2.5 border rounded-lg ${stateColor}`}>
            <div className="text-xs text-[#6b6560] font-medium mb-1">Status</div>
            <div className="text-sm font-semibold text-[#2d2926]">
              {worker.state}
              {worker.current_job_id && (
                <div className="text-xs text-[#6b6560] mt-1 font-mono">
                  Job: {worker.current_job_id.substring(0, 8)}...
                </div>
              )}
            </div>
          </div>
          <div className="bg-[#f5f3f0] px-3 py-2.5 border border-[#e8e4e0] rounded-lg">
            <div className="text-xs text-[#6b6560] font-medium mb-1">Capacity</div>
            <div className="text-sm font-semibold text-[#2d2926]">
              {worker.compute_capacity} CU
              {worker.assigned_compute_units && worker.assigned_compute_units !== worker.compute_capacity && (
                <span className="text-xs text-[#6b6560] ml-1">
                  ({worker.assigned_compute_units} assigned)
                </span>
              )}
            </div>
          </div>
        </div>
        
        {/* Phase Display */}
        {worker.current_phase && (
          <div className={`mb-4 px-4 py-3 border rounded-lg ${
            worker.current_phase === ProofPhase.Contribution 
              ? 'bg-blue-50 border-blue-200' 
              : worker.current_phase === ProofPhase.Prove 
              ? 'bg-purple-50 border-purple-200' 
              : 'bg-green-50 border-green-200'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-[#6b6560] font-medium mb-1">Computing Phase</div>
                <div className="text-base font-bold text-[#2d2926]">
                  {getPhaseName(worker.current_phase)}
                </div>
              </div>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                worker.current_phase === ProofPhase.Contribution 
                  ? 'bg-blue-500' 
                  : worker.current_phase === ProofPhase.Prove 
                  ? 'bg-purple-500' 
                  : 'bg-primary-500'
              }`}>
                <Activity className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
        )}
        
        {/* Utilization Indicator */}
        {worker.state === 'Computing' && (
          <div className="mb-4 px-4 py-2.5 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-[#6b6560] font-medium">Utilization</div>
              <div className="text-sm font-bold text-green-700">100%</div>
            </div>
            <div className="relative h-2 bg-[#e8e4e0] rounded-lg overflow-hidden">
              <div className="h-full bg-primary-500" style={{ width: '100%' }} />
            </div>
            <div className="text-xs text-[#6b6560] mt-1">
              Worker is actively computing {worker.current_phase ? getPhaseName(worker.current_phase) : 'task'}
            </div>
          </div>
        )}
        
        {worker.state === 'Idle' && (
          <div className="mb-4 px-4 py-2.5 bg-[#f5f3f0] border border-[#e8e4e0] rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-[#6b6560] font-medium">Utilization</div>
              <div className="text-sm font-bold text-[#6b6560]">0%</div>
            </div>
            <div className="relative h-2 bg-[#e8e4e0] rounded-lg overflow-hidden">
              <div className="h-full bg-[#d4c5b8]" style={{ width: '0%' }} />
            </div>
            <div className="text-xs text-[#6b6560] mt-1">
              Worker is idle and available for tasks
            </div>
          </div>
        )}

        {/* Connection Info */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="px-3 py-2 bg-[#f5f3f0] border border-[#e8e4e0] rounded-lg">
            <div className="text-xs text-[#6b6560] font-medium mb-1">Heartbeat</div>
            <div className="text-sm font-semibold text-[#2d2926]">
              {formatTimeAgo(worker.last_heartbeat_unix_ms)}
            </div>
          </div>
          <div className="px-3 py-2 bg-[#f5f3f0] border border-[#e8e4e0] rounded-lg">
            <div className="text-xs text-[#6b6560] font-medium mb-1">Connected</div>
            <div className="text-sm font-semibold text-[#2d2926]">
              {formatTimeAgo(worker.connected_at_unix_ms)}
            </div>
          </div>
        </div>

        {/* Metrics */}
        {currentMetrics && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="px-3 py-2 bg-[#f5f3f0] border border-[#e8e4e0] rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Cpu className="w-3 h-3 text-[#6b6560]" />
                  <div className="text-xs text-[#6b6560] font-medium">CPU</div>
                </div>
                <div className="text-sm font-semibold text-[#2d2926]">
                  {currentMetrics.cpu_percent.toFixed(1)}%
                </div>
              </div>
              <div className="px-3 py-2 bg-[#f5f3f0] border border-[#e8e4e0] rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <HardDrive className="w-3 h-3 text-[#6b6560]" />
                  <div className="text-xs text-[#6b6560] font-medium">Memory</div>
                </div>
                <div className="text-sm font-semibold text-[#2d2926]">
                  {currentMetrics.memory_used_gb.toFixed(1)} GB
                </div>
              </div>
              <div className="px-3 py-2 bg-[#f5f3f0] border border-[#e8e4e0] rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Network className="w-3 h-3 text-[#6b6560]" />
                  <div className="text-xs text-[#6b6560] font-medium">Network</div>
                </div>
                <div className="text-sm font-semibold text-[#2d2926]">
                  {(currentMetrics.network_in_mbps + currentMetrics.network_out_mbps).toFixed(1)} Mbps
                </div>
              </div>
            </div>
          </div>
        )}

        {!currentMetrics && (
          <div className="text-center py-4 text-sm text-[#6b6560]">
            Metrics not available
          </div>
        )}
      </div>
    </div>
  );
}
