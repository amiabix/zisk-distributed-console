import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { useMemo } from 'react';

interface DataPoint {
  time: string;
  value: number;
  timestamp: number;
}

interface MetricsGraphProps {
  data: DataPoint[];
  title: string;
  unit?: string;
  color?: string;
  maxValue?: number;
  height?: number;
}

export default function MetricsGraph({
  data,
  title,
  unit = '',
  color = '#007755',
  maxValue,
  height = 200,
}: MetricsGraphProps) {
  const chartData = useMemo(() => {
    if (data.length === 0) return [];
    
    // Take last 60 data points or all if less
    const recentData = data.slice(-60);
    
    return recentData.map((point) => {
      const date = new Date(point.timestamp);
      const formattedTime = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      return {
        time: formattedTime,
        value: Math.round(point.value * 100) / 100,
        fullTime: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }),
      };
    });
  }, [data]);

  const max = maxValue || Math.max(...chartData.map((d) => d.value), 0) * 1.1 || 100;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
          return (
            <div className="bg-white border border-[#e8e4e0] rounded-xl shadow-lg px-3 py-2">
              <p className="text-[#6b6560] text-xs font-medium mb-1">{payload[0].payload.fullTime}</p>
              <p className="text-[#2d2926] text-sm font-semibold">
                {payload[0].value.toFixed(2)}{unit}
              </p>
            </div>
          );
    }
    return null;
  };

  if (chartData.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center glass rounded-xl">
        <div className="text-[#6b6560] text-sm">No data available</div>
      </div>
    );
  }

  return (
    <div className="glass rounded-xl p-4">
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-[#2d2926]">{title}</h3>
          <div className="flex items-center gap-2 px-2 py-1 bg-white border border-[#e8e4e0] rounded-xl">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }}></div>
            <span className="text-xs font-semibold text-[#2d2926]">
              {chartData[chartData.length - 1]?.value.toFixed(2)}{unit}
            </span>
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`gradient-${title.replace(/\s+/g, '-')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={1} />
              <stop offset="50%" stopColor={color} stopOpacity={0.75} />
              <stop offset="100%" stopColor={color} stopOpacity={0.4} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e8e4e0" strokeOpacity={0.5} />
          <XAxis
            dataKey="time"
            stroke="#6b6560"
            tick={{ fill: '#6b6560', fontSize: 10 }}
            tickFormatter={(value) => {
              if (!value) return '';
              const timeStr = String(value).trim();
              if (timeStr === 'PM' || timeStr === 'AM') return '';
              return timeStr;
            }}
            interval="preserveStartEnd"
            minTickGap={30}
          />
          <YAxis
            stroke="#6b6560"
            tick={{ fill: '#6b6560', fontSize: 10 }}
            domain={[0, max]}
            tickFormatter={(value) => `${value}${unit}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#gradient-${title.replace(/\s+/g, '-')})`}
            dot={false}
            activeDot={{ r: 4, fill: color }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

