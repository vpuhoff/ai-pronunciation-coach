
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { PhraseData, Language, Difficulty, WordAnalysis, AnalysisResult } from "../types";

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
      Generate 3 unique, distinct, and conversational phrases for a language learner practicing speech therapy or fluency.
      Target Language: ${targetLang}
      Native Language: ${nativeLang}
      Topic: ${topic}
      Level: ${difficulty}
      
      Instructions:
      1. **Context & Naturalness:** Create natural-sounding phrases that fit the topic. Avoid generic textbook examples.
      2. **Add "Cognitive Ramps" (Fillers):**
         - Insert natural discourse markers (e.g., "Actually," "Well," "To be honest," "Basically," "You know," "I mean") at the beginning of the sentences or before complex keywords.
         - *Reason:* These words act as a motor starter to help the user overcome speech blocks or anxiety before hitting the main concept.
      3. **Optimize for Flow:**
         - Avoid overly dense cluster of consonants.
         - If a specific term is too complex phonetically, use a slightly more general synonym unless essential for the topic.
      4. Identify the specific word or segment that requires logical stress (prosody focus) for each phrase.
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
              text: { type: Type.STRING, description: "The phrase in target language with fillers included" },
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
      stressFocus: item.stressFocus,
      language: targetLang
    }));

  } catch (error) {
    console.error("Gemini generation error:", error);
    return mockPhrases(targetLang, topic);
  }
};

export const generateCustomPhrase = async (
    userInput: string,
    targetLang: Language,
    nativeLang: Language
): Promise<PhraseData | null> => {
    if (!apiKey) return null;

    try {
        const prompt = `
          The user wants to practice a specific phrase for speech therapy (anomia recovery).
          The goal is to generate ONE natural, spoken-English phrase that is easy to initiate.

          User Input: "${userInput}"
          Target Language: ${targetLang}
          Native Language: ${nativeLang}

          Instructions:
          1. **Translate & Adapt:** Translate the input to ${targetLang}. If the input is already in ${targetLang}, refine it.
          2. **Add "Cognitive Ramps" (Fillers):**
             - Insert natural discourse markers (e.g., "Actually," "Well," "To be honest," "Basically," "You know," "I mean") at the beginning of the sentence or before the complex keyword.
             - *Reason:* These words act as a motor starter to help the user overcome speech blocks before hitting the main concept.
          3. **Optimize for Flow:**
             - Avoid overly dense cluster of consonants.
             - If a specific technical term is too complex, use a slightly more general professional synonym (e.g., use "handle" instead of "facilitate" if appropriate), unless the user specifically asks for the hard term.
          4. Identify the main logical stress focus (usually the core noun or verb).
          5. Provide the translation in ${nativeLang}.
        `;

        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        text: { type: Type.STRING, description: "The final phrase with cognitive ramps/fillers included" },
                        translation: { type: Type.STRING, description: "Translation in native language" },
                        stressFocus: { type: Type.STRING, description: "The focused word" }
                    },
                    required: ["text", "translation", "stressFocus"]
                }
            }
        });

        const item = JSON.parse(response.text || "{}");
        if (!item.text) return null;

        return {
            id: `custom-${Date.now()}`,
            text: item.text,
            translation: item.translation,
            stressFocus: item.stressFocus,
            language: targetLang
        };
    } catch (e) {
        console.error("Custom phrase generation error", e);
        return null;
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
    nativeLanguage: string,
    previousAttempts: AnalysisResult[] = []
): Promise<{ overallScore: number, feedback: string, words: WordAnalysis[], detailedScore?: any }> => {
    
    // Default fallback if no API key
    if(!apiKey) {
        return {
            overallScore: 75,
            feedback: "Simulated Feedback (No API Key): Good attempt. Your intonation was mostly flat, try to add more energy.",
            words: originalText.split(' ').map(w => ({ word: w, score: 80, status: 'perfect' })),
            detailedScore: {
                articulation: { phonemeAccuracy: 80, completeness: 90 },
                prosody: { intonation: 60, rhythm: 70, stress: 75 },
                fluency: { speed: 'Natural', hesitations: 'Few', smoothness: 80 },
                impression: { confidence: 70, accent: 'Moderate' }
            }
        };
    }

    try {
        // Construct history context
        let historyContext = "";
        if (previousAttempts && previousAttempts.length > 0) {
            const summary = previousAttempts.map((attempt, index) => {
                const errors = attempt.words.filter(w => w.status !== 'perfect').map(w => w.word).join(', ');
                return `Attempt #${index + 1}: Score ${attempt.overallScore}. Feedback: "${attempt.feedback}". Issues: ${errors || "None"}.`;
            }).join('\n');
            
            historyContext = `
            \n--- PREVIOUS ATTEMPTS HISTORY ---
            The user has practiced this phrase ${previousAttempts.length} times before in this session.
            ${summary}
            
            INSTRUCTION: Compare the CURRENT attempt to the previous ones. 
            - If they fixed a previous error, praise them specifically for that improvement.
            - If they repeated the same error, gently point out that it is still persisting.
            - If they got worse, encourage them to recall the rhythm of their best attempt.
            ---------------------------------
            `;
        }

        const prompt = `
        You are a strict but encouraging phonetics coach. Analyze the user's pronunciation of the phrase: "${originalText}".
        ${historyContext}
        
        1. Give an overall pronunciation score (0-100).
        2. Analyze each word. If a word is mispronounced, mark status as 'error'. If intonation/stress is off, 'warning'. Otherwise 'perfect'.
        3. Provide helpful feedback in ${nativeLanguage} (2 sentences max). Address the user directly ("You...").
        4. Provide a detailed breakdown of metrics:
           - Articulation: Phoneme Accuracy (0-100), Completeness (0-100).
           - Prosody: Intonation (0-100), Rhythm (0-100), Stress Accuracy (0-100).
           - Fluency: Speed (Too Slow/Natural/Fast), Hesitations (None/Few/Many), Smoothness (0-100).
           - Impression: Confidence (0-100), Accent Strength (Native-like/Mild/Moderate/Heavy).
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
                        },
                        detailedScore: {
                            type: Type.OBJECT,
                            properties: {
                                articulation: {
                                    type: Type.OBJECT,
                                    properties: {
                                        phonemeAccuracy: { type: Type.INTEGER },
                                        completeness: { type: Type.INTEGER }
                                    },
                                    required: ["phonemeAccuracy", "completeness"]
                                },
                                prosody: {
                                    type: Type.OBJECT,
                                    properties: {
                                        intonation: { type: Type.INTEGER },
                                        rhythm: { type: Type.INTEGER },
                                        stress: { type: Type.INTEGER }
                                    },
                                    required: ["intonation", "rhythm", "stress"]
                                },
                                fluency: {
                                    type: Type.OBJECT,
                                    properties: {
                                        speed: { type: Type.STRING, enum: ["Too Slow", "Natural", "Fast"] },
                                        hesitations: { type: Type.STRING, enum: ["None", "Few", "Many"] },
                                        smoothness: { type: Type.INTEGER }
                                    },
                                    required: ["speed", "hesitations", "smoothness"]
                                },
                                impression: {
                                    type: Type.OBJECT,
                                    properties: {
                                        confidence: { type: Type.INTEGER },
                                        accent: { type: Type.STRING, enum: ["Native-like", "Mild", "Moderate", "Heavy"] }
                                    },
                                    required: ["confidence", "accent"]
                                }
                            },
                            required: ["articulation", "prosody", "fluency", "impression"]
                        }
                    },
                    required: ["overallScore", "feedback", "words", "detailedScore"]
                }
            }
        });

        const result = JSON.parse(response.text || "{}");
        return {
            overallScore: result.overallScore || 0,
            feedback: result.feedback || "Could not analyze audio.",
            words: result.words || [],
            detailedScore: result.detailedScore
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

export const askAiCoach = async (
    phraseText: string,
    userQuestion: string,
    previousFeedback: string
): Promise<string> => {
    if (!apiKey) return "Please provide an API Key to ask questions.";

    try {
        const prompt = `
        Context: The user is practicing the phrase: "${phraseText}".
        The AI coach previously gave this feedback: "${previousFeedback}".

        User Question: "${userQuestion}"

        Instruction: Answer the user's question briefly, encouragingly, and helpfully. 
        Act as an expert phonetics coach. 
        If they ask about how to pronounce a specific sound in the phrase, give concrete tips (tongue position, lip shape, etc).
        Keep the answer under 3-4 sentences.
        `;

        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt
        });

        return response.text || "I couldn't generate an answer.";
    } catch (e) {
        console.error("AI Coach Q&A Error", e);
        return "Sorry, I am having trouble connecting to the coach right now.";
    }
};


// Fallback for dev without API key
const mockPhrases = (lang: string, topic: string): PhraseData[] => [
  { id: '1', text: `Hello, how are you today? (${lang})`, translation: "Example translation", stressFocus: "today", language: lang },
  { id: '2', text: `I would like a coffee please.`, translation: "Example translation", stressFocus: "coffee", language: lang },
  { id: '3', text: `Could you help me with this?`, translation: "Example translation", stressFocus: "help", language: lang },
];
