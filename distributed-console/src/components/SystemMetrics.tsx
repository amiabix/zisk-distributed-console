import { useMemo } from 'react';
import { SystemStatusData, CoordinatorSnapshot, WorkerMetrics } from '../types/models';
import { TrendingUp, Users, Activity, Server } from 'lucide-react';
import MetricsGraph from './MetricsGraph';

interface SystemMetricsProps {
  systemStatus: SystemStatusData | null;
  history: CoordinatorSnapshot[];
}

export default function SystemMetrics({ systemStatus, history }: SystemMetricsProps) {
  const trackedMetrics = useMemo(() => {
    const utilizationData: Array<{ time: string; value: number; timestamp: number }> = [];
    const activeJobsData: Array<{ time: string; value: number; timestamp: number }> = [];
    const busyWorkersData: Array<{ time: string; value: number; timestamp: number }> = [];
    const computeCapacityData: Array<{ time: string; value: number; timestamp: number }> = [];
    const workerHealthData: Array<{ time: string; value: number; timestamp: number }> = [];

    history.forEach((snapshot) => {
      const date = new Date(snapshot.timestamp);
      const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      
      if (snapshot.system_status) {
        const status = snapshot.system_status;
        const utilization = status.total_workers > 0 
          ? Math.round((status.busy_workers / status.total_workers) * 100) 
          : 0;
        utilizationData.push({ time, value: utilization, timestamp: snapshot.timestamp });
        
        activeJobsData.push({ time, value: status.active_jobs, timestamp: snapshot.timestamp });
        
        busyWorkersData.push({ time, value: status.busy_workers, timestamp: snapshot.timestamp });
        
        const capacity = status.compute_capacity || 0;
        computeCapacityData.push({ time, value: capacity, timestamp: snapshot.timestamp });
      }
      
      const now = snapshot.timestamp;
      if (snapshot.workers && snapshot.workers.length > 0) {
        const healthyWorkers = snapshot.workers.filter((w) => {
          const timeSinceHeartbeat = now - w.last_heartbeat_unix_ms;
          return timeSinceHeartbeat < 45000;
        }).length;
        const healthPercent = Math.round((healthyWorkers / snapshot.workers.length) * 100);
        workerHealthData.push({ time, value: healthPercent, timestamp: snapshot.timestamp });
      } else {
        workerHealthData.push({ time, value: 0, timestamp: snapshot.timestamp });
      }
    });

    return { 
      utilizationData, 
      activeJobsData, 
      busyWorkersData, 
      computeCapacityData,
      workerHealthData 
    };
  }, [history]);

  const aggregatedMetrics = useMemo(() => {
    const cpuData: Array<{ time: string; value: number; timestamp: number }> = [];
    const memoryData: Array<{ time: string; value: number; timestamp: number }> = [];
    const networkData: Array<{ time: string; value: number; timestamp: number }> = [];

    history.forEach((snapshot) => {
        if (!snapshot.workers || snapshot.workers.length === 0) return;

          const workersWithMetrics = snapshot.workers.filter((w) => w.metrics);
          if (workersWithMetrics.length === 0) return;

          const date = new Date(snapshot.timestamp);
          const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

          const avgCpu = workersWithMetrics.reduce((sum, w) => sum + (w.metrics?.cpu_percent || 0), 0) / workersWithMetrics.length;
      const totalMemory = workersWithMetrics.reduce((sum, w) => sum + (w.metrics?.memory_used_gb || 0), 0);
      const totalNetwork = workersWithMetrics.reduce((sum, w) => sum + (w.metrics?.network_in_mbps || 0) + (w.metrics?.network_out_mbps || 0), 0);

      cpuData.push({ time, value: avgCpu, timestamp: snapshot.timestamp });
      memoryData.push({ time, value: totalMemory, timestamp: snapshot.timestamp });
      networkData.push({ time, value: totalNetwork, timestamp: snapshot.timestamp });
    });

    return { cpuData, memoryData, networkData };
  }, [history]);

  const currentMetrics = useMemo(() => {
    if (!history || history.length === 0) return null;
    const latest = history[history.length - 1];
    if (!latest.workers || latest.workers.length === 0) return null;

    const workersWithMetrics = latest.workers.filter((w) => w.metrics);
    if (workersWithMetrics.length === 0) return null;

    return {
      avgCpu: workersWithMetrics.reduce((sum, w) => sum + (w.metrics?.cpu_percent || 0), 0) / workersWithMetrics.length,
      totalMemory: workersWithMetrics.reduce((sum, w) => sum + (w.metrics?.memory_used_gb || 0), 0),
      totalNetwork: workersWithMetrics.reduce((sum, w) => sum + (w.metrics?.network_in_mbps || 0) + (w.metrics?.network_out_mbps || 0), 0),
    };
  }, [history]);

  const utilizationPercent =
    systemStatus && systemStatus.total_workers > 0
      ? Math.round((systemStatus.busy_workers / systemStatus.total_workers) * 100)
      : 0;

      return (
        <div className="space-y-6">
          {systemStatus && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="glass p-4">
            <div className="text-sm text-[#6b6560] mb-2">Total Workers</div>
            <div className="text-2xl font-semibold text-[#2d2926] mb-2">{systemStatus.total_workers}</div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[#6b6560]">{systemStatus.idle_workers} idle</span>
              <span className="text-[#6b6560]">·</span>
              <span className="text-[#6b6560]">{systemStatus.busy_workers} busy</span>
            </div>
          </div>

          <div className="glass p-4">
            <div className="text-sm text-[#6b6560] mb-2">Capacity Utilization</div>
            <div className="text-2xl font-semibold text-[#2d2926] mb-2">{utilizationPercent}%</div>
            <div className="h-1.5 bg-[#e8e4e0] rounded-xl overflow-hidden">
              <div
                className="h-full bg-primary-500 transition-all duration-300"
                style={{ width: `${utilizationPercent}%` }}
              />
            </div>
          </div>

          <div className="glass p-4">
            <div className="text-sm text-[#6b6560] mb-2">Active Jobs</div>
            <div className="text-2xl font-semibold text-[#2d2926] mb-2">{systemStatus.active_jobs}</div>
            <div className="text-xs text-[#6b6560]">Currently processing</div>
          </div>

          <div className="glass p-4">
            <div className="text-sm text-[#6b6560] mb-2">Busy Workers</div>
            <div className="text-2xl font-semibold text-[#2d2926] mb-2">{systemStatus.busy_workers}</div>
            <div className="text-xs text-[#6b6560]">
              {((systemStatus.busy_workers / systemStatus.total_workers) * 100 || 0).toFixed(0)}% of total
            </div>
          </div>

          {systemStatus.compute_capacity !== undefined && (
            <div className="glass p-4">
              <div className="text-sm text-[#6b6560] mb-2">Total Capacity</div>
              <div className="text-2xl font-semibold text-[#2d2926] mb-2">{systemStatus.compute_capacity} CU</div>
              <div className="text-xs text-[#6b6560]">Compute units</div>
            </div>
          )}
        </div>
      )}

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-[#2d2926]">System Performance Metrics</h3>

            {trackedMetrics.utilizationData.length > 0 || trackedMetrics.activeJobsData.length > 0 ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <MetricsGraph
                data={trackedMetrics.utilizationData}
                title="Worker Utilization"
                unit="%"
                color="#007755"
                maxValue={100}
                height={200}
              />
              <MetricsGraph
                data={trackedMetrics.activeJobsData}
                title="Active Jobs"
                unit=""
                color="#3b82f6"
                height={200}
              />
              <MetricsGraph
                data={trackedMetrics.busyWorkersData}
                title="Busy Workers"
                unit=""
                color="#f59e0b"
                height={200}
              />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <MetricsGraph
                data={trackedMetrics.computeCapacityData}
                title="Total Compute Capacity"
                unit=" CU"
                color="#8b5cf6"
                height={200}
              />
              <MetricsGraph
                data={trackedMetrics.workerHealthData}
                title="Worker Health"
                unit="%"
                color="#10b981"
                maxValue={100}
                height={200}
              />
                </div>

                {systemStatus && (
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-4">
                <div className="glass p-4">
                  <div className="text-sm text-[#6b6560] mb-1">Current Utilization</div>
                  <div className="text-xl font-semibold text-[#2d2926]">{utilizationPercent}%</div>
                </div>
                <div className="glass p-4">
                  <div className="text-sm text-[#6b6560] mb-1">Active Jobs</div>
                  <div className="text-xl font-semibold text-[#2d2926]">{systemStatus.active_jobs}</div>
                </div>
                <div className="glass p-4">
                  <div className="text-sm text-[#6b6560] mb-1">Busy Workers</div>
                  <div className="text-xl font-semibold text-[#2d2926]">{systemStatus.busy_workers}</div>
                </div>
                <div className="glass p-4">
                  <div className="text-sm text-[#6b6560] mb-1">Total Capacity</div>
                  <div className="text-xl font-semibold text-[#2d2926]">{systemStatus.compute_capacity || 0} CU</div>
                </div>
                <div className="glass p-4">
                  <div className="text-sm text-[#6b6560] mb-1">Total Workers</div>
                  <div className="text-xl font-semibold text-[#2d2926]">{systemStatus.total_workers}</div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="glass p-8 rounded-xl">
            <div className="text-center">
              <Activity className="w-12 h-12 text-[#9c9488] mx-auto mb-3" />
              <p className="text-[#6b6560] font-medium mb-2">No metrics data available</p>
              <div className="text-sm text-[#9c9488] space-y-1">
                {!systemStatus ? (
                  <>
                    <p>The coordinator may not be running or connected.</p>
                    <p>Start the coordinator and ensure workers are registered to begin collecting metrics.</p>
                  </>
                ) : (
                  <>
                    <p>Metrics will appear here as the system collects data over time.</p>
                    <p>Launch a proof generation job to start tracking system performance.</p>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
