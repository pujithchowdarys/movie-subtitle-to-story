export enum ChatRole {
  USER = 'user',
  MODEL = 'model',
}

export interface ChatMessage {
  role: ChatRole;
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

export enum Tab {
  STORY_GENERATOR = 'StoryGenerator',
  LIVE_CHAT = 'LiveChat',
  GENERAL_CHAT = 'GeneralChat',
}

// Interfaces for Audio decoding and encoding
export interface EncodedMediaBlob {
  data: string;
  mimeType: string;
}

export interface AudioProcessingResult {
  nextStartTime: number;
  sources: Set<AudioBufferSourceNode>;
}

// Function types for Live API callbacks
export type OnOpenCallback = () => void;
export type OnMessageCallback = (message: any) => Promise<void>;
export type OnErrorCallback = (event: ErrorEvent) => void;
export type OnCloseCallback = (event: CloseEvent) => void;

// Interfaces for structured video analysis output
export interface Timeframe {
  startTime: string; // e.g., "00:01:30"
  endTime: string;   // e.g., "00:01:45"
  description: string; // What's happening in this timeframe
}

export interface AnalysisOutput {
  analysisText: string;
  timeframes: Timeframe[];
}