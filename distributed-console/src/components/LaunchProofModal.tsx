import { useState } from 'react';
import { X, Play, AlertCircle, FolderOpen, FileText } from 'lucide-react';
import { CoordinatorClient } from '../services/coordinatorClient';
import { WORKER_REGISTRATION_WAIT_MS, GATEWAY } from '../constants/config';

interface LaunchProofModalProps {
  coordinatorUrl: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (jobId: string) => void;
}

export default function LaunchProofModal({
  coordinatorUrl,
  isOpen,
  onClose,
  onSuccess,
}: LaunchProofModalProps) {
  const [blockId, setBlockId] = useState('0x1234567890abcdef');
  const [computeCapacity, setComputeCapacity] = useState('10');
  const [inputPath, setInputPath] = useState('');
  const [elfPath, setElfPath] = useState('');
  const [numWorkers, setNumWorkers] = useState('0');
  const [provingKeyPath, setProvingKeyPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'config' | 'launch'>('config');

  if (!isOpen) return null;

  const handleConfigSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!elfPath || !inputPath) {
      setError('ELF path and input path are required');
      return;
    }

    setStep('launch');
  };

  const handleLaunchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let gatewayUrl = `${GATEWAY.DEFAULT_PROTOCOL}://localhost:${GATEWAY.DEFAULT_PORT}`;
      try {
        const url = new URL(coordinatorUrl.startsWith('http') ? coordinatorUrl : `http://${coordinatorUrl}`);
        gatewayUrl = `${url.protocol}//${url.hostname}:${GATEWAY.DEFAULT_PORT}`;
      } catch {
        gatewayUrl = `${GATEWAY.DEFAULT_PROTOCOL}://localhost:${GATEWAY.DEFAULT_PORT}`;
      }

      if (parseInt(numWorkers, 10) > 0) {
        console.log(`Auto-starting ${numWorkers} worker(s) before launching proof...`);
        const workerPromises = [];
        for (let i = 0; i < parseInt(numWorkers, 10); i++) {
          const workerId = `auto-worker-${Date.now()}-${i}`;
          workerPromises.push(
            fetch(`${gatewayUrl}/api/worker/start`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                workerId,
                elfPath,
                inputPath,
                provingKeyPath: provingKeyPath || undefined,
              }),
            })
          );
        }
        
        const workerResults = await Promise.allSettled(workerPromises);
        const failed = workerResults.filter(r => r.status === 'rejected');
        const succeeded = workerResults.filter(r => r.status === 'fulfilled');
        
        if (failed.length > 0) {
          const errorMessages = failed
            .map(r => r.status === 'rejected' ? (r.reason?.message || r.reason || 'Unknown error') : '')
            .filter(Boolean);
          console.warn('Some workers failed to start:', errorMessages);
          if (succeeded.length === 0) {
            throw new Error(`All ${numWorkers} worker(s) failed to start: ${errorMessages.join('; ')}`);
          }
          console.warn(`${failed.length} worker(s) failed, but ${succeeded.length} succeeded. Continuing...`);
        }
        
        if (succeeded.length > 0) {
          await new Promise(resolve => setTimeout(resolve, WORKER_REGISTRATION_WAIT_MS));
        }
      } else {
        console.log('Using existing workers (numWorkers = 0)');
      }

      const client = new CoordinatorClient(coordinatorUrl);
      const result = await client.launchProof(
        blockId,
        parseInt(computeCapacity, 10),
        inputPath
      );

      onSuccess(result.job_id);
      
      setBlockId('0x1234567890abcdef');
      setComputeCapacity('10');
      setInputPath('');
      setElfPath('');
      setNumWorkers('0');
      setProvingKeyPath('');
      setStep('config');
      onClose();
    } catch (err) {
      let errorMessage = 'Failed to launch proof';
      if (err instanceof Error) {
        if (err.message.includes('timeout') || err.message.includes('AbortError')) {
          errorMessage = `Request timeout: ${err.message}. The coordinator may be slow to respond or unavailable.`;
        } else if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
          errorMessage = `Connection error: ${err.message}. Check if the gateway server is running.`;
        } else {
          errorMessage = err.message;
        }
      }
      setError(errorMessage);
      console.error('Launch proof error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="glass rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-[#e8e4e0] px-6 py-5 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-500 flex items-center justify-center">
              <Play className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-[#2d2926]">Launch Proof Generation</h2>
              <p className="text-xs text-[#6b6560] mt-0.5">
                {step === 'config' ? 'Step 1: Configure paths' : 'Step 2: Launch job'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg border border-[#e8e4e0] bg-white hover:bg-[#f5f3f0] flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5 text-[#6b6560]" />
          </button>
        </div>

        {/* Form */}
        <form 
          onSubmit={step === 'config' ? handleConfigSubmit : handleLaunchSubmit} 
          className="p-6 space-y-5"
        >
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-700 font-medium">{error}</div>
            </div>
          )}

          {step === 'config' ? (
            <>
              <div>
                <label className="block text-sm font-semibold text-[#2d2926] mb-2 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  ELF File Path <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={elfPath}
                  onChange={(e) => setElfPath(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-white border border-[#e8e4e0] rounded-xl text-sm text-[#2d2926] placeholder-[#9c9488] focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono"
                  placeholder="/path/to/program.elf"
                />
                <p className="text-xs text-[#6b6560] mt-1 ml-1">Full path to your compiled ELF file</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#2d2926] mb-2 flex items-center gap-2">
                  <FolderOpen className="w-4 h-4" />
                  Input File Path <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={inputPath}
                  onChange={(e) => setInputPath(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-white border border-[#e8e4e0] rounded-xl text-sm text-[#2d2926] placeholder-[#9c9488] focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono"
                  placeholder="/path/to/input.bin"
                />
                <p className="text-xs text-[#6b6560] mt-1 ml-1">Full path to your input data file</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#2d2926] mb-2">
                  Proving Key Path (Optional)
                </label>
                <input
                  type="text"
                  value={provingKeyPath}
                  onChange={(e) => setProvingKeyPath(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-[#e8e4e0] rounded-xl text-sm text-[#2d2926] placeholder-[#9c9488] focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono"
                  placeholder="~/.zisk/provingKey"
                />
                <p className="text-xs text-[#6b6560] mt-1 ml-1">Defaults to ~/.zisk/provingKey if not specified</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-3 bg-white text-[#6b6560] rounded-xl font-semibold hover:bg-[#f5f3f0] transition-colors border border-[#e8e4e0]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-primary-500 text-white rounded-xl font-semibold hover:bg-primary-600 transition-colors"
                >
                  Next: Configure Job
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="bg-[#f5f3f0] border border-[#e8e4e0] rounded-xl p-4 space-y-2">
                <div className="text-xs text-[#6b6560] font-medium">ELF Path:</div>
                <div className="text-sm font-mono text-[#2d2926] truncate">{elfPath}</div>
                <div className="text-xs text-[#6b6560] font-medium mt-2">Input Path:</div>
                <div className="text-sm font-mono text-[#2d2926] truncate">{inputPath}</div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#2d2926] mb-2">
                  Block ID
                </label>
                <input
                  type="text"
                  value={blockId}
                  onChange={(e) => setBlockId(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-white border border-[#e8e4e0] rounded-xl text-sm text-[#2d2926] placeholder-[#9c9488] focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono"
                  placeholder="0x1234567890abcdef"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#2d2926] mb-2">
                  Compute Capacity (CU)
                </label>
                <input
                  type="number"
                  value={computeCapacity}
                  onChange={(e) => setComputeCapacity(e.target.value)}
                  required
                  min="1"
                  className="w-full px-4 py-3 bg-white border border-[#e8e4e0] rounded-xl text-sm text-[#2d2926] placeholder-[#9c9488] focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="10"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#2d2926] mb-2">
                  Auto-Start Workers (Optional)
                </label>
                <input
                  type="number"
                  value={numWorkers}
                  onChange={(e) => setNumWorkers(e.target.value)}
                  required
                  min="0"
                  max="10"
                  className="w-full px-4 py-3 bg-white border border-[#e8e4e0] rounded-xl text-sm text-[#2d2926] placeholder-[#9c9488] focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="0"
                />
                <p className="text-xs text-[#6b6560] mt-1 ml-1">
                  <span className="font-semibold">0</span> = Use existing workers (recommended)
                  <br />
                  <span className="font-semibold">1-10</span> = Automatically start this many new workers before launching proof
                </p>
                <p className="text-xs text-primary-500 mt-2 ml-1 font-medium">
                  💡 Tip: Start workers manually from "Worker Management" panel above, then set this to 0
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep('config')}
                  className="flex-1 px-4 py-3 bg-white text-[#6b6560] rounded-xl font-semibold hover:bg-[#f5f3f0] transition-colors border border-[#e8e4e0]"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-3 bg-white text-[#6b6560] rounded-xl font-semibold hover:bg-[#f5f3f0] transition-colors border border-[#e8e4e0]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-primary-500 text-white rounded-xl font-semibold hover:bg-primary-600 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Launching...' : 'Launch Proof'}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
