import React from 'react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

interface Props {
  dataUser: { time: number; value: number }[];
  dataRef: { time: number; value: number }[];
  height?: number;
}

export const WaveformVisualizer: React.FC<Props> = ({ dataUser, dataRef, height = 120 }) => {
  // Merge data for display
  const chartData = dataRef.map((refPoint, i) => ({
    time: refPoint.time,
    ref: refPoint.value,
    user: dataUser[i] ? dataUser[i].value : 0
  }));

  return (
    <div className="w-full bg-slate-900/50 rounded-lg p-2 border border-slate-700">
      <div className="text-xs text-slate-400 mb-1 flex justify-between px-2">
        <span>Pitch Contour</span>
        <div className="flex gap-3">
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-cyan-400"></div> Reference</span>
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-rose-400"></div> You</span>
        </div>
      </div>
      <div style={{ height: `${height}px`, width: '100%', minWidth: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="gradRef" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="gradUser" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#fb7185" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#fb7185" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis dataKey="time" hide />
            <YAxis hide domain={[0, 100]} />
            <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155' }} />
            <Area 
                type="monotone" 
                dataKey="ref" 
                stroke="#22d3ee" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#gradRef)" 
            />
            <Area 
                type="monotone" 
                dataKey="user" 
                stroke="#fb7185" 
                strokeDasharray="3 3"
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#gradUser)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};