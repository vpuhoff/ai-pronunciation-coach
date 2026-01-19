
import React, { useRef, useMemo } from 'react';
import { HistoryItem } from '../types';
import { ArrowLeft, Download, Upload, Play, Calendar, Star, Trash2, TrendingUp, Activity } from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  CartesianGrid
} from 'recharts';

interface Props {
  history: HistoryItem[];
  onBack: () => void;
  onPractice: (item: HistoryItem) => void;
  onImport: (file: File) => void;
  onClear: () => void;
}

const HistoryScreen: React.FC<Props> = ({ history, onBack, onPractice, onImport, onClear }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Statistics Logic ---
  const statsData = useMemo(() => {
    const today = new Date();
    const data: { date: string; displayDate: string; count: number; totalScore: number; avgScore: number }[] = [];
    const historyMap = new Map<string, { count: number; totalScore: number }>();

    // 1. Group history by date (YYYY-MM-DD)
    history.forEach(item => {
        // Use local date string for grouping to avoid timezone shifts affecting the "day"
        const d = new Date(item.timestamp);
        const dateKey = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
        
        if (!historyMap.has(dateKey)) {
            historyMap.set(dateKey, { count: 0, totalScore: 0 });
        }
        const entry = historyMap.get(dateKey)!;
        entry.count += 1;
        entry.totalScore += item.result.overallScore;
    });

    // 2. Generate last 30 days array (filling gaps with 0)
    for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        
        const dateKey = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
        const displayDate = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        
        const entry = historyMap.get(dateKey);
        
        data.push({
            date: dateKey,
            displayDate,
            count: entry ? entry.count : 0,
            totalScore: entry ? entry.totalScore : 0,
            avgScore: entry ? Math.round(entry.totalScore / entry.count) : 0
        });
    }
    return data;
  }, [history]);

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleExport = () => {
    const exportData = history.map(item => ({
        ...item,
        phrase: {
            ...item.phrase,
            audioBase64: undefined
        },
        result: {
            ...item.result,
            userAudioUrl: '',
            referenceAudioUrl: '',
            pitchCurveReference: [],
            pitchCurveUser: []
        }
    }));

    const dataStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `prosody_history_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImport(e.target.files[0]);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-brand-success';
    if (score >= 50) return 'text-brand-warning';
    return 'text-brand-danger';
  };

  // Helper to safely get language or null
  const getLanguageLabel = (phrase: any) => {
    if (phrase.language) return phrase.language;
    // Fallback to legacy check in text, but if not found, return null to hide badge
    const match = phrase.text.match(/\((.*?)\)/);
    return match ? match[1] : null; 
  };

  // Custom Tooltip for Charts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800 border border-slate-700 p-3 rounded-lg shadow-xl">
          <p className="text-slate-300 text-sm font-medium mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
             <p key={index} style={{ color: entry.color }} className="text-sm font-bold">
               {entry.name}: {entry.value}
             </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen w-full max-w-6xl mx-auto p-6 flex flex-col">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-3xl font-bold text-white">Progress & History</h1>
        </div>

        <div className="flex gap-3">
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json"
            className="hidden"
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors text-sm font-medium"
          >
            <Upload className="w-4 h-4" /> Import
          </button>
          <button 
            onClick={handleExport}
            disabled={history.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors text-sm font-medium disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> Export
          </button>
          {history.length > 0 && (
             <button 
             onClick={() => {
                 if(confirm('Are you sure you want to clear all history? This will also delete saved recordings.')) onClear();
             }}
             className="flex items-center gap-2 px-4 py-2 bg-rose-900/20 hover:bg-rose-900/40 text-rose-400 rounded-lg border border-rose-900/30 transition-colors text-sm font-medium"
           >
             <Trash2 className="w-4 h-4" /> Clear
           </button>
          )}
        </div>
      </div>

      {/* Analytics Charts */}
      {history.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
            {/* Chart 1: Activity */}
            <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-700/50">
                <div className="flex items-center gap-2 mb-4">
                    <Activity className="w-5 h-5 text-brand-primary" />
                    <h3 className="text-slate-200 font-semibold">Activity (Phrases)</h3>
                </div>
                <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={statsData}>
                            <XAxis 
                                dataKey="displayDate" 
                                tick={{fill: '#64748b', fontSize: 10}} 
                                axisLine={false} 
                                tickLine={false}
                                interval="preserveStartEnd"
                                minTickGap={20}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{fill: '#334155', opacity: 0.2}} />
                            <Bar 
                                dataKey="count" 
                                name="Phrases" 
                                fill="#3b82f6" 
                                radius={[4, 4, 0, 0]} 
                                maxBarSize={40}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Chart 2: Average Score */}
            <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-700/50">
                <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-5 h-5 text-brand-success" />
                    <h3 className="text-slate-200 font-semibold">Avg. Daily Score</h3>
                </div>
                <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={statsData}>
                            <defs>
                                <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <XAxis 
                                dataKey="displayDate" 
                                tick={{fill: '#64748b', fontSize: 10}} 
                                axisLine={false} 
                                tickLine={false}
                                interval="preserveStartEnd"
                                minTickGap={20}
                            />
                            <YAxis hide domain={[0, 100]} />
                            <Tooltip content={<CustomTooltip />} />
                            <Area 
                                type="monotone" 
                                dataKey="avgScore" 
                                name="Avg Score" 
                                stroke="#10b981" 
                                fillOpacity={1} 
                                fill="url(#colorScore)" 
                                strokeWidth={2}
                                connectNulls
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
      )}

      {/* List */}
      {history.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 space-y-4">
          <Calendar className="w-16 h-16 opacity-20" />
          <p className="text-lg">No history found.</p>
          <p className="text-sm">Complete a session or import a file to see your progress.</p>
        </div>
      ) : (
        <>
            <h3 className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-4">Recent Sessions</h3>
            <div className="grid grid-cols-1 gap-4 overflow-y-auto pb-20">
            {[...history].reverse().map((item) => {
                const langLabel = getLanguageLabel(item.phrase);
                return (
                <div key={item.id} className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 hover:bg-slate-800 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                
                <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3 text-xs text-slate-400 mb-1">
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3"/> {formatDate(item.timestamp)}</span>
                        {langLabel && (
                            <span className="bg-slate-700 px-2 py-0.5 rounded-full text-slate-300">{langLabel}</span>
                        )}
                    </div>
                    <h3 className="text-lg font-medium text-slate-100">{item.phrase.text}</h3>
                    <p className="text-sm text-slate-400 italic">{item.phrase.translation}</p>
                </div>

                <div className="flex items-center gap-6 justify-between md:justify-end border-t md:border-t-0 border-slate-700 pt-4 md:pt-0 mt-2 md:mt-0">
                    <div className="flex flex-col items-end min-w-[60px]">
                        <span className={`text-2xl font-bold ${getScoreColor(item.result.overallScore)}`}>{item.result.overallScore}</span>
                        <span className="text-xs text-slate-500 uppercase">Score</span>
                    </div>
                    
                    <button 
                    onClick={() => onPractice(item)}
                    className="flex items-center gap-2 px-4 py-3 bg-brand-primary/10 hover:bg-brand-primary text-brand-primary hover:text-white rounded-xl transition-all font-medium border border-brand-primary/30 hover:border-brand-primary"
                    >
                    <Play className="w-4 h-4" /> Practice
                    </button>
                </div>

                </div>
            )})}
            </div>
        </>
      )}
    </div>
  );
};

export default HistoryScreen;
