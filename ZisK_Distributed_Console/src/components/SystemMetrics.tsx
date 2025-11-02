import { useMemo } from 'react';
import { SystemStatusData, CoordinatorSnapshot } from '../types/models';
import MetricsGraph from './MetricsGraph';
import { TrendingUp, Users, Activity, Server } from 'lucide-react';

interface SystemMetricsProps {
  systemStatus: SystemStatusData | null;
  history: CoordinatorSnapshot[];
}

export default function SystemMetrics({ systemStatus, history }: SystemMetricsProps) {
  const systemMetrics = useMemo(() => {
    const workerCountData: Array<{ time: string; value: number; timestamp: number }> = [];
    const capacityData: Array<{ time: string; value: number; timestamp: number }> = [];

    history.forEach((snapshot) => {
      const time = new Date(snapshot.timestamp).toLocaleTimeString();
      
      workerCountData.push({
        time,
        value: snapshot.workers.filter((w) => w.state === 'Computing').length,
        timestamp: snapshot.timestamp,
      });

      const totalCapacity = snapshot.workers.reduce((sum, w) => sum + w.compute_capacity, 0);
      const usedCapacity = snapshot.workers
        .filter((w) => w.state === 'Computing')
        .reduce((sum, w) => sum + w.compute_capacity, 0);

      capacityData.push({
        time,
        value: totalCapacity > 0 ? (usedCapacity / totalCapacity) * 100 : 0,
        timestamp: snapshot.timestamp,
      });
    });

    return { workerCountData, capacityData };
  }, [history]);

  if (!systemStatus) {
    return null;
  }

  const utilizationPercent =
    systemStatus.total_workers > 0
      ? Math.round((systemStatus.busy_workers / systemStatus.total_workers) * 100)
      : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Workers */}
      <div className="bg-white border border-neutral rounded-4xl shadow-sm">
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-medium text-gray-900">Total Workers</div>
            <div className="w-8 h-8 rounded-3xl bg-primary-light/30 flex items-center justify-center">
              <Users className="w-4 h-4 text-primary" />
            </div>
          </div>
          <div className="text-3xl font-semibold text-gray-900 mb-3">{systemStatus.total_workers}</div>
          <div className="flex items-center gap-2 text-xs">
            <span className="bg-neutral-light text-gray-800 border border-neutral px-2 py-0.5 rounded-3xl font-medium">
              {systemStatus.idle_workers} idle
            </span>
            <span className="bg-primary-light/40 text-primary border border-primary/30 px-2 py-0.5 rounded-3xl font-medium">
              {systemStatus.busy_workers} busy
            </span>
          </div>
        </div>
      </div>

      {/* Capacity Utilization */}
      <div className="bg-white border border-neutral rounded-4xl shadow-sm">
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-medium text-gray-900">Capacity Utilization</div>
            <div className="w-8 h-8 rounded-3xl bg-gray-100 flex items-center justify-center">
              <Activity className="w-4 h-4 text-primary" />
            </div>
          </div>
          <div className="text-3xl font-semibold text-gray-900 mb-3">{utilizationPercent}%</div>
          <div className="h-2 bg-primary-light/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-500"
              style={{ width: `${utilizationPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Active Jobs */}
      <div className="bg-white border border-neutral rounded-4xl shadow-sm">
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-medium text-gray-900">Active Jobs</div>
            <div className="w-8 h-8 rounded-3xl bg-gray-100 flex items-center justify-center">
              <Server className="w-4 h-4 text-primary" />
            </div>
          </div>
          <div className="text-3xl font-semibold text-gray-900 mb-3">{systemStatus.active_jobs}</div>
          <div className="text-xs text-gray-900">Currently processing</div>
        </div>
      </div>

      {/* Busy Workers */}
      <div className="bg-white border border-neutral rounded-4xl shadow-sm">
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-medium text-gray-900">Busy Workers</div>
            <div className="w-8 h-8 rounded-3xl bg-gray-100 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-primary" />
            </div>
          </div>
          <div className="text-3xl font-semibold text-gray-900 mb-3">{systemStatus.busy_workers}</div>
          <div className="text-xs text-gray-900">
            {((systemStatus.busy_workers / systemStatus.total_workers) * 100 || 0).toFixed(0)}% of total
          </div>
        </div>
      </div>
    </div>
  );
}

