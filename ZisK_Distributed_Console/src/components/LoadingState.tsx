import LoadingSpinner from './LoadingSpinner';

export default function LoadingState({ message = 'Loading dashboard...' }: { message?: string }) {
  return (
    <div className="min-h-screen bg-neutral-light text-gray-900 p-4 flex items-center justify-center">
      <div className="text-center">
        <LoadingSpinner size="lg" className="mx-auto mb-4" />
        <div className="text-primary font-semibold text-lg">{message}</div>
        <div className="text-gray-800 text-sm mt-2">Connecting to coordinator...</div>
      </div>
    </div>
  );
}

