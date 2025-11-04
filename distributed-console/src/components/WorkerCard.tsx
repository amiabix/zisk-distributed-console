import {
  WorkerData,
  getWorkerHealthStatus,
  formatTimeAgo,
} from '../types/models';

interface WorkerCardProps {
  worker: WorkerData;
  index: number;
}

export default function WorkerCard({ worker, index }: WorkerCardProps) {
  const healthStatus = getWorkerHealthStatus(worker);

  const healthIndicator = {
    ok: { symbol: '✓', color: 'text-green-400', label: 'OK' },
    stale: { symbol: '⚠', color: 'text-yellow-400', label: 'STALE' },
    disconnected: { symbol: '✗', color: 'text-red-400', label: 'DISCONNECTED' },
  }[healthStatus];

  const stateColor = {
    Idle: 'text-gray-800',
    Computing:
      healthStatus === 'ok'
        ? 'text-green-400'
        : healthStatus === 'stale'
          ? 'text-yellow-400'
          : 'text-red-400',
    Disconnected: 'text-red-400 opacity-60',
    Error: 'text-red-400',
  }[worker.state];

  return (
    <div className="mb-2 sm:mb-3 border border-gray-700 p-2 rounded transition-smooth hover:border-cyan-400/50">
      <div className="text-cyan-400 font-mono text-xs sm:text-sm mb-1 break-all">
        [Worker {index + 1}: {worker.worker_id}]
      </div>
      <div className="font-mono text-xs sm:text-sm space-y-1">
        <div className="flex flex-wrap gap-x-2 gap-y-1">
          <span>
            <span className="text-gray-800">Status: </span>
            <span className={stateColor}>{worker.state}</span>
          </span>
          <span className="hidden sm:inline">|</span>
          <span>
            <span className="text-gray-800">Capacity: </span>
            <span className="text-white">{worker.compute_capacity} units</span>
          </span>
        </div>
        <div className="flex flex-wrap gap-x-2 gap-y-1">
          <span>
            <span className="text-gray-800">Health: </span>
            <span className={healthIndicator.color}>
              {healthIndicator.symbol} {healthIndicator.label}
            </span>
          </span>
          <span className="hidden sm:inline">|</span>
          <span>
            <span className="text-gray-800">Heartbeat: </span>
            <span className="text-white">
              {formatTimeAgo(worker.last_heartbeat_unix_ms)}
            </span>
          </span>
          <span className="hidden md:inline">|</span>
          <span className="hidden md:inline">
            <span className="text-gray-800">Connected: </span>
            <span className="text-white">
              {formatTimeAgo(worker.connected_at_unix_ms)}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
