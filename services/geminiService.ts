
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { PhraseData, Language, Difficulty, WordAnalysis } from "../types";

// Ensure API Key exists
const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const generateTrainingContent = async (
  targetLang: Language,
  nativeLang: Language,
  topic: string,
  difficulty: Difficulty
): Promise<PhraseData[]> => {
  if (!apiKey) {
    console.error("API Key missing");
    return mockPhrases(targetLang, topic);
  }

  try {
    const prompt = `
      Generate 3 unique, distinct, and conversational phrases for a language learner.
      Target Language: ${targetLang}
      Native Language: ${nativeLang}
      Topic: ${topic}
      Level: ${difficulty}
      
      Instructions:
      1. Create natural-sounding phrases that fit the context.
      2. Avoid generic textbook examples or repetitive structures.
      3. For each phrase, identify the specific word or segment that requires logical stress (prosody focus).
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING, description: "The phrase in target language" },
              translation: { type: Type.STRING, description: "Translation in native language" },
              stressFocus: { type: Type.STRING, description: "The specific word that carries the main logical stress or intonation peak" }
            },
            required: ["text", "translation", "stressFocus"]
          }
        }
      }
    });

    const data = JSON.parse(response.text || "[]");
    return data.map((item: any, index: number) => ({
      id: `phrase-${index}-${Date.now()}`, // Add timestamp to ID to ensure uniqueness
      text: item.text,
      translation: item.translation,
      stressFocus: item.stressFocus
    }));

  } catch (error) {
    console.error("Gemini generation error:", error);
    return mockPhrases(targetLang, topic);
  }
};

export const generateReferenceAudio = async (text: string, voiceName: string = 'Kore'): Promise<string | undefined> => {
    if (!apiKey) return undefined;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: text }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName }
                    }
                }
            }
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        return base64Audio;
    } catch (error) {
        console.error("TTS Error", error);
        return undefined;
    }
}

export const generateCoachFeedback = async (
    originalText: string,
    userAudioBase64: string,
    nativeLanguage: string
): Promise<{ overallScore: number, feedback: string, words: WordAnalysis[] }> => {
    
    // Default fallback if no API key
    if(!apiKey) {
        return {
            overallScore: 75,
            feedback: "Simulated Feedback (No API Key): Good attempt, try to focus on the rhythm.",
            words: originalText.split(' ').map(w => ({ word: w, score: 80, status: 'perfect' }))
        };
    }

    try {
        const prompt = `
        You are a strict phonetics coach. Analyze the user's pronunciation of the phrase: "${originalText}".
        
        1. Give an overall pronunciation score (0-100).
        2. Analyze each word. If a word is mispronounced, mark status as 'error'. If intonation/stress is off, 'warning'. Otherwise 'perfect'.
        3. Provide helpful feedback in ${nativeLanguage} (2 sentences max).
        `;

        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview", 
            contents: {
                parts: [
                    { text: prompt },
                    { 
                        inlineData: {
                            mimeType: "audio/wav", 
                            data: userAudioBase64
                        } 
                    }
                ]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        overallScore: { type: Type.INTEGER },
                        feedback: { type: Type.STRING },
                        words: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    word: { type: Type.STRING },
                                    score: { type: Type.INTEGER },
                                    status: { type: Type.STRING, enum: ["perfect", "warning", "error"] },
                                    issue: { type: Type.STRING, enum: ["pitch", "pause", "pronunciation", "speed"] }
                                },
                                required: ["word", "score", "status"]
                            }
                        }
                    },
                    required: ["overallScore", "feedback", "words"]
                }
            }
        });

        const result = JSON.parse(response.text || "{}");
        return {
            overallScore: result.overallScore || 0,
            feedback: result.feedback || "Could not analyze audio.",
            words: result.words || []
        };

    } catch (e) {
        console.error("Gemini Feedback Error:", e);
        return {
             overallScore: 0,
             feedback: "Error connecting to AI Coach. Please try again.",
             words: []
        };
    }
}


// Fallback for dev without API key
const mockPhrases = (lang: string, topic: string): PhraseData[] => [
  { id: '1', text: `Hello, how are you today? (${lang})`, translation: "Example translation", stressFocus: "today" },
  { id: '2', text: `I would like a coffee please.`, translation: "Example translation", stressFocus: "coffee" },
  { id: '3', text: `Could you help me with this?`, translation: "Example translation", stressFocus: "help" },
];
