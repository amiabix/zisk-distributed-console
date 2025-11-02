import { useMemo } from 'react';
import { WorkerData, WorkerMetrics, ProofPhase, getPhaseName } from '../types/models';
import MetricsGraph from './MetricsGraph';
import { formatTimeAgo, getWorkerHealthStatus } from '../types/models';
import { Activity, Cpu, HardDrive, Network } from 'lucide-react';

interface WorkerMetricsCardProps {
  worker: WorkerData;
  history: Array<{ timestamp: number; workers: WorkerData[] }>;
  index: number;
}

export default function WorkerMetricsCard({ worker, history, index }: WorkerMetricsCardProps) {
  const healthStatus = getWorkerHealthStatus(worker);

  // Generate mock metrics data from history
  const metricsData = useMemo(() => {
    const cpuData: Array<{ time: string; value: number; timestamp: number }> = [];
    const memoryData: Array<{ time: string; value: number; timestamp: number }> = [];
    const networkData: Array<{ time: string; value: number; timestamp: number }> = [];

    history.forEach((snapshot) => {
      const workerSnapshot = snapshot.workers.find((w) => w.worker_id === worker.worker_id);
      if (workerSnapshot?.metrics) {
        const time = new Date(snapshot.timestamp).toLocaleTimeString();
        const metrics = workerSnapshot.metrics;

        cpuData.push({
          time,
          value: metrics.cpu_percent,
          timestamp: snapshot.timestamp,
        });

        memoryData.push({
          time,
          value: metrics.memory_used_gb,
          timestamp: snapshot.timestamp,
        });

        networkData.push({
          time,
          value: metrics.network_in_mbps + metrics.network_out_mbps,
          timestamp: snapshot.timestamp,
        });
      }
    });

    return { cpuData, memoryData, networkData };
  }, [history, worker.worker_id]);

  // Use actual metrics from worker (no mock data)
  const currentMetrics: WorkerMetrics | null = worker.metrics || null;

  const healthIndicator = {
    ok: { color: 'text-primary', bgColor: 'bg-primary-light/30', label: 'Healthy' },
    stale: { color: 'text-gray-900', bgColor: 'bg-neutral-light', label: 'Stale' },
    disconnected: { color: 'text-gray-800', bgColor: 'bg-neutral-light', label: 'Disconnected' },
  }[healthStatus];

  const stateColor = {
    Idle: 'text-gray-800 bg-neutral-light border-neutral',
    Computing: 'text-gray-800 bg-primary-light/30 border-primary/30',
    Disconnected: 'text-gray-900 bg-neutral-light border-neutral',
    Error: 'text-gray-900 bg-neutral-light border-neutral',
  }[worker.state];

  const phaseColor = {
    [ProofPhase.Contribution]: 'text-primary',
    [ProofPhase.Prove]: 'text-primary',
    [ProofPhase.Aggregation]: 'text-primary',
  }[worker.current_phase || ProofPhase.Prove];

  return (
      <div className="bg-white border border-neutral rounded-4xl shadow-sm">
      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-4xl bg-primary flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">
                Worker {index}
              </h3>
              <p className="text-xs font-mono text-gray-900 truncate max-w-[200px] mt-0.5">
                {worker.worker_id}
              </p>
            </div>
          </div>
          <div className={`px-2.5 py-1 rounded-3xl text-xs font-medium ${healthIndicator.bgColor} ${healthIndicator.color} border border-primary/30`}>
            {healthIndicator.label}
          </div>
        </div>

        {/* Status Badges */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className={`px-3 py-2.5 border rounded-3xl ${stateColor}`}>
            <div className="text-xs text-gray-900 font-medium mb-1">Status</div>
            <div className="text-sm font-semibold">
              {worker.state}
              {worker.current_job_id && (
                <div className="text-xs text-gray-900 mt-1">
                  Job: {worker.current_job_id.substring(0, 8)}...
                </div>
              )}
            </div>
          </div>
          <div className="px-3 py-2.5 border border-neutral rounded-3xl bg-neutral-light">
            <div className="text-xs text-gray-900 font-medium mb-1">Capacity</div>
            <div className="text-sm font-semibold text-gray-900">
              {worker.compute_capacity} CU
              {worker.assigned_compute_units && worker.assigned_compute_units !== worker.compute_capacity && (
                <span className="text-xs text-gray-900 ml-1">
                  ({worker.assigned_compute_units} assigned)
                </span>
              )}
            </div>
          </div>
        </div>
        
        {worker.current_phase && (
          <div className="mb-4 px-3 py-2.5 border border-gray-300 bg-gray-100 rounded-3xl">
            <div className="text-xs text-gray-800 font-medium mb-1">Current Phase</div>
            <div className={`text-sm font-semibold ${phaseColor}`}>
              {getPhaseName(worker.current_phase)}
            </div>
          </div>
        )}

        {/* Connection Info */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="px-3 py-2 border border-gray-200 rounded-3xl bg-gray-50">
            <div className="text-xs text-gray-900 font-medium mb-1">Heartbeat</div>
            <div className="text-sm font-semibold text-gray-900">
              {formatTimeAgo(worker.last_heartbeat_unix_ms)}
            </div>
          </div>
          <div className="px-3 py-2 border border-gray-200 rounded-3xl bg-gray-50">
            <div className="text-xs text-gray-900 font-medium mb-1">Connected</div>
            <div className="text-sm font-semibold text-gray-900">
              {formatTimeAgo(worker.connected_at_unix_ms)}
            </div>
          </div>
        </div>

        {/* Current Metrics */}
        {currentMetrics ? (
          <>
            <div className="grid grid-cols-4 gap-3 mb-4">
              <div className="border border-neutral rounded-3xl p-3 bg-neutral-light">
                <div className="flex items-center gap-2 mb-2">
                <div className="w-5 h-5 rounded-3xl bg-primary-light/30 flex items-center justify-center">
                  <Cpu className="w-3 h-3 text-primary" />
                </div>
                <span className="text-xs text-gray-900 font-medium">CPU</span>
                </div>
                <div className="text-lg font-semibold text-gray-900">
                  {currentMetrics.cpu_percent.toFixed(0)}%
                </div>
              </div>
              <div className="border border-neutral rounded-3xl p-3 bg-neutral-light">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 rounded-3xl bg-gray-100 flex items-center justify-center">
                    <HardDrive className="w-3 h-3 text-primary" />
                  </div>
                  <span className="text-xs text-gray-900 font-medium">Memory</span>
                </div>
                <div className="text-lg font-semibold text-gray-900">
                  {currentMetrics.memory_used_gb.toFixed(1)}GB
                </div>
              </div>
              <div className="border border-neutral rounded-3xl p-3 bg-neutral-light">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 rounded-3xl bg-gray-100 flex items-center justify-center">
                    <Network className="w-3 h-3 text-primary" />
                  </div>
                  <span className="text-xs text-gray-900 font-medium">Network</span>
                </div>
                <div className="text-lg font-semibold text-gray-900">
                  {(currentMetrics.network_in_mbps + currentMetrics.network_out_mbps).toFixed(0)}Mbps
                </div>
              </div>
              <div className="border border-neutral rounded-3xl p-3 bg-neutral-light">
                <div className="text-xs text-gray-900 font-medium mb-2">Util</div>
                <div className="text-lg font-semibold text-gray-900">
                  {((currentMetrics.memory_used_gb / currentMetrics.memory_total_gb) * 100).toFixed(0)}%
                </div>
              </div>
            </div>

            {/* Metrics Graphs */}
            <div className="space-y-3 border-t border-neutral pt-4">
              <MetricsGraph
                data={metricsData.cpuData}
                title="CPU Usage"
                unit="%"
                color="#007755"
                maxValue={100}
                height={120}
              />
              <MetricsGraph
                data={metricsData.memoryData}
                title="Memory Usage"
                unit="GB"
                color="#007755"
                maxValue={currentMetrics.memory_total_gb}
                height={120}
              />
              <MetricsGraph
                data={metricsData.networkData}
                title="Network I/O"
                unit="Mbps"
                color="#007755"
                height={120}
              />
            </div>
          </>
        ) : (
          <div className="border border-neutral rounded-3xl p-4 bg-neutral-light text-center text-gray-900">
            Metrics not available yet. Waiting for worker heartbeat...
          </div>
        )}
      </div>
    </div>
  );
}

