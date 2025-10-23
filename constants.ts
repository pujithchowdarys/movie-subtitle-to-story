import { Modality } from '@google/genai';
import { Type } from '@google/genai';

export const GEMINI_PRO_MODEL = 'gemini-2.5-pro';
export const GEMINI_FLASH_MODEL = 'gemini-2.5-flash';
export const GEMINI_TTS_MODEL = 'gemini-2.5-flash-preview-tts';
export const GEMINI_LIVE_AUDIO_MODEL = 'gemini-2.5-flash-native-audio-preview-09-2025';

export const DEFAULT_VOICE_NAME = 'Kore'; // Or 'Puck', 'Charon', 'Fenrir', 'Zephyr'
export const INPUT_AUDIO_SAMPLE_RATE = 16000;
export const OUTPUT_AUDIO_SAMPLE_RATE = 24000;
export const AUDIO_PROCESSOR_BUFFER_SIZE = 4096;
export const AUDIO_NUM_CHANNELS = 1;

export const TTS_RESPONSE_MODALITIES = [Modality.AUDIO];
export const LIVE_RESPONSE_MODALITIES = [Modality.AUDIO];

export const AVAILABLE_VOICES = [
  { name: 'Kore', label: 'Kore (Female)' },
  { name: 'Puck', label: 'Puck (Male)' },
  { name: 'Charon', label: 'Charon (Male)' },
  { name: 'Fenrir', label: 'Fenrir (Male)' },
  { name: 'Zephyr', label: 'Zephyr (Female)' },
];

export const STORY_GENERATION_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'te', name: 'Telugu' },
  { code: 'hi', name: 'Hindi' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
];

export const SEARCH_GROUNDING_INFO_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      web: {
        type: Type.OBJECT,
        properties: {
          uri: { type: Type.STRING },
          title: { type: Type.STRING },
        },
        propertyOrdering: ['uri', 'title'],
      },
    },
    propertyOrdering: ['web'],
  },
};
