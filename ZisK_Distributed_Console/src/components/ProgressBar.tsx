interface ProgressBarProps {
  percent: number;
  width?: number;
  showPercentage?: boolean;
  className?: string;
  height?: 'sm' | 'md' | 'lg';
  animated?: boolean;
}

export default function ProgressBar({
  percent,
  width,
  showPercentage = true,
  className = '',
  height = 'md',
  animated = true,
}: ProgressBarProps) {
  const clampedPercent = Math.max(0, Math.min(100, Math.round(percent)));

  const heightClasses = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  };

  // Use accent color for progress bars
  let gradientClass = 'from-accent to-accent/90';

  if (width) {
    // Legacy text-based progress bar for compact displays
    const filledChars = Math.ceil((clampedPercent * width) / 100);
    const emptyChars = width - filledChars;
    const filled = '█'.repeat(Math.max(0, filledChars));
    const empty = '░'.repeat(Math.max(0, emptyChars));
    
    let colorClass = 'text-accent';

    return (
      <span className={`font-mono ${colorClass} ${className}`}>
        [{filled}{empty}]{showPercentage ? ` ${clampedPercent}%` : ''}
      </span>
    );
  }

  // Modern visual progress bar
  return (
    <div className={`w-full ${className}`}>
      <div className={`relative ${heightClasses[height]} bg-primary-light rounded-full overflow-hidden shadow-inner`}>
        <div
          className={`absolute inset-y-0 left-0 bg-gradient-to-r ${gradientClass} transition-all duration-700 ease-out rounded-full shadow-sm ${
            animated ? 'animate-pulse' : ''
          }`}
          style={{ width: `${clampedPercent}%` }}
        >
          {animated && clampedPercent > 0 && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer"></div>
          )}
        </div>
      </div>
      {showPercentage && (
        <div className="mt-1 text-xs font-semibold text-gray-900 text-right">
          {clampedPercent}%
        </div>
      )}
    </div>
  );
}
