import {
  CoordinatorSnapshot,
  JobStatusData,
  WorkerData,
  SystemStatusData,
  ProofPhase,
  JobState,
  WorkerStateData,
  CoordinatorInfo,
} from '../types/models';

function parsePhase(phaseStr: string): ProofPhase {
  // Rust JobPhase::Display returns: "Contributions", "Prove", "Aggregate"
  switch (phaseStr) {
    case 'Contributions':
      return ProofPhase.Contribution;
    case 'Prove':
      return ProofPhase.Prove;
    case 'Aggregate':
      return ProofPhase.Aggregation;
    // Fallback for old/different formats
    case 'Contribution':
      return ProofPhase.Contribution;
    case 'Aggregation':
      return ProofPhase.Aggregation;
    default:
      console.warn(`Unknown phase: ${phaseStr}, assuming Prove`);
      return ProofPhase.Prove;
  }
}

function parseJobState(stateStr: string): JobState {
  // Rust JobState::Display returns: "Created", "Running ({phase})", "Completed", "Failed"
  // The state string might be "Running (Contributions)" or just "Running"
  if (stateStr.startsWith('Running')) {
    return JobState.Running;
  }
  
  switch (stateStr) {
    case 'Completed':
      return JobState.Completed;
    case 'Failed':
      return JobState.Failed;
    case 'Created':
      return JobState.Waiting; // Map Created to Waiting in frontend
    case 'Waiting':
      return JobState.Waiting;
    default:
      // Default to Running for unknown states
      return JobState.Running;
  }
}

function parseWorkerState(stateStr: string): { state: WorkerStateData; phase?: ProofPhase } {
  // Rust WorkerState::Display returns:
  // - "Disconnected", "Connecting", "Idle", "Error" (simple)
  // - "Computing({phase})" (e.g., "Computing(Contributions)", "Computing(Prove)", "Computing(Aggregate)")
  
  if (stateStr.startsWith('Computing')) {
    // Extract phase from "Computing(Contributions)" format
    const phaseMatch = stateStr.match(/Computing\((\w+)\)/);
    if (phaseMatch) {
      const phase = parsePhase(phaseMatch[1]);
      return { state: WorkerStateData.Computing, phase };
    }
    return { state: WorkerStateData.Computing };
  }
  
  switch (stateStr) {
    case 'Idle':
      return { state: WorkerStateData.Idle };
    case 'Connecting':
      return { state: WorkerStateData.Idle }; // Map Connecting to Idle (transient state)
    case 'Disconnected':
      return { state: WorkerStateData.Disconnected };
    case 'Error':
      return { state: WorkerStateData.Error };
    default:
      console.warn(`Unknown worker state: ${stateStr}, assuming Idle`);
      return { state: WorkerStateData.Idle };
  }
}

export class CoordinatorClient {
  private coordinatorUrl: string;
  private jobId: string | null;

  constructor(coordinatorUrl: string = 'http://localhost:50051', jobId: string | null = null) {
    this.coordinatorUrl = coordinatorUrl;
    this.jobId = jobId;
  }

  /**
   * Get coordinator status info (version, uptime)
   */
  async getStatusInfo(signal?: AbortSignal): Promise<{
    service_name?: string;
    version?: string;
    uptime_seconds?: number;
    start_time?: string;
  } | null> {
    const controller = new AbortController();
    let abortHandler: (() => void) | null = null;
    
    if (signal) {
      abortHandler = () => controller.abort();
      signal.addEventListener('abort', abortHandler);
    }

    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const cacheBuster = `_t=${Date.now()}`;
      const response = await fetch(`${this.coordinatorUrl}/api/status/info?${cacheBuster}`, {
        signal: controller.signal,
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return {
        service_name: data.service_name,
        version: data.version,
        uptime_seconds: data.uptime_seconds,
        start_time: data.start_time,
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timeoutId);
      if (signal && abortHandler) {
        signal.removeEventListener('abort', abortHandler);
      }
    }
  }

  /**
   * Get coordinator connection information
   */
  async getCoordinatorInfo(signal?: AbortSignal): Promise<{
    coordinator_url: string;
    coordinator_host: string;
    coordinator_port: number;
    gateway_port: number;
    status: string;
    total_workers?: number;
    active_jobs?: number;
    service_name?: string;
    version?: string;
    uptime_seconds?: number;
    start_time?: string;
  } | null> {
    const controller = new AbortController();
    let abortHandler: (() => void) | null = null;
    
    if (signal) {
      abortHandler = () => controller.abort();
      signal.addEventListener('abort', abortHandler);
    }

    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(`${this.coordinatorUrl}/api/coordinator/info`, {
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        return null;
      }

      const info = await response.json();
      
      const statusInfo = await this.getStatusInfo(signal).catch(() => null);
      
      return {
        ...info,
        ...statusInfo,
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timeoutId);
      if (signal && abortHandler) {
        signal.removeEventListener('abort', abortHandler);
      }
    }
  }

  /**
   * Check if coordinator is reachable
   */
  async healthCheck(signal?: AbortSignal): Promise<boolean> {
    const controller = new AbortController();
    let abortHandler: (() => void) | null = null;
    
    if (signal) {
      abortHandler = () => controller.abort();
      signal.addEventListener('abort', abortHandler);
    }

    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(`${this.coordinatorUrl}/health`, {
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
      });

      return response.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timeoutId);
      if (signal && abortHandler) {
        signal.removeEventListener('abort', abortHandler);
      }
    }
  }

  /**
   * Get list of active jobs from coordinator
   */
  async getJobsList(activeOnly: boolean = false, signal?: AbortSignal): Promise<JobStatusData[]> {
    const controller = new AbortController();
    let abortHandler: (() => void) | null = null;
    
    if (signal) {
      abortHandler = () => controller.abort();
      signal.addEventListener('abort', abortHandler);
    }

    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      // Add cache-busting timestamp to ensure fresh data
      const cacheBuster = `_t=${Date.now()}`;
      const response = await fetch(`${this.coordinatorUrl}/api/jobs?active_only=${activeOnly}&${cacheBuster}`, {
        signal: controller.signal,
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      });

      if (!response.ok) {
        throw new Error(`Jobs list request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Handle gRPC response format: { jobs: [...] }
      const jobsData = data.jobs || [];

      if (!Array.isArray(jobsData)) {
        console.warn('Invalid jobs list response, expected array');
        return [];
      }

      return jobsData.map((job: any) => {
        let startTime = job.start_time || Date.now();
        // Handle string timestamps (Unix seconds)
        if (typeof startTime === 'string') {
          startTime = parseInt(startTime, 10);
        }
        if (startTime < 1e10) {
          startTime = startTime * 1000;
        }

        const phaseStr = job.phase || 'None';
        const phase = phaseStr === 'None' ? ProofPhase.Prove : parsePhase(phaseStr);

        // Handle assigned_workers - can be array, object (hex string representation), or single string
        let assignedWorkers: string[] = [];
        if (Array.isArray(job.assigned_workers)) {
          assignedWorkers = job.assigned_workers.map((w: any) => String(w));
        } else if (job.assigned_workers && typeof job.assigned_workers === 'object') {
          // Handle hex string representation as object {0: "5", 1: "1", ...}
          // Reconstruct the hex string from object keys
          const keys = Object.keys(job.assigned_workers).map(k => parseInt(k, 10)).sort((a, b) => a - b);
          const hexString = keys.map(k => job.assigned_workers[k]).join('');
          if (hexString.length > 0) {
            assignedWorkers = [hexString];
          } else {
            // Fallback: try to extract as array of values
            assignedWorkers = Object.values(job.assigned_workers).map((w: any) => String(w));
          }
        } else if (job.assigned_workers) {
          assignedWorkers = [String(job.assigned_workers)];
        }

        return {
          job_id: String(job.job_id),
          block_id: job.block_id ? String(job.block_id) : undefined,
          data_id: job.data_id || job.block_id || job.job_id, // Fallback to block_id or job_id if data_id missing
          phase,
          state: parseJobState(job.state || 'Running'),
          assigned_workers: assignedWorkers,
          start_time_unix_ms: startTime,
          duration_ms: (() => {
            const duration = Number(job.duration_ms);
            return isNaN(duration) ? 0 : duration;
          })(),
        };
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      if (signal && abortHandler) {
        signal.removeEventListener('abort', abortHandler);
      }
    }
  }

  private discoveryInProgress = false;

  async autoDiscoverJob(signal?: AbortSignal): Promise<string | null> {
    if (this.discoveryInProgress) {
      return null;
    }

    this.discoveryInProgress = true;
    try {
      const jobs = await this.getJobsList(false, signal);
      if (jobs.length === 0) {
        this.discoveryInProgress = false;
        return null;
      }
      
      const sorted = jobs.sort((a, b) => b.start_time_unix_ms - a.start_time_unix_ms);
      const jobId = sorted[0].job_id;
      this.discoveryInProgress = false;
      return jobId;
    } catch {
      this.discoveryInProgress = false;
      return null;
    }
  }

  async pollCoordinator(signal?: AbortSignal): Promise<CoordinatorSnapshot> {
    const requestStart = Date.now();

    try {
      // If no job ID set, try to auto-discover on every poll until found
      if (!this.jobId) {
        const discoveredJobId = await this.autoDiscoverJob(signal);
        if (discoveredJobId) {
          console.log('Auto-discovered job during poll:', discoveredJobId);
          this.jobId = discoveredJobId;
        }
      }

      const [jobStatusResult, workersListResult, systemStatusResult] =
        await Promise.allSettled([
          this.jobId ? this.getJobStatus(signal) : Promise.resolve(null),
          this.getWorkersList(signal),
          this.getSystemStatus(signal),
        ]);

      const requestLatency = Date.now() - requestStart;

      return {
        timestamp: Date.now(),
        job_status:
          jobStatusResult.status === 'fulfilled' ? jobStatusResult.value : null,
        workers:
          workersListResult.status === 'fulfilled'
            ? workersListResult.value
            : [],
        system_status:
          systemStatusResult.status === 'fulfilled'
            ? systemStatusResult.value
            : null,
        request_latency_ms: requestLatency,
        is_stale: requestLatency > 5000,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error; // Re-throw abort errors as-is
      }
      throw new Error(`Failed to poll coordinator: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Set or update the job ID (useful after auto-discovery)
   */
  setJobId(jobId: string | null) {
    this.jobId = jobId;
  }

  getJobId(): string | null {
    return this.jobId;
  }

  /**
   * IMPORTANT: The coordinator only exposes gRPC endpoints, not REST.
   * 
   * These REST endpoints will only work if:
   * 1. There's a REST-to-gRPC gateway/proxy running (e.g., on port 8080)
   * 2. OR the coordinator has been extended with REST support
   * 
   * Expected REST API format (if gateway exists):
   * - GET /api/job/{job_id} -> JobStatusResponse
   * - GET /api/workers -> WorkersListResponse  
   * - GET /api/system/status -> SystemStatusResponse
   * 
   * If no gateway exists, use gRPC-Web or create a proxy server.
   */
  private async getJobStatus(signal?: AbortSignal): Promise<JobStatusData | null> {
    if (!this.jobId) {
      return null;
    }
    const controller = new AbortController();
    let abortHandler: (() => void) | null = null;
    
    if (signal) {
      abortHandler = () => controller.abort();
      signal.addEventListener('abort', abortHandler);
    }

    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      // NOTE: This assumes a REST gateway is running that translates REST to gRPC
      // The actual gRPC endpoint is: JobStatus(JobStatusRequest) where request.job_id = jobId
      // Add cache-busting timestamp to ensure fresh data
      const cacheBuster = `_t=${Date.now()}`;
      const response = await fetch(`${this.coordinatorUrl}/api/job/${this.jobId}?${cacheBuster}`, {
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Job not found: ${this.jobId}`);
        }
        throw new Error(`Job status request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      const jobData = data.result?.job || data.job || data;

      if (!jobData || typeof jobData !== 'object') {
        throw new Error('Invalid job status response: expected object');
      }

      if (!jobData.job_id || jobData.job_id === 'undefined' || jobData.job_id === 'null') {
        throw new Error('Invalid job status response: missing or invalid job_id');
      }

      if (!jobData.data_id || jobData.data_id === 'undefined' || jobData.data_id === 'null') {
        throw new Error('Invalid job status response: missing or invalid data_id');
      }

      // start_time from Rust is u64 (milliseconds), but gRPC converts to number
      // If it's a very large number (> 1e12), it might be in seconds instead
      let startTime = jobData.start_time || Date.now();
      if (startTime < 1e10) {
        // Likely in seconds (Unix timestamp), convert to milliseconds
        startTime = startTime * 1000;
      }

      // Parse phase - Rust returns "Contributions", "Prove", "Aggregate", or "None"
      const phaseStr = jobData.phase || 'None';
      const phase = phaseStr === 'None' ? ProofPhase.Prove : parsePhase(phaseStr);

      // Build per-phase start times if available
      // Coordinator tracks: start_times: HashMap<JobPhase, DateTime<Utc>>
      // For now, we only have the current phase start time from the API
      // In future, coordinator API could expose all phase start times
      const phaseStartTimes = new Map<ProofPhase, number>();
      if (jobData.phase_start_times) {
        // If coordinator provides phase_start_times, use them
        Object.entries(jobData.phase_start_times).forEach(([phaseName, time]: [string, any]) => {
          const phase = parsePhase(phaseName);
          let phaseTime = time;
          if (phaseTime < 1e10) phaseTime = phaseTime * 1000;
          phaseStartTimes.set(phase, phaseTime);
        });
      }

      // Build per-phase durations if available
      const phaseDurations = new Map<ProofPhase, number>();
      if (jobData.phase_durations) {
        Object.entries(jobData.phase_durations).forEach(([phaseName, duration]: [string, any]) => {
          const phase = parsePhase(phaseName);
          const durationNum = Number(duration);
          phaseDurations.set(phase, isNaN(durationNum) ? 0 : durationNum);
        });
      }

      return {
        job_id: String(jobData.job_id),
        block_id: jobData.block_id ? String(jobData.block_id) : undefined,
        data_id: jobData.data_id ? String(jobData.data_id) : (jobData.block_id ? String(jobData.block_id) : String(jobData.job_id)),
        phase,
        state: parseJobState(jobData.state || 'Running'),
        assigned_workers: (() => {
          if (!jobData.assigned_workers) return [];
          if (Array.isArray(jobData.assigned_workers)) {
            return jobData.assigned_workers.map((w: any) => String(w));
          }
          if (typeof jobData.assigned_workers === 'object') {
            // Handle hex string representation as object (rare edge case)
            try {
              const keys = Object.keys(jobData.assigned_workers)
                .map(k => parseInt(k, 10))
                .filter(k => !isNaN(k))
                .sort((a, b) => a - b);
              const hexString = keys.map(k => String(jobData.assigned_workers[k])).join('');
              return hexString.length > 0 ? [hexString] : [];
            } catch {
              return [];
            }
          }
          return [String(jobData.assigned_workers)];
        })(),
        start_time_unix_ms: startTime,
        duration_ms: (() => {
          const duration = Number(jobData.duration_ms);
          return isNaN(duration) ? 0 : duration;
        })(),
        phase_start_times: phaseStartTimes.size > 0 ? phaseStartTimes : undefined,
        phase_durations: phaseDurations.size > 0 ? phaseDurations : undefined,
        aggregator_worker_id: jobData.aggregator_worker_id ? String(jobData.aggregator_worker_id) : null,
        compute_capacity_required: jobData.compute_capacity_required || jobData.compute_capacity || undefined,
        execution_mode: jobData.execution_mode === 'simulation' ? 'simulation' : jobData.execution_mode === 'standard' ? 'standard' : undefined,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      if (signal && abortHandler) {
        signal.removeEventListener('abort', abortHandler);
      }
    }
  }

  private async getWorkersList(signal?: AbortSignal): Promise<WorkerData[]> {
    const controller = new AbortController();
    let abortHandler: (() => void) | null = null;
    
    if (signal) {
      abortHandler = () => controller.abort();
      signal.addEventListener('abort', abortHandler);
    }

    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      // NOTE: This assumes a REST gateway is running
      // The actual gRPC endpoint is: WorkersList(WorkersListRequest)
      // Add cache-busting timestamp to ensure fresh data
      const cacheBuster = `_t=${Date.now()}`;
      const separator = this.coordinatorUrl.includes('?') ? '&' : '?';
      const response = await fetch(`${this.coordinatorUrl}/api/workers${separator}${cacheBuster}`, {
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      });

      if (!response.ok) {
        throw new Error(`Workers list request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Handle both direct response and wrapped response
      // gRPC format: { result: { workers_list: { workers: [...] } } }
      const workersData = data.result?.workers_list?.workers || data.workers || [];

      // Validate response structure
      if (!Array.isArray(workersData)) {
        console.warn('Invalid workers list response, expected array');
        return [];
      }

      return workersData.map((worker: any) => {
        const now = Date.now();
        
        // Parse timestamp (can be protobuf Timestamp {seconds, nanos} or ISO string)
        const parseTimestamp = (ts: any): number => {
          if (!ts) return now;
          if (typeof ts === 'string') {
            const parsed = new Date(ts).getTime();
            return isNaN(parsed) ? now : parsed;
          }
          if (typeof ts === 'object' && ts.seconds !== undefined) {
            // Protobuf Timestamp format: { seconds: number, nanos?: number }
            const seconds = Number(ts.seconds);
            const nanos = Number(ts.nanos ?? 0);
            if (isNaN(seconds) || isNaN(nanos)) return now;
            return seconds * 1000 + nanos / 1000000;
          }
          return now;
        };

        // Parse worker state and extract phase + job ID if present
        // Rust format: "Computing(JobId(...), Contributions)" or just "Computing"
        const stateStr = worker.state || 'Idle';
        const { state, phase } = parseWorkerState(stateStr);
        
        // Extract job ID from Computing state if present
        // Format: "Computing(JobId(abc123), Contributions)" or "Computing(Contributions)" with job in worker data
        let currentJobId: string | undefined = undefined;
        if (stateStr.startsWith('Computing')) {
          // Try multiple patterns
          const jobIdMatch = stateStr.match(/JobId\(([^)]+)\)/);
          if (jobIdMatch) {
            currentJobId = jobIdMatch[1];
          } else if (worker.job_id) {
            // Fallback to direct field if available
            currentJobId = String(worker.job_id);
          }
        }

        return {
          worker_id: String(worker.worker_id || 'unknown'),
          state,
          compute_capacity: (() => {
            const units = worker.compute_capacity?.compute_units ?? worker.compute_capacity?.units ?? worker.compute_capacity;
            return typeof units === 'number' && !isNaN(units) ? units : 0;
          })(),
          connected_at_unix_ms: parseTimestamp(worker.connected_at),
          last_heartbeat_unix_ms: parseTimestamp(worker.last_heartbeat),
          // Extract phase from state string (e.g., "Computing(Contributions)" -> Contribution phase)
          // If phase wasn't in state string, try direct field
          current_phase: phase || (worker.current_phase ? parsePhase(worker.current_phase) : undefined),
          current_job_id: currentJobId,
          metrics: worker.metrics ? {
            cpu_percent: (() => {
              const cpu = Number(worker.metrics.cpu_percent);
              return isNaN(cpu) ? 0 : cpu;
            })(),
            memory_used_gb: (() => {
              const mem = Number(worker.metrics.memory_used_gb);
              return isNaN(mem) ? 0 : mem;
            })(),
            memory_total_gb: (() => {
              const mem = Number(worker.metrics.memory_total_gb);
              return isNaN(mem) ? 16 : mem;
            })(),
            network_in_mbps: (() => {
              const net = Number(worker.metrics.network_in_mbps);
              return isNaN(net) ? 0 : net;
            })(),
            network_out_mbps: (() => {
              const net = Number(worker.metrics.network_out_mbps);
              return isNaN(net) ? 0 : net;
            })(),
          } : undefined,
        };
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      if (signal && abortHandler) {
        signal.removeEventListener('abort', abortHandler);
      }
    }
  }

  private async getSystemStatus(signal?: AbortSignal): Promise<SystemStatusData> {
    const controller = new AbortController();
    let abortHandler: (() => void) | null = null;
    
    if (signal) {
      abortHandler = () => controller.abort();
      signal.addEventListener('abort', abortHandler);
    }

    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      // NOTE: This assumes a REST gateway is running
      // The actual gRPC endpoint is: SystemStatus(SystemStatusRequest)
      // Add cache-busting timestamp to ensure fresh data
      const cacheBuster = `_t=${Date.now()}`;
      const response = await fetch(`${this.coordinatorUrl}/api/system/status?${cacheBuster}`, {
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      });

      if (!response.ok) {
        throw new Error(`System status request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Handle both direct response and wrapped response
      // gRPC format: { result: { status: { ... } } }
      const statusData = data.result?.status || data.status || data;

      return {
        total_workers: Number(statusData.total_workers) || 0,
        idle_workers: Number(statusData.idle_workers) || 0,
        busy_workers: Number(statusData.busy_workers) || 0,
        active_jobs: Number(statusData.active_jobs) || 0,
        compute_capacity: statusData.compute_capacity?.compute_units || statusData.compute_capacity || undefined,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      if (signal && abortHandler) {
        signal.removeEventListener('abort', abortHandler);
      }
    }
  }

  async getProofsList(signal?: AbortSignal): Promise<Array<{
    job_id: string;
    file_name: string;
    file_path: string;
    size_bytes: number;
    size_mb: string;
    compressed_size_bytes: number | null;
    compressed_size_mb: string | null;
    created_at: string;
    modified_at: string;
  }>> {
    const controller = new AbortController();
    let abortHandler: (() => void) | null = null;
    
    if (signal) {
      abortHandler = () => controller.abort();
      signal.addEventListener('abort', abortHandler);
    }

    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`${this.coordinatorUrl}/api/proofs`, {
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Proofs list request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.proofs || [];
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      if (signal && abortHandler) {
        signal.removeEventListener('abort', abortHandler);
      }
    }
  }

  async launchProof(
    blockId: string,
    computeCapacity: number,
    inputPath: string,
    signal?: AbortSignal
  ): Promise<{ job_id: string }> {
    const controller = new AbortController();
    let abortHandler: (() => void) | null = null;
    
    if (signal) {
      abortHandler = () => controller.abort();
      signal.addEventListener('abort', abortHandler);
    }

    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch(`${this.coordinatorUrl}/api/proof/launch`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          block_id: blockId,
          compute_capacity: computeCapacity,
          input_path: inputPath,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to launch proof: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return {
        job_id: String(data.job_id || data.result?.job_id || ''),
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.message.includes('timeout') || error.message.includes('cancelled')) {
          throw new Error('Request timeout: The coordinator did not respond in time. Check if the gateway server is running on port 8080.');
        }
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          throw new Error('Cannot connect to gateway server. Make sure the gateway is running: cd distributed-console && node gateway-server.cjs');
        }
        // Handle gRPC errors
        if (error.message.includes('CANCELLED') || error.message.includes('Call cancelled')) {
          throw new Error('Request was cancelled. The gateway server may not be running or the coordinator is not responding.');
        }
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      if (signal && abortHandler) {
        signal.removeEventListener('abort', abortHandler);
      }
    }
  }

  async cancelJob(jobId: string, signal?: AbortSignal): Promise<void> {
    const controller = new AbortController();
    let abortHandler: (() => void) | null = null;
    
    if (signal) {
      abortHandler = () => controller.abort();
      signal.addEventListener('abort', abortHandler);
    }

    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`${this.coordinatorUrl}/api/job/${jobId}/cancel`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to cancel job: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      if (signal && abortHandler) {
        signal.removeEventListener('abort', abortHandler);
      }
    }
  }
}

// Mock data moved to src/utils/mockData.ts to keep production code clean
