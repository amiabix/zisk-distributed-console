/**
 * Generic hook for fetching data with polling
 * Extracts the repeated fetch pattern used throughout the app
 * 
 * Features:
 * - Automatic retry with exponential backoff
 * - Request deduplication (prevents duplicate concurrent requests)
 * - Simple cache with TTL
 * - Proper error handling and recovery
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  POLLING_INTERVALS, 
  API_RETRY, 
  REQUEST_TIMEOUT_MS,
  TRANSIENT_ERROR_CODES,
  TRANSIENT_ERROR_PATTERNS,
  CACHE,
} from '../constants/config';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface UseFetchWithPollingOptions<T> {
  url: string;
  interval?: number;
  enabled?: boolean;
  transform?: (data: any) => T;
  onError?: (error: Error) => void;
  onSuccess?: (data: T) => void;
  maxRetries?: number;
  retryDelay?: number;
  cacheTime?: number;
  requestTimeout?: number;
}

interface UseFetchWithPollingResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Simple in-memory cache shared across all hook instances
const globalCache = new Map<string, CacheEntry<any>>();

// Track in-flight requests to prevent duplicates
const inFlightRequests = new Map<string, Promise<any>>();

function isTransientError(error: any): boolean {
  // Check HTTP status codes
  if (error.status && TRANSIENT_ERROR_CODES.includes(error.status as any)) {
    return true;
  }

  // Check error message patterns
  const message = error.message || String(error);
  return TRANSIENT_ERROR_PATTERNS.some(pattern => pattern.test(message));
}

function calculateBackoff(retryCount: number, baseDelay: number): number {
  const delay = baseDelay * Math.pow(API_RETRY.BACKOFF_MULTIPLIER, retryCount);
  return Math.min(delay, API_RETRY.MAX_DELAY_MS);
}

function isCacheValid<T>(entry: CacheEntry<T> | undefined): boolean {
  if (!entry) return false;
  return Date.now() - entry.timestamp < entry.ttl;
}

export function useFetchWithPolling<T = any>({
  url,
  interval = POLLING_INTERVALS.ACTIVE,
  enabled = true,
  transform,
  onError,
  onSuccess,
  maxRetries = API_RETRY.MAX_RETRIES,
  retryDelay = API_RETRY.INITIAL_DELAY_MS,
  cacheTime = CACHE.DEFAULT_TTL_MS,
  requestTimeout = REQUEST_TIMEOUT_MS,
}: UseFetchWithPollingOptions<T>): UseFetchWithPollingResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const intervalRef = useRef<number | null>(null);
  const retryCountRef = useRef(0);

  const fetchData = useCallback(async (isRetry = false): Promise<void> => {
    // Request deduplication: If same URL is already being fetched, reuse that request
    const existingRequest = inFlightRequests.get(url);
    if (existingRequest && !isRetry) {
      try {
        const result = await existingRequest;
        const transformed = transform ? transform(result) : result;
        setData(transformed);
        setError(null);
        if (onSuccess) onSuccess(transformed);
      } catch (err) {
        // Let original request handle error
      }
      return;
    }

    // Check cache first (only if not a retry)
    if (!isRetry) {
      const cacheKey = `${url}:${transform ? 'transformed' : 'raw'}`;
      const cached = globalCache.get(cacheKey);
      if (isCacheValid(cached)) {
        setData(cached!.data);
        setError(null);
        setLoading(false);
        if (onSuccess) onSuccess(cached!.data);
        return;
      }
    }

    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const timeoutId = setTimeout(() => {
      abortControllerRef.current?.abort();
    }, requestTimeout);

    setLoading(true);
    if (!isRetry) {
      setError(null); // Only clear error on new request, not retries
    }

    // Create the fetch promise and store it for deduplication
    const fetchPromise = (async () => {
      try {
        const response = await fetch(url, {
          signal: abortControllerRef.current!.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const error = new Error(`HTTP ${response.status}: ${response.statusText}`) as any;
          error.status = response.status;
          throw error;
        }

        const json = await response.json();
        const transformed = transform ? transform(json) : json;
        
        // Update cache
        const cacheKey = `${url}:${transform ? 'transformed' : 'raw'}`;
        globalCache.set(cacheKey, {
          data: transformed,
          timestamp: Date.now(),
          ttl: cacheTime,
        });

        setData(transformed);
        setError(null);
        retryCountRef.current = 0; // Reset retry count on success
        
        if (onSuccess) onSuccess(transformed);
        
        return transformed;
      } catch (err) {
        clearTimeout(timeoutId);
        
        // Don't set error on abort (expected)
        if (err instanceof Error && err.name === 'AbortError') {
          throw err;
        }

        const errorObj = err instanceof Error ? err : new Error(String(err));
        
        // Check if error is transient and we should retry
        if (isTransientError(errorObj) && retryCountRef.current < maxRetries) {
          retryCountRef.current += 1;
          const backoff = calculateBackoff(retryCountRef.current - 1, retryDelay);
          
          setTimeout(() => {
            fetchData(true); // Retry
          }, backoff);
          
          // Don't set error state yet - will set if all retries fail
          setLoading(false);
          return;
        }

        // All retries exhausted or non-transient error
        const errorMessage = errorObj.message || 'Unknown error';
        setError(errorMessage);
        
        if (onError) {
          onError(errorObj);
        }
        
        throw errorObj;
      } finally {
        inFlightRequests.delete(url);
        setLoading(false);
      }
    })();

    inFlightRequests.set(url, fetchPromise);

    try {
      await fetchPromise;
    } catch {
      // Error already handled in promise
    }
  }, [url, transform, onError, onSuccess, maxRetries, retryDelay, cacheTime, requestTimeout]);

  // Refetch function for manual triggers
  const refetch = useCallback(async () => {
    retryCountRef.current = 0; // Reset retry count on manual refetch
    await fetchData(false);
  }, [fetchData]);

  useEffect(() => {
    if (!enabled || !url) {
      return;
    }

    // Initial fetch
    fetchData(false);

    // Set up polling
    intervalRef.current = window.setInterval(() => {
      fetchData(false);
    }, interval);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [url, interval, enabled, fetchData]);

  return { data, loading, error, refetch };
}

