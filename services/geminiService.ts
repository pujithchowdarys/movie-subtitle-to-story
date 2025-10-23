import { GoogleGenAI, GenerateContentResponse, Modality, FunctionDeclaration, Type, LiveServerMessage } from '@google/genai';
import {
  GEMINI_PRO_MODEL,
  GEMINI_FLASH_MODEL,
  GEMINI_TTS_MODEL,
  GEMINI_LIVE_AUDIO_MODEL,
  DEFAULT_VOICE_NAME,
  TTS_RESPONSE_MODALITIES,
  LIVE_RESPONSE_MODALITIES,
  INPUT_AUDIO_SAMPLE_RATE,
  OUTPUT_AUDIO_SAMPLE_RATE,
  AUDIO_NUM_CHANNELS,
  SEARCH_GROUNDING_INFO_SCHEMA,
} from '../constants';
import { EncodedMediaBlob, OnCloseCallback, OnErrorCallback, OnMessageCallback, OnOpenCallback, AnalysisOutput } from '../types';

// The `window.aistudio` object is assumed to be pre-configured, valid, and accessible in the
// execution context, meaning its types are globally available. Explicitly declaring it here
// can lead to "identical modifiers" and "subsequent property declarations" errors if another
// declaration exists in the environment. Therefore, this local declaration is removed.

// Helper function to create a new GoogleGenAI instance with the latest API key
const getGeminiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY is not set. Please select an API key.");
  }
  return new GoogleGenAI({ apiKey });
};

// --- API Key Management ---
export const checkAndSelectApiKey = async (): Promise<boolean> => {
  // Assuming window.aistudio is globally available and typed by the environment.
  // The type check below handles cases where it might not be present in non-AI Studio environments.
  if (typeof window.aistudio === 'undefined' || typeof window.aistudio.hasSelectedApiKey === 'undefined') {
    console.warn("window.aistudio API is not available. Ensure the environment is correctly set up.");
    // In a development environment without the AI Studio runtime, assume API key is present
    return !!process.env.API_KEY;
  }
  const hasKey = await window.aistudio.hasSelectedApiKey();
  if (!hasKey) {
    console.log("No API key selected. Opening key selection dialog.");
    await window.aistudio.openSelectKey();
    // Assume selection was successful to avoid race condition,
    // actual key availability will be checked upon model instantiation.
    return true;
  }
  return true;
};

// --- Story Generation and Video Analysis ---
export const generateStoryFromTranscript = async (
  transcript: string,
  language: string,
  promptPrefix: string,
): Promise<string> => {
  const ai = getGeminiClient();
  const fullPrompt = `${promptPrefix}\n\nHere is the transcript: \n${transcript}`;
  const response: GenerateContentResponse = await ai.models.generateContent({
    model: GEMINI_PRO_MODEL,
    contents: [{ parts: [{ text: fullPrompt }] }],
    config: {
      systemInstruction: `You are a professional movie storyteller. Your task is to craft an engaging and detailed narrative of a movie's plot. The story should be told in a clear, concise, and captivating manner. Generate the entire story in ${language}. Ensure the narrative, character names (if applicable), and all descriptive elements are localized to ${language}. The output MUST be entirely in ${language}. Avoid overly technical jargon or minute details that don't serve the main narrative.`,
    },
  });
  return response.text;
};

export const analyzeVideoTranscriptForInfo = async (
  transcript: string,
  query: string,
  language: string,
): Promise<AnalysisOutput> => {
  const ai = getGeminiClient();
  const fullPrompt = `Analyze the following video transcript and respond to the query: "${query}". Extract key information, main themes, significant characters, plot twists, or any other relevant details that directly answer the user's query. Additionally, identify 3-5 specific timeframes from the transcript that would be suitable for taking a picture or screenshot from the movie, and provide a brief description for each.
  Provide the analysis and answer the query entirely in ${language}. If the transcript does not contain enough information to answer the query, state that clearly. The output MUST be a JSON object conforming to the provided schema.
  \n\nTranscript: \n${transcript}`;
  const response: GenerateContentResponse = await ai.models.generateContent({
    model: GEMINI_PRO_MODEL,
    contents: [{ parts: [{ text: fullPrompt }] }],
    config: {
      systemInstruction: `You are an expert video content analyst. Your goal is to provide concise and accurate answers based on the provided video transcript and identify relevant timeframes. The output MUST be entirely in ${language} and formatted as a JSON object.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          analysisText: {
            type: Type.STRING,
            description: `The main analysis text answering the query in ${language}.`,
          },
          timeframes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                startTime: { type: Type.STRING, description: 'Start time of the event (HH:MM:SS format).' },
                endTime: { type: Type.STRING, description: 'End time of the event (HH:MM:SS format).' },
                description: { type: Type.STRING, description: 'Brief description of the event or visual for a picture in ${language}.' },
              },
              required: ['startTime', 'endTime', 'description'],
              propertyOrdering: ['startTime', 'endTime', 'description'],
            },
            description: `A list of 3-5 relevant timeframes from the transcript suitable for taking pictures, with descriptions in ${language}.`,
          },
        },
        required: ['analysisText', 'timeframes'],
        propertyOrdering: ['analysisText', 'timeframes'],
      },
    },
  });

  try {
    const parsedResponse = JSON.parse(response.text.trim());
    return parsedResponse as AnalysisOutput;
  } catch (e) {
    console.error("Failed to parse JSON response from analysis:", response.text, e);
    // Fallback if parsing fails, return an object with the raw text and empty timeframes
    return { analysisText: `Failed to parse structured analysis. Raw response: ${response.text}`, timeframes: [] };
  }
};

// --- Text-to-Speech ---
export const generateAudioFromText = async (
  text: string,
  voiceName: string = DEFAULT_VOICE_NAME,
): Promise<string | undefined> => {
  if (!text) return undefined;
  const ai = getGeminiClient();
  const response: GenerateContentResponse = await ai.models.generateContent({
    model: GEMINI_TTS_MODEL,
    contents: [{ parts: [{ text: text }] }],
    config: {
      responseModalities: TTS_RESPONSE_MODALITIES,
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voiceName },
        },
      },
    },
  });
  return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
};

// --- Live Chat (Native Audio) ---
export interface LiveSessionCallbacks {
  onopen: OnOpenCallback;
  onmessage: OnMessageCallback;
  onerror: OnErrorCallback;
  onclose: OnCloseCallback;
}

export const startLiveSession = async (callbacks: LiveSessionCallbacks) => {
  const ai = getGeminiClient();
  // IMPORTANT: Re-instantiate GoogleGenAI right before connecting to ensure the latest API key is used.
  const sessionPromise = ai.live.connect({
    model: GEMINI_LIVE_AUDIO_MODEL,
    callbacks: callbacks,
    config: {
      responseModalities: LIVE_RESPONSE_MODALITIES,
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: DEFAULT_VOICE_NAME } },
      },
      systemInstruction: 'You are a friendly and helpful AI assistant, ready to have a natural conversation.',
      outputAudioTranscription: {}, // Enable transcription for model output audio.
      inputAudioTranscription: {}, // Enable transcription for user input audio.
    },
  });
  return sessionPromise;
};

// Fix: Change mediaBlob type to EncodedMediaBlob
export const sendRealtimeInput = async (session: any, mediaBlob: EncodedMediaBlob) => {
  try {
    session.sendRealtimeInput({ media: mediaBlob });
  } catch (error) {
    console.error('Error sending realtime input:', error);
    throw error;
  }
};

// --- General Chat with Search Grounding ---
export const generateContentWithSearch = async (prompt: string): Promise<{ text: string; urls: { uri: string; title?: string }[] }> => {
  const ai = getGeminiClient();
  const response: GenerateContentResponse = await ai.models.generateContent({
    model: GEMINI_FLASH_MODEL,
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  const urls: { uri: string; title?: string }[] = [];
  response.candidates?.[0]?.groundingMetadata?.groundingChunks?.forEach((chunk: any) => {
    if (chunk.web && chunk.web.uri) {
      urls.push({ uri: chunk.web.uri, title: chunk.web.title });
    }
  });

  return { text: response.text, urls };
};

// --- Audio Utility Functions (as per guidelines) ---
export function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// Fix: Change return type to EncodedMediaBlob
export function createBlob(data: Float32Array): EncodedMediaBlob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: `audio/pcm;rate=${INPUT_AUDIO_SAMPLE_RATE}`,
  };
}

/**
 * Converts raw PCM (Pulse-Code Modulation) audio data into a WAV file format.
 * This function adds the necessary RIFF and WAV headers to the raw audio bytes,
 * making it a playable .wav file.
 *
 * @param pcmBytes The raw PCM audio data as a Uint8Array.
 * @param sampleRate The sample rate of the PCM data (e.g., 24000 for TTS output).
 * @param numChannels The number of audio channels (e.g., 1 for mono).
 * @returns A Blob representing the WAV audio file.
 */
// Fix: Change return type to native Blob
export function convertPcmToWavBlob(
  pcmBytes: Uint8Array,
  sampleRate: number,
  numChannels: number,
): globalThis.Blob {
  const bitsPerSample = 16; // The Gemini TTS output is 16-bit PCM (Int16Array buffer)

  const headerLength = 44;
  const dataLength = pcmBytes.byteLength;
  const fileLength = dataLength + headerLength - 8;

  const buffer = new ArrayBuffer(headerLength + dataLength);
  const view = new DataView(buffer);

  let offset = 0;

  // RIFF chunk descriptor
  writeString(view, offset, 'RIFF'); offset += 4;
  view.setUint32(offset, fileLength, true); offset += 4;
  writeString(view, offset, 'WAVE'); offset += 4;

  // fmt sub-chunk
  writeString(view, offset, 'fmt '); offset += 4;
  view.setUint32(offset, 16, true); offset += 4; // Subchunk1Size (16 for PCM)
  view.setUint16(offset, 1, true); offset += 2; // AudioFormat (1 for PCM)
  view.setUint16(offset, numChannels, true); offset += 2; // NumChannels
  view.setUint32(offset, sampleRate, true); offset += 4; // SampleRate
  view.setUint32(offset, sampleRate * numChannels * (bitsPerSample / 8), true); offset += 4; // ByteRate
  view.setUint16(offset, numChannels * (bitsPerSample / 8), true); offset += 2; // BlockAlign
  view.setUint16(offset, bitsPerSample, true); offset += 2; // BitsPerSample

  // data sub-chunk
  writeString(view, offset, 'data'); offset += 4;
  view.setUint32(offset, dataLength, true); offset += 4;

  // Write the PCM data
  for (let i = 0; i < dataLength; i++) {
    view.setUint8(offset + i, pcmBytes[i]);
  }

  // Fix: Return native Blob
  return new globalThis.Blob([buffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, s: string) {
  for (let i = 0; i < s.length; i++) {
    view.setUint8(offset + i, s.charCodeAt(i));
  }
}