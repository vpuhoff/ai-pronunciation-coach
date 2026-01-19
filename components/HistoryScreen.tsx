import React, { useRef } from 'react';
import { HistoryItem } from '../types';
import { ArrowLeft, Download, Upload, Play, Calendar, Star, Trash2 } from 'lucide-react';

interface Props {
  history: HistoryItem[];
  onBack: () => void;
  onPractice: (item: HistoryItem) => void;
  onImport: (file: File) => void;
  onClear: () => void;
}

const HistoryScreen: React.FC<Props> = ({ history, onBack, onPractice, onImport, onClear }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleExport = () => {
    // Create a clean version of history for export, ensuring no pitch curve data is included
    // (This handles legacy history items that might still have it)
    const exportData = history.map(item => ({
        ...item,
        result: {
            ...item.result,
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

  return (
    <div className="min-h-screen w-full max-w-5xl mx-auto p-6 flex flex-col">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-3xl font-bold text-white">History</h1>
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
                 if(confirm('Are you sure you want to clear all history?')) onClear();
             }}
             className="flex items-center gap-2 px-4 py-2 bg-rose-900/20 hover:bg-rose-900/40 text-rose-400 rounded-lg border border-rose-900/30 transition-colors text-sm font-medium"
           >
             <Trash2 className="w-4 h-4" /> Clear
           </button>
          )}
        </div>
      </div>

      {/* List */}
      {history.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 space-y-4">
          <Calendar className="w-16 h-16 opacity-20" />
          <p className="text-lg">No history found.</p>
          <p className="text-sm">Complete a session or import a file to see your progress.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 overflow-y-auto pb-20">
          {[...history].reverse().map((item) => (
            <div key={item.id} className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 hover:bg-slate-800 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
              
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-3 text-xs text-slate-400 mb-1">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3"/> {formatDate(item.timestamp)}</span>
                    <span className="bg-slate-700 px-2 py-0.5 rounded-full text-slate-300">{item.phrase.text.match(/\((.*?)\)/)?.[1] || 'Unknown'}</span>
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
          ))}
        </div>
      )}
    </div>
  );
};

export default HistoryScreen;