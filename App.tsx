
import React, { useState, useEffect } from 'react';
import { Screen, SessionConfig, PhraseData, AnalysisResult, HistoryItem } from './types';
import SetupScreen from './components/SetupScreen';
import TrainingScreen from './components/TrainingScreen';
import ResultScreen from './components/ResultScreen';
import HistoryScreen from './components/HistoryScreen';
import { generateTrainingContent, generateCustomPhrase } from './services/geminiService';
import { analyzeAudio } from './services/audioUtils';
import { Loader2 } from 'lucide-react';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>(Screen.SETUP);
  const [config, setConfig] = useState<SessionConfig | null>(null);
  
  const [phrases, setPhrases] = useState<PhraseData[]>([]);
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");

  // History State
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('prosody_history');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to load history", e);
      return [];
    }
  });

  // Save history whenever it changes
  useEffect(() => {
    localStorage.setItem('prosody_history', JSON.stringify(history));
  }, [history]);

  const saveToHistory = (phrase: PhraseData, result: AnalysisResult) => {
    // We remove heavy pitch curve data as it's not needed for history listing
    // and takes up significant storage space.
    const lightweightResult: AnalysisResult = {
      ...result,
      pitchCurveReference: [],
      pitchCurveUser: []
    };

    const newItem: HistoryItem = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      phrase: phrase,
      result: lightweightResult
    };
    setHistory(prev => [...prev, newItem]);
  };

  const startSession = async (newConfig: SessionConfig) => {
    setIsProcessing(true);
    setLoadingMessage("Designing your lesson...");
    setConfig(newConfig);
    
    // Generate content via Gemini
    const generatedPhrases = await generateTrainingContent(
      newConfig.targetLanguage, 
      newConfig.nativeLanguage, 
      newConfig.topic, 
      newConfig.difficulty
    );
    
    setPhrases(generatedPhrases);
    setCurrentPhraseIndex(0);
    setIsProcessing(false);
    setCurrentScreen(Screen.TRAINING);
  };

  const handleRecordingFinished = async (userBlob: Blob, refAudioBase64: string | undefined) => {
    setIsProcessing(true);
    setLoadingMessage("Analyzing Prosody...");
    
    const currentPhrase = phrases[currentPhraseIndex];
    // Perform simulated DSP analysis + Gemini Feedback
    // Default to 'English' if for some reason config is missing, but it shouldn't be.
    const nativeLang = config?.nativeLanguage || 'English';
    const result = await analyzeAudio(userBlob, refAudioBase64, currentPhrase, nativeLang);
    
    setAnalysisResult(result);
    setIsProcessing(false);
    setCurrentScreen(Screen.RESULT);
  };

  const handleNextPhrase = () => {
    // Save the current result to history before moving on
    if (analysisResult) {
      saveToHistory(phrases[currentPhraseIndex], analysisResult);
    }

    // Determine next step
    if (currentPhraseIndex < phrases.length - 1) {
        setAnalysisResult(null); // Clear previous result
        setCurrentPhraseIndex(prev => prev + 1);
        setCurrentScreen(Screen.TRAINING);
    } else {
        // End of session
        setCurrentScreen(Screen.HISTORY);
    }
  };

  const handleCustomPhraseRequest = async (input: string) => {
      if (!config) return;
      
      // Save current result first
      if (analysisResult) {
        saveToHistory(phrases[currentPhraseIndex], analysisResult);
      }

      setIsProcessing(true);
      setLoadingMessage("Creating custom lesson...");

      const newPhrase = await generateCustomPhrase(input, config.targetLanguage, config.nativeLanguage);
      
      if (newPhrase) {
        // Insert the new phrase after the current one
        setPhrases(prev => {
            const next = [...prev];
            next.splice(currentPhraseIndex + 1, 0, newPhrase);
            return next;
        });
        
        // Move to that new phrase
        setAnalysisResult(null);
        setCurrentPhraseIndex(prev => prev + 1);
        setIsProcessing(false);
        setCurrentScreen(Screen.TRAINING);
      } else {
        setIsProcessing(false);
        alert("Failed to generate phrase. Please try again.");
      }
  };

  const handleRetry = () => {
    // Don't save to history yet, let them retry
    setCurrentScreen(Screen.TRAINING);
  };

  // --- History Handlers ---

  const handleHistoryPractice = (item: HistoryItem) => {
    // Set up a "single phrase session"
    setPhrases([item.phrase]);
    setCurrentPhraseIndex(0);
    setAnalysisResult(null);
    setCurrentScreen(Screen.TRAINING);
  };

  const handleImportHistory = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const importedHistory = JSON.parse(content);
        if (Array.isArray(importedHistory)) {
          // Merge or replace? Let's merge for now, avoiding duplicates by ID
          setHistory(prev => {
             const existingIds = new Set(prev.map(i => i.id));
             // Ensure imported items also don't carry heavy data if possible
             const newItems = importedHistory.filter((i: HistoryItem) => !existingIds.has(i.id));
             return [...prev, ...newItems];
          });
          alert(`Imported ${importedHistory.length} items successfully.`);
        }
      } catch (err) {
        alert("Failed to parse history file.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen h-full w-full bg-brand-dark text-slate-100 font-sans selection:bg-brand-primary selection:text-white overflow-x-hidden">
      {/* Global Overlay Loading */}
      {isProcessing && (
        <div className="fixed inset-0 z-50 bg-brand-dark/80 backdrop-blur-sm flex items-center justify-center flex-col gap-4">
            <Loader2 className="w-12 h-12 text-brand-primary animate-spin" />
            <p className="text-slate-300 font-medium animate-pulse">
                {loadingMessage || "Processing..."}
            </p>
        </div>
      )}

      {currentScreen === Screen.SETUP && (
        <SetupScreen 
          onStart={startSession} 
          onHistory={() => setCurrentScreen(Screen.HISTORY)}
          isLoading={isProcessing} 
        />
      )}

      {currentScreen === Screen.HISTORY && (
        <HistoryScreen 
          history={history}
          onBack={() => setCurrentScreen(Screen.SETUP)}
          onPractice={handleHistoryPractice}
          onImport={handleImportHistory}
          onClear={() => setHistory([])}
        />
      )}

      {currentScreen === Screen.TRAINING && phrases.length > 0 && (
        <TrainingScreen 
            phrase={phrases[currentPhraseIndex]} 
            onRecordFinish={handleRecordingFinished}
            onNext={() => {
              // Skip logic: if skipping, we might not want to save a result (since there is none),
              // but we need to move index.
              if (currentPhraseIndex < phrases.length - 1) {
                setAnalysisResult(null);
                setCurrentPhraseIndex(prev => prev + 1);
              } else {
                setCurrentScreen(Screen.HISTORY);
              }
            }}
            onExit={() => setCurrentScreen(Screen.HISTORY)}
        />
      )}

      {currentScreen === Screen.RESULT && analysisResult && (
        <ResultScreen 
            result={analysisResult} 
            onRetry={handleRetry} 
            onNext={handleNextPhrase}
            onCustomPhrase={handleCustomPhraseRequest}
        />
      )}
    </div>
  );
}
