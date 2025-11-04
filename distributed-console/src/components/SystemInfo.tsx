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
      ? { label: 'Live', color: 'text-primary-dark' }
      : freshness < 5000
        ? { label: 'Stale', color: 'text-gray-400' }
        : { label: 'Old', color: 'text-gray-500' };

  return (
    <div className="glass p-5">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-[#6b6560] font-medium">System:</span>
          <span className="text-[#2d2926] font-semibold">{systemStatus.busy_workers} workers active</span>
        </div>
        <span className="hidden sm:inline text-[#9c9488]">•</span>
        <div className="flex items-center gap-2">
          <span className="text-[#6b6560] font-medium">Utilization:</span>
          <span className="text-[#2d2926] font-semibold">{capacityUtilization}%</span>
        </div>
        <span className="hidden sm:inline text-[#9c9488]">•</span>
        <div className="flex items-center gap-2">
          <span className={`${freshnessIndicator.color === 'text-primary-dark' ? 'text-green-700' : 'text-[#6b6560]'} font-semibold`}>
            {freshnessIndicator.label}
          </span>
          <span className="text-[#6b6560] text-xs font-mono">
            {formatTimeAgo(lastUpdate)} • {requestLatency}ms
          </span>
        </div>
      </div>
    </div>
  );
}
