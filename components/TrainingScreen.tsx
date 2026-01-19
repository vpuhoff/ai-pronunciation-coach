import React, { useState, useRef, useEffect } from 'react';
import { PhraseData } from '../types';
import { Mic, Play, Square, Loader2, Volume2, SkipForward } from 'lucide-react';
import { generateReferenceAudio as generateGeminiAudio } from '../services/geminiService';
import { generateElevenLabsAudio } from '../services/elevenLabsService';
import { pcmToBase64Wav } from '../services/audioUtils';

interface Props {
  phrase: PhraseData;
  onRecordFinish: (audioBlob: Blob, refAudioData: string | undefined) => void;
  onNext: () => void;
}

const TrainingScreen: React.FC<Props> = ({ phrase, onRecordFinish, onNext }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loadingAudio, setLoadingAudio] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const apiKey = localStorage.getItem('elevenLabsKey');

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

  const togglePlayback = async () => {
    if (!audioRef.current || !audioUrl) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    } else {
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

  const startRecording = async () => {
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
        // Pass the audioUrl (which is a valid Data URI) instead of raw base64
        onRecordFinish(blob, audioUrl || undefined);
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
        <span className="text-sm font-bold text-slate-500 tracking-widest uppercase border border-slate-700 px-3 py-1 rounded-full">Training Session</span>
        <button onClick={onNext} className="text-slate-400 hover:text-white flex items-center gap-2 text-sm font-medium transition-colors">
           Skip Phrase <SkipForward className="w-4 h-4" />
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

            {/* Recording Button */}
            <div className="flex flex-col items-center space-y-4">
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
        </div>

      </div>

      {/* Spacer for mobile to ensure content isn't flush with bottom */}
      <div className="h-12 md:h-0"></div>
    </div>
  );
};

export default TrainingScreen;