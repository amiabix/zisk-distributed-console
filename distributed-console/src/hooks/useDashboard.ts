import { useState, useEffect, useCallback, useRef } from 'react';
import {
  AppState,
  CoordinatorStatus,
  getPhaseProgress,
} from '../types/models';
import { CoordinatorClient } from '../services/coordinatorClient';
import { createMockSnapshot } from '../utils/mockData';

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
  const pollInProgressRef = useRef(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!useMockData) {
      if (clientRef.current) {
        const currentJobId = clientRef.current.getJobId();
        if (currentJobId !== jobId) {
          clientRef.current.setJobId(jobId);
          setDiscoveredJobId(jobId);
          setTimeout(() => pollCoordinator(), 100);
          return;
        }
      }

      const client = new CoordinatorClient(coordinatorUrl, jobId);
      clientRef.current = client;

      client.getCoordinatorInfo()
        .then((info) => {
          if (info) {
            setCoordinatorInfo(info);
          } else {
            console.warn('Coordinator info was null');
          }
        })
        .catch((error) => {
          console.error('Failed to fetch coordinator info:', error);
        });

      if (!jobId) {
        client.autoDiscoverJob()
          .then((discoveredId) => {
            if (discoveredId) {
              setDiscoveredJobId(discoveredId);
              client.setJobId(discoveredId);
            }
            autoDiscoveryAttempted.current = true;
          })
          .catch((error) => {
            console.warn('Auto-discovery failed:', error);
            autoDiscoveryAttempted.current = true;
          });
      } else {
        setDiscoveredJobId(jobId);
        autoDiscoveryAttempted.current = true;
      }
    }
  }, [coordinatorUrl, jobId, useMockData]);

  const pollCoordinator = useCallback(async () => {
    if (state.paused) {
      return;
    }

    if (pollInProgressRef.current) {
      return;
    }

    if (!useMockData && !clientRef.current) {
      console.warn('Coordinator client not initialized yet, skipping poll');
      return;
    }

    pollInProgressRef.current = true;
    const currentRequestId = ++requestIdRef.current;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      let snapshot;

      if (useMockData) {
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
      }

      if (currentRequestId !== requestIdRef.current) {
        return;
      }

      setState((prev) => {
        const newHistory = prev.history.length >= MAX_HISTORY
          ? [...prev.history.slice(1), snapshot]
          : [...prev.history, snapshot];

        return {
          ...prev,
          history: newHistory,
          coordinator_status: CoordinatorStatus.Connected,
          error_message: null,
          disconnected_reason: undefined,
          retry_in_secs: undefined,
        };
      });

      consecutiveFailures.current = 0;
      currentBackoffMs.current = INITIAL_BACKOFF_MS;

      if (snapshot.job_status && clientRef.current) {
        const currentJobId = snapshot.job_status.job_id;
        if (currentJobId !== discoveredJobId) {
          setDiscoveredJobId(currentJobId);
          clientRef.current.setJobId(currentJobId);
          const url = new URL(window.location.href);
          url.searchParams.set('job', currentJobId);
          window.history.replaceState({}, '', url);
        }
      }
      
      if (!snapshot.job_status && clientRef.current && !clientRef.current.getJobId()) {
        const now = Date.now();
        const lastDiscoveryAttempt = (window as any).__lastDiscoveryAttempt || 0;
        if (now - lastDiscoveryAttempt > 5000) {
          (window as any).__lastDiscoveryAttempt = now;
          clientRef.current.autoDiscoverJob(abortControllerRef.current.signal)
            .then((discoveredId) => {
              if (discoveredId && clientRef.current) {
                setDiscoveredJobId(discoveredId);
                clientRef.current.setJobId(discoveredId);
                const url = new URL(window.location.href);
                url.searchParams.set('job', discoveredId);
                window.history.replaceState({}, '', url);
                setTimeout(() => pollCoordinator(), 100);
              }
            })
            .catch((err) => {
              if (!err.message?.includes('No jobs found')) {
                console.warn('Auto-discovery during poll failed:', err);
              }
            });
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }

      console.error('Poll error:', error instanceof Error ? error.message : error);

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

        currentBackoffMs.current = Math.min(
          currentBackoffMs.current * 2,
          MAX_BACKOFF_MS
        );
      } else {
        currentBackoffMs.current = Math.min(
          INITIAL_BACKOFF_MS * (consecutiveFailures.current + 1),
          MAX_BACKOFF_MS
        );
        console.warn(
          `Poll failed (${consecutiveFailures.current}/${MAX_CONSECUTIVE_FAILURES}):`,
          error
        );
      }
    } finally {
      pollInProgressRef.current = false;
    }
  }, [state.paused, useMockData]);

  const getPollInterval = useCallback(() => {
    if (consecutiveFailures.current >= MAX_CONSECUTIVE_FAILURES) {
      return RECONNECT_INTERVAL_MS;
    }
    return currentBackoffMs.current || POLL_INTERVAL_MS;
  }, []);

  useEffect(() => {
    if (intervalIdRef.current !== null) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }

    if (state.paused) {
      return;
    }

    let isMounted = true;
    let currentIntervalId: number | null = null;

    const scheduleNextPoll = async () => {
      if (!isMounted || state.paused) {
        return;
      }

      if (useMockData || clientRef.current) {
        await pollCoordinator();
      } else {
        await new Promise<void>((resolve) => {
          const timeoutId = setTimeout(() => {
            if (clientRef.current && isMounted) {
              pollCoordinator().then(() => {
                resolve();
              }).catch(() => {
                resolve();
              });
            } else {
              resolve();
            }
          }, 500);
          
          return () => {
            clearTimeout(timeoutId);
          };
        });
      }

      if (!isMounted || state.paused) {
        return;
      }

      const nextInterval = getPollInterval();
      if (nextInterval === null) {
        return;
      }

      currentIntervalId = window.setTimeout(() => {
        if (isMounted && !state.paused) {
          scheduleNextPoll();
        }
      }, nextInterval);
    };

    scheduleNextPoll();

    return () => {
      isMounted = false;
      if (currentIntervalId !== null) {
        clearTimeout(currentIntervalId);
      }
      if (intervalIdRef.current !== null) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [pollCoordinator, state.paused, useMockData, getPollInterval]);

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
