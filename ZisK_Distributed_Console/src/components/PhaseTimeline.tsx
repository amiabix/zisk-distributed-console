import { ProofPhase, getPhaseName, WorkerData } from '../types/models';
import { formatDuration } from '../types/models';
import { CheckCircle2, Clock, Loader2 } from 'lucide-react';

interface PhaseTimelineProps {
  currentPhase: ProofPhase;
  phaseStartTimes?: Map<ProofPhase, number>;
  phaseDurations?: Map<ProofPhase, number>;
  totalDuration: number;
  assignedWorkers?: string[];
  aggregatorWorkerId?: string | null;
  computeCapacityRequired?: number;
  executionMode?: 'standard' | 'simulation';
  workers?: WorkerData[];
}

export default function PhaseTimeline({
  currentPhase,
  phaseStartTimes,
  phaseDurations,
  totalDuration,
  assignedWorkers = [],
  aggregatorWorkerId,
  computeCapacityRequired,
  executionMode,
  workers = [],
}: PhaseTimelineProps) {
  const phases: ProofPhase[] = [ProofPhase.Contribution, ProofPhase.Prove, ProofPhase.Aggregation];

  const getPhaseStatus = (phase: ProofPhase): 'completed' | 'active' | 'pending' => {
    const currentIndex = phases.indexOf(currentPhase);
    const phaseIndex = phases.indexOf(phase);

    if (phaseIndex < currentIndex) return 'completed';
    if (phaseIndex === currentIndex) return 'active';
    return 'pending';
  };

  const getPhaseDescription = (phase: ProofPhase): string => {
    switch (phase) {
      case ProofPhase.Contribution:
        return 'Distributed challenge generation - Workers compute partial challenges';
      case ProofPhase.Prove:
        return 'Cryptographic proof generation from aggregated challenges';
      case ProofPhase.Aggregation:
        return 'Final proof aggregation and validation by designated aggregator';
      default:
        return '';
    }
  };

  const getPhaseWorkers = (phase: ProofPhase): WorkerData[] => {
    if (!workers.length) return [];
    
    // Get workers currently in this phase
    return workers.filter((w) => {
      if (w.current_phase === phase) return true;
      // If phase is completed and worker was assigned, include them
      const phaseIndex = phases.indexOf(phase);
      const currentIndex = phases.indexOf(currentPhase);
      if (phaseIndex < currentIndex && assignedWorkers.includes(w.worker_id)) {
        return true;
      }
      return false;
    });
  };

  const getEstimatedPhaseDuration = (phase: ProofPhase): number => {
    switch (phase) {
      case ProofPhase.Contribution:
        return totalDuration * 0.33;
      case ProofPhase.Prove:
        return totalDuration * 0.5;
      case ProofPhase.Aggregation:
        return totalDuration * 0.17;
      default:
        return 0;
    }
  };

  const getEstimatedTimeRemaining = (phase: ProofPhase): number | null => {
    const status = getPhaseStatus(phase);
    if (status !== 'active') return null;

    const elapsed = getPhaseDuration(phase);
    const estimatedTotal = getEstimatedPhaseDuration(phase);
    const remaining = estimatedTotal - elapsed;

    return remaining > 0 ? remaining : 0;
  };

  const getPhaseDuration = (phase: ProofPhase): number => {
    // Use actual phase duration if available
    if (phaseDurations?.has(phase)) {
      return phaseDurations.get(phase)!;
    }

    // Otherwise calculate from start times
    const startTime = phaseStartTimes?.get(phase);
    if (!startTime) return 0;

    if (getPhaseStatus(phase) === 'active') {
      return Date.now() - startTime;
    }

    // For completed phases, calculate duration until next phase or total
    const nextPhaseIndex = phases.indexOf(phase) + 1;
    if (nextPhaseIndex < phases.length && phaseStartTimes) {
      const nextPhase = phases[nextPhaseIndex];
      const nextStartTime = phaseStartTimes.get(nextPhase);
      if (nextStartTime) {
        return nextStartTime - startTime;
      }
    }

    return totalDuration;
  };

  const getProgressWidth = (phase: ProofPhase): number => {
    const status = getPhaseStatus(phase);
    if (status === 'completed') return 100;
    if (status === 'pending') return 0;

    // For active phase, estimate progress based on typical durations
    const elapsed = getPhaseDuration(phase);
    const estimatedTotal = phase === ProofPhase.Contribution
      ? totalDuration * 0.33
      : phase === ProofPhase.Prove
      ? totalDuration * 0.5
      : totalDuration * 0.17;

    return Math.min(100, (elapsed / estimatedTotal) * 100);
  };

  return (
      <div className="bg-white border border-neutral rounded-4xl shadow-sm">
      <div className="border-b border-neutral px-5 py-4">
        <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-3xl bg-primary-light/30 flex items-center justify-center">
              <Clock className="w-4 h-4 text-primary" />
            </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Proof Generation Timeline
            </h3>
            <p className="text-sm text-gray-700 mt-0.5">
              Real-time progress tracking across all phases
            </p>
          </div>
        </div>
      </div>
      <div className="p-5">
        <div className="space-y-4">
        {phases.map((phase, index) => {
          const status = getPhaseStatus(phase);
          const progress = getProgressWidth(phase);
          const duration = getPhaseDuration(phase);
          const phaseWorkers = getPhaseWorkers(phase);
          const estimatedRemaining = getEstimatedTimeRemaining(phase);
          const estimatedTotal = getEstimatedPhaseDuration(phase);

          const statusColors = {
            completed: {
              bg: 'bg-primary',
              text: 'text-gray-800',
              border: 'border-primary/30',
              bgLight: 'bg-neutral-light',
              iconBg: 'bg-primary-light/30',
            },
            active: {
              bg: 'bg-primary',
              text: 'text-primary',
              border: 'border-primary/30',
              bgLight: 'bg-primary-light/20',
              iconBg: 'bg-primary-light/40',
            },
            pending: {
              bg: 'bg-neutral',
              text: 'text-gray-800',
              border: 'border-neutral',
              bgLight: 'bg-neutral-light',
              iconBg: 'bg-primary-light/20',
            },
          };

          const colors = statusColors[status];
          const isCompleted = status === 'completed';
          const isActive = status === 'active';

          return (
            <div
              key={phase}
              className={`border rounded-3xl p-4 ${
                isActive
                  ? 'border-primary/30 bg-primary-light/20'
                  : isCompleted
                  ? 'border-primary/20 bg-neutral-light'
                  : 'border-neutral bg-neutral-light'
              }`}
            >
              {/* Phase Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3 flex-1">
                  <div
                    className={`mt-0.5 w-7 h-7 rounded-3xl ${colors.iconBg} flex items-center justify-center`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                    ) : isActive ? (
                      <Loader2 className="w-4 h-4 text-primary animate-spin" />
                    ) : (
                      <Clock className="w-4 h-4 text-gray-800" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-sm font-semibold ${colors.text}`}>
                        Phase {index + 1}: {getPhaseName(phase)}
                      </span>
                      {isActive && (
                        <span className="px-2 py-0.5 bg-primary text-white text-xs font-medium rounded-3xl">
                          ACTIVE
                        </span>
                      )}
                      {isCompleted && (
                        <span className="px-2 py-0.5 bg-primary/80 text-white text-xs font-medium rounded-3xl">
                          COMPLETED
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-800 leading-relaxed mt-1">
                      {getPhaseDescription(phase)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-800">Progress</span>
                  <span className={`text-sm font-semibold ${colors.text}`}>
                    {Math.round(progress)}%
                  </span>
                </div>
                <div className="relative h-2 bg-primary-light/50 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      isCompleted ? 'bg-accent' : isActive ? 'bg-accent' : 'bg-accent/60'
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="border border-neutral rounded-3xl p-2.5 bg-white">
                  <div className="text-xs text-gray-900 font-medium mb-1">Elapsed Time</div>
                  <div className="text-sm font-semibold text-gray-900">
                    {formatDuration(duration)}
                  </div>
                </div>
                <div className="border border-neutral rounded-3xl p-2.5 bg-white">
                  <div className="text-xs text-gray-900 font-medium mb-1">
                    {isActive ? 'Est. Remaining' : 'Total Duration'}
                  </div>
                  <div className="text-sm font-semibold text-gray-900">
                    {estimatedRemaining !== null
                      ? formatDuration(estimatedRemaining)
                      : formatDuration(estimatedTotal)}
                  </div>
                </div>
              </div>

              {/* Worker Assignments */}
              {phaseWorkers.length > 0 && (
                <div className="pt-3 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-gray-800 font-medium">
                      Assigned Workers
                    </div>
                    <div className={`px-2 py-0.5 rounded text-xs font-medium ${
                      phase === ProofPhase.Aggregation && assignedWorkers?.length === 1
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {phaseWorkers.length}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {phaseWorkers.slice(0, 4).map((worker) => {
                      const isAggregator = phase === ProofPhase.Aggregation && assignedWorkers?.includes(worker.worker_id) && assignedWorkers.length === 1;
                      return (
                        <div
                          key={worker.worker_id}
                          className={`px-2 py-1 text-xs font-medium rounded-3xl border ${
                            isAggregator
                              ? 'bg-primary-light/40 text-primary border-primary/30 font-semibold'
                              : 'bg-white text-gray-900 border-neutral'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono">{worker.worker_id.substring(0, 8)}...</span>
                            {worker.compute_capacity && (
                              <span className="text-gray-900">({worker.compute_capacity} CU)</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {phaseWorkers.length > 4 && (
                      <div className="px-2 py-1 bg-neutral-light text-gray-900 text-xs font-medium rounded-3xl border border-neutral">
                        +{phaseWorkers.length - 4} more
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Aggregator Status for Aggregate Phase */}
              {phase === ProofPhase.Aggregation && assignedWorkers && assignedWorkers.length === 0 && (
                <div className="pt-3 border-t border-gray-200">
                  <div className="text-xs text-gray-800">
                    Aggregator will be assigned when Phase 2 completes
                  </div>
                </div>
              )}
            </div>
          );
        })}
        </div>

        {/* Summary Footer */}
        <div className="mt-4 pt-4 border-t border-neutral">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="border border-neutral rounded-3xl p-3 bg-neutral-light">
              <div className="text-xs text-gray-900 font-medium mb-1">Total Duration</div>
              <div className="text-lg font-semibold text-gray-900">
                {formatDuration(totalDuration)}
              </div>
            </div>
            <div className="border border-primary/30 rounded-3xl p-3 bg-primary-light/30">
              <div className="text-xs text-gray-900 font-medium mb-1">Current Phase</div>
              <div className="text-lg font-semibold text-primary">
                {getPhaseName(currentPhase)}
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            {assignedWorkers.length > 0 && (
              <div className="border border-neutral rounded-3xl p-3 bg-neutral-light">
                <div className="text-xs text-gray-900 font-medium mb-1">Workers</div>
                <div className="text-sm font-semibold text-gray-900">
                  {assignedWorkers.length} worker{assignedWorkers.length !== 1 ? 's' : ''}
                </div>
              </div>
            )}
            
            {computeCapacityRequired && (
              <div className="border border-neutral rounded-3xl p-3 bg-neutral-light">
                <div className="text-xs text-gray-900 font-medium mb-1">Capacity</div>
                <div className="text-sm font-semibold text-gray-900">
                  {computeCapacityRequired} CU
                </div>
              </div>
            )}
            
            {aggregatorWorkerId && (
              <div className="border border-primary/30 rounded-3xl p-3 bg-primary-light/30 col-span-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-gray-900 font-medium mb-1">Aggregator Worker</div>
                    <div className="text-sm font-semibold text-primary font-mono">
                      {aggregatorWorkerId.substring(0, 16)}...
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {executionMode === 'simulation' && (
              <div className="border border-gray-300 rounded-3xl p-3 bg-gray-100 col-span-2">
                <div className="flex items-center gap-2">
                  <div>
                    <div className="text-xs text-gray-900 font-medium">Execution Mode</div>
                    <div className="text-sm font-semibold text-primary">Simulation Mode</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

