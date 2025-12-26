import React, { useState, useEffect } from 'react';
import { UserState, AppMode, ExerciseResult } from './types';
import { Dashboard } from './components/Dashboard';
import { ReadingView } from './components/ReadingView';
import { WritingView } from './components/WritingView';
import { Zap, AlertTriangle, X } from 'lucide-react';
import { Logger } from './services/logger';

const XP_PER_LEVEL = 100;
const MAX_LEVEL = 50;

function App() {
  const [mode, setMode] = useState<AppMode>(AppMode.DASHBOARD);
  const [globalError, setGlobalError] = useState<string | null>(null);
  
  // Initialize state from localStorage or default
  const [userState, setUserState] = useState<UserState>(() => {
    try {
      const saved = localStorage.getItem('techcomm-user');
      return saved ? JSON.parse(saved) : {
        level: 1,
        xp: 0,
        xpToNextLevel: XP_PER_LEVEL,
        history: []
      };
    } catch (e) {
      Logger.error("Failed to load user state", e);
      return { level: 1, xp: 0, xpToNextLevel: XP_PER_LEVEL, history: [] };
    }
  });

  // Persist state
  useEffect(() => {
    localStorage.setItem('techcomm-user', JSON.stringify(userState));
  }, [userState]);

  // Error Handler passed to children
  const handleError = (msg: string) => {
    setGlobalError(msg);
    // Auto clear after 10 seconds
    setTimeout(() => setGlobalError(null), 10000);
  };

  const handleExerciseComplete = (score: number, type: 'reading' | 'writing') => {
    const xpGained = Math.round(score * 1.5); 
    
    setUserState(prev => {
      let newXp = prev.xp + xpGained;
      let newLevel = prev.level;
      let newXpToNext = prev.xpToNextLevel;

      if (newXp >= newXpToNext && newLevel < MAX_LEVEL) {
        newXp = newXp - newXpToNext;
        newLevel += 1;
      } else if (newLevel === MAX_LEVEL) {
        newXp = newXpToNext; 
      }

      const newHistory: ExerciseResult = {
        id: Date.now().toString(),
        type,
        score,
        date: new Date().toISOString(),
        level: prev.level
      };

      return {
        ...prev,
        level: newLevel,
        xp: newXp,
        history: [...prev.history, newHistory]
      };
    });

    setMode(AppMode.DASHBOARD);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setMode(AppMode.DASHBOARD)}>
            <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white">
              <Zap className="w-5 h-5" fill="currentColor" />
            </div>
            <span className="font-bold text-xl tracking-tight">TechComm AI</span>
          </div>
          <div className="text-sm text-slate-500 hidden md:block">
            English for Engineering Professionals
          </div>
        </div>
      </nav>

      {/* Global Error Banner */}
      {globalError && (
        <div className="bg-red-50 border-b border-red-200 p-4 animate-fade-in">
          <div className="max-w-6xl mx-auto flex items-center justify-between text-red-700">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-medium">Error: {globalError}</span>
            </div>
            <button onClick={() => setGlobalError(null)} className="hover:bg-red-100 p-1 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 py-8">
        {mode === AppMode.DASHBOARD && (
          <Dashboard 
            userState={userState} 
            onStartReading={() => setMode(AppMode.READING)} 
            onStartWriting={() => setMode(AppMode.WRITING)} 
          />
        )}

        {mode === AppMode.READING && (
          <ReadingView 
            level={userState.level} 
            onComplete={(score) => handleExerciseComplete(score, 'reading')}
            onExit={() => setMode(AppMode.DASHBOARD)}
            onError={handleError}
          />
        )}

        {mode === AppMode.WRITING && (
          <WritingView 
            level={userState.level} 
            onComplete={(score) => handleExerciseComplete(score, 'writing')}
            onExit={() => setMode(AppMode.DASHBOARD)}
            onError={handleError}
          />
        )}
      </main>
    </div>
  );
}

export default App;