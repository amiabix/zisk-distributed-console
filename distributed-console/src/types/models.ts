export enum ProofPhase {
  Contribution = 0,
  Prove = 1,
  Aggregation = 2,
}

export enum JobState {
  Running = 'Running',
  Completed = 'Completed',
  Failed = 'Failed',
  Waiting = 'Waiting',
}

export enum WorkerStateData {
  Idle = 'Idle',
  Computing = 'Computing',
  Disconnected = 'Disconnected',
  Error = 'Error',
}

export interface JobStatusData {
  job_id: string;
  block_id?: string; // Block ID from coordinator
  data_id: string;
  phase: ProofPhase;
  state: JobState;
  assigned_workers: string[];
  start_time_unix_ms: number; // Job start time (Phase 1 start)
  duration_ms: number; // Total job duration
  // Per-phase statistics (if available from coordinator)
  phase_start_times?: Map<ProofPhase, number>; // Per-phase start times in ms
  phase_durations?: Map<ProofPhase, number>; // Per-phase durations in ms
  aggregator_worker_id?: string | null; // Only set after Phase 2 completes
  compute_capacity_required?: number; // Total compute units needed
  execution_mode?: 'standard' | 'simulation'; // Execution mode
}

export interface WorkerMetrics {
  cpu_percent: number;
  memory_used_gb: number;
  memory_total_gb: number;
  network_in_mbps: number;
  network_out_mbps: number;
  disk_io_mbps?: number;
}

export interface WorkerData {
  worker_id: string;
  state: WorkerStateData;
  compute_capacity: number; // Compute units capacity
  connected_at_unix_ms: number;
  last_heartbeat_unix_ms: number;
  current_phase?: ProofPhase; // Phase worker is currently computing
  current_job_id?: string; // Job ID worker is computing (from Computing state)
  assigned_compute_units?: number; // Actual compute units assigned to this job
  metrics?: WorkerMetrics;
}

export interface SystemStatusData {
  total_workers: number;
  idle_workers: number;
  busy_workers: number;
  active_jobs: number;
  compute_capacity?: number; // Total compute capacity from coordinator
}

export interface CoordinatorInfo {
  service_name?: string;
  version?: string;
  uptime_seconds?: number;
  start_time?: string;
  coordinator_url: string;
  coordinator_host: string;
  coordinator_port: number;
  gateway_port: number;
  status: string;
  total_workers?: number;
  active_jobs?: number;
}

export interface CoordinatorSnapshot {
  timestamp: number;
  job_status: JobStatusData | null;
  workers: WorkerData[];
  system_status: SystemStatusData | null;
  request_latency_ms: number;
  is_stale: boolean;
}

export enum CoordinatorStatus {
  Connected = 'Connected',
  Connecting = 'Connecting',
  Disconnected = 'Disconnected',
  AuthFailed = 'AuthFailed',
}

export interface AppState {
  history: CoordinatorSnapshot[];
  coordinator_status: CoordinatorStatus;
  error_message: string | null;
  paused: boolean;
  worker_scroll_offset: number;
  selected_worker: number | null;
  disconnected_reason?: string;
  retry_in_secs?: number;
}

export function getPhaseProgress(phase: ProofPhase, durationMs?: number, estimatedPhaseDuration?: number): number {
  // Base progress for phase transitions
  let baseProgress: number;
  switch (phase) {
    case ProofPhase.Contribution:
      baseProgress = 0;
      break;
    case ProofPhase.Prove:
      baseProgress = 33;
      break;
    case ProofPhase.Aggregation:
      baseProgress = 66;
      break;
    default:
      return 0;
  }

  // If we have duration estimates, calculate sub-phase progress
  if (durationMs !== undefined && estimatedPhaseDuration !== undefined && estimatedPhaseDuration > 0) {
    const phaseProgress = Math.min((durationMs / estimatedPhaseDuration) * 33, 33);
    return baseProgress + phaseProgress;
  }

  return baseProgress;
}

export function getPhaseName(phase: ProofPhase): string {
  switch (phase) {
    case ProofPhase.Contribution:
      return 'Contributions'; // Match Rust JobPhase::Contributions
    case ProofPhase.Prove:
      return 'Prove';
    case ProofPhase.Aggregation:
      return 'Aggregate'; // Match Rust JobPhase::Aggregate
    default:
      return 'Unknown';
  }
}

export function isWorkerHealthy(worker: WorkerData): boolean {
  if (worker.state === WorkerStateData.Disconnected) {
    return false;
  }
  const now = Date.now();
  return now - worker.last_heartbeat_unix_ms < 30000;
}

export function getWorkerHealthStatus(
  worker: WorkerData
): 'ok' | 'stale' | 'disconnected' {
  if (worker.state === WorkerStateData.Disconnected) {
    return 'disconnected';
  }
  const now = Date.now();
  const timeSinceHeartbeat = now - worker.last_heartbeat_unix_ms;
  // Workers send heartbeats every 30 seconds, so allow up to 60 seconds before marking stale
  // This accounts for network latency and polling delays
  if (timeSinceHeartbeat < 35000) {
    return 'ok';
  } else if (timeSinceHeartbeat < 90000) {
    return 'stale';
  } else {
    return 'disconnected';
  }
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  } else {
    return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
  }
}

export function formatTimeAgo(timestampMs: number): string {
  const now = Date.now();
  const diffMs = now - timestampMs;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) {
    return `${diffSec}s ago`;
  }
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `${diffMin}m ago`;
  }
  const diffHour = Math.floor(diffMin / 60);
  return `${diffHour}h ago`;
}
