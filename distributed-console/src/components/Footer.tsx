import { CoordinatorStatus } from '../types/models';
import { AlertCircle, WifiOff, RefreshCw } from 'lucide-react';

interface FooterProps {
  paused: boolean;
  coordinatorStatus: CoordinatorStatus;
  errorMessage: string | null;
  disconnectedReason?: string;
  retryInSecs?: number;
}

function getErrorDetails(errorMessage: string | null, status: CoordinatorStatus): {
  title: string;
  suggestion: string;
  icon: typeof AlertCircle;
} {
  if (!errorMessage) {
    return { title: 'No errors', suggestion: '', icon: AlertCircle };
  }

  const lowerError = errorMessage.toLowerCase();

  if (lowerError.includes('failed to fetch') || lowerError.includes('network')) {
    return {
      title: 'Network Connection Error',
      suggestion: 'Check if the gateway server is running on port 8080.',
      icon: WifiOff,
    };
  }

  if (lowerError.includes('coordinator unreachable') || status === CoordinatorStatus.Disconnected) {
    return {
      title: 'Coordinator Unreachable',
      suggestion: 'Verify the coordinator is running.',
      icon: WifiOff,
    };
  }

  return {
    title: 'Error',
    suggestion: 'Check browser console and coordinator logs for more details.',
    icon: AlertCircle,
  };
}

export default function Footer({
  paused,
  coordinatorStatus,
  errorMessage,
  disconnectedReason,
  retryInSecs,
}: FooterProps) {
  const errorDetails = getErrorDetails(errorMessage, coordinatorStatus);
  const ErrorIcon = errorDetails.icon;

  return (
    <div className="space-y-3">
      {errorMessage && (
        <div className="glass p-4 border-red-200 bg-red-50 rounded-xl">
          <div className="flex items-start gap-3">
            <ErrorIcon className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-red-900 font-semibold text-sm mb-1">{errorDetails.title}</div>
              <p className="text-red-700 text-sm mb-2">{errorMessage}</p>
              {errorDetails.suggestion && (
                <div className="bg-white border border-red-200 rounded-xl p-2 mt-2">
                  <div className="text-xs text-red-800 font-medium mb-1">Suggestion:</div>
                  <div className="text-xs text-red-700">{errorDetails.suggestion}</div>
                </div>
              )}
              {coordinatorStatus === CoordinatorStatus.Disconnected && retryInSecs && (
                <div className="flex items-center gap-2 mt-2 text-xs text-red-700">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>Retrying in {retryInSecs} seconds...</span>
                </div>
              )}
              {disconnectedReason && disconnectedReason !== errorMessage && (
                <div className="text-xs text-red-700 mt-1">Reason: {disconnectedReason}</div>
              )}
            </div>
          </div>
        </div>
      )}
      {paused && (
        <div className="glass p-4">
          <div className="flex items-center gap-2">
            <span className="text-[#6b6560] font-medium text-sm">⏸️ Paused - Press [r] to resume</span>
          </div>
        </div>
      )}
      <div className="glass p-4">
        <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-[#6b6560]">
          <span><span className="text-primary-500 font-semibold">[q]</span>uit</span>
          <span><span className="text-primary-500 font-semibold">[p]</span>ause</span>
          <span><span className="text-primary-500 font-semibold">[r]</span>esume</span>
          <span><span className="text-primary-500 font-semibold">[?]</span>help</span>
          <span><span className="text-primary-500 font-semibold">[c]</span>lear error</span>
        </div>
      </div>
    </div>
  );
}
