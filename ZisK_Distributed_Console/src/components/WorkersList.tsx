import { WorkerData } from '../types/models';
import WorkerCard from './WorkerCard';

interface WorkersListProps {
  workers: WorkerData[];
  scrollOffset: number;
}

export default function WorkersList({
  workers,
  scrollOffset,
}: WorkersListProps) {
  const visibleWorkers = workers.slice(scrollOffset, scrollOffset + 8);

  return (
    <div className="border-b border-gray-700 pb-3 mb-3">
      <div className="text-cyan-400 font-mono mb-2">
        WORKERS {workers.length > 8 ? '(scroll with ↑/↓)' : ''}:
      </div>
      {visibleWorkers.length === 0 ? (
        <div className="text-gray-800 font-mono text-sm">No workers available</div>
      ) : (
        <div className="space-y-2">
          {visibleWorkers.map((worker, idx) => (
            <WorkerCard
              key={worker.worker_id}
              worker={worker}
              index={scrollOffset + idx}
            />
          ))}
        </div>
      )}
      {workers.length > 8 && (
        <div className="text-gray-800 font-mono text-xs mt-2 text-center">
          Showing {scrollOffset + 1}-{Math.min(scrollOffset + 8, workers.length)}{' '}
          of {workers.length}
        </div>
      )}
    </div>
  );
}
