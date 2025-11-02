import { SystemStatusData, formatTimeAgo } from '../types/models';

interface SystemInfoProps {
  systemStatus: SystemStatusData | null;
  lastUpdate: number;
  requestLatency: number;
}

export default function SystemInfo({
  systemStatus,
  lastUpdate,
  requestLatency,
}: SystemInfoProps) {
  if (!systemStatus) {
    return null;
  }

  const capacityUtilization =
    systemStatus.total_workers > 0
      ? Math.round((systemStatus.busy_workers / systemStatus.total_workers) * 100)
      : 0;

  const freshness = Date.now() - lastUpdate;
  const freshnessIndicator =
    freshness < 2000
      ? { label: 'Live', color: 'text-primary' }
      : freshness < 5000
        ? { label: 'Stale', color: 'text-gray-800' }
        : { label: 'Old', color: 'text-gray-900' };

  return (
    <div className="bg-white border border-neutral rounded-4xl shadow-sm p-4">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-gray-900 font-medium">System:</span>
          <span className="text-gray-900 font-semibold">{systemStatus.busy_workers} workers active</span>
        </div>
        <span className="hidden sm:inline text-gray-300">•</span>
        <div className="flex items-center gap-2">
          <span className="text-gray-900 font-medium">Utilization:</span>
          <span className="text-gray-900 font-semibold">{capacityUtilization}%</span>
        </div>
        <span className="hidden sm:inline text-gray-300">•</span>
        <div className="flex items-center gap-2">
          <span className={`${freshnessIndicator.color} font-medium`}>
            {freshnessIndicator.label}
          </span>
          <span className="text-gray-900 text-xs">
            {formatTimeAgo(lastUpdate)} • {requestLatency}ms
          </span>
        </div>
      </div>
    </div>
  );
}
