
import React, { useState, useEffect } from 'react';
import { Screen, SessionConfig, PhraseData, AnalysisResult, HistoryItem } from './types';
import SetupScreen from './components/SetupScreen';
import TrainingScreen from './components/TrainingScreen';
import ResultScreen from './components/ResultScreen';
import HistoryScreen from './components/HistoryScreen';
import { generateTrainingContent, generateCustomPhrase } from './services/geminiService';
import { analyzeAudio } from './services/audioUtils';
import { saveAudioSession, getAudioSession, clearAudioStorage } from './services/storageService';
import { Loader2 } from 'lucide-react';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>(Screen.SETUP);
  const [config, setConfig] = useState<SessionConfig | null>(null);
  
  const [phrases, setPhrases] = useState<PhraseData[]>([]);
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  
  // Track attempts for the CURRENT phrase to provide context to AI
  const [sessionAttempts, setSessionAttempts] = useState<AnalysisResult[]>([]);
  
  // Temporary holding for the blob until we save to history or discard
  const [currentUserBlob, setCurrentUserBlob] = useState<Blob | null>(null);
  
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

  const saveToHistory = async (phrase: PhraseData, result: AnalysisResult, userBlob: Blob | null) => {
    const historyId = crypto.randomUUID();

    // 1. Clean up result for localStorage (Remove URLs and heavy curves)
    const lightweightResult: AnalysisResult = {
      ...result,
      userAudioUrl: '', // Do not store ephemeral blob URLs
      referenceAudioUrl: '', // Do not store data URIs in local storage (too big)
      pitchCurveReference: [], // Can be re-calculated or omitted for history list
      pitchCurveUser: []
    };

    // 2. Prepare reference audio data (base64)
    // We try to extract the base64 from the phrase data or the result URL if it was a data URI
    let refBase64: string | undefined = phrase.audioBase64;
    if (!refBase64 && result.referenceAudioUrl && result.referenceAudioUrl.startsWith('data:')) {
        refBase64 = result.referenceAudioUrl; // It's already a data URI
    }

    // 3. Save binary data to IndexedDB
    try {
        await saveAudioSession(historyId, userBlob, refBase64);
    } catch (e) {
        console.error("Failed to save audio to IDB", e);
    }

    // 4. Save metadata to State/LocalStorage
    const newItem: HistoryItem = {
      id: historyId,
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
    setSessionAttempts([]); // Reset attempts
    setIsProcessing(false);
    setCurrentScreen(Screen.TRAINING);
  };

  const handleRecordingFinished = async (userBlob: Blob, refAudioBase64: string | undefined) => {
    setIsProcessing(true);
    setLoadingMessage("Analyzing Prosody...");
    
    // Store blob temporarily in case we move to next and need to save it
    setCurrentUserBlob(userBlob);

    const currentPhrase = phrases[currentPhraseIndex];
    const nativeLang = config?.nativeLanguage || 'English';
    
    // Pass sessionAttempts to analysis so AI knows history
    const result = await analyzeAudio(
        userBlob, 
        refAudioBase64, 
        currentPhrase, 
        nativeLang, 
        sessionAttempts
    );
    
    setAnalysisResult(result);
    // Add this result to the current session history
    setSessionAttempts(prev => [...prev, result]);
    
    setIsProcessing(false);
    setCurrentScreen(Screen.RESULT);
  };

  const handleNextPhrase = async () => {
    // Save the current result to history before moving on
    if (analysisResult) {
      await saveToHistory(phrases[currentPhraseIndex], analysisResult, currentUserBlob);
    }

    // Clean up current state
    setCurrentUserBlob(null);
    setAnalysisResult(null);
    setSessionAttempts([]); // Clear attempts for the new phrase

    // Determine next step
    if (currentPhraseIndex < phrases.length - 1) {
        setCurrentPhraseIndex(prev => prev + 1);
        setCurrentScreen(Screen.TRAINING);
    } else {
        // End of session
        setCurrentScreen(Screen.HISTORY);
    }
  };

  const handleCustomPhraseRequest = async (input: string) => {
      if (!config) return;
      
      // Save current result first if exists
      if (analysisResult) {
        await saveToHistory(phrases[currentPhraseIndex], analysisResult, currentUserBlob);
      }
      
      setCurrentUserBlob(null);

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
        setSessionAttempts([]); // Clear attempts
        setCurrentPhraseIndex(prev => prev + 1);
        setIsProcessing(false);
        setCurrentScreen(Screen.TRAINING);
      } else {
        setIsProcessing(false);
        alert("Failed to generate phrase. Please try again.");
      }
  };

  const handleRetry = () => {
    // Don't save to history yet, let them retry.
    // We DO NOT clear sessionAttempts here, because we want the AI to remember this attempt.
    setCurrentScreen(Screen.TRAINING);
  };

  // --- History Handlers ---

  const handleHistoryPractice = async (item: HistoryItem) => {
    setIsProcessing(true);
    setLoadingMessage("Loading session...");

    // Try to recover reference audio from IndexedDB to avoid re-generation
    let phraseWithAudio = { ...item.phrase };
    try {
        const audioRecord = await getAudioSession(item.id);
        if (audioRecord && audioRecord.referenceBase64) {
            phraseWithAudio.audioBase64 = audioRecord.referenceBase64;
        }
    } catch (e) {
        console.warn("Could not load audio from history DB", e);
    }

    // Set up a "single phrase session"
    setPhrases([phraseWithAudio]);
    setCurrentPhraseIndex(0);
    setSessionAttempts([]); // Start fresh for practice
    setAnalysisResult(null);
    setCurrentUserBlob(null);
    setIsProcessing(false);
    setCurrentScreen(Screen.TRAINING);
  };

  const handleImportHistory = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const importedHistory = JSON.parse(content);
        if (Array.isArray(importedHistory)) {
          // Filter out items that already exist to avoid duplicates
          setHistory(prev => {
             const existingIds = new Set(prev.map(i => i.id));
             // Ensure imported items don't have heavy data attached just in case
             const newItems = importedHistory.filter((i: HistoryItem) => !existingIds.has(i.id)).map((i: any) => ({
                 ...i,
                 result: {
                     ...i.result,
                     userAudioUrl: '',
                     referenceAudioUrl: '',
                     pitchCurveReference: [],
                     pitchCurveUser: []
                 }
             }));
             return [...prev, ...newItems];
          });
          alert(`Imported ${importedHistory.length} items successfully (Audio not included in import).`);
        }
      } catch (err) {
        alert("Failed to parse history file.");
      }
    };
    reader.readAsText(file);
  };

  const handleClearHistory = async () => {
      setHistory([]);
      try {
          await clearAudioStorage();
      } catch (e) {
          console.error("Failed to clear audio DB", e);
      }
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
          onClear={handleClearHistory}
        />
      )}

      {currentScreen === Screen.TRAINING && phrases.length > 0 && (
        <TrainingScreen 
            phrase={phrases[currentPhraseIndex]} 
            onRecordFinish={handleRecordingFinished}
            onNext={async () => {
              // Skip logic
              setCurrentUserBlob(null);
              setAnalysisResult(null);
              setSessionAttempts([]);

              if (currentPhraseIndex < phrases.length - 1) {
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
            phrase={phrases[currentPhraseIndex]}
            result={analysisResult} 
            onRetry={handleRetry} 
            onNext={handleNextPhrase}
            onCustomPhrase={handleCustomPhraseRequest}
        />
      )}
    </div>
  );
}
