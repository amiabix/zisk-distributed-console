import { ProofPhase, getPhaseName } from '../types/models';
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
  workers?: any[];
}

export default function PhaseTimeline({
  currentPhase,
  phaseStartTimes,
  phaseDurations,
  totalDuration,
}: PhaseTimelineProps) {
  const phases: ProofPhase[] = [ProofPhase.Contribution, ProofPhase.Prove, ProofPhase.Aggregation];

  const getPhaseStatus = (phase: ProofPhase): 'completed' | 'active' | 'pending' => {
    const currentIndex = phases.indexOf(currentPhase);
    const phaseIndex = phases.indexOf(phase);
    if (phaseIndex < currentIndex) return 'completed';
    if (phaseIndex === currentIndex) return 'active';
    return 'pending';
  };

  const getPhaseDuration = (phase: ProofPhase): number => {
    if (phaseDurations?.has(phase)) {
      return phaseDurations.get(phase)!;
    }
    const startTime = phaseStartTimes?.get(phase);
    if (!startTime) return 0;
    if (getPhaseStatus(phase) === 'active') {
      return Date.now() - startTime;
    }
    return 0;
  };

  return (
    <div className="glass p-4">
      <div className="text-sm font-semibold text-[#2d2926] mb-4">
        <div className="w-10 h-10 rounded-xl bg-primary-500 inline-flex items-center justify-center mr-3">
          <Clock className="w-5 h-5 text-white" />
        </div>
        Proof Generation Timeline
      </div>
      <div className="space-y-3">
        {phases.map((phase, index) => {
          const status = getPhaseStatus(phase);
          const duration = getPhaseDuration(phase);
          const isCompleted = status === 'completed';
          const isActive = status === 'active';

          return (
            <div key={phase} className="border border-[#e8e4e0] rounded-xl p-3">
              <div className="flex items-center gap-3 mb-2">
                {isCompleted ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                ) : isActive ? (
                  <Loader2 className="w-4 h-4 text-primary-500 animate-spin" />
                ) : (
                  <Clock className="w-4 h-4 text-[#9c9488]" />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[#2d2926]">
                      Phase {index + 1}: {getPhaseName(phase)}
                    </span>
                    {isActive && (
                      <span className="px-2 py-0.5 bg-primary-500 text-white text-xs font-medium rounded-xl">
                        ACTIVE
                      </span>
                    )}
                    {isCompleted && (
                      <span className="px-2 py-0.5 bg-green-500 text-white text-xs font-medium rounded-xl">
                        COMPLETED
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {duration > 0 && (
                <div className="text-xs text-[#6b6560] ml-7">
                  Duration: {formatDuration(duration)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
