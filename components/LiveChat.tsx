import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  startLiveSession,
  sendRealtimeInput,
  createBlob,
  decodeAudioData,
  decode,
} from '../services/geminiService';
import LoadingSpinner from './LoadingSpinner';
import {
  INPUT_AUDIO_SAMPLE_RATE,
  OUTPUT_AUDIO_SAMPLE_RATE,
  AUDIO_PROCESSOR_BUFFER_SIZE,
  AUDIO_NUM_CHANNELS,
} from '../constants';
import { ChatMessage, ChatRole, EncodedMediaBlob } from '../types';
import { GoogleGenAI, LiveServerMessage } from '@google/genai';

interface LiveChatProps {}

const LiveChat: React.FC<LiveChatProps> = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [currentInputTranscription, setCurrentInputTranscription] = useState('');
  const [currentOutputTranscription, setCurrentOutputTranscription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const liveSessionRef = useRef<Awaited<ReturnType<GoogleGenAI['live']['connect']>> | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Audio playback state
  const nextStartTimeRef = useRef(0);
  const playbackSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const addChatMessage = useCallback((message: ChatMessage) => {
    setChatMessages((prev) => [...prev, message]);
  }, []);

  const clearCurrentTranscriptions = useCallback(() => {
    setCurrentInputTranscription('');
    setCurrentOutputTranscription('');
  }, []);

  const handleLiveMessage = useCallback(async (message: LiveServerMessage) => {
    // Handle audio output
    const base64EncodedAudioString = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
    if (base64EncodedAudioString && outputAudioContextRef.current) {
      const outputAudioContext = outputAudioContextRef.current;
      nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContext.currentTime);
      try {
        const audioBuffer = await decodeAudioData(
          decode(base64EncodedAudioString),
          outputAudioContext,
          OUTPUT_AUDIO_SAMPLE_RATE,
          AUDIO_NUM_CHANNELS,
        );
        const source = outputAudioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(outputAudioContext.destination); // Direct to speakers
        source.addEventListener('ended', () => {
          playbackSourcesRef.current.delete(source);
        });

        source.start(nextStartTimeRef.current);
        nextStartTimeRef.current = nextStartTimeRef.current + audioBuffer.duration;
        playbackSourcesRef.current.add(source);
      } catch (audioError) {
        console.error("Error decoding or playing audio:", audioError);
      }
    }

    // Handle transcription updates
    if (message.serverContent?.outputTranscription) {
      setCurrentOutputTranscription((prev) => prev + message.serverContent.outputTranscription.text);
    } else if (message.serverContent?.inputTranscription) {
      setCurrentInputTranscription((prev) => prev + message.serverContent.inputTranscription.text);
    }

    // Handle turn completion
    if (message.serverContent?.turnComplete) {
      if (currentInputTranscription.trim()) {
        addChatMessage({
          role: ChatRole.USER,
          content: currentInputTranscription,
          timestamp: new Date(),
        });
      }
      if (currentOutputTranscription.trim()) {
        addChatMessage({
          role: ChatRole.MODEL,
          content: currentOutputTranscription,
          timestamp: new Date(),
        });
      }
      clearCurrentTranscriptions();
    }

    // Handle interruptions
    if (message.serverContent?.interrupted) {
      // Stop all currently playing audio
      for (const source of playbackSourcesRef.current.values()) {
        source.stop();
        playbackSourcesRef.current.delete(source);
      }
      nextStartTimeRef.current = 0;
      clearCurrentTranscriptions(); // Clear transcriptions if interrupted
    }
  }, [addChatMessage, currentInputTranscription, currentOutputTranscription, clearCurrentTranscriptions]);


  const startRecording = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setChatMessages([]);
    clearCurrentTranscriptions();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // Use standard AudioContext
      audioContextRef.current = new AudioContext({
        sampleRate: INPUT_AUDIO_SAMPLE_RATE,
      });
      // Use standard AudioContext
      outputAudioContextRef.current = new AudioContext({
        sampleRate: OUTPUT_AUDIO_SAMPLE_RATE,
      });

      const source = audioContextRef.current.createMediaStreamSource(stream);
      mediaStreamSourceRef.current = source;

      const scriptProcessor = audioContextRef.current.createScriptProcessor(
        AUDIO_PROCESSOR_BUFFER_SIZE,
        AUDIO_NUM_CHANNELS,
        AUDIO_NUM_CHANNELS,
      );
      scriptProcessorRef.current = scriptProcessor;

      scriptProcessor.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0);
        const pcmBlob: EncodedMediaBlob = createBlob(inputData); // Explicitly type pcmBlob
        if (liveSessionRef.current) {
          sendRealtimeInput(liveSessionRef.current, pcmBlob).catch((err) => {
            console.error("Error sending realtime input during recording:", err);
            // Optionally stop recording or show error
          });
        }
      };

      source.connect(scriptProcessor);
      scriptProcessor.connect(audioContextRef.current.destination);

      const session = await startLiveSession({
        onopen: () => {
          console.debug('Live session opened.');
        },
        onmessage: handleLiveMessage,
        onerror: (e: ErrorEvent) => {
          console.error('Live session error:', e);
          setError(`Live session error: ${e.message}. Please try again.`);
          stopRecording(); // Automatically stop on error
        },
        onclose: (e: CloseEvent) => {
          console.debug('Live session closed:', e.code, e.reason);
          if (!e.wasClean) {
            setError(`Live session closed unexpectedly: ${e.reason || 'Unknown reason'}.`);
          }
          // Only stop if not explicitly stopped by user
          if (isRecording) {
            stopRecording();
          }
        },
      });
      liveSessionRef.current = session;
      setIsRecording(true);
    } catch (err: any) {
      console.error('Error starting live session:', err);
      setError(`Failed to start live session: ${err.message || 'Unknown error'}. Please ensure microphone access is granted.`);
      setIsRecording(false);
      // Clean up if setup fails
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
    } finally {
      setIsLoading(false);
    }
  }, [handleLiveMessage, isRecording, clearCurrentTranscriptions]); // Added isRecording as dependency to prevent stale closure for internal stopRecording call

  const stopRecording = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (mediaStreamSourceRef.current) {
      mediaStreamSourceRef.current.disconnect();
      mediaStreamSourceRef.current = null;
    }
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(e => console.error("Error closing input audio context:", e));
      audioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      // Stop all currently playing model audio
      for (const source of playbackSourcesRef.current.values()) {
        source.stop();
      }
      playbackSourcesRef.current.clear();
      nextStartTimeRef.current = 0;
      outputAudioContextRef.current.close().catch(e => console.error("Error closing output audio context:", e));
      outputAudioContextRef.current = null;
    }
    if (liveSessionRef.current) {
      liveSessionRef.current.close();
      liveSessionRef.current = null;
    }
    setIsRecording(false);
    setIsLoading(false);
  }, []);

  // Effect for cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, [stopRecording]);

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-xl p-6 sm:p-8">
      <h1 className="text-3xl font-extrabold text-indigo-800 mb-6 text-center">
        Live AI Conversation
      </h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <strong className="font-bold">Error:</strong>
          <span className="block sm:inline ml-2">{error}</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50 flex flex-col space-y-4">
        {chatMessages.length === 0 && !isRecording && !currentInputTranscription && !currentOutputTranscription && (
          <p className="text-center text-gray-500 italic">Start recording to begin a live conversation...</p>
        )}
        {chatMessages.map((msg, index) => (
          <div
            key={index}
            className={`flex ${msg.role === ChatRole.USER ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[70%] px-4 py-2 rounded-lg shadow-md ${
                msg.role === ChatRole.USER
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-800'
              }`}
            >
              <p className="text-sm">{msg.content}</p>
              <p className="text-xs mt-1 opacity-75">
                {msg.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
        {currentInputTranscription && (
          <div className="flex justify-end">
            <div className="max-w-[70%] px-4 py-2 rounded-lg shadow-md bg-blue-500 text-white opacity-90">
              <p className="text-sm italic">You: {currentInputTranscription}</p>
            </div>
          </div>
        )}
        {currentOutputTranscription && (
          <div className="flex justify-start">
            <div className="max-w-[70%] px-4 py-2 rounded-lg shadow-md bg-gray-100 text-gray-700 opacity-90">
              <p className="text-sm italic">AI: {currentOutputTranscription}</p>
            </div>
          </div>
        )}
        {isLoading && (
          <div className="flex justify-center mt-4">
            <LoadingSpinner />
            <p className="ml-2 text-gray-600">Connecting...</p>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 bg-white p-4 -mx-6 -mb-8 border-t border-gray-200 flex justify-center gap-4">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isLoading}
          className={`flex items-center px-6 py-3 rounded-lg shadow-md font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 ${
            isRecording
              ? 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500'
              : 'bg-green-600 hover:bg-green-700 text-white focus:ring-green-500'
          } disabled:opacity-50`}
        >
          {isLoading ? (
            <LoadingSpinner />
          ) : isRecording ? (
            <>
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"></path></svg>
              Stop Recording
            </>
          ) : (
            <>
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
              Start Recording
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default LiveChat;