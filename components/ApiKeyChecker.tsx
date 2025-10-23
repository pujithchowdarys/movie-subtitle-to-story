import React, { useState, useEffect } from 'react';
import { checkAndSelectApiKey } from '../services/geminiService';
import LoadingSpinner from './LoadingSpinner';

interface ApiKeyCheckerProps {
  children: React.ReactNode;
}

const ApiKeyChecker: React.FC<ApiKeyCheckerProps> = ({ children }) => {
  const [apiKeyAvailable, setApiKeyAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const handleCheckKey = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const success = await checkAndSelectApiKey();
      setApiKeyAvailable(success);
      if (!success) {
        setError("Please select an API key to use the application. This is required for Gemini API access.");
      }
    } catch (err) {
      console.error("Error checking or selecting API key:", err);
      setError("Failed to check or select API key. Please try again.");
      setApiKeyAvailable(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    handleCheckKey();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50">
        <LoadingSpinner />
        <p className="mt-4 text-lg text-gray-700">Checking API key...</p>
      </div>
    );
  }

  if (!apiKeyAvailable) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center bg-gray-50">
        <h2 className="text-2xl font-bold text-red-600 mb-4">API Key Required</h2>
        <p className="text-lg text-gray-700 mb-6">
          A Gemini API key is necessary to use this application's features.
          Please select your API key to proceed.
        </p>
        {error && <p className="text-red-500 mb-4">{error}</p>}
        <button
          onClick={handleCheckKey}
          className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Select API Key
        </button>
        <p className="mt-6 text-sm text-gray-500">
          Need an API key? Learn more about billing at{" "}
          <a
            href="https://ai.google.dev/gemini-api/docs/billing"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            ai.google.dev/gemini-api/docs/billing
          </a>
          .
        </p>
      </div>
    );
  }

  return <>{children}</>;
};

export default ApiKeyChecker;
