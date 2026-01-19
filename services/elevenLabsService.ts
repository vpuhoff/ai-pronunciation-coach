// Default voice ID (Rachel) - stable and widely available
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; 

export const generateElevenLabsAudio = async (
  text: string, 
  apiKey: string,
  voiceId: string = DEFAULT_VOICE_ID
): Promise<string | undefined> => {
  if (!apiKey) return undefined;

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "Accept": "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text: text,
          model_id: "eleven_multilingual_v2", // Better for language learning
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error("ElevenLabs API Error:", errorData);
      return undefined;
    }

    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            // Reader result is a data URL (e.g., "data:audio/mpeg;base64,.....")
            // We return strictly the data URL string
            resolve(reader.result as string);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });

  } catch (error) {
    console.error("ElevenLabs Service Error:", error);
    return undefined;
  }
};
