import { useState, useEffect } from 'react';
import { Power, PowerOff, RefreshCw, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { CoordinatorStatus } from '../types/models';

interface CoordinatorControlProps {
  gatewayUrl: string;
  connectionStatus?: CoordinatorStatus;
}

export default function CoordinatorControl({ gatewayUrl, connectionStatus }: CoordinatorControlProps) {
  const [isRunning, setIsRunning] = useState<boolean | null>(null);
  const [pid, setPid] = useState<number | null>(null);
  const [isManaged, setIsManaged] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    try {
      const cacheBuster = `_t=${Date.now()}`;
      const separator = gatewayUrl.includes('?') ? '&' : '?';
      const response = await fetch(`${gatewayUrl}/api/coordinator/process-status${separator}${cacheBuster}`, {
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      });
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        setIsRunning(data.running);
        setPid(data.pid || null);
        setIsManaged(data.managed || false);
        setError(null);
      } else {
        setError(`Gateway server error: ${response.status} ${response.statusText}`);
        setIsRunning(false);
        setPid(null);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      console.error('Failed to fetch coordinator status:', err);
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          setError('Request timeout (15s). The coordinator may be slow or unresponsive. Check coordinator logs.');
        } else if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
          setError('Cannot connect to gateway server. Make sure it\'s running: cd distributed-console && node gateway-server.cjs');
        } else {
          setError(`Connection error: ${err.message}`);
        }
      } else {
        setError('Failed to connect to gateway server');
      }
      setIsRunning(false);
      setPid(null);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, [gatewayUrl]);

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${gatewayUrl}/api/coordinator/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (response.ok) {
        setIsRunning(true);
        setPid(data.pid);
        setTimeout(fetchStatus, 1500);
      } else {
        if (data.error && data.error.includes('already running')) {
          setTimeout(fetchStatus, 500);
        } else {
          setError(data.error || 'Failed to start coordinator');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start coordinator');
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${gatewayUrl}/api/coordinator/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (response.ok) {
        setIsRunning(false);
        setPid(null);
      } else {
        setError(data.error || 'Failed to stop coordinator');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop coordinator');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            isRunning ? 'bg-primary-500' : 'bg-[#e8e4e0]'
          }`}>
            {isRunning ? (
              <Power className="w-5 h-5 text-white" />
            ) : (
              <PowerOff className="w-5 h-5 text-[#6b6560]" />
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[#2d2926]">Coordinator</h3>
            <p className="text-xs text-[#6b6560] font-medium">
              {isRunning === null 
                ? 'Checking status...' 
                : isRunning 
                  ? pid 
                    ? `Running (PID: ${pid})${!isManaged ? ' - External' : ''}` 
                    : `Running${!isManaged ? ' - External' : ''}`
                  : 'Stopped'}
            </p>
          </div>
        </div>
        <button
          onClick={fetchStatus}
          disabled={loading}
          className="w-9 h-9 rounded-xl border border-[#e8e4e0] bg-white hover:bg-[#f5f3f0] flex items-center justify-center transition-colors"
        >
          <RefreshCw className={`w-4 h-4 text-[#6b6560] ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

          {isRunning && connectionStatus === CoordinatorStatus.Connected && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
              <Wifi className="w-4 h-4 text-green-600 flex-shrink-0" />
              <div className="text-sm text-green-700 font-medium">Connected to coordinator service</div>
            </div>
          )}
          
          {isRunning && connectionStatus === CoordinatorStatus.Connecting && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse flex-shrink-0" />
              <Wifi className="w-4 h-4 text-yellow-600 animate-pulse flex-shrink-0" />
              <div className="text-sm text-yellow-700 font-medium">Connecting to coordinator service...</div>
            </div>
          )}
          
          {isRunning && connectionStatus === CoordinatorStatus.Disconnected && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
              <WifiOff className="w-4 h-4 text-red-600 flex-shrink-0" />
              <div className="text-sm text-red-700 font-medium">Coordinator running but dashboard cannot connect</div>
            </div>
          )}

          {isRunning === false && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
              <PowerOff className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <div className="text-sm text-amber-700 font-medium">Coordinator process is stopped. Start it to enable monitoring.</div>
            </div>
          )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
          <div className="flex items-start gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-sm text-red-700 font-medium mb-1">{error}</div>
              {error.includes('Gateway server not accessible') && (
                <div className="text-xs text-red-600 mt-1">
                  <div className="font-mono bg-white/50 px-2 py-1 rounded mt-1">
                    cd distributed-console && node gateway-server.cjs
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={handleStart}
          disabled={loading || isRunning === true}
          className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-xl border border-primary-600 hover:bg-primary-600 font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Power className="w-4 h-4" />
          Start
        </button>
        <button
          onClick={handleStop}
          disabled={loading || isRunning === false}
          className="flex-1 px-4 py-2 bg-white text-red-600 rounded-xl border border-red-300 hover:bg-red-50 font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <PowerOff className="w-4 h-4" />
          Stop
        </button>
      </div>
    </div>
  );
}

