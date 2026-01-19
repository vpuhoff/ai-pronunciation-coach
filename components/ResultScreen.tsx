import React, { useState } from 'react';
import { AnalysisResult, WordAnalysis } from '../types';
import { WaveformVisualizer } from './WaveformVisualizer';
import { RefreshCw, ArrowRight, Play, Info } from 'lucide-react';

interface Props {
  result: AnalysisResult;
  onRetry: () => void;
  onNext: () => void;
}

const ResultScreen: React.FC<Props> = ({ result, onRetry, onNext }) => {
  const [playingRef, setPlayingRef] = useState(false);
  const [playingUser, setPlayingUser] = useState(false);
  
  // Audio elements
  const refAudio = React.useRef<HTMLAudioElement>(null);
  const userAudio = React.useRef<HTMLAudioElement>(null);

  const safePlay = async (audioEl: HTMLAudioElement, setPlaying: (v: boolean) => void) => {
    try {
        setPlaying(true);
        audioEl.currentTime = 0;
        await audioEl.play();
    } catch (err) {
        if ((err as Error).name !== 'AbortError') {
             console.error("Playback error", err);
        }
        setPlaying(false);
    }
  };

  const playAudio = (type: 'ref' | 'user') => {
    if (type === 'ref') {
        if(refAudio.current && result.referenceAudioUrl) {
            safePlay(refAudio.current, setPlayingRef);
        }
    } else {
        if(userAudio.current && result.userAudioUrl) {
            safePlay(userAudio.current, setPlayingUser);
        }
    }
  };

  const getWordColor = (status: WordAnalysis['status']) => {
    switch(status) {
        case 'error': return 'text-red-400 bg-red-400/10 border-red-400/20';
        case 'warning': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
        default: return 'text-brand-success bg-brand-success/10 border-brand-success/20';
    }
  };

  const getIssueIcon = (issue?: string) => {
    if (!issue) return null;
    if (issue === 'pitch') return <span className="text-[10px] uppercase tracking-tighter bg-purple-500/20 text-purple-300 px-1 rounded ml-1">Intonation</span>;
    if (issue === 'pause') return <span className="text-[10px] uppercase tracking-tighter bg-blue-500/20 text-blue-300 px-1 rounded ml-1">Rhythm</span>;
    return <span className="text-[10px] uppercase tracking-tighter bg-red-500/20 text-red-300 px-1 rounded ml-1">Pronun.</span>;
  };

  return (
    <div className="flex flex-col h-full p-6 w-full max-w-6xl mx-auto overflow-y-auto pb-32">
      {result.referenceAudioUrl && (
        <audio ref={refAudio} src={result.referenceAudioUrl} onEnded={() => setPlayingRef(false)} />
      )}
      {result.userAudioUrl && (
        <audio ref={userAudio} src={result.userAudioUrl} onEnded={() => setPlayingUser(false)} />
      )}

      {/* Title */}
      <h2 className="text-center md:text-left text-2xl font-bold text-white mb-8">Session Results</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
          
          {/* Left Column: Metrics & Audio */}
          <div className="space-y-8">
            {/* Score Circle */}
            <div className="bg-slate-800/50 p-6 rounded-3xl border border-slate-700/50 backdrop-blur-sm flex flex-col items-center">
                <div className="inline-flex items-center justify-center relative mb-2">
                    <svg className="w-32 h-32 md:w-40 md:h-40 transform -rotate-90">
                        <circle cx="50%" cy="50%" r="40%" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-slate-800" />
                        <circle 
                            cx="50%" cy="50%" r="40%" 
                            stroke="currentColor" 
                            strokeWidth="12" 
                            fill="transparent" 
                            strokeDasharray="251.2" // approximate for r=40% of 100 viewBox size but visually tuned
                            pathLength={100}
                            strokeDashoffset={100 - result.overallScore}
                            strokeLinecap="round"
                            className={`${result.overallScore > 80 ? 'text-brand-success' : result.overallScore > 50 ? 'text-brand-warning' : 'text-brand-danger'} transition-all duration-1000 ease-out`} 
                        />
                    </svg>
                    <span className="absolute text-3xl md:text-4xl font-bold text-white">{result.overallScore}</span>
                </div>
                <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wide">Pronunciation Score</h3>
            </div>

            {/* Audio Controls (Grid) */}
            <div className="grid grid-cols-2 gap-4">
                <button 
                    disabled={!result.referenceAudioUrl}
                    onClick={() => playAudio('ref')} 
                    className="flex flex-col items-center justify-center gap-2 py-4 bg-slate-800 hover:bg-slate-700 rounded-2xl border border-slate-700 transition-colors disabled:opacity-50"
                >
                    {playingRef ? <Play className="w-6 h-6 text-brand-primary animate-pulse"/> : <Play className="w-6 h-6 text-brand-primary"/>}
                    <span className="text-xs font-medium text-slate-300">Reference</span>
                </button>
                <button 
                    disabled={!result.userAudioUrl}
                    onClick={() => playAudio('user')} 
                    className="flex flex-col items-center justify-center gap-2 py-4 bg-slate-800 hover:bg-slate-700 rounded-2xl border border-slate-700 transition-colors disabled:opacity-50"
                >
                    {playingUser ? <Play className="w-6 h-6 text-rose-400 animate-pulse"/> : <Play className="w-6 h-6 text-rose-400"/>}
                    <span className="text-xs font-medium text-slate-300">My Recording</span>
                </button>
            </div>

            {/* Waveform */}
            <div className="bg-slate-800/30 p-4 rounded-2xl border border-slate-700/50">
                <WaveformVisualizer dataUser={result.pitchCurveUser} dataRef={result.pitchCurveReference} height={150} />
            </div>
          </div>

          {/* Right Column: Analysis & Feedback */}
          <div className="space-y-8">
             {/* AI Feedback */}
             <div className="bg-gradient-to-br from-brand-accent/20 to-brand-primary/10 border border-brand-accent/30 p-6 rounded-3xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Info className="w-24 h-24 text-brand-accent" />
                </div>
                <div className="relative z-10">
                    <h3 className="font-bold text-brand-accent mb-2 flex items-center gap-2">
                        <Info className="w-5 h-5" /> AI Coach Feedback
                    </h3>
                    <p className="text-slate-100 leading-relaxed text-lg">
                        {result.feedback}
                    </p>
                </div>
             </div>

             {/* Detailed Word Feedback */}
             <div className="bg-slate-800/50 p-6 rounded-3xl border border-slate-700">
                <h3 className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-4">Word Analysis</h3>
                <div className="flex flex-wrap gap-3">
                    {result.words.map((w, i) => (
                        <div key={i} className={`flex flex-col items-center group`}>
                            <span 
                                className={`px-4 py-2 rounded-xl border-2 text-xl font-medium transition-all cursor-pointer ${getWordColor(w.status)} hover:scale-105`}
                                onClick={() => playAudio('user')}
                            >
                                {w.word}
                            </span>
                            {w.issue && (
                                <div className="mt-1 opacity-100 transition-opacity">
                                    {getIssueIcon(w.issue)}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
             </div>
          </div>
      </div>

      {/* Sticky Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-brand-dark via-brand-dark/95 to-transparent z-40">
        <div className="flex gap-4 max-w-4xl mx-auto">
            <button 
                onClick={onRetry}
                className="flex-1 py-4 bg-slate-700 hover:bg-slate-600 text-white rounded-2xl font-semibold flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95"
            >
                <RefreshCw className="w-5 h-5" /> Retry
            </button>
            <button 
                onClick={onNext}
                className="flex-[2] py-4 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-brand-primary/25 transition-transform active:scale-95"
            >
                Next Phrase <ArrowRight className="w-5 h-5" />
            </button>
        </div>
      </div>

    </div>
  );
};

export default ResultScreen;