import { useState, useEffect, useCallback, useRef } from 'react';
import {
  AppState,
  CoordinatorStatus,
  getPhaseProgress,
} from '../types/models';
import { CoordinatorClient, createMockSnapshot } from '../services/coordinatorClient';

const POLL_INTERVAL_MS = 1000;
const MAX_HISTORY = 120;
const RECONNECT_INTERVAL_MS = 10000;
const MAX_CONSECUTIVE_FAILURES = 3;
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;

export function useDashboard(
  coordinatorUrl: string,
  jobId: string | null = null,
  useMockData: boolean = false
) {
  const [state, setState] = useState<AppState>({
    history: [],
    coordinator_status: CoordinatorStatus.Connecting,
    error_message: null,
    paused: false,
    worker_scroll_offset: 0,
    selected_worker: null,
  });

  const [discoveredJobId, setDiscoveredJobId] = useState<string | null>(jobId);
  const [coordinatorInfo, setCoordinatorInfo] = useState<{
    coordinator_url: string;
    coordinator_host: string;
    coordinator_port: number;
    gateway_port: number;
    status: string;
    total_workers?: number;
    active_jobs?: number;
  } | null>(null);
  const clientRef = useRef<CoordinatorClient | null>(null);
  const consecutiveFailures = useRef(0);
  const currentBackoffMs = useRef(INITIAL_BACKOFF_MS);
  const intervalIdRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const autoDiscoveryAttempted = useRef(false);

  useEffect(() => {
    if (!useMockData) {
      const client = new CoordinatorClient(coordinatorUrl, jobId);
      clientRef.current = client;

      // Fetch coordinator connection info immediately
      client.getCoordinatorInfo()
        .then((info) => {
          if (info) {
            console.log('📡 Coordinator info fetched:', info);
            setCoordinatorInfo(info);
          } else {
            console.warn('⚠️ Coordinator info was null');
          }
        })
        .catch((error) => {
          console.error('❌ Failed to fetch coordinator info:', error);
        });

      // Auto-discover job if not provided
      if (!jobId && !autoDiscoveryAttempted.current) {
        autoDiscoveryAttempted.current = true;
        client.autoDiscoverJob()
          .then((discoveredId) => {
            if (discoveredId) {
              setDiscoveredJobId(discoveredId);
              client.setJobId(discoveredId);
            }
          })
          .catch((error) => {
            console.warn('Auto-discovery failed, will continue polling:', error);
          });
      }
    }
  }, [coordinatorUrl, jobId, useMockData]);

  const pollCoordinator = useCallback(async () => {
    if (state.paused) {
      return;
    }

    // If not using mock data, ensure client is initialized
    if (!useMockData && !clientRef.current) {
      console.warn('Coordinator client not initialized yet, skipping poll');
      return;
    }

    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      let snapshot;

      if (useMockData) {
        // Simulate realistic progress based on phase and duration
        snapshot = createMockSnapshot();
        const elapsed = Date.now() - snapshot.job_status!.start_time_unix_ms;
        snapshot.duration_ms = elapsed;
        snapshot.job_status!.duration_ms = elapsed;
      } else {
        if (!clientRef.current) {
          console.warn('Coordinator client not initialized');
          return;
        }
        snapshot = await clientRef.current.pollCoordinator(abortControllerRef.current.signal);
        
        // Log successful fetch for debugging
        if (snapshot.system_status) {
          console.log('✅ Fetched coordinator data:', {
            workers: snapshot.system_status.total_workers,
            jobs: snapshot.system_status.active_jobs,
            timestamp: new Date(snapshot.timestamp).toISOString()
          });
        }
      }

      // Use actual metrics from workers (no mock data)
      setState((prev) => {
        const newHistory = [...prev.history, snapshot];
        if (newHistory.length > MAX_HISTORY) {
          newHistory.shift();
        }

        return {
          ...prev,
          history: newHistory,
          coordinator_status: CoordinatorStatus.Connected,
          error_message: null,
          disconnected_reason: undefined,
          retry_in_secs: undefined,
        };
      });

      // Reset failure tracking on success
      consecutiveFailures.current = 0;
      currentBackoffMs.current = INITIAL_BACKOFF_MS;

      // Update discovered job ID if we got a job status
      if (snapshot.job_status && !discoveredJobId && clientRef.current) {
        setDiscoveredJobId(snapshot.job_status.job_id);
        clientRef.current.setJobId(snapshot.job_status.job_id);
      }
    } catch (error) {
      // Don't process errors if request was aborted
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }

      // Log error for debugging
      console.error('❌ Poll error:', error instanceof Error ? error.message : error);

      consecutiveFailures.current += 1;
      const isCriticalFailure = consecutiveFailures.current >= MAX_CONSECUTIVE_FAILURES;

      if (isCriticalFailure) {
        setState((prev) => ({
          ...prev,
          coordinator_status: CoordinatorStatus.Disconnected,
          error_message: `Coordinator unreachable: ${error instanceof Error ? error.message : 'Unknown error'}`,
          disconnected_reason: error instanceof Error ? error.message : 'Unknown error',
          retry_in_secs: Math.floor(RECONNECT_INTERVAL_MS / 1000),
        }));

        // Exponential backoff with cap
        currentBackoffMs.current = Math.min(
          currentBackoffMs.current * 2,
          MAX_BACKOFF_MS
        );
      } else {
        // Linear backoff for minor failures
        currentBackoffMs.current = Math.min(
          INITIAL_BACKOFF_MS * (consecutiveFailures.current + 1),
          MAX_BACKOFF_MS
        );
        console.warn(
          `Poll failed (${consecutiveFailures.current}/${MAX_CONSECUTIVE_FAILURES}):`,
          error
        );
      }
    }
  }, [state.paused, useMockData]);

  const getPollInterval = useCallback(() => {
    if (consecutiveFailures.current >= MAX_CONSECUTIVE_FAILURES) {
      return RECONNECT_INTERVAL_MS;
    }
    return currentBackoffMs.current || POLL_INTERVAL_MS;
  }, []);

  useEffect(() => {
    // Clear any existing interval
    if (intervalIdRef.current !== null) {
      clearInterval(intervalIdRef.current);
    }

    // Initial poll - wait a bit for client to be initialized if not using mock data
    if (useMockData || clientRef.current) {
      pollCoordinator();
    } else {
      // Wait for client initialization
      const timeoutId = setTimeout(() => {
        if (clientRef.current) {
          pollCoordinator();
        }
      }, 500);
      return () => clearTimeout(timeoutId);
    }

    // Set up interval with dynamic backoff
    const setupInterval = () => {
      if (state.paused) {
        return; // Don't poll when paused
      }

      const interval = getPollInterval();
      if (interval === null) return;

      intervalIdRef.current = window.setInterval(() => {
        pollCoordinator();
      }, interval);
    };

    setupInterval();

    return () => {
      if (intervalIdRef.current !== null) {
        clearInterval(intervalIdRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [pollCoordinator, state.paused, getPollInterval, useMockData]);

  const pause = useCallback(() => {
    setState((prev) => ({ ...prev, paused: true }));
    if (intervalIdRef.current !== null) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
  }, []);

  const resume = useCallback(() => {
    setState((prev) => ({ ...prev, paused: false }));
    // Restart polling
    pollCoordinator();
    const interval = getPollInterval();
    if (interval !== null) {
      intervalIdRef.current = window.setInterval(() => {
        pollCoordinator();
      }, interval);
    }
  }, [pollCoordinator, getPollInterval]);

  const scrollUp = useCallback(() => {
    setState((prev) => ({
      ...prev,
      worker_scroll_offset: Math.max(0, prev.worker_scroll_offset - 1),
    }));
  }, []);

  const scrollDown = useCallback(() => {
    setState((prev) => {
      const latestSnapshot = prev.history[prev.history.length - 1];
      const maxScroll = Math.max(
        0,
        (latestSnapshot?.workers.length || 0) - 8
      );
      return {
        ...prev,
        worker_scroll_offset: Math.min(
          maxScroll,
          prev.worker_scroll_offset + 1
        ),
      };
    });
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error_message: null }));
  }, []);

  const latestSnapshot = state.history[state.history.length - 1];
  // Calculate progress based on phase only (no random values)
  const progress = latestSnapshot?.job_status
    ? getPhaseProgress(latestSnapshot.job_status.phase)
    : 0;

  return {
    state,
    latestSnapshot,
    progress,
    coordinatorInfo,
    actions: {
      pause,
      resume,
      scrollUp,
      scrollDown,
      clearError,
    },
  };
}
