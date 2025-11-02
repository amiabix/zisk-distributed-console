import { useState, useEffect } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import LoadingState from './components/LoadingState';
import { useDashboard } from './hooks/useDashboard';
import { useKeyboard } from './hooks/useKeyboard';
import Header from './components/Header';
import DashboardGrid from './components/DashboardGrid';
import SystemInfo from './components/SystemInfo';
import Footer from './components/Footer';
import HelpOverlay from './components/HelpOverlay';
import ProofsList from './components/ProofsList';
import { CoordinatorStatus } from './types/models';

function App() {
  const [showHelp, setShowHelp] = useState(false);

  // Get coordinator URL from env, URL params, or default
  // Default to gateway (8080) which proxies to coordinator (50051)
  const urlParams = new URLSearchParams(window.location.search);
  const coordinatorUrl = 
    urlParams.get('coordinator') || 
    import.meta.env.VITE_COORDINATOR_URL || 
    'http://localhost:8080';
  
  // Job ID can be null for auto-discovery
  const jobId = 
    urlParams.get('job') || 
    (import.meta.env.VITE_JOB_ID || null);
  
  // Default to false (use real coordinator) unless explicitly set to 'true'
  const useMockData = import.meta.env.VITE_USE_MOCK_DATA === 'true';

  const { state, latestSnapshot, progress, coordinatorInfo, actions } = useDashboard(
    coordinatorUrl,
    jobId,
    useMockData
  );

  useKeyboard({
    onQuit: () => {
      if (confirm('Are you sure you want to quit the dashboard?')) {
        window.close();
      }
    },
    onPause: actions.pause,
    onResume: actions.resume,
    onScrollUp: actions.scrollUp,
    onScrollDown: actions.scrollDown,
    onClearError: actions.clearError,
    onHelp: () => setShowHelp(true),
  });

  // Close help overlay on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showHelp) {
        setShowHelp(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showHelp]);

  // Show loading state while connecting
  if (state.coordinator_status === CoordinatorStatus.Connecting && !latestSnapshot) {
    return <LoadingState message="Connecting to coordinator..." />;
  }

  return (
    <div className="min-h-screen bg-neutral-light text-gray-900 p-4 sm:p-6 overflow-auto scrollbar-thin">
      <div className="max-w-[1920px] mx-auto space-y-4">
        {/* Header Section */}
        <Header
            jobStatus={latestSnapshot?.job_status || null}
            workerCount={latestSnapshot?.workers.filter(w => w.state === 'Computing').length || 0}
            totalWorkers={latestSnapshot?.system_status?.total_workers || 0}
            progress={progress}
            coordinatorInfo={coordinatorInfo}
          />

        {/* Main Dashboard Grid */}
        <DashboardGrid
          workers={latestSnapshot?.workers || []}
          systemStatus={latestSnapshot?.system_status || null}
          jobStatus={latestSnapshot?.job_status || null}
          history={state.history}
        />

        {/* Generated Proofs List */}
        <ProofsList coordinatorUrl={coordinatorUrl} />

        {/* System Info & Footer */}
        <div className="space-y-4">
          <SystemInfo
            systemStatus={latestSnapshot?.system_status || null}
            lastUpdate={latestSnapshot?.timestamp || Date.now()}
            requestLatency={latestSnapshot?.request_latency_ms || 0}
          />

          <Footer
            paused={state.paused}
            coordinatorStatus={state.coordinator_status}
            errorMessage={state.error_message}
            disconnectedReason={state.disconnected_reason}
            retryInSecs={state.retry_in_secs}
          />
        </div>

        {useMockData && (
          <div className="mt-4 p-3 bg-neutral-light border border-neutral rounded-xl">
            <span className="text-gray-800 font-mono text-sm">
              Running in DEMO MODE with mock data. Set VITE_USE_MOCK_DATA=false to connect to real coordinator.
            </span>
          </div>
        )}
      </div>

      {showHelp && <HelpOverlay onClose={() => setShowHelp(false)} />}
    </div>
  );
}

function AppWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

export default AppWithErrorBoundary;
