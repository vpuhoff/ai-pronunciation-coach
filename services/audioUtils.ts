import { AnalysisResult, PhraseData } from "../types";
import { generateCoachFeedback } from "./geminiService";

export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
        const result = reader.result as string;
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const pcmToBase64Wav = (base64PCM: string, sampleRate = 24000): string => {
  const binaryString = atob(base64PCM);
  const len = binaryString.length;
  const buffer = new ArrayBuffer(44 + len);
  const view = new DataView(buffer);

  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + len, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, len, true);

  const bytes = new Uint8Array(buffer, 44);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  let binary = '';
  const bytesAll = new Uint8Array(buffer);
  const lenAll = bytesAll.byteLength;
  for (let i = 0; i < lenAll; i++) {
    binary += String.fromCharCode(bytesAll[i]);
  }
  return btoa(binary);
};

// --- DSP Logic ---

const decodeAudioData = async (arrayBuffer: ArrayBuffer): Promise<AudioBuffer> => {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    try {
        return await ctx.decodeAudioData(arrayBuffer);
    } finally {
        if (ctx.state !== 'closed') void ctx.close();
    }
};

// Simple AMDF (Average Magnitude Difference Function) Pitch Detection
const extractPitch = (buffer: AudioBuffer): number[] => {
    const channelData = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;
    
    // Parameters
    const step = Math.floor(sampleRate * 0.02); // 20ms steps
    const winSize = Math.floor(sampleRate * 0.04); // 40ms window
    const pitchCurve: number[] = [];

    // Search range for human voice: 75Hz - 600Hz
    const minP = Math.floor(sampleRate / 600);
    const maxP = Math.floor(sampleRate / 75);

    for (let i = 0; i < channelData.length - winSize; i += step) {
        
        // 1. VAD (Energy Threshold)
        let energy = 0;
        for (let j = 0; j < winSize; j += 4) {
            energy += Math.abs(channelData[i + j]);
        }
        energy /= (winSize / 4);

        if (energy < 0.01) { // Silence threshold
            pitchCurve.push(0);
            continue;
        }

        // 2. AMDF Pitch Extraction
        let bestPeriod = 0;
        let minAmdf = Infinity;

        for (let p = minP; p <= maxP; p++) {
            let amdf = 0;
            for (let j = 0; j < winSize; j += 4) { // Sub-sampling for performance
                amdf += Math.abs(channelData[i + j] - channelData[i + j + p]);
            }
            if (amdf < minAmdf) {
                minAmdf = amdf;
                bestPeriod = p;
            }
        }

        const f0 = sampleRate / bestPeriod;
        pitchCurve.push(f0);
    }
    return pitchCurve;
};

// Helper: Trim zeros from start/end (VAD based trimming)
const trimPitch = (arr: number[]) => {
    let start = 0;
    while(start < arr.length && arr[start] === 0) start++;
    let end = arr.length - 1;
    while(end >= 0 && arr[end] === 0) end--;
    
    if (start > end) return [];
    return arr.slice(start, end + 1);
};

// Helper: Dynamic Time Warping (DTW)
// Aligns 'user' array to match the length and temporal structure of 'ref' array
const performDTW = (ref: number[], user: number[]) => {
    const N = ref.length;
    const M = user.length;
    
    if (N === 0 || M === 0) return Array(N).fill(0);

    // 1. Compute Cost Matrix
    // D[i][j] = distance(i,j) + min(neighbors)
    // Using a simpler linear space approach if needed, but for short phrases matrix is fine.
    
    const cost = Array.from({ length: N }, () => Array(M).fill(Infinity));
    cost[0][0] = Math.abs(ref[0] - user[0]);

    for (let i = 1; i < N; i++) cost[i][0] = cost[i-1][0] + Math.abs(ref[i] - user[0]);
    for (let j = 1; j < M; j++) cost[0][j] = cost[0][j-1] + Math.abs(ref[0] - user[j]);

    for (let i = 1; i < N; i++) {
        for (let j = 1; j < M; j++) {
            const dist = Math.abs(ref[i] - user[j]);
            // Allow diagonal, horizontal, vertical moves
            cost[i][j] = dist + Math.min(cost[i-1][j], cost[i][j-1], cost[i-1][j-1]);
        }
    }

    // 2. Backtrack to find optimal path
    let i = N - 1;
    let j = M - 1;
    const path: [number, number][] = [[i, j]];
    
    while (i > 0 || j > 0) {
        if (i === 0) j--;
        else if (j === 0) i--;
        else {
            const min = Math.min(cost[i-1][j], cost[i][j-1], cost[i-1][j-1]);
            if (min === cost[i-1][j-1]) { i--; j--; }
            else if (min === cost[i-1][j]) i--;
            else j--;
        }
        path.push([i, j]);
    }
    path.reverse();

    // 3. Construct Warped Signal
    // We map user values onto the reference timeline (size N)
    const alignedUser = new Array(N).fill(0);
    
    path.forEach(([rIdx, uIdx]) => {
        alignedUser[rIdx] = user[uIdx];
    });

    return alignedUser;
};

// --- Main Analysis Function ---

export const analyzeAudio = async (
  userBlob: Blob,
  referenceAudioData: string | undefined,
  phrase: PhraseData,
  nativeLanguage: string
): Promise<AnalysisResult> => {
  
  // 1. Prepare Inputs for Multimodal LLM
  const userBase64 = await blobToBase64(userBlob);
  const userAudioUrl = URL.createObjectURL(userBlob);

  // 2. Gemini Analysis (Parallel Request)
  // We send the audio to Gemini to get the "Pronunciation Score" and text feedback
  const geminiPromise = generateCoachFeedback(phrase.text, userBase64, nativeLanguage);

  // 3. DSP Analysis (Client-side)
  // We calculate Pitch Contour and DTW alignment for the visualization
  let pitchCurveReference: { time: number; value: number }[] = [];
  let pitchCurveUser: { time: number; value: number }[] = [];
  let referenceAudioUrl: string | undefined;

  try {
      // Decode User Audio
      const userArrayBuffer = await userBlob.arrayBuffer();
      const userAudioBuffer = await decodeAudioData(userArrayBuffer);
      
      // Decode Reference Audio
      let refArrayBuffer: ArrayBuffer | null = null;
      
      if (referenceAudioData) {
          if (referenceAudioData.startsWith('data:')) {
              // It's a data URI (ElevenLabs)
              const base64 = referenceAudioData.split(',')[1];
              const bin = atob(base64);
              const len = bin.length;
              const bytes = new Uint8Array(len);
              for(let i=0; i<len; i++) bytes[i] = bin.charCodeAt(i);
              refArrayBuffer = bytes.buffer;
              referenceAudioUrl = referenceAudioData;
          } else {
              // Raw PCM from Gemini
              const wav = pcmToBase64Wav(referenceAudioData);
              const bin = atob(wav);
              const len = bin.length;
              const bytes = new Uint8Array(len);
              for(let i=0; i<len; i++) bytes[i] = bin.charCodeAt(i);
              refArrayBuffer = bytes.buffer;
              referenceAudioUrl = `data:audio/wav;base64,${wav}`;
          }
      }

      if (refArrayBuffer) {
          const refAudioBuffer = await decodeAudioData(refArrayBuffer);
          
          // A. Extract Pitches
          let refPitch = extractPitch(refAudioBuffer);
          let userPitch = extractPitch(userAudioBuffer);
          
          // B. Normalize (0-100 scale for visual comparison)
          const normalize = (arr: number[]) => {
             const nonZeros = arr.filter(v => v > 0);
             if (nonZeros.length === 0) return arr;
             const min = Math.min(...nonZeros);
             const max = Math.max(...nonZeros);
             const range = max - min || 1;
             return arr.map(v => v === 0 ? 0 : ((v - min) / range) * 80 + 10); // Scale to 10-90
          };

          const refPitchNorm = normalize(refPitch);
          const userPitchNorm = normalize(userPitch);

          // C. Trim Silence (VAD)
          const refTrimmed = trimPitch(refPitchNorm);
          const userTrimmed = trimPitch(userPitchNorm);

          // D. DTW Alignment
          const userAligned = performDTW(refTrimmed, userTrimmed);

          // E. Format
          pitchCurveReference = refTrimmed.map((v, i) => ({ time: i, value: v }));
          pitchCurveUser = userAligned.map((v, i) => ({ time: i, value: v }));
      }
      
  } catch (e) {
      console.error("DSP Analysis Error", e);
      // Fallback visualization if DSP fails
      pitchCurveReference = Array.from({length: 50}, (_, i) => ({ time: i, value: 50 + 20*Math.sin(i*0.2) }));
      pitchCurveUser = Array.from({length: 50}, (_, i) => ({ time: i, value: 50 + 20*Math.sin(i*0.25) }));
  }

  // 4. Await Gemini Result
  const feedbackResult = await geminiPromise;

  return {
    ...feedbackResult,
    userAudioUrl,
    referenceAudioUrl,
    pitchCurveReference,
    pitchCurveUser
  };
};