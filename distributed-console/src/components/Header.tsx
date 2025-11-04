import { JobStatusData, getPhaseName, formatDuration, JobState, ProofPhase, CoordinatorStatus, SystemStatusData, formatTimeAgo } from '../types/models';
import { Activity, Clock, Users, Wifi, WifiOff } from 'lucide-react';
import { CoordinatorInfo } from '../types/models';

interface HeaderProps {
  jobStatus: JobStatusData | null;
  workerCount: number;
  totalWorkers: number;
  progress: number;
  coordinatorInfo?: CoordinatorInfo | null;
  coordinatorStatus?: CoordinatorStatus;
  systemStatus?: SystemStatusData | null;
  lastUpdate?: number;
  requestLatency?: number;
}

export default function Header({
  jobStatus,
  workerCount,
  totalWorkers,
  progress,
  coordinatorInfo,
  coordinatorStatus,
  systemStatus,
  lastUpdate,
  requestLatency,
}: HeaderProps) {
  // Connection status indicator
  const getConnectionStatus = () => {
    if (coordinatorStatus === CoordinatorStatus.Connected) {
      return {
        icon: Wifi,
        text: 'Connected',
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        dotColor: 'bg-green-500',
      };
    } else if (coordinatorStatus === CoordinatorStatus.Connecting) {
      return {
        icon: Wifi,
        text: 'Connecting...',
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
        dotColor: 'bg-yellow-500',
      };
    } else {
      return {
        icon: WifiOff,
        text: 'Disconnected',
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        dotColor: 'bg-red-500',
      };
    }
  };

  const connectionStatus = getConnectionStatus();
  const StatusIcon = connectionStatus.icon;

  if (!jobStatus) {
    return (
      <div className="glass p-6">
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-[#e8e4e0]">
          <div>
            <h1 className="text-2xl font-semibold text-[#2d2926]">ZisK Distributed Proving Dashboard</h1>
            <p className="text-sm text-[#6b6560] mt-1">Real-time proof generation monitoring</p>
          </div>
          {coordinatorStatus && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${connectionStatus.bgColor} ${connectionStatus.borderColor}`}>
              <div className={`w-2 h-2 rounded-full ${connectionStatus.dotColor} ${coordinatorStatus === CoordinatorStatus.Connected ? 'animate-pulse' : ''}`} />
              <StatusIcon className={`w-4 h-4 ${connectionStatus.color}`} />
              <span className={`text-sm font-medium ${connectionStatus.color}`}>
                {connectionStatus.text}
              </span>
            </div>
          )}
        </div>
        <div className="space-y-3">
          {coordinatorInfo && (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-4">
                <span className="text-[#6b6560]">Host:</span>
                <span className="text-[#2d2926] font-mono">{coordinatorInfo.coordinator_host}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[#6b6560]">Port:</span>
                <span className="text-[#2d2926] font-mono">{coordinatorInfo.coordinator_port}</span>
              </div>
              {coordinatorInfo.version && (
                <div className="flex items-center gap-4">
                  <span className="text-[#6b6560]">Version:</span>
                  <span className="text-[#2d2926]">{coordinatorInfo.version}</span>
                </div>
              )}
            </div>
          )}
          
          {systemStatus && lastUpdate !== undefined && requestLatency !== undefined && (
            <div className="pt-3 border-t border-[#e8e4e0]">
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-[#6b6560] font-medium">System:</span>
                  <span className="text-[#2d2926] font-semibold">{systemStatus.busy_workers} workers active</span>
                </div>
                <span className="hidden sm:inline text-[#9c9488]">•</span>
                <div className="flex items-center gap-2">
                  <span className="text-[#6b6560] font-medium">Utilization:</span>
                  <span className="text-[#2d2926] font-semibold">
                    {systemStatus.total_workers > 0
                      ? Math.round((systemStatus.busy_workers / systemStatus.total_workers) * 100)
                      : 0}%
                  </span>
                </div>
                <span className="hidden sm:inline text-[#9c9488]">•</span>
                <div className="flex items-center gap-2">
                  <span className={`${Date.now() - lastUpdate < 2000 ? 'text-green-700' : 'text-[#6b6560]'} font-semibold`}>
                    {Date.now() - lastUpdate < 2000 ? 'Live' : Date.now() - lastUpdate < 5000 ? 'Stale' : 'Old'}
                  </span>
                  <span className="text-[#6b6560] text-xs font-mono">
                    {formatTimeAgo(lastUpdate)} • {requestLatency}ms
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const elapsed = formatDuration(jobStatus.duration_ms);
  const estimatedRemaining = progress > 0
    ? Math.max(0, Math.ceil((jobStatus.duration_ms / progress) * (100 - progress)))
    : 0;
  const remaining = formatDuration(estimatedRemaining);

  return (
    <div className="glass p-6">
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-[#e8e4e0]">
        <div>
          <h1 className="text-2xl font-semibold text-[#2d2926]">ZisK Distributed Proving Dashboard</h1>
          <p className="text-sm text-[#6b6560] mt-1">Real-time proof generation monitoring</p>
        </div>
        <div className="flex items-center gap-3">
          {coordinatorStatus && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${connectionStatus.bgColor} ${connectionStatus.borderColor}`}>
              <div className={`w-2 h-2 rounded-full ${connectionStatus.dotColor} ${coordinatorStatus === CoordinatorStatus.Connected ? 'animate-pulse' : ''}`} />
              <StatusIcon className={`w-4 h-4 ${connectionStatus.color}`} />
              <span className={`text-sm font-medium ${connectionStatus.color}`}>
                {connectionStatus.text}
              </span>
            </div>
          )}
          <div className="px-3 py-1.5 bg-[#e8f5e9] text-[#2e7d32] border border-[#c8e6c9] rounded-xl text-sm font-medium">
            {jobStatus.state}
          </div>
        </div>
      </div>

      <div className="mb-4 pb-4 border-b border-[#e8e4e0]">
        <div className="flex items-center gap-4 mb-3">
          <div className="text-sm text-[#6b6560]">Current Phase:</div>
          <div className="text-lg font-semibold text-[#2d2926]">{getPhaseName(jobStatus.phase)}</div>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-[#6b6560]">Progress:</span>
            <span className="text-[#2d2926] font-semibold">{Math.round(progress)}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[#6b6560]">Elapsed:</span>
            <span className="text-[#2d2926]">{elapsed}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[#6b6560]">Remaining:</span>
            <span className="text-[#2d2926]">{remaining}</span>
          </div>
        </div>
        <div className="mt-3 h-2 bg-[#e8e4e0] rounded-xl overflow-hidden">
          <div
            className="h-full bg-primary-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <div className="text-[#6b6560] mb-1">Job ID</div>
          <div className="text-[#2d2926] font-mono text-xs truncate" title={jobStatus.job_id}>
            {jobStatus.job_id.substring(0, 16)}...
          </div>
        </div>
        {jobStatus.block_id && (
          <div>
            <div className="text-[#6b6560] mb-1">Block ID</div>
            <div className="text-[#2d2926] font-mono text-xs truncate" title={jobStatus.block_id}>
              {jobStatus.block_id.length > 16 ? `${jobStatus.block_id.substring(0, 16)}...` : jobStatus.block_id}
            </div>
          </div>
        )}
        <div>
          <div className="text-[#6b6560] mb-1">Workers</div>
          <div className="text-[#2d2926] font-semibold">
            {workerCount} / {totalWorkers}
          </div>
        </div>
        <div>
          <div className="text-[#6b6560] mb-1">Data ID</div>
          <div className="text-[#2d2926] font-mono text-xs truncate" title={jobStatus.data_id}>
            {jobStatus.data_id.substring(0, 16)}...
          </div>
        </div>
      </div>
    </div>
  );
}
