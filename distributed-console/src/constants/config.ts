/**
 * Configuration constants for the dashboard
 * All magic numbers and intervals should be defined here
 */

// Polling intervals (in milliseconds)
export const POLLING_INTERVALS = {
  // Critical data that changes frequently (job status, worker metrics)
  CRITICAL: 1000, // 1 second
  
  // Active data that updates regularly (workers list, system status)
  ACTIVE: 2000, // 2 seconds
  
  // Periodic updates (job history, proofs list)
  PERIODIC: 5000, // 5 seconds
  
  // Slow background updates (managed worker status, coordinator status)
  BACKGROUND: 10000, // 10 seconds
  
  // Very slow updates (proof list refresh)
  SLOW: 30000, // 30 seconds
} as const;

// Worker connection time heuristic
// Used to distinguish "recently started" workers from external ones
export const WORKER_CONNECTION_HEURISTIC_MS = 180000; // 3 minutes

// Worker registration wait time (after starting a worker, wait for it to register)
export const WORKER_REGISTRATION_WAIT_MS = 2000; // 2 seconds

// Auto-discovery settings
export const AUTO_DISCOVERY = {
  // Should not retry automatically - single attempt only
  MAX_RETRIES: 0,
} as const;

// Gateway URL derivation
export const GATEWAY = {
  DEFAULT_PORT: 8080,
  DEFAULT_PROTOCOL: 'http',
} as const;

// Maximum history entries to keep in memory
export const MAX_HISTORY_ENTRIES = 120;

// Error display settings
export const ERROR_DISPLAY = {
  TIMEOUT_MS: 5000, // Show errors for 5 seconds
  AUTO_DISMISS: true,
  SHOW_DETAILS: process.env.NODE_ENV === 'development',
} as const;

// API retry settings
export const API_RETRY = {
  MAX_RETRIES: 3,
  BACKOFF_MULTIPLIER: 2,
  INITIAL_DELAY_MS: 1000,
  MAX_DELAY_MS: 30000,
} as const;

// Request timeout
export const REQUEST_TIMEOUT_MS = 10000; // 10 seconds

// Max concurrent requests per component
export const MAX_CONCURRENT_REQUESTS = 5;

// Error recovery settings
export const ERROR_RECOVERY = {
  AUTO_DISMISS_MS: 5000,
  SHOW_DETAILS: process.env.NODE_ENV === 'development',
} as const;

// Cache settings
export const CACHE = {
  DEFAULT_TTL_MS: 5000, // 5 seconds default cache
  SHORT_TTL_MS: 1000, // 1 second for rapidly changing data
  LONG_TTL_MS: 30000, // 30 seconds for stable data
} as const;

// Transient error codes (should retry)
export const TRANSIENT_ERROR_CODES = [
  408, // Request Timeout
  429, // Too Many Requests
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
] as const;

// Network error patterns (should retry)
export const TRANSIENT_ERROR_PATTERNS = [
  /timeout/i,
  /network/i,
  /connection/i,
  /ECONNREFUSED/i,
  /ETIMEDOUT/i,
] as const;

