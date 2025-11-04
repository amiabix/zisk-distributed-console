import { useMemo } from 'react';
import { FileDown, CheckCircle2, Clock } from 'lucide-react';
import { useFetchWithPolling } from '../hooks/useFetchWithPolling';
import { POLLING_INTERVALS, GATEWAY, CACHE } from '../constants/config';
import Button from './Button';
import Card from './Card';

interface ProofFile {
  job_id: string;
  file_name: string;
  file_path: string;
  size_bytes: number;
  size_mb: string;
  compressed_size_bytes: number | null;
  compressed_size_mb: string | null;
  created_at: string;
  modified_at: string;
}

interface ProofsListProps {
  coordinatorUrl: string;
}

export default function ProofsList({ coordinatorUrl }: ProofsListProps) {
  // Convert coordinator URL to gateway URL
  const proofsUrl = useMemo(() => {
    try {
      const url = new URL(coordinatorUrl.startsWith('http') ? coordinatorUrl : `http://${coordinatorUrl}`);
      return `${url.protocol}//${url.hostname}:${GATEWAY.DEFAULT_PORT}/api/proofs`;
    } catch {
      return `${GATEWAY.DEFAULT_PROTOCOL}://localhost:${GATEWAY.DEFAULT_PORT}/api/proofs`;
    }
  }, [coordinatorUrl]);

  const { data: proofsResponse, loading, error } = useFetchWithPolling<{ proofs: ProofFile[] }>({
    url: proofsUrl,
    interval: POLLING_INTERVALS.SLOW,
    transform: (data) => {
      // Handle both { proofs: [] } and direct array responses
      if (Array.isArray(data)) {
        return { proofs: data };
      }
      return { proofs: data.proofs || [] };
    },
    cacheTime: CACHE.LONG_TTL_MS, // Proofs don't change frequently
  });

  const proofs = proofsResponse?.proofs || [];

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  if (loading && proofs.length === 0) {
    return (
      <div className="glass p-5">
        <div className="flex items-center gap-2 text-[#6b6560]">
          <Clock className="w-4 h-4 animate-spin text-primary-500" />
          <span className="text-sm font-medium">Loading proofs...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass border-red-200 p-5">
        <div className="text-sm text-red-700 font-medium">Error loading proofs: {error}</div>
      </div>
    );
  }

  if (proofs.length === 0) {
    return (
      <div className="glass p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary-500 flex items-center justify-center">
            <FileDown className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[#2d2926]">Generated Proofs</h3>
            <p className="text-sm text-[#6b6560]">Proof files saved to disk</p>
          </div>
        </div>
        <div className="text-sm text-[#6b6560] text-center py-4 font-medium">
          No proof files found in proofs directory
        </div>
      </div>
    );
  }

  return (
    <div className="glass p-5">
      <div className="flex items-center gap-3 mb-4 pb-4 border-b border-[#e8e4e0]">
        <div className="w-10 h-10 rounded-xl bg-primary-500 flex items-center justify-center">
          <CheckCircle2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-[#2d2926]">Generated Proofs</h3>
          <p className="text-sm text-[#6b6560]">
            {proofs.length} proof{proofs.length !== 1 ? 's' : ''} available
          </p>
        </div>
      </div>
      <div className="space-y-3">
        {proofs.map((proof) => {
          const downloadUrl = (() => {
            try {
              const url = new URL(coordinatorUrl.startsWith('http') ? coordinatorUrl : `http://${coordinatorUrl}`);
              return `${url.protocol}//${url.hostname}:${GATEWAY.DEFAULT_PORT}/api/proofs/${proof.job_id}/download`;
            } catch {
              return `${GATEWAY.DEFAULT_PROTOCOL}://localhost:${GATEWAY.DEFAULT_PORT}/api/proofs/${proof.job_id}/download`;
            }
          })();

          return (
            <div
              key={proof.job_id}
              className="bg-white border border-[#e8e4e0] rounded-xl p-4 flex items-start justify-between card-hover"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-semibold text-[#6b6560]">Job ID:</span>
                  <span className="text-sm font-mono text-[#2d2926]">{proof.job_id}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <div>
                    <div className="text-xs text-[#6b6560] font-medium mb-1">File Size</div>
                    <div className="text-sm font-semibold text-[#2d2926]">{proof.size_mb} MB</div>
                  </div>
                  {proof.compressed_size_mb && (
                    <div>
                      <div className="text-xs text-[#6b6560] font-medium mb-1">Compressed</div>
                      <div className="text-sm font-semibold text-[#2d2926]">
                        {proof.compressed_size_mb} MB
                      </div>
                    </div>
                  )}
                </div>
                <div className="text-xs text-[#6b6560] font-mono">
                  Created: {formatDate(proof.created_at)}
                </div>
              </div>
              <div className="ml-4 flex items-center gap-2">
                <Button
                  variant="primary"
                  size="md"
                  icon={<FileDown className="w-4 h-4" />}
                  onClick={() => {
                    window.location.href = downloadUrl;
                  }}
                >
                  Download
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
