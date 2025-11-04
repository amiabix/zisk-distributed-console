// Mock data generator for development/demo ONLY
// Do not use in production - this file should be excluded from production builds

import { CoordinatorSnapshot, WorkerData, WorkerStateData, ProofPhase, JobState } from '../types/models';

export function createMockSnapshot(index: number = 0): CoordinatorSnapshot {
  const now = Date.now();
  const baseTime = now - (index * 1000);

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

