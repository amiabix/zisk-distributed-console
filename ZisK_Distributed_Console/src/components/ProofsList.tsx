import { useState, useEffect } from 'react';
import { FileDown, CheckCircle2, Clock } from 'lucide-react';

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
  const [proofs, setProofs] = useState<ProofFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProofs() {
      try {
        setLoading(true);
        const response = await fetch(`${coordinatorUrl}/api/proofs`);
        if (!response.ok) {
          throw new Error(`Failed to fetch proofs: ${response.statusText}`);
        }
        const data = await response.json();
        setProofs(data.proofs || []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setProofs([]);
      } finally {
        setLoading(false);
      }
    }

    fetchProofs();
    // Refresh every 30 seconds
    const interval = setInterval(fetchProofs, 30000);
    return () => clearInterval(interval);
  }, [coordinatorUrl]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  if (loading) {
    return (
      <div className="bg-white border border-neutral rounded-4xl shadow-sm p-6">
        <div className="flex items-center gap-2 text-gray-900">
          <Clock className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading proofs...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-neutral rounded-4xl shadow-sm p-6">
        <div className="text-sm text-gray-900">Error loading proofs: {error}</div>
      </div>
    );
  }

  if (proofs.length === 0) {
    return (
      <div className="bg-white border border-neutral rounded-4xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-3xl bg-primary-light/30 flex items-center justify-center">
            <FileDown className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Generated Proofs</h3>
            <p className="text-sm text-gray-700 mt-0.5">Proof files saved to disk</p>
          </div>
        </div>
        <div className="text-sm text-gray-900 text-center py-4">
          No proof files found in proofs directory
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-neutral rounded-4xl shadow-sm">
      <div className="border-b border-neutral px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-3xl bg-primary-light/30 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Generated Proofs</h3>
            <p className="text-sm text-gray-700 mt-0.5">
              {proofs.length} proof{proofs.length !== 1 ? 's' : ''} available
            </p>
          </div>
        </div>
      </div>
      <div className="p-5">
        <div className="space-y-3">
          {proofs.map((proof) => (
            <div
              key={proof.job_id}
              className="border border-neutral rounded-3xl p-4 bg-neutral-light hover:bg-primary-light/10 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold text-gray-900">Job ID:</span>
                    <span className="text-sm font-mono text-gray-900">{proof.job_id}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-2">
                    <div>
                      <div className="text-xs text-gray-900 font-medium mb-1">File Size</div>
                      <div className="text-sm font-semibold text-gray-900">{proof.size_mb} MB</div>
                    </div>
                    {proof.compressed_size_mb && (
                      <div>
                        <div className="text-xs text-gray-900 font-medium mb-1">Compressed</div>
                        <div className="text-sm font-semibold text-gray-900">
                          {proof.compressed_size_mb} MB
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-gray-900">
                    Created: {formatDate(proof.created_at)}
                  </div>
                </div>
                <div className="ml-4 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-3xl bg-primary-light/30 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

