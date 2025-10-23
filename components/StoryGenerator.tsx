import React, { useState, useCallback, useMemo } from 'react';
import FileUpload from './FileUpload';
import LoadingSpinner from './LoadingSpinner';
import AudioPlayer from './AudioPlayer';
import {
  generateStoryFromTranscript,
  analyzeVideoTranscriptForInfo,
  generateAudioFromText,
  decode,
  convertPcmToWavBlob,
} from '../services/geminiService';
import {
  STORY_GENERATION_LANGUAGES,
  AVAILABLE_VOICES,
  DEFAULT_VOICE_NAME,
  OUTPUT_AUDIO_SAMPLE_RATE,
  AUDIO_NUM_CHANNELS,
} from '../constants';
import { AnalysisOutput } from '../types';

type StoryGenerationMode = 'story' | 'analysis';
type GeneratedOutputType = string | AnalysisOutput | null;

const StoryGenerator: React.FC = () => {
  const [transcriptContent, setTranscriptContent] = useState<string | null>(null);
  const [transcriptFileName, setTranscriptFileName] = useState<string | null>(null);
  // Fix: Explicitly define the union type for useState to avoid potential inference issues with type aliases.
  const [generatedOutput, setGeneratedOutput] = useState<string | AnalysisOutput | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en');
  const [selectedVoice, setSelectedVoice] = useState<string>(DEFAULT_VOICE_NAME);
  const [audioPlayback, setAudioPlayback] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<StoryGenerationMode>('story'); // 'story' or 'analysis'
  const [analysisQuery, setAnalysisQuery] = useState<string>('');

  const handleFileRead = useCallback((content: string, fileName: string) => {
    setTranscriptContent(content);
    setTranscriptFileName(fileName);
    setGeneratedOutput(null);
    setAudioPlayback(null);
    setError(null);
  }, []);

  const getOutputTextForProcessing = useCallback((output: GeneratedOutputType): string => {
    if (typeof output === 'string' || output === null) {
      return output || '';
    } else { // It's an AnalysisOutput object
      const timeframesText = output.timeframes.length > 0
        ? `\n\nSuggested Timeframes for Pictures:\n${output.timeframes.map(tf => `[${tf.startTime}-${tf.endTime}] ${tf.description}`).join('\n')}`
        : '';
      return `${output.analysisText}${timeframesText}`;
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!transcriptContent) {
      setError('Please upload a subtitle or transcript file first.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setGeneratedOutput(null);
    setAudioPlayback(null);

    try {
      if (mode === 'story') {
        const promptPrefix = `Generate a detailed movie story based on the following transcript. Focus on plot progression, character development, and key events.`;
        const result = await generateStoryFromTranscript(transcriptContent, selectedLanguage, promptPrefix);
        setGeneratedOutput(result);
      } else { // mode === 'analysis'
        if (!analysisQuery.trim()) {
          setError('Please enter a query for video analysis.');
          return;
        }
        const result = await analyzeVideoTranscriptForInfo(transcriptContent, analysisQuery, selectedLanguage);
        setGeneratedOutput(result);
      }
    } catch (err: any) {
      console.error('Error generating content:', err);
      setError(`Failed to generate content: ${err.message || 'Unknown error'}. Please try again.`);
    } finally {
      setIsLoading(false);
    }
  }, [transcriptContent, selectedLanguage, mode, analysisQuery]);

  const handleGenerateAudio = useCallback(async () => {
    if (!generatedOutput) {
      setError('Please generate story/analysis text first.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setAudioPlayback(null);
    try {
      const textToSpeak = getOutputTextForProcessing(generatedOutput);
      const audio = await generateAudioFromText(textToSpeak, selectedVoice);
      setAudioPlayback(audio);
    } catch (err: any) {
      console.error('Error generating audio:', err);
      setError(`Failed to generate audio: ${err.message || 'Unknown error'}. Please try again.`);
    } finally {
      setIsLoading(false);
    }
  }, [generatedOutput, selectedVoice, getOutputTextForProcessing]);

  const handleDownloadOutput = useCallback(() => {
    if (generatedOutput) {
      const filename = `${transcriptFileName?.replace(/\.[^/.]+$/, "") || 'generated-content'}-${mode === 'story' ? 'story' : 'analysis'}-${selectedLanguage}.txt`;
      const textToDownload = getOutputTextForProcessing(generatedOutput);
      const blob = new Blob([textToDownload], { type: 'text/plain;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    }
  }, [generatedOutput, transcriptFileName, mode, selectedLanguage, getOutputTextForProcessing]);

  const handleDownloadNarration = useCallback(() => {
    if (audioPlayback) {
      try {
        const pcmBytes = decode(audioPlayback); // Decode base64 to Uint8Array (raw PCM)
        const wavBlob = convertPcmToWavBlob(
          pcmBytes,
          OUTPUT_AUDIO_SAMPLE_RATE,
          AUDIO_NUM_CHANNELS,
        );

        const filename = `${transcriptFileName?.replace(/\.[^/.]+$/, "") || 'generated-narration'}-${mode === 'story' ? 'story' : 'analysis'}-${selectedLanguage}-${selectedVoice}.wav`;
        const link = document.createElement('a');
        link.href = URL.createObjectURL(wavBlob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
      } catch (err) {
        console.error('Error downloading narration:', err);
        setError(`Failed to download narration: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }
  }, [audioPlayback, transcriptFileName, mode, selectedLanguage, selectedVoice]);


  const isActionDisabled = useMemo(() => {
    return isLoading || !transcriptContent || (mode === 'analysis' && !analysisQuery.trim());
  }, [isLoading, transcriptContent, mode, analysisQuery]);

  const displayOutput = useMemo(() => {
    if (!generatedOutput) return null;

    if (typeof generatedOutput === 'string') {
      return <p className="whitespace-pre-wrap text-gray-700">{generatedOutput}</p>;
    } else {
      // Structured Analysis Output
      return (
        <div className="text-gray-700">
          <p className="whitespace-pre-wrap">{generatedOutput.analysisText}</p>
          {generatedOutput.timeframes.length > 0 && (
            <div className="mt-4 p-3 bg-gray-100 rounded-md border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Suggested Timeframes for Pictures:</h3>
              <ul className="list-disc pl-5">
                {generatedOutput.timeframes.map((tf, index) => (
                  <li key={index} className="mb-1">
                    <span className="font-mono bg-gray-200 px-1 py-0.5 rounded text-sm">{tf.startTime} - {tf.endTime}</span>: {tf.description}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }
  }, [generatedOutput]);

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-xl p-6 sm:p-8">
      <h1 className="text-3xl font-extrabold text-blue-800 mb-6 text-center">
        Movie Storyteller & Video Analyst
      </h1>

      <div className="mb-6">
        <FileUpload onFileRead={handleFileRead} />
        {transcriptFileName && (
          <p className="text-sm text-gray-600 mt-2 text-center">
            File loaded: <span className="font-semibold">{transcriptFileName}</span>
            {mode === 'analysis' && (
              <span className="block italic text-gray-500 text-xs mt-1">
                (For best timeframe results, use a transcript with timestamps like .srt)
              </span>
            )}
          </p>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <label htmlFor="mode-select" className="block text-sm font-medium text-gray-700 mb-1">
            Mode:
          </label>
          <select
            id="mode-select"
            value={mode}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setMode(e.target.value as StoryGenerationMode)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white"
            disabled={isLoading}
          >
            <option value="story">Generate Movie Story</option>
            <option value="analysis">Analyze Video Transcript</option>
          </select>
        </div>

        <div className="flex-1">
          <label htmlFor="language-select" className="block text-sm font-medium text-gray-700 mb-1">
            Output Language:
          </label>
          <select
            id="language-select"
            value={selectedLanguage}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedLanguage(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white"
            disabled={isLoading}
          >
            {STORY_GENERATION_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1">
          <label htmlFor="voice-select" className="block text-sm font-medium text-gray-700 mb-1">
            Narration Voice:
          </label>
          <select
            id="voice-select"
            value={selectedVoice}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedVoice(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white"
            disabled={isLoading}
          >
            {AVAILABLE_VOICES.map((voice) => (
              <option key={voice.name} value={voice.name}>
                {voice.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {mode === 'analysis' && (
        <div className="mb-6">
          <label htmlFor="analysis-query" className="block text-sm font-medium text-gray-700 mb-1">
            Analysis Query:
          </label>
          <input
            id="analysis-query"
            type="text"
            value={analysisQuery}
            onChange={(e) => setAnalysisQuery(e.target.value)}
            placeholder="e.g., 'What are the main themes?', 'Who is the protagonist?', 'Summarize the ending.'"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            disabled={isLoading}
          />
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-4 mb-6">
        <button
          onClick={handleGenerate}
          disabled={isActionDisabled}
          className="flex items-center justify-center px-6 py-3 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:bg-green-400 min-w-[180px]"
        >
          {isLoading && !audioPlayback && (!generatedOutput || typeof generatedOutput === 'string') ? ( // Show spinner only for text generation
            <LoadingSpinner />
          ) : (
            <>
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
              {mode === 'story' ? 'Generate Story' : 'Analyze Transcript'}
            </>
          )}
        </button>

        <button
          onClick={handleGenerateAudio}
          disabled={isActionDisabled || !generatedOutput || (isLoading && audioPlayback === null)} // Disable if currently loading any operation or no output
          className="flex items-center justify-center px-6 py-3 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:bg-purple-400 min-w-[180px]"
        >
          {isLoading && generatedOutput && audioPlayback === null ? ( // Show spinner only for audio generation
            <LoadingSpinner />
          ) : (
            <>
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.108 12 5v14c0 .892-1.077 1.337-1.707.707L5.586 15z"></path></svg>
              Generate Narration
            </>
          )}
        </button>

        {generatedOutput && (
          <button
            onClick={handleDownloadOutput}
            disabled={isLoading}
            className="flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-blue-400 min-w-[180px]"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
            Download Output
          </button>
        )}

        {audioPlayback && (
          <button
            onClick={handleDownloadNarration}
            disabled={isLoading}
            className="flex items-center justify-center px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:bg-indigo-400 min-w-[180px]"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H4a2 2 0 01-2-2V6a2 2 0 012-2h12a2 2 0 012 2v2"></path></svg>
            Download Narration
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <strong className="font-bold">Error:</strong>
          <span className="block sm:inline ml-2">{error}</span>
        </div>
      )}

      {generatedOutput && (
        <div className="flex-1 bg-gray-50 p-4 border border-gray-200 rounded-lg shadow-inner overflow-auto">
          <h2 className="text-xl font-bold text-gray-800 mb-3">
            {mode === 'story' ? 'Generated Movie Story' : 'Video Analysis Result'}
          </h2>
          {displayOutput}
          <AudioPlayer base64Audio={audioPlayback} />
        </div>
      )}
    </div>
  );
};

export default StoryGenerator;