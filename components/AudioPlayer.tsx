import React, { useEffect, useRef } from 'react';
import { decode, decodeAudioData } from '../services/geminiService';
import { OUTPUT_AUDIO_SAMPLE_RATE, AUDIO_NUM_CHANNELS } from '../constants';

interface AudioPlayerProps {
  base64Audio: string | null;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ base64Audio }) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    const playAudio = async (audioData: string) => {
      // Ensure AudioContext is initialized
      if (!audioContextRef.current) {
        // Fix: Use AudioContext directly, webkitAudioContext is deprecated and not typed
        audioContextRef.current = new AudioContext({
          sampleRate: OUTPUT_AUDIO_SAMPLE_RATE,
        });
        gainNodeRef.current = audioContextRef.current.createGain();
        gainNodeRef.current.connect(audioContextRef.current.destination);
      }

      // Stop any currently playing audio
      if (currentSourceRef.current) {
        currentSourceRef.current.stop();
        currentSourceRef.current.disconnect();
        currentSourceRef.current = null;
      }

      try {
        const decodedBytes = decode(audioData);
        const audioBuffer = await decodeAudioData(
          decodedBytes,
          audioContextRef.current,
          OUTPUT_AUDIO_SAMPLE_RATE,
          AUDIO_NUM_CHANNELS,
        );

        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(gainNodeRef.current!); // Connect to gain node
        source.start(0); // Play immediately
        currentSourceRef.current = source;

        source.onended = () => {
          if (currentSourceRef.current === source) {
            currentSourceRef.current = null; // Clear reference if this is the source that just ended
          }
        };
      } catch (error) {
        console.error("Error decoding or playing audio:", error);
      }
    };

    if (base64Audio) {
      playAudio(base64Audio);
    } else {
      // If base64Audio becomes null, stop any playing audio
      if (currentSourceRef.current) {
        currentSourceRef.current.stop();
        currentSourceRef.current.disconnect();
        currentSourceRef.current = null;
      }
    }

    // Cleanup function: stop audio and close AudioContext on component unmount
    return () => {
      if (currentSourceRef.current) {
        currentSourceRef.current.stop();
        currentSourceRef.current.disconnect();
        currentSourceRef.current = null;
      }
      if (audioContextRef.current) {
        // Only close if it's not already closed or suspended
        if (audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close().catch(e => console.error("Error closing audio context:", e));
        }
        audioContextRef.current = null;
        gainNodeRef.current = null;
      }
    };
  }, [base64Audio]); // Re-run effect when base64Audio changes

  // The component does not render any visible audio player UI since it uses Web Audio API
  if (!base64Audio) {
    return null;
  }

  return (
    <div className="mt-4 flex justify-center text-gray-600 italic">
      <p>Playing narration...</p>
    </div>
  );
};

export default AudioPlayer;