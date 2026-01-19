
import React, { useState, useRef, useEffect } from 'react';
import { PhraseData } from '../types';
import { Mic, Play, Square, Loader2, Volume2, SkipForward, X, RefreshCw, Send } from 'lucide-react';
import { generateReferenceAudio as generateGeminiAudio } from '../services/geminiService';
import { generateElevenLabsAudio } from '../services/elevenLabsService';
import { pcmToBase64Wav } from '../services/audioUtils';

interface Props {
  phrase: PhraseData;
  onRecordFinish: (audioBlob: Blob, refAudioData: string | undefined) => void;
  onNext: () => void;
  onExit: () => void;
}

const TrainingScreen: React.FC<Props> = ({ phrase, onRecordFinish, onNext, onExit }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loadingAudio, setLoadingAudio] = useState(false);

  // User Recording State
  const [userBlob, setUserBlob] = useState<Blob | null>(null);
  const [userAudioUrl, setUserAudioUrl] = useState<string | null>(null);
  const [isPlayingUser, setIsPlayingUser] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const userAudioRef = useRef<HTMLAudioElement | null>(null);

  const apiKey = localStorage.getItem('elevenLabsKey');

  // Reset state when phrase changes
  useEffect(() => {
    setUserBlob(null);
    if (userAudioUrl) URL.revokeObjectURL(userAudioUrl);
    setUserAudioUrl(null);
    setIsPlayingUser(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phrase]);

  useEffect(() => {
    let active = true;
    const fetchAudio = async () => {
      setLoadingAudio(true);
      setAudioUrl(null);
      setIsPlaying(false);
      
      let audioData = phrase.audioBase64;

      if (!audioData) {
        if (apiKey) {
            audioData = await generateElevenLabsAudio(phrase.text, apiKey);
        } else {
            audioData = await generateGeminiAudio(phrase.text);
        }
      }

      if (active && audioData) {
        if (audioData.startsWith('data:')) {
            // ElevenLabs or cached Data URI
            setAudioUrl(audioData);
        } else {
            // Gemini raw PCM
            try {
                const wav = pcmToBase64Wav(audioData);
                setAudioUrl(`data:audio/wav;base64,${wav}`);
            } catch (e) {
                console.error("Error formatting PCM audio", e);
            }
        }
      }
      if (active) setLoadingAudio(false);
    };

    fetchAudio();
    return () => { active = false; };
  }, [phrase, apiKey]);

  const stopOtherAudio = (current: 'ref' | 'user') => {
      if (current === 'ref') {
          if (userAudioRef.current) {
              userAudioRef.current.pause();
              userAudioRef.current.currentTime = 0;
              setIsPlayingUser(false);
          }
      } else {
          if (audioRef.current) {
              audioRef.current.pause();
              audioRef.current.currentTime = 0;
              setIsPlaying(false);
          }
      }
  }

  const togglePlayback = async () => {
    if (!audioRef.current || !audioUrl) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    } else {
      stopOtherAudio('ref');
      setIsPlaying(true);
      try {
        await audioRef.current.play();
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
             console.error("Playback failed:", err);
        }
        setIsPlaying(false);
      }
    }
  };

  const toggleUserPlayback = async () => {
    if (!userAudioRef.current || !userAudioUrl) return;

    if (isPlayingUser) {
        userAudioRef.current.pause();
        userAudioRef.current.currentTime = 0;
        setIsPlayingUser(false);
    } else {
        stopOtherAudio('user');
        setIsPlayingUser(true);
        try {
            await userAudioRef.current.play();
        } catch (err) {
            console.error("User playback failed:", err);
            setIsPlayingUser(false);
        }
    }
  };

  const startRecording = async () => {
    // Cleanup previous recording
    if (userAudioUrl) URL.revokeObjectURL(userAudioUrl);
    setUserBlob(null);
    setUserAudioUrl(null);

    // Stop reference audio if playing
    if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsPlaying(false);
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        
        const url = URL.createObjectURL(blob);
        setUserBlob(blob);
        setUserAudioUrl(url);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Mic access denied", err);
      alert("Please allow microphone access to use this app.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleDiscard = () => {
      if (userAudioUrl) URL.revokeObjectURL(userAudioUrl);
      setUserBlob(null);
      setUserAudioUrl(null);
  };

  const handleSubmit = () => {
      if (userBlob) {
          onRecordFinish(userBlob, audioUrl || undefined);
      }
  };

  const renderText = () => {
    const parts = phrase.text.split(new RegExp(`(${phrase.stressFocus})`, 'gi'));
    return (
      <h2 className="text-3xl md:text-5xl font-medium text-center md:text-left leading-relaxed text-slate-200">
        {parts.map((part, i) => 
          part.toLowerCase() === phrase.stressFocus.toLowerCase() ? (
            <span key={i} className="text-brand-primary font-bold underline decoration-brand-accent decoration-4 underline-offset-8">{part}</span>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </h2>
    );
  };

  return (
    <div className="flex flex-col h-full items-center p-6 w-full max-w-5xl mx-auto relative min-h-screen">
      {/* Header Controls */}
      <div className="w-full flex justify-between items-center mb-12">
        <button 
            onClick={onExit}
            className="text-slate-400 hover:text-white flex items-center gap-2 text-sm font-medium transition-colors p-2 -ml-2 rounded-lg hover:bg-slate-800"
            title="Exit to History"
        >
            <X className="w-6 h-6" /> <span className="hidden sm:inline">Exit</span>
        </button>

        <span className="text-sm font-bold text-slate-500 tracking-widest uppercase border border-slate-700 px-3 py-1 rounded-full hidden md:inline-block">Training Session</span>
        
        <button onClick={onNext} className="text-slate-400 hover:text-white flex items-center gap-2 text-sm font-medium transition-colors p-2 -mr-2 rounded-lg hover:bg-slate-800">
           <span className="hidden sm:inline">Skip Phrase</span> <SkipForward className="w-4 h-4" />
        </button>
      </div>

      {/* Main Content Area: Responsive Split */}
      <div className="flex-1 flex flex-col md:flex-row md:items-center md:justify-between w-full gap-8 md:gap-16">
        
        {/* Left: Text & Translation */}
        <div className="flex-1 space-y-6 md:space-y-8 flex flex-col items-center md:items-start">
            {renderText()}
            <p className="text-slate-500 italic text-xl md:text-2xl text-center md:text-left font-light border-t border-slate-800 pt-6 w-full max-w-md md:max-w-none">
                {phrase.translation}
            </p>
        </div>

        {/* Right: Audio & Recording Controls */}
        <div className="w-full md:w-96 flex flex-col items-center gap-8 bg-slate-800/30 p-8 rounded-3xl border border-slate-700/50 backdrop-blur-sm">
            {/* Reference Audio */}
            <div className="w-full">
                {audioUrl && (
                    <audio 
                        ref={audioRef} 
                        src={audioUrl} 
                        onEnded={() => setIsPlaying(false)}
                    />
                )}
                <button 
                    disabled={loadingAudio || !audioUrl}
                    onClick={togglePlayback}
                    className={`w-full py-5 rounded-2xl border flex items-center justify-center gap-3 transition-all transform active:scale-95 ${
                    isPlaying 
                        ? 'bg-brand-primary/20 border-brand-primary text-brand-primary shadow-[0_0_20px_rgba(59,130,246,0.2)]' 
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:border-slate-600'
                    } disabled:opacity-50`}
                >
                    {loadingAudio ? <Loader2 className="animate-spin w-6 h-6"/> : isPlaying ? <Volume2 className="w-6 h-6 animate-pulse" /> : <Play className="w-6 h-6 ml-1" />}
                    <span className="font-bold text-lg">{loadingAudio ? "Loading..." : isPlaying ? "Playing..." : "Listen"}</span>
                </button>
            </div>

            {/* Recording / Review Area */}
            <div className="flex flex-col items-center w-full min-h-[140px] justify-center">
                {!userBlob ? (
                    // RECORDING MODE
                    <div className="flex flex-col items-center space-y-4 animate-in fade-in zoom-in duration-300">
                        <div className="relative">
                            {/* Ripple/Pulse Effect */}
                            {isRecording && (
                                <span className="absolute inset-0 rounded-full bg-rose-500 animate-ping opacity-75"></span>
                            )}
                            <button
                                onClick={isRecording ? stopRecording : startRecording}
                                className={`relative w-24 h-24 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 z-10 ${
                                    isRecording 
                                    ? 'bg-rose-500 scale-110 ring-4 ring-rose-500/30' 
                                    : 'bg-gradient-to-br from-brand-primary to-brand-accent hover:shadow-brand-primary/50 hover:scale-105'
                                }`}
                            >
                                {isRecording ? (
                                    <Square className="w-10 h-10 text-white fill-current" />
                                ) : (
                                    <Mic className="w-10 h-10 text-white" />
                                )}
                            </button>
                        </div>
                        <p className={`text-sm font-medium transition-colors ${isRecording ? 'text-rose-400 animate-pulse' : 'text-slate-500'}`}>
                            {isRecording ? "Recording... Tap to stop" : "Tap microphone to speak"}
                        </p>
                    </div>
                ) : (
                    // REVIEW MODE
                    <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-4">
                        {userAudioUrl && (
                            <audio 
                                ref={userAudioRef} 
                                src={userAudioUrl} 
                                onEnded={() => setIsPlayingUser(false)}
                            />
                        )}

                        <button 
                            onClick={toggleUserPlayback}
                            className={`w-full py-4 rounded-xl border flex items-center justify-center gap-2 transition-all ${isPlayingUser ? 'bg-rose-500/20 border-rose-500 text-rose-400' : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'}`}
                        >
                            {isPlayingUser ? <Volume2 className="w-5 h-5 animate-pulse" /> : <Play className="w-5 h-5" />}
                            <span className="font-medium">{isPlayingUser ? "Playing..." : "Review Recording"}</span>
                        </button>

                        <div className="flex gap-3">
                            <button 
                                onClick={handleDiscard}
                                className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-600 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors hover:text-white"
                            >
                                <RefreshCw className="w-5 h-5" /> Re-record
                            </button>
                            <button 
                                onClick={handleSubmit}
                                className="flex-[1.5] py-4 bg-brand-success hover:bg-brand-success/90 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-brand-success/20 transition-transform active:scale-95"
                            >
                                Analyze <Send className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>

      </div>

      {/* Spacer for mobile to ensure content isn't flush with bottom */}
      <div className="h-12 md:h-0"></div>
    </div>
  );
};

export default TrainingScreen;
