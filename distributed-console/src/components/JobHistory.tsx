import { useState, useMemo } from 'react';
import { JobStatusData, ProofPhase, getPhaseName, formatDuration, JobState } from '../types/models';
import { useFetchWithPolling } from '../hooks/useFetchWithPolling';
import { POLLING_INTERVALS, GATEWAY } from '../constants/config';
import { transformJobsList } from '../utils/jobTransform';
import { Clock, Search, RefreshCw } from 'lucide-react';

interface JobHistoryProps {
  coordinatorUrl: string;
  onSelectJob: (jobId: string) => void;
}

export default function JobHistory({ coordinatorUrl, onSelectJob }: JobHistoryProps) {
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'failed'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const jobsUrl = useMemo(() => {
    try {
      const url = new URL(coordinatorUrl.startsWith('http') ? coordinatorUrl : `http://${coordinatorUrl}`);
      return `${url.protocol}//${url.hostname}:${GATEWAY.DEFAULT_PORT}/api/jobs`;
    } catch {
      return `${GATEWAY.DEFAULT_PROTOCOL}://localhost:${GATEWAY.DEFAULT_PORT}/api/jobs`;
    }
  }, [coordinatorUrl]);

  const { data: jobsResponse, loading, error, refetch } = useFetchWithPolling<{ jobs: JobStatusData[] }>({
    url: jobsUrl,
    interval: POLLING_INTERVALS.PERIODIC,
    transform: (data) => {
      const jobs = transformJobsList(data);
      return { jobs };
    },
    cacheTime: 3000,
  });

  const jobs = jobsResponse?.jobs || [];

  const filteredJobs = jobs.filter((job) => {
    if (filter === 'active' && job.state !== JobState.Running) return false;
    if (filter === 'completed' && job.state !== JobState.Completed) return false;
    if (filter === 'failed' && job.state !== JobState.Failed) return false;
    if (searchTerm && !job.job_id.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !job.data_id.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    return true;
  });

  const getStateColor = (state: JobState) => {
    switch (state) {
      case JobState.Running:
        return 'bg-green-100 text-green-700 border-green-200';
      case JobState.Completed:
        return 'bg-green-100 text-green-700 border-green-200';
      case JobState.Failed:
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-[#f5f3f0] text-[#6b6560] border-[#e8e4e0]';
    }
  };

  return (
    <div className="glass p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-500 flex items-center justify-center">
            <Clock className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[#2d2926]">Job History</h3>
            <p className="text-sm text-[#6b6560] mt-0.5">
              {filteredJobs.length} job{filteredJobs.length !== 1 ? 's' : ''} shown
            </p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="w-9 h-9 rounded-xl border border-[#e8e4e0] bg-white hover:bg-[#f5f3f0] flex items-center justify-center transition-colors"
        >
          <RefreshCw className="w-4 h-4 text-[#6b6560]" />
        </button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#9c9488]" />
          <input
            type="text"
            placeholder="Search jobs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-[#e8e4e0] rounded-xl bg-white text-sm text-[#2d2926] focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'active', 'completed', 'failed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 text-sm font-medium rounded-xl border transition-colors ${
                filter === f
                  ? 'bg-primary-500 text-white border-primary-600'
                  : 'bg-white text-[#6b6560] border-[#e8e4e0] hover:bg-[#f5f3f0]'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading && filteredJobs.length === 0 && (
        <div className="text-center py-8 text-[#6b6560]">Loading jobs...</div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          Error loading jobs: {error}
        </div>
      )}

      {!loading && filteredJobs.length === 0 && (
        <div className="text-center py-8 text-[#6b6560]">No jobs found</div>
      )}

      {filteredJobs.length > 0 && (
        <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin">
          {filteredJobs.map((job) => (
            <button
              key={job.job_id}
              onClick={() => onSelectJob(job.job_id)}
              className="w-full text-left glass p-4 rounded-xl card-hover"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-mono font-semibold text-[#2d2926] truncate">
                      {job.job_id.substring(0, 16)}...
                    </span>
                    <span className={`px-2 py-0.5 rounded-xl text-xs font-medium border ${getStateColor(job.state)}`}>
                      {job.state}
                    </span>
                  </div>
                  <div className="text-xs text-[#6b6560] font-mono mb-1">
                    Data ID: {job.data_id.substring(0, 16)}...
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-[#6b6560]">
                <span>Phase: {getPhaseName(job.phase)}</span>
                <span>Duration: {formatDuration(job.duration_ms)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
