import React, { useState } from 'react';
import StoryGenerator from './components/StoryGenerator';
import LiveChat from './components/LiveChat';
import GeneralChat from './components/GeneralChat';
import ApiKeyChecker from './components/ApiKeyChecker';
import { Tab } from './types';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.STORY_GENERATOR);

  const renderActiveTab = () => {
    switch (activeTab) {
      case Tab.STORY_GENERATOR:
        return <StoryGenerator />;
      case Tab.LIVE_CHAT:
        return <LiveChat />;
      case Tab.GENERAL_CHAT:
        return <GeneralChat />;
      default:
        return <StoryGenerator />;
    }
  };

  return (
    <ApiKeyChecker>
      <div className="min-h-screen flex flex-col items-center p-4 sm:p-8 bg-gradient-to-br from-blue-50 to-indigo-100">
        <header className="w-full max-w-5xl bg-white shadow-lg rounded-xl p-4 mb-8">
          <nav className="flex flex-wrap justify-center gap-2 sm:gap-4">
            <TabButton
              label="Movie Storyteller"
              isActive={activeTab === Tab.STORY_GENERATOR}
              onClick={() => setActiveTab(Tab.STORY_GENERATOR)}
            />
            <TabButton
              label="Live AI Chat"
              isActive={activeTab === Tab.LIVE_CHAT}
              onClick={() => setActiveTab(Tab.LIVE_CHAT)}
            />
            <TabButton
              label="General AI Chat"
              isActive={activeTab === Tab.GENERAL_CHAT}
              onClick={() => setActiveTab(Tab.GENERAL_CHAT)}
            />
          </nav>
        </header>

        <main className="w-full max-w-5xl flex-1 pb-4">
          {renderActiveTab()}
        </main>
      </div>
    </ApiKeyChecker>
  );
};

interface TabButtonProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
}

const TabButton: React.FC<TabButtonProps> = ({ label, isActive, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg font-medium text-sm sm:text-base transition-all duration-300
        ${isActive
          ? 'bg-blue-600 text-white shadow-md'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
    >
      {label}
    </button>
  );
};

export default App;
