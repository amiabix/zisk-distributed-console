import { WorkerData, CoordinatorSnapshot, JobStatusData, SystemStatusData, ProofPhase } from '../types/models';
import WorkerMetricsCard from './WorkerMetricsCard';
import PhaseTimeline from './PhaseTimeline';
import SystemMetrics from './SystemMetrics';
import { Activity } from 'lucide-react';

interface DashboardGridProps {
  workers: WorkerData[];
  systemStatus: SystemStatusData | null;
  jobStatus: JobStatusData | null;
  history: CoordinatorSnapshot[];
}

export default function DashboardGrid({
  workers,
  systemStatus,
  jobStatus,
  history,
}: DashboardGridProps) {
  // Create phase timeline data
  const phaseStartTimes = new Map<ProofPhase, number>();
  if (jobStatus) {
    // Use actual phase start times if available, otherwise estimate
    if (jobStatus.phase_start_times) {
      jobStatus.phase_start_times.forEach((time, phase) => {
        phaseStartTimes.set(phase, time);
      });
    } else {
      // Fallback: Estimate phase start times based on job duration
      const contributionStart = jobStatus.start_time_unix_ms;
      const proveStart = contributionStart + (jobStatus.duration_ms * 0.33);
      const aggregationStart = contributionStart + (jobStatus.duration_ms * 0.66);

      phaseStartTimes.set(ProofPhase.Contribution, contributionStart);
      phaseStartTimes.set(ProofPhase.Prove, proveStart);
      phaseStartTimes.set(ProofPhase.Aggregation, aggregationStart);
    }
  }

  return (
    <div className="space-y-6">
      {/* System Metrics Overview */}
      <SystemMetrics systemStatus={systemStatus} history={history} />

      {/* Main Grid: Timeline + Workers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Phase Timeline - Takes 1/3 on large screens */}
        {jobStatus && (
          <div className="lg:col-span-1">
            <PhaseTimeline
              currentPhase={jobStatus.phase}
              phaseStartTimes={phaseStartTimes}
              phaseDurations={jobStatus.phase_durations}
              totalDuration={jobStatus.duration_ms}
              assignedWorkers={jobStatus.assigned_workers}
              aggregatorWorkerId={jobStatus.aggregator_worker_id}
              computeCapacityRequired={jobStatus.compute_capacity_required}
              executionMode={jobStatus.execution_mode}
              workers={workers}
            />
          </div>
        )}

        {/* Workers Grid - Takes 2/3 on large screens */}
        <div className={`${jobStatus ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          <div className="mb-4 bg-white border border-neutral rounded-4xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-3xl bg-primary-light/30 flex items-center justify-center">
                <Activity className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Worker Performance Metrics
                </h2>
                <p className="text-sm text-gray-700 mt-0.5">
                  Real-time monitoring of {workers.length} worker{workers.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>

          {workers.length === 0 ? (
            <div className="bg-white rounded-4xl border border-neutral shadow-sm p-8 text-center">
              <div className="text-gray-900 font-mono">No workers available</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {workers.map((worker, index) => (
                <WorkerMetricsCard
                  key={worker.worker_id}
                  worker={worker}
                  history={history.map((snapshot) => ({
                    timestamp: snapshot.timestamp,
                    workers: snapshot.workers,
                  }))}
                  index={index + 1}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

