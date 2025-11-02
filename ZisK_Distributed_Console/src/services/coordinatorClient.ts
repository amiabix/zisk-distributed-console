import {
  CoordinatorSnapshot,
  JobStatusData,
  WorkerData,
  SystemStatusData,
  ProofPhase,
  JobState,
  WorkerStateData,
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
      return { state: WorkerStateData.Computing }; // Map Connecting to Computing
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
  } | null> {
    const controller = new AbortController();
    if (signal) {
      signal.addEventListener('abort', () => controller.abort());
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

      return await response.json();
    } catch {
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Check if coordinator is reachable
   */
  async healthCheck(signal?: AbortSignal): Promise<boolean> {
    const controller = new AbortController();
    if (signal) {
      signal.addEventListener('abort', () => controller.abort());
    }

    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

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
    }
  }

  /**
   * Get list of active jobs from coordinator
   */
  async getJobsList(activeOnly: boolean = false, signal?: AbortSignal): Promise<JobStatusData[]> {
    const controller = new AbortController();
    if (signal) {
      signal.addEventListener('abort', () => controller.abort());
    }

    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
      const response = await fetch(`${this.coordinatorUrl}/api/jobs?active_only=${activeOnly}`, {
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
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
        if (startTime < 1e10) {
          startTime = startTime * 1000;
        }

        const phaseStr = job.phase || 'None';
        const phase = phaseStr === 'None' ? ProofPhase.Prove : parsePhase(phaseStr);

        return {
          job_id: String(job.job_id),
          data_id: String(job.data_id),
          phase,
          state: parseJobState(job.state || 'Running'),
          assigned_workers: Array.isArray(job.assigned_workers)
            ? job.assigned_workers.map((w: any) => String(w))
            : [],
          start_time_unix_ms: startTime,
          duration_ms: Number(job.duration_ms) || 0,
        };
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Auto-discover and select the most recent job (active or completed)
   */
  async autoDiscoverJob(signal?: AbortSignal): Promise<string | null> {
    try {
      const jobs = await this.getJobsList(false, signal); // Get all jobs including completed
      if (jobs.length === 0) {
        return null;
      }

      // Sort by start time (most recent first) and return first job ID
      const sortedJobs = jobs.sort((a, b) => b.start_time_unix_ms - a.start_time_unix_ms);
      return sortedJobs[0].job_id;
    } catch (error) {
      console.warn('Failed to auto-discover jobs:', error);
      return null;
    }
  }

  async pollCoordinator(signal?: AbortSignal): Promise<CoordinatorSnapshot> {
    const requestStart = Date.now();

    try {
      // If no job ID set, try to auto-discover
      if (!this.jobId) {
        const discoveredJobId = await this.autoDiscoverJob(signal);
        if (discoveredJobId) {
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
    if (signal) {
      signal.addEventListener('abort', () => controller.abort());
    }

    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
      // NOTE: This assumes a REST gateway is running that translates REST to gRPC
      // The actual gRPC endpoint is: JobStatus(JobStatusRequest) where request.job_id = jobId
      const response = await fetch(`${this.coordinatorUrl}/api/job/${this.jobId}`, {
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Job not found: ${this.jobId}`);
        }
        throw new Error(`Job status request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Handle gRPC response format: JobStatusResponse { result: { job: JobStatus } }
      // JobStatus contains: job_id, data_id, phase, state, assigned_workers, start_time (u64), duration_ms (u64)
      const jobData = data.result?.job || data.job || data;

      // Validate required fields
      if (!jobData.job_id || !jobData.data_id) {
        throw new Error('Invalid job status response: missing required fields');
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
          phaseDurations.set(phase, Number(duration) || 0);
        });
      }

      return {
        job_id: String(jobData.job_id),
        data_id: String(jobData.data_id),
        phase,
        state: parseJobState(jobData.state || 'Running'),
        assigned_workers: Array.isArray(jobData.assigned_workers) 
          ? jobData.assigned_workers.map((w: any) => String(w))
          : [],
        start_time_unix_ms: startTime,
        duration_ms: Number(jobData.duration_ms) || 0,
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
    }
  }

  private async getWorkersList(signal?: AbortSignal): Promise<WorkerData[]> {
    const controller = new AbortController();
    if (signal) {
      signal.addEventListener('abort', () => controller.abort());
    }

    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
      // NOTE: This assumes a REST gateway is running
      // The actual gRPC endpoint is: WorkersList(WorkersListRequest)
      const response = await fetch(`${this.coordinatorUrl}/api/workers`, {
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
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
            return new Date(ts).getTime();
          }
          if (typeof ts === 'object' && ts.seconds !== undefined) {
            // Protobuf Timestamp format
            return ts.seconds * 1000 + (ts.nanos || 0) / 1000000;
          }
          return now;
        };

        // Parse worker state and extract phase + job ID if present
        // Rust format: "Computing(JobId(...), Contributions)" or just "Computing"
        const stateStr = worker.state || 'Idle';
        const { state, phase } = parseWorkerState(stateStr);
        
        // Extract job ID from Computing state if present
        // Format: "Computing(JobId(abc123), Contributions)"
        let currentJobId: string | undefined = undefined;
        if (stateStr.startsWith('Computing')) {
          const jobIdMatch = stateStr.match(/JobId\(([^)]+)\)/);
          if (jobIdMatch) {
            currentJobId = jobIdMatch[1];
          }
        }

        return {
          worker_id: String(worker.worker_id || 'unknown'),
          state,
          compute_capacity: worker.compute_capacity?.compute_units || worker.compute_capacity?.units || worker.compute_capacity || 0,
          connected_at_unix_ms: parseTimestamp(worker.connected_at),
          last_heartbeat_unix_ms: parseTimestamp(worker.last_heartbeat),
          // Extract phase from state string (e.g., "Computing(Contributions)" -> Contribution phase)
          // If phase wasn't in state string, try direct field
          current_phase: phase || (worker.current_phase ? parsePhase(worker.current_phase) : undefined),
          current_job_id: currentJobId,
          metrics: worker.metrics ? {
            cpu_percent: worker.metrics.cpu_percent || 0,
            memory_used_gb: worker.metrics.memory_used_gb || 0,
            memory_total_gb: worker.metrics.memory_total_gb || 16,
            network_in_mbps: worker.metrics.network_in_mbps || 0,
            network_out_mbps: worker.metrics.network_out_mbps || 0,
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
    }
  }

  private async getSystemStatus(signal?: AbortSignal): Promise<SystemStatusData> {
    const controller = new AbortController();
    if (signal) {
      signal.addEventListener('abort', () => controller.abort());
    }

    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
      // NOTE: This assumes a REST gateway is running
      // The actual gRPC endpoint is: SystemStatus(SystemStatusRequest)
      const response = await fetch(`${this.coordinatorUrl}/api/system/status`, {
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
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
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Get list of proof files from disk
   */
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
    if (signal) {
      signal.addEventListener('abort', () => controller.abort());
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
    }
  }
}

// Mock data generator for development/demo

export function createMockSnapshot(index: number = 0): CoordinatorSnapshot {
  const now = Date.now();
  const baseTime = now - (index * 1000); // Simulate time progression

  const workers: WorkerData[] = [
    {
      worker_id: 'worker-001',
      state: WorkerStateData.Computing,
      compute_capacity: 16,
      connected_at_unix_ms: now - 600000,
      last_heartbeat_unix_ms: now - 200,
      current_phase: ProofPhase.Prove,
      metrics: {
        cpu_percent: 75 + Math.sin(baseTime / 10000) * 15 + Math.random() * 10,
        memory_used_gb: 10 + Math.sin(baseTime / 8000) * 2,
        memory_total_gb: 16,
        network_in_mbps: 150 + Math.sin(baseTime / 5000) * 50,
        network_out_mbps: 75 + Math.sin(baseTime / 5000) * 25,
      },
    },
    {
      worker_id: 'worker-002',
      state: WorkerStateData.Computing,
      compute_capacity: 16,
      connected_at_unix_ms: now - 300000,
      last_heartbeat_unix_ms: now - 100,
      current_phase: ProofPhase.Prove,
      metrics: {
        cpu_percent: 82 + Math.cos(baseTime / 12000) * 18 + Math.random() * 8,
        memory_used_gb: 12 + Math.cos(baseTime / 7000) * 3,
        memory_total_gb: 16,
        network_in_mbps: 180 + Math.cos(baseTime / 6000) * 60,
        network_out_mbps: 90 + Math.cos(baseTime / 6000) * 30,
      },
    },
    {
      worker_id: 'worker-003',
      state: WorkerStateData.Idle,
      compute_capacity: 16,
      connected_at_unix_ms: now - 120000,
      last_heartbeat_unix_ms: now - 500,
      current_phase: ProofPhase.Contribution,
      metrics: {
        cpu_percent: 5 + Math.random() * 5,
        memory_used_gb: 1 + Math.random() * 1,
        memory_total_gb: 16,
        network_in_mbps: Math.random() * 5,
        network_out_mbps: Math.random() * 2,
      },
    },
    {
      worker_id: 'worker-004',
      state: WorkerStateData.Computing,
      compute_capacity: 32,
      connected_at_unix_ms: now - 450000,
      last_heartbeat_unix_ms: now - 150,
      current_phase: ProofPhase.Aggregation,
      metrics: {
        cpu_percent: 95 + Math.sin(baseTime / 9000) * 5 + Math.random() * 5,
        memory_used_gb: 14 + Math.sin(baseTime / 6000) * 2,
        memory_total_gb: 32,
        network_in_mbps: 250 + Math.sin(baseTime / 4000) * 100,
        network_out_mbps: 120 + Math.sin(baseTime / 4000) * 50,
      },
    },
  ];

  return {
    timestamp: baseTime,
    job_status: {
      job_id: 'proof-abc123',
      data_id: 'dataset-v2',
      phase: ProofPhase.Prove,
      state: JobState.Running,
      assigned_workers: ['worker-001', 'worker-002', 'worker-004'],
      start_time_unix_ms: now - 225000,
      duration_ms: 225000,
    },
    workers,
    system_status: {
      total_workers: 4,
      idle_workers: 1,
      busy_workers: 3,
      active_jobs: 1,
    },
    request_latency_ms: 120,
    is_stale: false,
  };
}
