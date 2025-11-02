interface HelpOverlayProps {
  onClose: () => void;
}

export default function HelpOverlay({ onClose }: HelpOverlayProps) {
  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div className="bg-white border-2 border-primary rounded-4xl p-6 max-w-2xl mx-4 shadow-xl">
        <h2 className="text-2xl font-semibold text-primary mb-4">
          ZisK Dashboard - Help
        </h2>
        <div className="space-y-3 text-sm">
          <div className="border-b border-neutral pb-2">
            <h3 className="text-gray-900 font-semibold mb-2">Keyboard Controls:</h3>
            <div className="space-y-1 text-gray-900">
              <div>
                <span className="text-gray-900 font-semibold">[q]</span> - Quit dashboard
              </div>
              <div>
                <span className="text-gray-900 font-semibold">[p]</span> - Pause polling
              </div>
              <div>
                <span className="text-gray-900 font-semibold">[r]</span> - Resume polling
              </div>
              <div>
                <span className="text-gray-900 font-semibold">[↑/↓]</span> - Scroll worker list
              </div>
              <div>
                <span className="text-gray-900 font-semibold">[c]</span> - Clear error message
              </div>
              <div>
                <span className="text-gray-900 font-semibold">[?]</span> - Show this help
              </div>
            </div>
          </div>
          <div className="border-b border-neutral pb-2">
            <h3 className="text-gray-900 font-semibold mb-2">Health Indicators:</h3>
            <div className="space-y-1 text-gray-900">
              <div>
                <span className="text-primary font-semibold">Healthy</span> - Worker heartbeat
                &lt; 5 seconds ago
              </div>
              <div>
                <span className="text-gray-900 font-semibold">Stale</span> - Worker
                heartbeat 5-30 seconds ago
              </div>
              <div>
                <span className="text-gray-800 font-semibold">Disconnected</span> - Worker
                heartbeat &gt; 30 seconds ago
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-gray-900 font-semibold mb-2">About:</h3>
            <div className="text-gray-900">
              <p>
                This dashboard monitors ZisK distributed proof generation in
                real-time.
              </p>
              <p className="mt-2">
                Polling interval: 1 second | Max history: 120 snapshots (2
                minutes)
              </p>
            </div>
          </div>
        </div>
        <div className="mt-6 text-center text-gray-800 text-sm">
          Press any key or click to close
        </div>
      </div>
    </div>
  );
}
