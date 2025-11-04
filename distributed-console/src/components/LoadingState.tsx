import { Loader2 } from 'lucide-react';

export default function LoadingState({ message = 'Loading dashboard...' }: { message?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#faf9f6]">
      <div className="glass rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-xl bg-primary-500 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-[#2d2926] mb-2">ZisK Dashboard</h2>
            <p className="text-sm text-[#6b6560] font-medium">{message}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
