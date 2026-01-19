
export enum Screen {
  SETUP = 'SETUP',
  TRAINING = 'TRAINING',
  RESULT = 'RESULT',
  HISTORY = 'HISTORY',
}

export enum Language {
  ENGLISH = 'English',
  SPANISH = 'Spanish',
  FRENCH = 'French',
  GERMAN = 'German',
  RUSSIAN = 'Russian',
  MANDARIN = 'Mandarin',
}

export enum Difficulty {
  BEGINNER = 'Beginner',
  INTERMEDIATE = 'Intermediate',
  ADVANCED = 'Advanced',
}

export interface SessionConfig {
  targetLanguage: Language;
  nativeLanguage: Language;
  topic: string;
  difficulty: Difficulty;
  elevenLabsApiKey?: string;
}

export interface PhraseData {
  id: string;
  text: string;
  translation: string;
  stressFocus: string; // The word/part that needs logical stress
  audioBase64?: string; // Reference audio (Base64)
  language?: string; // Target language of the phrase
}

export interface WordAnalysis {
  word: string;
  score: number; // 0-100
  status: 'perfect' | 'warning' | 'error';
  issue?: 'pitch' | 'pause' | 'pronunciation' | 'speed';
  start?: number; // relative time in seconds
  end?: number;
}

export interface AnalysisResult {
  overallScore: number;
  words: WordAnalysis[];
  feedback: string;
  userAudioUrl: string; // Can be empty string in history
  referenceAudioUrl?: string; // Can be empty string in history
  // Real data for visualization
  pitchCurveReference: { time: number; value: number }[];
  pitchCurveUser: { time: number; value: number }[];
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  phrase: PhraseData;
  result: AnalysisResult;
}
