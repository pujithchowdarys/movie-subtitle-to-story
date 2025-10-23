import React, { useState, useCallback, useRef, useEffect } from 'react';
import { generateContentWithSearch } from '../services/geminiService';
import { ChatMessage, ChatRole } from '../types';
import LoadingSpinner from './LoadingSpinner';

const GeneralChat: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const sendMessage = useCallback(async () => {
    if (!input.trim()) return;

    const userMessage: ChatMessage = {
      role: ChatRole.USER,
      content: input,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const { text, urls } = await generateContentWithSearch(input);
      const modelMessageContent = urls.length > 0
        ? `${text}\n\n**Sources:**\n${urls.map(url => `- [${url.title || url.uri}](${url.uri})`).join('\n')}`
        : text;

      const modelMessage: ChatMessage = {
        role: ChatRole.MODEL,
        content: modelMessageContent,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, modelMessage]);
    } catch (err: any) {
      console.error('Error in general chat:', err);
      setError(`Failed to get response: ${err.message || 'Unknown error'}.`);
      setMessages((prev) => [
        ...prev,
        {
          role: ChatRole.MODEL,
          content: `Oops! Something went wrong. ${err.message || 'Please try again.'}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isLoading) {
      sendMessage();
    }
  }, [sendMessage, isLoading]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-xl p-6 sm:p-8">
      <h1 className="text-3xl font-extrabold text-teal-800 mb-6 text-center">
        General AI Chat (with Google Search)
      </h1>

      <div ref={chatContainerRef} className="flex-1 overflow-y-auto mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50 flex flex-col space-y-4">
        {messages.length === 0 ? (
          <p className="text-center text-gray-500 italic">Ask me anything! I can use Google Search for up-to-date info.</p>
        ) : (
          messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.role === ChatRole.USER ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] px-4 py-2 rounded-lg shadow-md ${
                  msg.role === ChatRole.USER
                    ? 'bg-teal-600 text-white'
                    : 'bg-gray-200 text-gray-800'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                <p className="text-xs mt-1 opacity-75">
                  {msg.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-center mt-4">
            <LoadingSpinner />
            <p className="ml-2 text-gray-600">Thinking...</p>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <strong className="font-bold">Error:</strong>
          <span className="block sm:inline ml-2">{error}</span>
        </div>
      )}

      <div className="sticky bottom-0 bg-white p-4 -mx-6 -mb-8 border-t border-gray-200 flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your message..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-800"
          disabled={isLoading}
        />
        <button
          onClick={sendMessage}
          disabled={isLoading || !input.trim()}
          className="px-6 py-3 bg-teal-600 text-white font-semibold rounded-lg shadow-md hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:bg-teal-400"
        >
          {isLoading ? (
            <LoadingSpinner />
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 9l3 3m0 0l-3 3m3-3H8m-8 0v0a2 2 0 002 2h4a2 2 0 002-2V7a2 2 0 00-2-2H2a2 2 0 00-2 2v4z"></path></svg>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default GeneralChat;
