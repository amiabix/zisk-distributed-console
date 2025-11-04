import { WorkerData, CoordinatorSnapshot, JobStatusData, SystemStatusData, getWorkerHealthStatus } from '../types/models';
import WorkerMetricsCard from './WorkerMetricsCard';
import PhaseTimeline from './PhaseTimeline';
import SystemMetrics from './SystemMetrics';
import { Activity, Filter } from 'lucide-react';
import { useState, useEffect } from 'react';
import { POLLING_INTERVALS, WORKER_CONNECTION_HEURISTIC_MS } from '../constants/config';
import Button from './Button';

interface DashboardGridProps {
  workers: WorkerData[];
  systemStatus: SystemStatusData | null;
  jobStatus: JobStatusData | null;
  history: CoordinatorSnapshot[];
  onWorkerClick?: (worker: WorkerData) => void;
}

export default function DashboardGrid({
  workers,
  systemStatus,
  jobStatus,
  history,
  onWorkerClick,
}: DashboardGridProps) {
  const [showManagedOnly, setShowManagedOnly] = useState(false);
  const [hasManagedWorkers, setHasManagedWorkers] = useState(false);

  useEffect(() => {
    const checkManagedWorkers = () => {
      const now = Date.now();
      const recentWorkers = workers.filter(
        (w) => now - w.connected_at_unix_ms < WORKER_CONNECTION_HEURISTIC_MS
      );
      setHasManagedWorkers(recentWorkers.length > 0);
    };
    checkManagedWorkers();
    const interval = setInterval(checkManagedWorkers, POLLING_INTERVALS.BACKGROUND);
    return () => clearInterval(interval);
  }, [workers]);

  const filteredWorkers = showManagedOnly
    ? workers.filter((w) => {
        const timeSinceConnection = Date.now() - w.connected_at_unix_ms;
        return timeSinceConnection < WORKER_CONNECTION_HEURISTIC_MS;
      }).filter((w) => {
        // Also filter out disconnected workers when showing managed only
        const healthStatus = getWorkerHealthStatus(w);
        return healthStatus !== 'disconnected';
      })
    : workers.filter((w) => {
        // Always filter out disconnected workers (heartbeat > 45 seconds old)
        const healthStatus = getWorkerHealthStatus(w);
        return healthStatus !== 'disconnected';
      });

  return (
    <div className="space-y-4">
      <SystemMetrics systemStatus={systemStatus} history={history} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {jobStatus && (
          <div className="lg:col-span-1">
            <PhaseTimeline
              currentPhase={jobStatus.phase}
              phaseStartTimes={jobStatus.phase_start_times}
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

        <div className={`${jobStatus ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          <div className="glass p-4 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#2d2926]">Worker Performance Metrics</h2>
                <p className="text-sm text-[#6b6560] mt-1">
                  {showManagedOnly
                    ? `Showing ${filteredWorkers.length} of ${workers.length} workers`
                    : `${filteredWorkers.length} worker${filteredWorkers.length !== 1 ? 's' : ''} available`}
                </p>
              </div>
              <Button
                variant={showManagedOnly ? 'primary' : 'secondary'}
                size="md"
                icon={<Filter className="w-4 h-4" />}
                onClick={() => setShowManagedOnly(!showManagedOnly)}
              >
                {showManagedOnly ? 'Show All' : 'Hide External'}
              </Button>
            </div>
          </div>

          {filteredWorkers.length === 0 ? (
            <div className="glass p-8 text-center">
              <div className="text-[#6b6560]">No workers available</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {filteredWorkers.map((worker, index) => {
                const timeSinceConnection = Date.now() - worker.connected_at_unix_ms;
                const isLikelyManaged = hasManagedWorkers && timeSinceConnection < 180000;
                return (
                  <WorkerMetricsCard
                    key={worker.worker_id}
                    worker={worker}
                    history={history.map((snapshot) => ({
                      timestamp: snapshot.timestamp,
                      workers: snapshot.workers,
                    }))}
                    index={index + 1}
                    onClick={onWorkerClick ? () => onWorkerClick(worker) : undefined}
                    isManaged={isLikelyManaged}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
