import { CoordinatorStatus } from '../types/models';

interface FooterProps {
  paused: boolean;
  coordinatorStatus: CoordinatorStatus;
  errorMessage: string | null;
  disconnectedReason?: string;
  retryInSecs?: number;
}

export default function Footer({
  paused,
  coordinatorStatus,
  errorMessage,
  disconnectedReason,
  retryInSecs,
}: FooterProps) {
  return (
    <div className="space-y-3">
      {errorMessage && (
        <div className="bg-neutral-light border border-neutral rounded-4xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-gray-900 font-semibold text-sm">Error</span>
          </div>
          <p className="text-gray-700 text-sm">{errorMessage}</p>
          {coordinatorStatus === CoordinatorStatus.Disconnected &&
            retryInSecs && (
              <p className="text-gray-800 text-xs mt-1">
                Will retry in {retryInSecs}s
              </p>
            )}
        </div>
      )}
      {coordinatorStatus === CoordinatorStatus.Connecting && (
        <div className="bg-neutral-light border border-neutral rounded-4xl p-4">
          <div className="flex items-center gap-2">
            <span className="text-gray-900 font-medium text-sm">
              Connecting to coordinator...
            </span>
          </div>
        </div>
      )}
      {paused && (
        <div className="bg-neutral-light border border-neutral rounded-4xl p-4">
          <div className="flex items-center gap-2">
            <span className="text-gray-900 font-medium text-sm">
              Paused - Press [r] to resume
            </span>
          </div>
        </div>
      )}
      <div className="bg-white border border-neutral rounded-4xl px-4 py-3">
        <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-gray-800">
          <span className="text-gray-900 font-semibold">[q]</span>uit
          <span className="text-gray-900 font-semibold">[p]</span>ause
          <span className="text-gray-900 font-semibold">[r]</span>esume
          <span className="text-gray-900 font-semibold">[?]</span>help
          <span className="text-gray-900 font-semibold">[c]</span>lear error
        </div>
      </div>
    </div>
  );
}
