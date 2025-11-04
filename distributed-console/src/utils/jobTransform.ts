/**
 * Utility functions for transforming raw API job data to JobStatusData
 * Used when fetching directly from gateway (bypassing CoordinatorClient)
 */

import { JobStatusData, ProofPhase, JobState } from '../types/models';

function parsePhase(phaseStr: string): ProofPhase {
  const normalized = phaseStr.toLowerCase();
  if (normalized.includes('contribution')) return ProofPhase.Contribution;
  if (normalized.includes('prove')) return ProofPhase.Prove;
  if (normalized.includes('aggregat')) return ProofPhase.Aggregation;
  return ProofPhase.Prove;
}

function parseJobState(stateStr: string): JobState {
  const normalized = stateStr.toLowerCase();
  if (normalized.includes('running')) return JobState.Running;
  if (normalized.includes('completed')) return JobState.Completed;
  if (normalized.includes('failed')) return JobState.Failed;
  return JobState.Running;
}

export function transformJobData(job: any): JobStatusData {
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
    try {
      const keys = Object.keys(job.assigned_workers)
        .map(k => parseInt(k, 10))
        .filter(k => !isNaN(k))
        .sort((a, b) => a - b);
      const hexString = keys.map(k => String(job.assigned_workers[k])).join('');
      assignedWorkers = hexString.length > 0 ? [hexString] : [];
    } catch {
      assignedWorkers = [];
    }
  } else if (job.assigned_workers) {
    assignedWorkers = [String(job.assigned_workers)];
  }

  return {
    job_id: String(job.job_id),
    block_id: job.block_id ? String(job.block_id) : undefined,
    data_id: job.data_id ? String(job.data_id) : (job.block_id ? String(job.block_id) : String(job.job_id)),
    phase,
    state: parseJobState(job.state || 'Running'),
    assigned_workers: assignedWorkers,
    start_time_unix_ms: startTime,
    duration_ms: (() => {
      const duration = Number(job.duration_ms);
      return isNaN(duration) ? 0 : duration;
    })(),
    phase_start_times: undefined, // Not provided by gateway
    phase_durations: undefined, // Not provided by gateway
    aggregator_worker_id: job.aggregator_worker_id ? String(job.aggregator_worker_id) : null,
  };
}

export function transformJobsList(data: any): JobStatusData[] {
  // Handle gRPC response format: { jobs: [...] }
  const jobsData = data.jobs || [];
  
  if (!Array.isArray(jobsData)) {
    console.warn('Invalid jobs list response, expected array');
    return [];
  }

  return jobsData.map(transformJobData);
}

