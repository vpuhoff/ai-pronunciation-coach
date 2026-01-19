import React, { useState } from 'react';
import { Language, Difficulty, SessionConfig } from '../types';
import { LANGUAGES, DIFFICULTIES, TOPICS } from '../constants';
import { ArrowRight, Sparkles, Key, Globe, History as HistoryIcon } from 'lucide-react';

interface Props {
  onStart: (config: SessionConfig) => void;
  onHistory: () => void;
  isLoading: boolean;
}

const SetupScreen: React.FC<Props> = ({ onStart, onHistory, isLoading }) => {
  // Lazy initialize state from localStorage
  const [elevenLabsKey, setElevenLabsKey] = useState(() => localStorage.getItem('elevenLabsKey') || '');
  
  const [config, setConfig] = useState<SessionConfig>(() => ({
    targetLanguage: (localStorage.getItem('prosody_targetLang') as Language) || Language.ENGLISH,
    nativeLanguage: (localStorage.getItem('prosody_nativeLang') as Language) || Language.SPANISH,
    topic: localStorage.getItem('prosody_topic') || TOPICS[0],
    difficulty: (localStorage.getItem('prosody_difficulty') as Difficulty) || Difficulty.INTERMEDIATE,
    elevenLabsApiKey: localStorage.getItem('elevenLabsKey') || ''
  }));

  const handleKeyChange = (value: string) => {
    setElevenLabsKey(value);
    localStorage.setItem('elevenLabsKey', value);
    setConfig(prev => ({ ...prev, elevenLabsApiKey: value }));
  };

  const handleChange = (key: keyof SessionConfig, value: string) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    
    // Persist changes to localStorage
    const storageKeyMap: Partial<Record<keyof SessionConfig, string>> = {
        targetLanguage: 'prosody_targetLang',
        nativeLanguage: 'prosody_nativeLang',
        topic: 'prosody_topic',
        difficulty: 'prosody_difficulty'
    };

    const storageKey = storageKeyMap[key];
    if (storageKey) {
        localStorage.setItem(storageKey, value);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 w-full relative">
      
      {/* Top Navigation */}
      <div className="absolute top-6 right-6">
        <button 
            onClick={onHistory}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-full border border-slate-700 transition-colors backdrop-blur-md"
        >
            <HistoryIcon className="w-4 h-4" /> <span className="hidden md:inline">History</span>
        </button>
      </div>

      <div className="w-full max-w-5xl md:grid md:grid-cols-2 md:gap-16 items-center">
        
        {/* Left Side: Hero Text (Desktop) */}
        <div className="mb-8 md:mb-0 text-center md:text-left">
            <div className="w-20 h-20 bg-gradient-to-br from-brand-primary to-brand-accent rounded-3xl mx-auto md:mx-0 flex items-center justify-center mb-6 shadow-2xl shadow-brand-primary/30">
                <Sparkles className="text-white w-10 h-10" />
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4 leading-tight">
                Master your <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-primary to-brand-accent">Pronunciation</span>
            </h1>
            <p className="text-slate-400 text-lg md:max-w-md leading-relaxed">
                AI-powered prosody training. Perfect your rhythm, intonation, and stress with real-time feedback.
            </p>
        </div>

        {/* Right Side: Configuration Form */}
        <div className="w-full bg-slate-800/50 p-6 md:p-8 rounded-3xl border border-slate-700/50 backdrop-blur-xl shadow-2xl">
            
            {/* ElevenLabs Settings */}
            <div className="space-y-3 border-b border-slate-700/50 pb-6 mb-6">
                <label className="text-sm font-bold text-brand-accent flex items-center gap-2 uppercase tracking-wide">
                    <Key className="w-4 h-4" /> ElevenLabs API Key
                </label>
                <input 
                    type="password"
                    placeholder="sk_..."
                    className="w-full bg-slate-900/80 border border-slate-700 text-white rounded-xl p-4 focus:ring-2 focus:ring-brand-accent focus:border-transparent outline-none transition-all placeholder:text-slate-600 text-sm font-mono"
                    value={elevenLabsKey}
                    onChange={(e) => handleKeyChange(e.target.value)}
                />
                <p className="text-xs text-slate-500">Required for high-quality voice generation.</p>
            </div>

            <div className="space-y-5">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                        <Globe className="w-4 h-4" /> I want to learn
                    </label>
                    <select 
                        className="w-full bg-slate-900/80 border border-slate-700 text-white rounded-xl p-4 appearance-none focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none transition-all cursor-pointer hover:bg-slate-900"
                        value={config.targetLanguage}
                        onChange={(e) => handleChange('targetLanguage', e.target.value)}
                    >
                        {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">My native language is</label>
                    <select 
                        className="w-full bg-slate-900/80 border border-slate-700 text-white rounded-xl p-4 appearance-none focus:ring-2 focus:ring-brand-primary outline-none transition-all cursor-pointer hover:bg-slate-900"
                        value={config.nativeLanguage}
                        onChange={(e) => handleChange('nativeLanguage', e.target.value)}
                    >
                        {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Topic</label>
                        <select 
                            className="w-full bg-slate-900/80 border border-slate-700 text-white rounded-xl p-4 appearance-none focus:ring-2 focus:ring-brand-primary outline-none transition-all cursor-pointer hover:bg-slate-900"
                            value={config.topic}
                            onChange={(e) => handleChange('topic', e.target.value)}
                        >
                            {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Difficulty</label>
                        <select 
                             className="w-full bg-slate-900/80 border border-slate-700 text-white rounded-xl p-4 appearance-none focus:ring-2 focus:ring-brand-primary outline-none transition-all cursor-pointer hover:bg-slate-900"
                             value={config.difficulty}
                             onChange={(e) => handleChange('difficulty', e.target.value)}
                        >
                             {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            <button
                onClick={() => onStart(config)}
                disabled={isLoading || !elevenLabsKey}
                className="mt-8 w-full bg-gradient-to-r from-brand-primary to-brand-accent hover:opacity-90 text-white font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
                {isLoading ? (
                    <span className="animate-pulse">Generating Lesson...</span>
                ) : !elevenLabsKey ? (
                    <span>Enter API Key to Start</span>
                ) : (
                    <>
                        Start Session <ArrowRight className="w-5 h-5" />
                    </>
                )}
            </button>
        </div>
      </div>
    </div>
  );
};

export default SetupScreen;