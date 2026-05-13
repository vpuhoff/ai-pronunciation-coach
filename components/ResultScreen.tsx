import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import { AnalysisResult, WordAnalysis, PhraseData } from '../types';
import { WaveformVisualizer } from './WaveformVisualizer';
import { RefreshCw, ArrowRight, Play, Info, PlusCircle, X, HelpCircle, MessageCircle, Undo2, Loader2, History as HistoryIcon, Activity, Mic2, Wind, Award } from 'lucide-react';
import { MetricBar } from './result/MetricBar';
import { askAiCoach } from '../services/geminiService';

interface Props {
  phrase: PhraseData;
  result: AnalysisResult;
  onRetry: () => void;
  onNext: () => void;
  onCustomPhrase: (text: string) => void;
  onExit: () => void;
}

// Helper for enum badges
const EnumBadge = ({ label, value, colorClass }: { label: string, value: string, colorClass: string }) => (
    <div className="flex flex-col gap-1 w-full">
         <span className="text-xs text-slate-400 font-medium">{label}</span>
         <span className={`px-2 py-1 rounded-md text-xs font-bold border ${colorClass} text-center`}>
            {value}
         </span>
    </div>
);

/** Pronunciation ring + count-up duration (plan 001 Step 6; TZ 0.6–1.2s). */
const SCORE_COUNT_UP_MS = 850;

/** Word Analysis tooltip: human-readable status (plan 001 Step 10 / spec D). */
function wordStatusLabel(status: WordAnalysis['status']): string {
  switch (status) {
    case 'perfect':
      return 'Perfect';
    case 'warning':
      return 'Warning';
    case 'error':
      return 'Error';
    default:
      return status;
  }
}

/** Label for `issue` when present. */
function wordIssueLabel(issue: WordAnalysis['issue'] | undefined): string | null {
  if (!issue) return null;
  switch (issue) {
    case 'pitch':
      return 'Pitch / intonation';
    case 'pause':
      return 'Pause / rhythm';
    case 'pronunciation':
      return 'Pronunciation';
    case 'speed':
      return 'Tempo / speed';
    default:
      return issue;
  }
}

/** Fallback when `issue` is missing (spec: general wording by status). */
function wordIssueFallback(w: WordAnalysis): string {
  if (!w.issue) {
    if (w.status === 'warning') {
      return 'Small mismatch with the reference — check stress and rhythm.';
    }
    if (w.status === 'error') {
      return 'Clear deviation — compare with the reference recording.';
    }
  }
  return 'Use Reference / My Recording to compare with the native line.';
}

function readPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const ResultScreen: React.FC<Props> = ({ phrase, result, onRetry, onNext, onCustomPhrase, onExit }) => {
  const [playingRef, setPlayingRef] = useState(false);
  const [playingUser, setPlayingUser] = useState(false);

  /** Plan 001 Step 11: единый источник для score count-up, MetricBar, Pitch (WaveformVisualizer). */
  const [reduceMotion, setReduceMotion] = useState(readPrefersReducedMotion);
  
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

  /** Normalized progress 0→1 for score ring + count-up (Step 6). Reset when `result` changes. */
  const [scoreAnimProgress, setScoreAnimProgress] = useState(0);
  const scoreAnimFrameRef = useRef<number>(0);

  const wordTipBaseId = useId().replace(/:/g, '');
  const [wordTooltipIndex, setWordTooltipIndex] = useState<number | null>(null);
  const [wordTooltipFixedStyle, setWordTooltipFixedStyle] = useState<React.CSSProperties>({});
  const wordTooltipLeaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wordAnchorMapRef = useRef<Map<number, HTMLButtonElement>>(new Map());
  const wordTooltipBoxRef = useRef<HTMLDivElement>(null);
  const [canHoverWordTip, setCanHoverWordTip] = useState(false);

  const clearWordTipLeaveTimer = useCallback(() => {
    if (wordTooltipLeaveTimerRef.current !== null) {
      clearTimeout(wordTooltipLeaveTimerRef.current);
      wordTooltipLeaveTimerRef.current = null;
    }
  }, []);

  const scheduleWordTipClose = useCallback(() => {
    clearWordTipLeaveTimer();
    wordTooltipLeaveTimerRef.current = window.setTimeout(() => {
      setWordTooltipIndex(null);
      wordTooltipLeaveTimerRef.current = null;
    }, 220);
  }, [clearWordTipLeaveTimer]);

  const setWordAnchorRef = useCallback((index: number) => (el: HTMLButtonElement | null) => {
    if (el) wordAnchorMapRef.current.set(index, el);
    else wordAnchorMapRef.current.delete(index);
  }, []);

  const repositionWordTooltip = useCallback(() => {
    const i = wordTooltipIndex;
    if (i === null) {
      setWordTooltipFixedStyle({});
      return;
    }
    const anchor = wordAnchorMapRef.current.get(i);
    if (!anchor) return;

    const r = anchor.getBoundingClientRect();
    const margin = 8;
    const maxW = Math.min(280, window.innerWidth - margin * 2);
    const tipEl = wordTooltipBoxRef.current;
    const tipH = tipEl?.offsetHeight ?? 120;

    let left = r.left + r.width / 2 - maxW / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - maxW - margin));

    let top = r.bottom + margin;
    if (top + tipH > window.innerHeight - margin) {
      top = r.top - tipH - margin;
    }
    top = Math.max(margin, Math.min(top, window.innerHeight - tipH - margin));

    setWordTooltipFixedStyle({
      position: 'fixed',
      top,
      left,
      width: maxW,
      zIndex: 30,
    });
  }, [wordTooltipIndex]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(hover: hover)');
    const sync = () => setCanHoverWordTip(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  /** Tailwind `lg` (≥1024px): two flex columns so left/right stack independently (no shared grid row heights). */
  const [layoutLg, setLayoutLg] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : false
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => setLayoutLg(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new Event('resize'));
  }, [layoutLg]);

  useEffect(() => {
    setWordTooltipIndex(null);
    clearWordTipLeaveTimer();
  }, [result, clearWordTipLeaveTimer]);

  useEffect(() => {
    if (isCustomModalOpen || isQuestionModalOpen) {
      setWordTooltipIndex(null);
      clearWordTipLeaveTimer();
    }
  }, [isCustomModalOpen, isQuestionModalOpen, clearWordTipLeaveTimer]);

  useEffect(() => {
    if (wordTooltipIndex === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setWordTooltipIndex(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [wordTooltipIndex]);

  useEffect(() => {
    if (wordTooltipIndex === null) return;
    const onPointerDown = (ev: PointerEvent) => {
      const t = ev.target as Node;
      if (wordTooltipBoxRef.current?.contains(t)) return;
      const anchor = wordAnchorMapRef.current.get(wordTooltipIndex);
      if (anchor?.contains(t)) return;
      setWordTooltipIndex(null);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [wordTooltipIndex]);

  useLayoutEffect(() => {
    if (wordTooltipIndex === null) {
      setWordTooltipFixedStyle({});
      return;
    }
    const run = () => repositionWordTooltip();
    const raf = requestAnimationFrame(run);
    const el = wordTooltipBoxRef.current;
    let ro: ResizeObserver | undefined;
    if (el) {
      ro = new ResizeObserver(run);
      ro.observe(el);
    }
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [wordTooltipIndex, repositionWordTooltip]);

  useEffect(() => {
    if (wordTooltipIndex === null) return;
    const onViewport = () => repositionWordTooltip();
    window.addEventListener('resize', onViewport);
    window.addEventListener('scroll', onViewport, true);
    return () => {
      window.removeEventListener('resize', onViewport);
      window.removeEventListener('scroll', onViewport, true);
    };
  }, [wordTooltipIndex, repositionWordTooltip]);

  useEffect(() => () => clearWordTipLeaveTimer(), [clearWordTipLeaveTimer]);

  // Update local feedback if the result prop changes (e.g., after a retry)
  useEffect(() => {
    setFeedbackText(result.feedback);
  }, [result.feedback]);

  // Count-up + strokeDashoffset sync on new `result` (retry / history); `reduceMotion` — plan Step 11.
  useEffect(() => {
    let cancelled = false;
    const target = Math.min(100, Math.max(0, result.overallScore));

    cancelAnimationFrame(scoreAnimFrameRef.current);

    if (reduceMotion || target === 0) {
      setScoreAnimProgress(1);
      return;
    }

    setScoreAnimProgress(0);
    const start = performance.now();

    const tick = (now: number) => {
      if (cancelled) return;
      const t = Math.min(1, (now - start) / SCORE_COUNT_UP_MS);
      const eased = 1 - (1 - t) ** 3;
      setScoreAnimProgress(eased);
      if (t < 1) {
        scoreAnimFrameRef.current = requestAnimationFrame(tick);
      } else {
        setScoreAnimProgress(1);
      }
    };

    scoreAnimFrameRef.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(scoreAnimFrameRef.current);
    };
  }, [result, reduceMotion]);

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

  /** Сигнатура данных Pitch для сброса IO-анимации при новом `result` (plan 001 Step 8). */
  const waveformAnimationKey = useMemo(
    () =>
      [
        phrase.id,
        result.overallScore,
        result.feedback.length,
        result.pitchCurveReference.length,
        result.pitchCurveUser.length,
        result.pitchCurveReference[0]?.time ?? '',
        result.pitchCurveReference[0]?.value ?? '',
        result.pitchCurveUser[0]?.value ?? '',
      ].join('|'),
    [
      phrase.id,
      result.overallScore,
      result.feedback.length,
      result.pitchCurveReference,
      result.pitchCurveUser,
    ]
  );

  /** Custom / Ask Coach modal open — bottom bar must not capture taps or focus (plan 001 Step 5, docs/ai/plans/001-session-results-responsive-dynamics.md). */
  const isActionBarBlocked = isCustomModalOpen || isQuestionModalOpen;

  const overallTarget = Math.min(100, Math.max(0, result.overallScore));
  const scoreLabel =
    scoreAnimProgress >= 1 ? overallTarget : Math.round(overallTarget * scoreAnimProgress);
  const scoreRingDashOffset = 100 - overallTarget * scoreAnimProgress;

  return (
    <div className="flex flex-col h-full min-w-0 w-full max-w-6xl xl:max-w-7xl mx-auto overflow-y-auto overflow-x-hidden p-6 max-md:pb-[calc(8rem+env(safe-area-inset-bottom,0px))] max-md:scroll-pb-[calc(8rem+env(safe-area-inset-bottom,0px))]">
      {result.referenceAudioUrl && (
        <audio ref={refAudio} src={result.referenceAudioUrl} onEnded={() => setPlayingRef(false)} />
      )}
      {result.userAudioUrl && (
        <audio ref={userAudio} src={result.userAudioUrl} onEnded={() => setPlayingUser(false)} />
      )}

      {/* Header with Title and History Button */}
      <div className="flex min-w-0 items-center justify-between gap-4 mb-8">
          <h2 className="truncate min-w-0 font-bold text-white max-lg:text-[clamp(1.125rem,2.5vw+0.65rem,1.5rem)] lg:text-2xl">
            Session Results
          </h2>
          <button 
            type="button"
            onClick={onExit}
            className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/80 px-4 py-2 text-sm font-medium text-slate-300 transition-[transform,box-shadow,background-color] duration-150 ease-out hover:scale-[1.02] hover:bg-slate-700 hover:shadow-md hover:shadow-black/35 active:scale-[0.98] active:brightness-95 motion-reduce:transition-colors motion-reduce:hover:scale-100 motion-reduce:hover:shadow-none motion-reduce:active:scale-100"
          >
            <HistoryIcon className="w-4 h-4" /> <span className="hidden sm:inline">History</span>
          </button>
      </div>

      {/*
        Mobile: single column, DOM order = plan 001 (Score → Audio → Feedback → Words → Deep → Pitch).
        Desktop (lg+): two flex columns — heights are independent (grid row sync caused huge vertical gaps).
      */}
      {!layoutLg ? (
        <div className="flex min-w-0 flex-col gap-8">
          <section key="sec-score" className="min-w-0">
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
                            strokeDashoffset={scoreRingDashOffset}
                            strokeLinecap="round"
                            className={overallTarget > 80 ? 'text-brand-success' : overallTarget > 50 ? 'text-brand-warning' : 'text-brand-danger'}
                        />
                    </svg>
                    <span className="absolute font-bold text-white max-lg:text-[clamp(1.6875rem,4.5vw+0.75rem,2.25rem)] lg:text-4xl">
                      {scoreLabel}
                    </span>
                </div>
                <h3 className="font-medium uppercase tracking-wide text-slate-400 max-lg:text-[clamp(0.6875rem,1.2vw+0.55rem,0.875rem)] lg:text-sm">
                  Pronunciation Score
                </h3>
            </div>
        </section>

          <section key="sec-audio" className="min-w-0">
            <div className="grid min-w-0 grid-cols-2 gap-4">
                <button 
                    type="button"
                    disabled={!result.referenceAudioUrl}
                    onClick={() => playAudio('ref')} 
                    className="flex min-w-0 flex-col items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-800 py-4 transition-[transform,box-shadow,background-color] duration-150 ease-out enabled:hover:scale-[1.02] enabled:hover:bg-slate-700 enabled:hover:shadow-lg enabled:hover:shadow-cyan-400/20 enabled:active:scale-[0.98] enabled:active:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-colors motion-reduce:enabled:hover:scale-100 motion-reduce:enabled:hover:shadow-none motion-reduce:enabled:active:scale-100"
                >
                    {playingRef ? <Play className="w-6 h-6 text-brand-primary animate-pulse"/> : <Play className="w-6 h-6 text-brand-primary"/>}
                    <span className="text-xs font-medium text-slate-300">Reference</span>
                </button>
                <button 
                    type="button"
                    disabled={!result.userAudioUrl}
                    onClick={() => playAudio('user')} 
                    className="flex min-w-0 flex-col items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-800 py-4 transition-[transform,box-shadow,background-color] duration-150 ease-out enabled:hover:scale-[1.02] enabled:hover:bg-slate-700 enabled:hover:shadow-lg enabled:hover:shadow-rose-400/25 enabled:active:scale-[0.98] enabled:active:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-colors motion-reduce:enabled:hover:scale-100 motion-reduce:enabled:hover:shadow-none motion-reduce:enabled:active:scale-100"
                >
                    {playingUser ? <Play className="w-6 h-6 text-rose-400 animate-pulse"/> : <Play className="w-6 h-6 text-rose-400"/>}
                    <span className="text-xs font-medium text-slate-300">My Recording</span>
                </button>
            </div>
        </section>

          <section key="sec-feedback" className="min-w-0">
             <div className="bg-gradient-to-br from-brand-accent/10 to-brand-primary/5 border border-brand-accent/20 p-4 rounded-2xl relative overflow-hidden min-w-0">
                <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none">
                    <Info className="w-16 h-16 text-brand-accent" />
                </div>
                
                <div className="relative z-10 flex min-w-0 flex-col">
                    <div className="flex justify-between items-start mb-2 gap-2 min-w-0">
                        <h3 className="flex min-w-0 shrink items-center gap-2 font-bold text-brand-accent max-lg:text-[clamp(0.9375rem,2vw+0.35rem,1rem)] lg:text-base">
                            <Info className="w-4 h-4 shrink-0" /> AI Coach Feedback
                        </h3>
                        <div className="flex gap-2 shrink-0">
                            {feedbackText !== result.feedback && (
                                <button 
                                    type="button"
                                    onClick={restoreFeedback}
                                    className="flex items-center gap-1 rounded p-1 text-xs text-slate-300 transition-[transform,background-color,color] duration-150 ease-out hover:scale-105 hover:bg-slate-900/60 hover:text-white active:scale-95 motion-reduce:transition-colors motion-reduce:hover:scale-100 motion-reduce:active:scale-100"
                                    title="Restore original feedback"
                                >
                                    <Undo2 className="w-3 h-3" /> Original
                                </button>
                            )}
                            <button 
                                type="button"
                                onClick={() => setIsQuestionModalOpen(true)}
                                className="rounded p-1 text-brand-accent transition-[transform,background-color,color] duration-150 ease-out hover:scale-105 hover:bg-slate-900/60 hover:text-white active:scale-95 motion-reduce:transition-colors motion-reduce:hover:scale-100 motion-reduce:active:scale-100"
                                title="Ask a question about this feedback"
                            >
                                <HelpCircle className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                    
                    <div className="min-w-0">
                        {isAsking ? (
                            <div className="flex flex-col items-center justify-center py-4 gap-2 text-slate-400 animate-pulse">
                                <Loader2 className="w-5 h-5 animate-spin text-brand-accent" />
                                <span className="text-xs">Consulting the coach...</span>
                            </div>
                        ) : (
                            <p className="text-slate-200 leading-normal text-sm animate-in fade-in duration-500 break-words">
                                {feedbackText}
                            </p>
                        )}
                    </div>
                </div>
             </div>
        </section>

          <section key="sec-words" className="min-w-0">
             <div className="bg-slate-800/50 p-6 rounded-3xl border border-slate-700 min-w-0 overflow-x-auto">
                <h3 className="mb-4 font-bold uppercase tracking-wider text-slate-400 max-lg:text-[clamp(0.6875rem,1.5vw+0.5rem,0.875rem)] lg:text-sm">
                  Word Analysis
                </h3>
                <div className="flex min-w-0 flex-wrap gap-3">
                    {result.words.map((w, i) => {
                      const isProblem = w.status === 'warning' || w.status === 'error';

                      if (!isProblem) {
                        return (
                          <div key={i} className="flex flex-col items-center">
                            <span
                              role="presentation"
                              className={`rounded-xl border-2 px-4 py-2 text-xl font-medium cursor-default select-none ${getWordColor(w.status)}`}
                            >
                              {w.word}
                            </span>
                            {w.issue ? (
                              <div className="mt-1 opacity-100 transition-opacity">
                                {getIssueIcon(w.issue)}
                              </div>
                            ) : null}
                          </div>
                        );
                      }

                      const tipOpen = wordTooltipIndex === i;
                      return (
                        <div key={i} className="flex flex-col items-center">
                          <button
                            type="button"
                            ref={setWordAnchorRef(i)}
                            aria-expanded={tipOpen}
                            aria-describedby={tipOpen ? `${wordTipBaseId}-desc-${i}` : undefined}
                            className={`rounded-xl border-2 px-4 py-2 text-xl font-medium transition-[transform,color,border-color,background-color] duration-150 ease-out enabled:hover:scale-[1.02] enabled:active:scale-[0.98] motion-reduce:enabled:hover:scale-100 motion-reduce:enabled:active:scale-100 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${getWordColor(w.status)}`}
                            onClick={() => {
                              clearWordTipLeaveTimer();
                              setWordTooltipIndex((c) => (c === i ? null : i));
                            }}
                            onMouseEnter={() => {
                              if (!canHoverWordTip) return;
                              clearWordTipLeaveTimer();
                              setWordTooltipIndex(i);
                            }}
                            onMouseLeave={() => {
                              if (!canHoverWordTip) return;
                              const anchor = wordAnchorMapRef.current.get(i);
                              if (anchor && document.activeElement === anchor) return;
                              scheduleWordTipClose();
                            }}
                            onFocus={() => {
                              clearWordTipLeaveTimer();
                              setWordTooltipIndex(i);
                            }}
                            onBlur={(e) => {
                              if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                              setWordTooltipIndex((c) => (c === i ? null : c));
                            }}
                          >
                            {w.word}
                          </button>
                          {w.issue ? (
                            <div className="mt-1 opacity-100 transition-opacity">
                              {getIssueIcon(w.issue)}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                </div>
             </div>
        </section>

          {result.detailedScore && (
        <section key="sec-deep" className="min-w-0">
                 <div className="bg-slate-800/40 p-5 rounded-3xl border border-slate-700 min-w-0">
                     <h3 className="mb-4 flex items-center gap-2 font-bold uppercase tracking-wider text-slate-400 max-lg:text-[clamp(0.6875rem,1.5vw+0.5rem,0.875rem)] lg:text-sm">
                         <Activity className="w-4 h-4" /> Deep Analysis
                     </h3>
                     
                     <div className="grid min-w-0 grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                         
                         {/* Articulation */}
                         <div className="space-y-3 min-w-0">
                             <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase">
                                 <Mic2 className="w-3 h-3" /> Articulation
                             </div>
                             <MetricBar label="Phoneme Accuracy" value={result.detailedScore.articulation.phonemeAccuracy} colorClass="bg-cyan-500" reduceMotion={reduceMotion} />
                             <MetricBar label="Completeness" value={result.detailedScore.articulation.completeness} colorClass="bg-cyan-500" reduceMotion={reduceMotion} />
                         </div>

                         {/* Prosody */}
                         <div className="space-y-3 min-w-0">
                             <div className="flex items-center gap-2 text-violet-400 text-xs font-bold uppercase">
                                 <Activity className="w-3 h-3" /> Prosody
                             </div>
                             <MetricBar label="Intonation" value={result.detailedScore.prosody.intonation} colorClass="bg-violet-500" reduceMotion={reduceMotion} />
                             <MetricBar label="Stress" value={result.detailedScore.prosody.stress} colorClass="bg-violet-500" reduceMotion={reduceMotion} />
                             <MetricBar label="Rhythm" value={result.detailedScore.prosody.rhythm} colorClass="bg-violet-500" reduceMotion={reduceMotion} />
                         </div>

                         {/* Fluency */}
                         <div className="space-y-3 min-w-0">
                             <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase">
                                 <Wind className="w-3 h-3" /> Fluency
                             </div>
                             <MetricBar label="Smoothness" value={result.detailedScore.fluency.smoothness} colorClass="bg-amber-500" reduceMotion={reduceMotion} />
                             <div className="grid grid-cols-2 gap-2 min-w-0">
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
                         <div className="space-y-3 min-w-0">
                             <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase">
                                 <Award className="w-3 h-3" /> Impression
                             </div>
                             <MetricBar label="Confidence" value={result.detailedScore.impression.confidence} colorClass="bg-emerald-500" reduceMotion={reduceMotion} />
                             <EnumBadge 
                                label="Accent" 
                                value={result.detailedScore.impression.accent} 
                                colorClass={getAccentColor(result.detailedScore.impression.accent)} 
                             />
                         </div>
                     </div>
                 </div>
        </section>
        )}

          <section key="sec-pitch" className="min-w-0 w-full">
            <div className="bg-slate-800/30 p-4 rounded-2xl border border-slate-700/50 min-w-0 max-w-full overflow-x-auto">
                <WaveformVisualizer
                  animationKey={waveformAnimationKey}
                  dataUser={result.pitchCurveUser}
                  dataRef={result.pitchCurveReference}
                  height={150}
                  reduceMotion={reduceMotion}
                />
            </div>
        </section>
        </div>
      ) : (
        <div className="flex min-w-0 flex-row items-start gap-6">
          <div className="flex min-w-0 flex-1 flex-col gap-8">
            <section key="sec-score" className="min-w-0">
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
                            strokeDashoffset={scoreRingDashOffset}
                            strokeLinecap="round"
                            className={overallTarget > 80 ? 'text-brand-success' : overallTarget > 50 ? 'text-brand-warning' : 'text-brand-danger'}
                        />
                    </svg>
                    <span className="absolute font-bold text-white max-lg:text-[clamp(1.6875rem,4.5vw+0.75rem,2.25rem)] lg:text-4xl">
                      {scoreLabel}
                    </span>
                </div>
                <h3 className="font-medium uppercase tracking-wide text-slate-400 max-lg:text-[clamp(0.6875rem,1.2vw+0.55rem,0.875rem)] lg:text-sm">
                  Pronunciation Score
                </h3>
            </div>
        </section>

            <section key="sec-audio" className="min-w-0">
            <div className="grid min-w-0 grid-cols-2 gap-4">
                <button 
                    type="button"
                    disabled={!result.referenceAudioUrl}
                    onClick={() => playAudio('ref')} 
                    className="flex min-w-0 flex-col items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-800 py-4 transition-[transform,box-shadow,background-color] duration-150 ease-out enabled:hover:scale-[1.02] enabled:hover:bg-slate-700 enabled:hover:shadow-lg enabled:hover:shadow-cyan-400/20 enabled:active:scale-[0.98] enabled:active:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-colors motion-reduce:enabled:hover:scale-100 motion-reduce:enabled:hover:shadow-none motion-reduce:enabled:active:scale-100"
                >
                    {playingRef ? <Play className="w-6 h-6 text-brand-primary animate-pulse"/> : <Play className="w-6 h-6 text-brand-primary"/>}
                    <span className="text-xs font-medium text-slate-300">Reference</span>
                </button>
                <button 
                    type="button"
                    disabled={!result.userAudioUrl}
                    onClick={() => playAudio('user')} 
                    className="flex min-w-0 flex-col items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-800 py-4 transition-[transform,box-shadow,background-color] duration-150 ease-out enabled:hover:scale-[1.02] enabled:hover:bg-slate-700 enabled:hover:shadow-lg enabled:hover:shadow-rose-400/25 enabled:active:scale-[0.98] enabled:active:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-colors motion-reduce:enabled:hover:scale-100 motion-reduce:enabled:hover:shadow-none motion-reduce:enabled:active:scale-100"
                >
                    {playingUser ? <Play className="w-6 h-6 text-rose-400 animate-pulse"/> : <Play className="w-6 h-6 text-rose-400"/>}
                    <span className="text-xs font-medium text-slate-300">My Recording</span>
                </button>
            </div>
        </section>

            <section key="sec-pitch" className="min-w-0 w-full">
            <div className="bg-slate-800/30 p-4 rounded-2xl border border-slate-700/50 min-w-0 max-w-full overflow-x-auto">
                <WaveformVisualizer
                  animationKey={waveformAnimationKey}
                  dataUser={result.pitchCurveUser}
                  dataRef={result.pitchCurveReference}
                  height={150}
                  reduceMotion={reduceMotion}
                />
            </div>
        </section>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-8">
            <section key="sec-feedback" className="min-w-0">
             <div className="bg-gradient-to-br from-brand-accent/10 to-brand-primary/5 border border-brand-accent/20 p-4 rounded-2xl relative overflow-hidden min-w-0">
                <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none">
                    <Info className="w-16 h-16 text-brand-accent" />
                </div>
                
                <div className="relative z-10 flex min-w-0 flex-col">
                    <div className="flex justify-between items-start mb-2 gap-2 min-w-0">
                        <h3 className="flex min-w-0 shrink items-center gap-2 font-bold text-brand-accent max-lg:text-[clamp(0.9375rem,2vw+0.35rem,1rem)] lg:text-base">
                            <Info className="w-4 h-4 shrink-0" /> AI Coach Feedback
                        </h3>
                        <div className="flex gap-2 shrink-0">
                            {feedbackText !== result.feedback && (
                                <button 
                                    type="button"
                                    onClick={restoreFeedback}
                                    className="flex items-center gap-1 rounded p-1 text-xs text-slate-300 transition-[transform,background-color,color] duration-150 ease-out hover:scale-105 hover:bg-slate-900/60 hover:text-white active:scale-95 motion-reduce:transition-colors motion-reduce:hover:scale-100 motion-reduce:active:scale-100"
                                    title="Restore original feedback"
                                >
                                    <Undo2 className="w-3 h-3" /> Original
                                </button>
                            )}
                            <button 
                                type="button"
                                onClick={() => setIsQuestionModalOpen(true)}
                                className="rounded p-1 text-brand-accent transition-[transform,background-color,color] duration-150 ease-out hover:scale-105 hover:bg-slate-900/60 hover:text-white active:scale-95 motion-reduce:transition-colors motion-reduce:hover:scale-100 motion-reduce:active:scale-100"
                                title="Ask a question about this feedback"
                            >
                                <HelpCircle className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                    
                    <div className="min-w-0">
                        {isAsking ? (
                            <div className="flex flex-col items-center justify-center py-4 gap-2 text-slate-400 animate-pulse">
                                <Loader2 className="w-5 h-5 animate-spin text-brand-accent" />
                                <span className="text-xs">Consulting the coach...</span>
                            </div>
                        ) : (
                            <p className="text-slate-200 leading-normal text-sm animate-in fade-in duration-500 break-words">
                                {feedbackText}
                            </p>
                        )}
                    </div>
                </div>
             </div>
        </section>

            {result.detailedScore && (
        <section key="sec-deep" className="min-w-0">
                 <div className="bg-slate-800/40 p-5 rounded-3xl border border-slate-700 min-w-0">
                     <h3 className="mb-4 flex items-center gap-2 font-bold uppercase tracking-wider text-slate-400 max-lg:text-[clamp(0.6875rem,1.5vw+0.5rem,0.875rem)] lg:text-sm">
                         <Activity className="w-4 h-4" /> Deep Analysis
                     </h3>
                     
                     <div className="grid min-w-0 grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                         
                         {/* Articulation */}
                         <div className="space-y-3 min-w-0">
                             <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase">
                                 <Mic2 className="w-3 h-3" /> Articulation
                             </div>
                             <MetricBar label="Phoneme Accuracy" value={result.detailedScore.articulation.phonemeAccuracy} colorClass="bg-cyan-500" reduceMotion={reduceMotion} />
                             <MetricBar label="Completeness" value={result.detailedScore.articulation.completeness} colorClass="bg-cyan-500" reduceMotion={reduceMotion} />
                         </div>

                         {/* Prosody */}
                         <div className="space-y-3 min-w-0">
                             <div className="flex items-center gap-2 text-violet-400 text-xs font-bold uppercase">
                                 <Activity className="w-3 h-3" /> Prosody
                             </div>
                             <MetricBar label="Intonation" value={result.detailedScore.prosody.intonation} colorClass="bg-violet-500" reduceMotion={reduceMotion} />
                             <MetricBar label="Stress" value={result.detailedScore.prosody.stress} colorClass="bg-violet-500" reduceMotion={reduceMotion} />
                             <MetricBar label="Rhythm" value={result.detailedScore.prosody.rhythm} colorClass="bg-violet-500" reduceMotion={reduceMotion} />
                         </div>

                         {/* Fluency */}
                         <div className="space-y-3 min-w-0">
                             <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase">
                                 <Wind className="w-3 h-3" /> Fluency
                             </div>
                             <MetricBar label="Smoothness" value={result.detailedScore.fluency.smoothness} colorClass="bg-amber-500" reduceMotion={reduceMotion} />
                             <div className="grid grid-cols-2 gap-2 min-w-0">
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
                         <div className="space-y-3 min-w-0">
                             <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase">
                                 <Award className="w-3 h-3" /> Impression
                             </div>
                             <MetricBar label="Confidence" value={result.detailedScore.impression.confidence} colorClass="bg-emerald-500" reduceMotion={reduceMotion} />
                             <EnumBadge 
                                label="Accent" 
                                value={result.detailedScore.impression.accent} 
                                colorClass={getAccentColor(result.detailedScore.impression.accent)} 
                             />
                         </div>
                     </div>
                 </div>
        </section>
        )}

            <section key="sec-words" className="min-w-0">
             <div className="bg-slate-800/50 p-6 rounded-3xl border border-slate-700 min-w-0 overflow-x-auto">
                <h3 className="mb-4 font-bold uppercase tracking-wider text-slate-400 max-lg:text-[clamp(0.6875rem,1.5vw+0.5rem,0.875rem)] lg:text-sm">
                  Word Analysis
                </h3>
                <div className="flex min-w-0 flex-wrap gap-3">
                    {result.words.map((w, i) => {
                      const isProblem = w.status === 'warning' || w.status === 'error';

                      if (!isProblem) {
                        return (
                          <div key={i} className="flex flex-col items-center">
                            <span
                              role="presentation"
                              className={`rounded-xl border-2 px-4 py-2 text-xl font-medium cursor-default select-none ${getWordColor(w.status)}`}
                            >
                              {w.word}
                            </span>
                            {w.issue ? (
                              <div className="mt-1 opacity-100 transition-opacity">
                                {getIssueIcon(w.issue)}
                              </div>
                            ) : null}
                          </div>
                        );
                      }

                      const tipOpen = wordTooltipIndex === i;
                      return (
                        <div key={i} className="flex flex-col items-center">
                          <button
                            type="button"
                            ref={setWordAnchorRef(i)}
                            aria-expanded={tipOpen}
                            aria-describedby={tipOpen ? `${wordTipBaseId}-desc-${i}` : undefined}
                            className={`rounded-xl border-2 px-4 py-2 text-xl font-medium transition-[transform,color,border-color,background-color] duration-150 ease-out enabled:hover:scale-[1.02] enabled:active:scale-[0.98] motion-reduce:enabled:hover:scale-100 motion-reduce:enabled:active:scale-100 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${getWordColor(w.status)}`}
                            onClick={() => {
                              clearWordTipLeaveTimer();
                              setWordTooltipIndex((c) => (c === i ? null : i));
                            }}
                            onMouseEnter={() => {
                              if (!canHoverWordTip) return;
                              clearWordTipLeaveTimer();
                              setWordTooltipIndex(i);
                            }}
                            onMouseLeave={() => {
                              if (!canHoverWordTip) return;
                              const anchor = wordAnchorMapRef.current.get(i);
                              if (anchor && document.activeElement === anchor) return;
                              scheduleWordTipClose();
                            }}
                            onFocus={() => {
                              clearWordTipLeaveTimer();
                              setWordTooltipIndex(i);
                            }}
                            onBlur={(e) => {
                              if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                              setWordTooltipIndex((c) => (c === i ? null : c));
                            }}
                          >
                            {w.word}
                          </button>
                          {w.issue ? (
                            <div className="mt-1 opacity-100 transition-opacity">
                              {getIssueIcon(w.issue)}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                </div>
             </div>
        </section>
          </div>
        </div>
      )}

      {/* Bottom actions: fixed max-md (Step 3). When Custom/Ask modal open — Step 5 (docs/ai/plans/001-session-results-responsive-dynamics.md): bar inert for pointer + a11y. */}
      <div
        className={`z-40 w-full min-w-0 max-md:fixed max-md:bottom-0 max-md:inset-x-0 max-md:p-6 max-md:bg-gradient-to-t max-md:from-brand-dark max-md:via-brand-dark/95 max-md:to-transparent md:static md:mt-8${isActionBarBlocked ? ' pointer-events-none' : ''}`}
        aria-hidden={isActionBarBlocked ? true : undefined}
        tabIndex={isActionBarBlocked ? -1 : undefined}
      >
        {/*
          Plan 002 Step 3–4 (docs/ai/plans/002-session-results-desktop-whitespace.md): равные доли кнопок (`flex-1 min-w-0`);
          ширина ряда = корень (`max-w-6xl xl:max-w-7xl`). Primary — стиль Next, не flex-[2].
        */}
        <div className="flex w-full min-w-0 max-w-6xl xl:max-w-7xl mx-auto gap-4 items-stretch">
            <button 
                type="button"
                disabled={isActionBarBlocked}
                onClick={onRetry}
                className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-700 py-4 font-semibold text-white shadow-lg transition-[transform,box-shadow,background-color] duration-150 ease-out enabled:hover:scale-[1.02] enabled:hover:bg-slate-600 enabled:hover:shadow-xl enabled:hover:shadow-black/30 enabled:active:scale-[0.98] enabled:active:brightness-95 disabled:cursor-not-allowed motion-reduce:enabled:hover:scale-100 motion-reduce:enabled:hover:shadow-lg motion-reduce:enabled:active:scale-100"
            >
                <RefreshCw className="w-5 h-5 shrink-0" /> Retry
            </button>
            
            <button
                type="button"
                disabled={isActionBarBlocked}
                onClick={() => setIsCustomModalOpen(true)}
                className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl border border-brand-primary/30 bg-slate-800 py-4 font-semibold text-brand-primary shadow-lg transition-[transform,box-shadow,background-color,border-color] duration-150 ease-out enabled:hover:scale-[1.02] enabled:hover:border-brand-primary enabled:hover:bg-slate-700 enabled:hover:shadow-lg enabled:hover:shadow-brand-primary/25 enabled:active:scale-[0.98] enabled:active:brightness-95 disabled:cursor-not-allowed motion-reduce:enabled:hover:scale-100 motion-reduce:enabled:hover:shadow-lg motion-reduce:enabled:active:scale-100"
            >
                <PlusCircle className="w-5 h-5 shrink-0" /> Custom
            </button>

            <button 
                type="button"
                disabled={isActionBarBlocked}
                onClick={onNext}
                className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl bg-brand-primary py-4 font-bold text-white shadow-lg shadow-brand-primary/25 transition-[transform,box-shadow,background-color] duration-150 ease-out enabled:hover:scale-[1.02] enabled:hover:bg-brand-primary/90 enabled:hover:shadow-xl enabled:hover:shadow-brand-primary/40 enabled:active:scale-[0.98] enabled:active:brightness-95 disabled:cursor-not-allowed motion-reduce:enabled:hover:scale-100 motion-reduce:enabled:hover:shadow-lg motion-reduce:enabled:active:scale-100"
            >
                Next Phrase <ArrowRight className="w-5 h-5 shrink-0" />
            </button>
        </div>
      </div>

      {/* Custom Phrase Modal */}
      {isCustomModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-800 rounded-3xl border border-slate-700 w-full max-w-md p-6 shadow-2xl transform transition-all scale-100">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-white">Add Custom Phrase</h3>
                    <button
                      type="button"
                      onClick={() => setIsCustomModalOpen(false)}
                      className="rounded-lg p-1 text-slate-400 transition-[transform,color,background-color] duration-150 ease-out hover:scale-110 hover:bg-slate-700/60 hover:text-white active:scale-95 motion-reduce:hover:scale-100 motion-reduce:active:scale-100"
                    >
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
                            className="flex-1 rounded-xl bg-slate-700 py-3 font-medium text-white transition-[transform,background-color] duration-150 ease-out hover:scale-[1.02] hover:bg-slate-600 active:scale-[0.98] motion-reduce:transition-colors motion-reduce:hover:scale-100 motion-reduce:active:scale-100"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            disabled={!customInput.trim()}
                            className="flex-1 rounded-xl bg-brand-primary py-3 font-bold text-white transition-[transform,box-shadow,background-color] duration-150 ease-out enabled:hover:scale-[1.02] enabled:hover:bg-brand-primary/90 enabled:hover:shadow-lg enabled:hover:shadow-brand-primary/30 enabled:active:scale-[0.98] enabled:active:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:enabled:hover:scale-100 motion-reduce:enabled:active:scale-100"
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
                    <button
                      type="button"
                      onClick={() => setIsQuestionModalOpen(false)}
                      className="rounded-lg p-1 text-slate-400 transition-[transform,color,background-color] duration-150 ease-out hover:scale-110 hover:bg-slate-700/60 hover:text-white active:scale-95 motion-reduce:hover:scale-100 motion-reduce:active:scale-100"
                    >
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
                            className="flex-1 rounded-xl bg-slate-700 py-3 font-medium text-white transition-[transform,background-color] duration-150 ease-out hover:scale-[1.02] hover:bg-slate-600 active:scale-[0.98] motion-reduce:transition-colors motion-reduce:hover:scale-100 motion-reduce:active:scale-100"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            disabled={!questionInput.trim()}
                            className="flex-1 rounded-xl bg-brand-accent py-3 font-bold text-white transition-[transform,box-shadow,background-color] duration-150 ease-out enabled:hover:scale-[1.02] enabled:hover:bg-brand-accent/90 enabled:hover:shadow-lg enabled:hover:shadow-brand-accent/25 enabled:active:scale-[0.98] enabled:active:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:enabled:hover:scale-100 motion-reduce:enabled:active:scale-100"
                        >
                            Ask Coach
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* Word Analysis tooltip: portal + fixed + z-30 — ниже модалок z-50 (plan Step 10, docs/ai/plans/001-session-results-responsive-dynamics.md). */}
      {wordTooltipIndex !== null &&
        (() => {
          const tw = result.words[wordTooltipIndex];
          if (!tw || tw.status === 'perfect') return null;
          const issueLine = wordIssueLabel(tw.issue);
          const fallbackLine = wordIssueFallback(tw);
          return createPortal(
            <div
              ref={wordTooltipBoxRef}
              id={`${wordTipBaseId}-desc-${wordTooltipIndex}`}
              role="tooltip"
              style={wordTooltipFixedStyle}
              className="pointer-events-auto rounded-xl border border-slate-600 bg-slate-900/95 p-3 text-left text-sm text-slate-200 shadow-xl backdrop-blur-sm"
              onMouseEnter={clearWordTipLeaveTimer}
              onMouseLeave={canHoverWordTip ? scheduleWordTipClose : undefined}
            >
              <p className="mb-2 font-semibold text-white">{tw.word}</p>
              <dl className="space-y-1.5 text-xs sm:text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="shrink-0 text-slate-500">Score</dt>
                  <dd className="min-w-0 text-right font-medium tabular-nums text-slate-100">{tw.score}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="shrink-0 text-slate-500">Status</dt>
                  <dd className="min-w-0 text-right font-medium text-slate-100">{wordStatusLabel(tw.status)}</dd>
                </div>
                {issueLine ? (
                  <div className="flex justify-between gap-3">
                    <dt className="shrink-0 text-slate-500">Issue</dt>
                    <dd className="min-w-0 text-right font-medium text-slate-100">{issueLine}</dd>
                  </div>
                ) : null}
                <div className="border-t border-slate-700/80 pt-1.5 text-slate-300">{fallbackLine}</div>
              </dl>
            </div>,
            document.body
          );
        })()}

    </div>
  );
};

export default ResultScreen;
