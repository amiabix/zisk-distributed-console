import { useState, useEffect } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useDashboard } from './hooks/useDashboard';
import { useKeyboard } from './hooks/useKeyboard';
import Header from './components/Header';
import DashboardGrid from './components/DashboardGrid';
import Footer from './components/Footer';
import HelpOverlay from './components/HelpOverlay';
import ProofsList from './components/ProofsList';
import LaunchProofModal from './components/LaunchProofModal';
import JobHistory from './components/JobHistory';
import WorkerDetailModal from './components/WorkerDetailModal';
import CoordinatorControl from './components/CoordinatorControl';
import WorkerManagement from './components/WorkerManagement';
import { WorkerData } from './types/models';
import { Play, Clock, Activity } from 'lucide-react';

function App() {
  const [showHelp, setShowHelp] = useState(false);
  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [showJobHistory, setShowJobHistory] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<WorkerData | null>(null);

  const urlParams = new URLSearchParams(window.location.search);
  const coordinatorUrl = 
    urlParams.get('coordinator') || 
    import.meta.env.VITE_COORDINATOR_URL || 
    'http://localhost:8080';
  
  const gatewayUrl = coordinatorUrl.replace('localhost:50051', 'http://localhost:8080')
                                    .replace('127.0.0.1:50051', 'http://localhost:8080')
                                    .startsWith('http') ? coordinatorUrl : `http://${coordinatorUrl}`;
  
  const jobId = 
    urlParams.get('job') || 
    (import.meta.env.VITE_JOB_ID || null);
  
  const useMockData = import.meta.env.VITE_USE_MOCK_DATA === 'true';

  const [currentJobId, setCurrentJobId] = useState<string | null>(jobId);
  
  const { state, latestSnapshot, progress, coordinatorInfo, actions } = useDashboard(
    coordinatorUrl,
    currentJobId,
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

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showHelp) {
        setShowHelp(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showHelp]);

  const handleLaunchSuccess = (jobId: string) => {
    setCurrentJobId(jobId);
    setShowLaunchModal(false);
    const url = new URL(window.location.href);
    url.searchParams.set('job', jobId);
    window.history.pushState({}, '', url);
  };

  const handleJobSelect = (jobId: string) => {
    setCurrentJobId(jobId);
    setShowJobHistory(false);
    const url = new URL(window.location.href);
    url.searchParams.set('job', jobId);
    window.history.pushState({}, '', url);
  };

  return (
      <div className="min-h-screen bg-[#faf9f6] p-4 sm:p-6 overflow-auto">
        <div className="max-w-[1920px] mx-auto space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <Header
                jobStatus={latestSnapshot?.job_status || null}
                workerCount={latestSnapshot?.workers?.filter(w => w.state === 'Computing').length || 0}
                totalWorkers={latestSnapshot?.system_status?.total_workers || 0}
                progress={progress}
                coordinatorInfo={coordinatorInfo}
                coordinatorStatus={state.coordinator_status}
                systemStatus={latestSnapshot?.system_status || null}
                lastUpdate={latestSnapshot?.timestamp || Date.now()}
                requestLatency={latestSnapshot?.request_latency_ms || 0}
              />
            </div>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setShowLaunchModal(true)}
              className="px-6 py-3 bg-primary-500 text-white rounded-xl border border-primary-600 hover:bg-primary-600 font-semibold text-base transition-all flex items-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <Play className="w-5 h-5" />
              Launch Proof
            </button>
            <button
              onClick={() => setShowJobHistory(!showJobHistory)}
              className="px-6 py-3 bg-white text-[#6b6560] rounded-xl border border-[#e8e4e0] hover:bg-[#f5f3f0] font-medium text-sm transition-colors flex items-center gap-2 shadow-sm"
            >
              <Clock className="w-4 h-4" />
              {showJobHistory ? 'Hide' : 'Show'} History
            </button>
            {!latestSnapshot?.job_status && (!latestSnapshot?.system_status || (latestSnapshot.system_status.active_jobs ?? 0) === 0) && (
              <div className="mt-2 text-center">
                <p className="text-xs text-[#6b6560]">No active jobs</p>
                <p className="text-xs text-[#9c9488] mt-0.5">Click "Launch Proof" to start</p>
              </div>
            )}
          </div>
        </div>

        {showJobHistory && (
          <JobHistory
            coordinatorUrl={coordinatorUrl}
            onSelectJob={handleJobSelect}
          />
        )}

        <div className="border-t border-[#e8e4e0] pt-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-primary-500 flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-[#2d2926]">System Management</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CoordinatorControl 
              gatewayUrl={gatewayUrl} 
              connectionStatus={state.coordinator_status}
            />
            <WorkerManagement gatewayUrl={gatewayUrl} />
          </div>
        </div>

        <DashboardGrid
          workers={latestSnapshot?.workers || []}
          systemStatus={latestSnapshot?.system_status || null}
          jobStatus={latestSnapshot?.job_status || null}
          history={state.history}
          onWorkerClick={(worker) => setSelectedWorker(worker)}
        />

        <ProofsList coordinatorUrl={coordinatorUrl} />

        <div className="space-y-4">
          <Footer
            paused={state.paused}
            coordinatorStatus={state.coordinator_status}
            errorMessage={state.error_message}
            disconnectedReason={state.disconnected_reason}
            retryInSecs={state.retry_in_secs}
          />
        </div>

        {useMockData && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
            <span className="text-yellow-800 font-mono text-sm font-medium">
              Running in DEMO MODE with mock data. Set VITE_USE_MOCK_DATA=false to connect to real coordinator.
            </span>
          </div>
        )}
      </div>

      {showHelp && <HelpOverlay onClose={() => setShowHelp(false)} />}

          <LaunchProofModal
        coordinatorUrl={coordinatorUrl}
        isOpen={showLaunchModal}
        onClose={() => setShowLaunchModal(false)}
        onSuccess={handleLaunchSuccess}
      />

          {selectedWorker && (
        <WorkerDetailModal
          worker={selectedWorker}
          history={state.history}
          isOpen={!!selectedWorker}
          onClose={() => setSelectedWorker(null)}
        />
      )}
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
