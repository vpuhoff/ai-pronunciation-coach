
import React, { useState, useEffect } from 'react';
import { AnalysisResult, WordAnalysis, PhraseData } from '../types';
import { WaveformVisualizer } from './WaveformVisualizer';
import { RefreshCw, ArrowRight, Play, Info, PlusCircle, X, HelpCircle, MessageCircle, Undo2, Loader2, History as HistoryIcon, Activity, Mic2, Wind, Award } from 'lucide-react';
import { askAiCoach } from '../services/geminiService';

interface Props {
  phrase: PhraseData;
  result: AnalysisResult;
  onRetry: () => void;
  onNext: () => void;
  onCustomPhrase: (text: string) => void;
  onExit: () => void;
}

// Helper component for mini progress bars
const MetricBar = ({ label, value, colorClass }: { label: string, value: number, colorClass: string }) => (
    <div className="flex flex-col gap-1 w-full">
        <div className="flex justify-between items-end text-xs">
            <span className="text-slate-400 font-medium">{label}</span>
            <span className={`font-bold ${colorClass.replace('bg-', 'text-')}`}>{value}</span>
        </div>
        <div className="h-2 w-full bg-slate-700 rounded-full overflow-hidden">
            <div 
                className={`h-full rounded-full ${colorClass} transition-all duration-1000 ease-out`} 
                style={{ width: `${value}%` }}
            />
        </div>
    </div>
);

// Helper for enum badges
const EnumBadge = ({ label, value, colorClass }: { label: string, value: string, colorClass: string }) => (
    <div className="flex flex-col gap-1 w-full">
         <span className="text-xs text-slate-400 font-medium">{label}</span>
         <span className={`px-2 py-1 rounded-md text-xs font-bold border ${colorClass} text-center`}>
            {value}
         </span>
    </div>
);

const ResultScreen: React.FC<Props> = ({ phrase, result, onRetry, onNext, onCustomPhrase, onExit }) => {
  const [playingRef, setPlayingRef] = useState(false);
  const [playingUser, setPlayingUser] = useState(false);
  
  // Custom Phrase Modal
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [customInput, setCustomInput] = useState('');
  
  // Q&A States
  const [feedbackText, setFeedbackText] = useState(result.feedback);
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [questionInput, setQuestionInput] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  
  // Audio elements
  const refAudio = React.useRef<HTMLAudioElement>(null);
  const userAudio = React.useRef<HTMLAudioElement>(null);

  // Update local feedback if the result prop changes (e.g., after a retry)
  useEffect(() => {
    setFeedbackText(result.feedback);
  }, [result.feedback]);

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

  // --- Dynamic Color Helpers ---
  const getSpeedColor = (val: string) => {
    if (val === 'Natural') return 'border-brand-success/30 text-brand-success bg-brand-success/10';
    return 'border-brand-warning/30 text-brand-warning bg-brand-warning/10';
  }

  const getHesitationColor = (val: string) => {
    if (val === 'None') return 'border-brand-success/30 text-brand-success bg-brand-success/10';
    if (val === 'Few') return 'border-brand-warning/30 text-brand-warning bg-brand-warning/10';
    return 'border-brand-danger/30 text-brand-danger bg-brand-danger/10';
  }

  const getAccentColor = (val: string) => {
    if (['Native-like', 'Mild'].includes(val)) return 'border-brand-success/30 text-brand-success bg-brand-success/10';
    if (val === 'Moderate') return 'border-brand-warning/30 text-brand-warning bg-brand-warning/10';
    return 'border-brand-danger/30 text-brand-danger bg-brand-danger/10';
  }
  // -----------------------------

  const handleCustomSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if(customInput.trim()) {
          onCustomPhrase(customInput.trim());
          setIsCustomModalOpen(false);
      }
  };

  const handleQuestionSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!questionInput.trim()) return;

      setIsAsking(true);
      setIsQuestionModalOpen(false);

      const answer = await askAiCoach(phrase.text, questionInput.trim(), result.feedback);
      
      setFeedbackText(answer);
      setQuestionInput('');
      setIsAsking(false);
  };

  const restoreFeedback = () => {
      setFeedbackText(result.feedback);
  };

  return (
    <div className="flex flex-col h-full p-6 w-full max-w-6xl mx-auto overflow-y-auto pb-32">
      {result.referenceAudioUrl && (
        <audio ref={refAudio} src={result.referenceAudioUrl} onEnded={() => setPlayingRef(false)} />
      )}
      {result.userAudioUrl && (
        <audio ref={userAudio} src={result.userAudioUrl} onEnded={() => setPlayingUser(false)} />
      )}

      {/* Header with Title and History Button */}
      <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-white">Session Results</h2>
          <button 
            onClick={onExit}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors text-sm font-medium"
          >
            <HistoryIcon className="w-4 h-4" /> <span className="hidden sm:inline">History</span>
          </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          
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
          <div className="space-y-6">
             {/* AI Feedback */}
             <div className="bg-gradient-to-br from-brand-accent/10 to-brand-primary/5 border border-brand-accent/20 p-4 rounded-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none">
                    <Info className="w-16 h-16 text-brand-accent" />
                </div>
                
                <div className="relative z-10 flex flex-col">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-brand-accent flex items-center gap-2 text-base">
                            <Info className="w-4 h-4" /> AI Coach Feedback
                        </h3>
                        <div className="flex gap-2">
                            {feedbackText !== result.feedback && (
                                <button 
                                    onClick={restoreFeedback}
                                    className="p-1 bg-slate-900/40 hover:bg-slate-900/60 rounded text-slate-300 hover:text-white transition-colors text-xs flex items-center gap-1"
                                    title="Restore original feedback"
                                >
                                    <Undo2 className="w-3 h-3" /> Original
                                </button>
                            )}
                            <button 
                                onClick={() => setIsQuestionModalOpen(true)}
                                className="p-1 bg-slate-900/40 hover:bg-slate-900/60 rounded text-brand-accent hover:text-white transition-colors"
                                title="Ask a question about this feedback"
                            >
                                <HelpCircle className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                    
                    <div>
                        {isAsking ? (
                            <div className="flex flex-col items-center justify-center py-4 gap-2 text-slate-400 animate-pulse">
                                <Loader2 className="w-5 h-5 animate-spin text-brand-accent" />
                                <span className="text-xs">Consulting the coach...</span>
                            </div>
                        ) : (
                            <p className="text-slate-200 leading-normal text-sm animate-in fade-in duration-500">
                                {feedbackText}
                            </p>
                        )}
                    </div>
                </div>
             </div>

             {/* Detailed Deep Analysis Grid */}
             {result.detailedScore && (
                 <div className="bg-slate-800/40 p-5 rounded-3xl border border-slate-700">
                     <h3 className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
                         <Activity className="w-4 h-4" /> Deep Analysis
                     </h3>
                     
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                         
                         {/* Articulation */}
                         <div className="space-y-3">
                             <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase">
                                 <Mic2 className="w-3 h-3" /> Articulation
                             </div>
                             <MetricBar label="Phoneme Accuracy" value={result.detailedScore.articulation.phonemeAccuracy} colorClass="bg-cyan-500" />
                             <MetricBar label="Completeness" value={result.detailedScore.articulation.completeness} colorClass="bg-cyan-500" />
                         </div>

                         {/* Prosody */}
                         <div className="space-y-3">
                             <div className="flex items-center gap-2 text-violet-400 text-xs font-bold uppercase">
                                 <Activity className="w-3 h-3" /> Prosody
                             </div>
                             <MetricBar label="Intonation" value={result.detailedScore.prosody.intonation} colorClass="bg-violet-500" />
                             <MetricBar label="Stress" value={result.detailedScore.prosody.stress} colorClass="bg-violet-500" />
                             <MetricBar label="Rhythm" value={result.detailedScore.prosody.rhythm} colorClass="bg-violet-500" />
                         </div>

                         {/* Fluency */}
                         <div className="space-y-3">
                             <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase">
                                 <Wind className="w-3 h-3" /> Fluency
                             </div>
                             <MetricBar label="Smoothness" value={result.detailedScore.fluency.smoothness} colorClass="bg-amber-500" />
                             <div className="grid grid-cols-2 gap-2">
                                <EnumBadge 
                                    label="Speed" 
                                    value={result.detailedScore.fluency.speed} 
                                    colorClass={getSpeedColor(result.detailedScore.fluency.speed)} 
                                />
                                <EnumBadge 
                                    label="Hesitations" 
                                    value={result.detailedScore.fluency.hesitations} 
                                    colorClass={getHesitationColor(result.detailedScore.fluency.hesitations)} 
                                />
                             </div>
                         </div>

                         {/* Impression */}
                         <div className="space-y-3">
                             <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase">
                                 <Award className="w-3 h-3" /> Impression
                             </div>
                             <MetricBar label="Confidence" value={result.detailedScore.impression.confidence} colorClass="bg-emerald-500" />
                             <EnumBadge 
                                label="Accent" 
                                value={result.detailedScore.impression.accent} 
                                colorClass={getAccentColor(result.detailedScore.impression.accent)} 
                             />
                         </div>
                     </div>
                 </div>
             )}

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
        <div className="flex gap-4 max-w-4xl mx-auto items-stretch">
            <button 
                onClick={onRetry}
                className="flex-1 py-4 bg-slate-700 hover:bg-slate-600 text-white rounded-2xl font-semibold flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95"
            >
                <RefreshCw className="w-5 h-5" /> Retry
            </button>
            
            <button
                onClick={() => setIsCustomModalOpen(true)}
                 className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-brand-primary border border-brand-primary/30 hover:border-brand-primary rounded-2xl font-semibold flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95"
            >
                <PlusCircle className="w-5 h-5" /> Custom
            </button>

            <button 
                onClick={onNext}
                className="flex-[2] py-4 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-brand-primary/25 transition-transform active:scale-95"
            >
                Next Phrase <ArrowRight className="w-5 h-5" />
            </button>
        </div>
      </div>

      {/* Custom Phrase Modal */}
      {isCustomModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-800 rounded-3xl border border-slate-700 w-full max-w-md p-6 shadow-2xl transform transition-all scale-100">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-white">Add Custom Phrase</h3>
                    <button onClick={() => setIsCustomModalOpen(false)} className="text-slate-400 hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                <form onSubmit={handleCustomSubmit}>
                    <p className="text-slate-400 text-sm mb-3">
                        Enter a phrase in your native or target language. The AI will translate it and prepare a lesson.
                    </p>
                    <textarea 
                        value={customInput}
                        onChange={(e) => setCustomInput(e.target.value)}
                        placeholder="E.g., I would like to order a beer..."
                        className="w-full h-32 bg-slate-900 border border-slate-700 rounded-xl p-4 text-white placeholder:text-slate-600 focus:ring-2 focus:ring-brand-primary outline-none resize-none mb-6"
                        autoFocus
                    />
                    <div className="flex gap-3">
                        <button 
                            type="button" 
                            onClick={() => setIsCustomModalOpen(false)}
                            className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            disabled={!customInput.trim()}
                            className="flex-1 py-3 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-xl font-bold transition-transform active:scale-95 disabled:opacity-50"
                        >
                            Generate
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* Ask Question Modal */}
      {isQuestionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-800 rounded-3xl border border-slate-700 w-full max-w-md p-6 shadow-2xl transform transition-all scale-100">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <MessageCircle className="w-6 h-6 text-brand-accent" /> Ask the Coach
                    </h3>
                    <button onClick={() => setIsQuestionModalOpen(false)} className="text-slate-400 hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                <form onSubmit={handleQuestionSubmit}>
                    <p className="text-slate-400 text-sm mb-3">
                        Ask specifically about pronunciation, intonation, or how to say a difficult part of this phrase.
                    </p>
                    <textarea 
                        value={questionInput}
                        onChange={(e) => setQuestionInput(e.target.value)}
                        placeholder="E.g., How do I position my tongue for the 'th' sound?"
                        className="w-full h-32 bg-slate-900 border border-slate-700 rounded-xl p-4 text-white placeholder:text-slate-600 focus:ring-2 focus:ring-brand-accent outline-none resize-none mb-6"
                        autoFocus
                    />
                    <div className="flex gap-3">
                        <button 
                            type="button" 
                            onClick={() => setIsQuestionModalOpen(false)}
                            className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            disabled={!questionInput.trim()}
                            className="flex-1 py-3 bg-brand-accent hover:bg-brand-accent/90 text-white rounded-xl font-bold transition-transform active:scale-95 disabled:opacity-50"
                        >
                            Ask Coach
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

    </div>
  );
};

export default ResultScreen;
