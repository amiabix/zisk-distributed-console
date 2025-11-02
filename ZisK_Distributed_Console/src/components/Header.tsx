import { JobStatusData, getPhaseName, formatDuration, JobState } from '../types/models';
import ProgressBar from './ProgressBar';
import { Activity, Clock, Users, Zap } from 'lucide-react';

interface HeaderProps {
  jobStatus: JobStatusData | null;
  workerCount: number;
  totalWorkers: number;
  progress: number;
  coordinatorInfo?: {
    coordinator_url: string;
    coordinator_host: string;
    coordinator_port: number;
    gateway_port: number;
    status: string;
    total_workers?: number;
    active_jobs?: number;
  } | null;
}

export default function Header({
  jobStatus,
  workerCount,
  totalWorkers,
  progress,
  coordinatorInfo,
}: HeaderProps) {
  if (!jobStatus) {
    return (
      <div className="bg-white border border-neutral rounded-4xl shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-4xl bg-primary flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                ZisK Distributed Proving Dashboard
              </h1>
              <p className="text-sm text-gray-700 mt-0.5">Real-time proof generation monitoring</p>
            </div>
          </div>
        </div>
        <div className="space-y-3">
          {coordinatorInfo ? (
            <div className="bg-primary-light/30 border border-primary/30 rounded-3xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-gray-900">Coordinator Connected</span>
                <span className={`text-xs px-2 py-0.5 rounded-lg ${
                  coordinatorInfo.status === 'connected' 
                    ? 'bg-accent/20 text-accent' 
                    : 'bg-gray-200 text-gray-700'
                }`}>
                  {coordinatorInfo.status === 'connected' ? '●' : '○'} {coordinatorInfo.status}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-gray-600">Host:</span>
                  <span className="ml-1 font-mono font-semibold text-gray-900">{coordinatorInfo.coordinator_host}</span>
                </div>
                <div>
                  <span className="text-gray-600">Port:</span>
                  <span className="ml-1 font-mono font-semibold text-gray-900">{coordinatorInfo.coordinator_port}</span>
                </div>
                <div>
                  <span className="text-gray-600">Gateway:</span>
                  <span className="ml-1 font-mono font-semibold text-gray-900">:{coordinatorInfo.gateway_port}</span>
                </div>
                {coordinatorInfo.total_workers !== undefined && (
                  <div>
                    <span className="text-gray-600">Workers:</span>
                    <span className="ml-1 font-semibold text-gray-900">{coordinatorInfo.total_workers}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-gray-100 border border-gray-300 rounded-3xl p-4">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-gray-500 animate-pulse" />
                <span className="text-sm font-semibold text-gray-700">Connecting to coordinator...</span>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 text-gray-900 bg-neutral-light px-3 py-2 rounded-3xl border border-neutral">
            <Clock className="w-4 h-4" />
            <span className="text-sm">Waiting for job data...</span>
          </div>
        </div>
      </div>
    );
  }

  const elapsed = formatDuration(jobStatus.duration_ms);
  const estimatedRemaining = Math.max(
    0,
    Math.ceil(
      (jobStatus.duration_ms / progress) * (100 - progress)
    )
  );
  const remaining = formatDuration(estimatedRemaining);

  const stateBadge = {
    [JobState.Running]: { color: 'bg-primary-light/30 text-gray-800 border-primary/30', icon: Activity },
    [JobState.Completed]: { color: 'bg-primary-light/30 text-gray-800 border-primary/30', icon: Activity },
    [JobState.Failed]: { color: 'bg-neutral-light text-gray-800 border-neutral', icon: Activity },
    [JobState.Waiting]: { color: 'bg-neutral-light text-gray-800 border-neutral', icon: Clock },
  }[jobStatus.state];

  const StateIcon = stateBadge.icon;

  return (
      <div className="bg-white border border-neutral rounded-4xl shadow-sm">
      {/* Header Section */}
      <div className="border-b border-neutral px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-4xl bg-primary flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                ZisK Distributed Proving Dashboard
              </h1>
              <p className="text-sm text-gray-700 mt-0.5">Real-time proof generation monitoring</p>
            </div>
          </div>
          
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-3xl border text-sm font-medium ${stateBadge.color}`}>
            <StateIcon className="w-4 h-4" />
            <span>{jobStatus.state}</span>
          </div>
        </div>
      </div>

      {/* Progress Section */}
      <div className="px-6 py-5 border-b border-neutral">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-900">Overall Progress</span>
            <span className="text-xl font-semibold text-gray-900">{Math.round(progress)}%</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-800">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-gray-800" />
              <span>{elapsed}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-gray-800" />
              <span>{remaining} remaining</span>
            </div>
          </div>
        </div>
        
        {/* AWS-style Progress Bar */}
        <div className="relative h-2 bg-primary-light rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-accent transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Info Cards Grid */}
      <div className="px-6 py-5 grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Job ID Card */}
        <div className="border border-neutral rounded-3xl p-3 hover:border-primary/40 bg-white transition-colors">
          <div className="text-xs text-gray-900 font-medium mb-1.5">Job ID</div>
          <div className="text-sm font-mono font-semibold text-gray-900 truncate" title={jobStatus.job_id}>
            {jobStatus.job_id.substring(0, 14)}...
          </div>
        </div>

        {/* Data ID Card */}
        <div className="border border-neutral rounded-3xl p-3 hover:border-primary/40 bg-white transition-colors">
          <div className="text-xs text-gray-900 font-medium mb-1.5">Data ID</div>
          <div className="text-sm font-mono font-semibold text-gray-900 truncate" title={jobStatus.data_id}>
            {jobStatus.data_id.substring(0, 14)}...
          </div>
        </div>

        {/* Workers Card */}
        <div className="border border-neutral rounded-3xl p-3 hover:border-primary/40 bg-white transition-colors">
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-xs text-gray-900 font-medium">Workers</div>
            <Users className="w-4 h-4 text-gray-800" />
          </div>
          <div className="text-lg font-semibold text-gray-900">
            <span className="text-primary font-semibold">{workerCount}</span>
            <span className="text-gray-800">/{totalWorkers}</span>
          </div>
        </div>

        {/* Phase Card */}
        <div className="border border-primary/30 bg-primary-light/30 rounded-3xl p-3">
          <div className="text-xs text-gray-900 font-medium mb-1.5">Current Phase</div>
          <div className="text-lg font-semibold text-primary">
            {getPhaseName(jobStatus.phase)}
          </div>
        </div>
      </div>
    </div>
  );
}
