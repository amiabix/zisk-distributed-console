interface HelpOverlayProps {
  onClose: () => void;
}

export default function HelpOverlay({ onClose }: HelpOverlayProps) {
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div 
        className="glass-strong rounded-4xl shadow-2xl p-6 max-w-2xl mx-4 border border-white/20"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-display font-bold text-primary-dark mb-4">
          ZisK Dashboard - Help
        </h2>
        <div className="space-y-4 text-sm">
          <div className="border-b border-white/10 pb-3">
            <h3 className="text-gray-50 font-display font-semibold mb-2">Keyboard Controls:</h3>
            <div className="space-y-1.5 text-gray-300">
              <div className="font-mono">
                <span className="text-primary-dark font-display font-bold">[q]</span> - Quit dashboard
              </div>
              <div className="font-mono">
                <span className="text-primary-dark font-display font-bold">[p]</span> - Pause polling
              </div>
              <div className="font-mono">
                <span className="text-primary-dark font-display font-bold">[r]</span> - Resume polling
              </div>
              <div className="font-mono">
                <span className="text-primary-dark font-display font-bold">[↑/↓]</span> - Scroll worker list
              </div>
              <div className="font-mono">
                <span className="text-primary-dark font-display font-bold">[c]</span> - Clear error message
              </div>
              <div className="font-mono">
                <span className="text-primary-dark font-display font-bold">[?]</span> - Show this help
              </div>
            </div>
          </div>
          <div className="border-b border-white/10 pb-3">
            <h3 className="text-gray-50 font-display font-semibold mb-2">Health Indicators:</h3>
            <div className="space-y-1.5 text-gray-300">
              <div>
                <span className="text-primary-dark font-display font-semibold">Healthy</span> - Worker heartbeat &lt; 10 seconds ago
              </div>
              <div>
                <span className="text-gray-400 font-display font-semibold">Stale</span> - Worker heartbeat 10-45 seconds ago
              </div>
              <div>
                <span className="text-gray-500 font-display font-semibold">Disconnected</span> - Worker heartbeat &gt; 45 seconds ago
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-gray-50 font-display font-semibold mb-2">About:</h3>
            <div className="text-gray-300 space-y-2">
              <p>
                This dashboard monitors ZisK distributed proof generation in real-time.
              </p>
              <p className="text-xs text-gray-400 font-mono">
                Polling interval: 1 second | Max history: 120 snapshots (2 minutes)
              </p>
            </div>
          </div>
        </div>
        <div className="mt-6 text-center text-gray-400 text-sm font-medium">
          Press any key or click to close
        </div>
      </div>
    </div>
  );
}
