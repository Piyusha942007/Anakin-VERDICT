'use client';

import React from 'react';
import Image from 'next/image';
import GlowingGlow from '../components/GlowingGlow';
import VerdictInput from '../components/VerdictInput';
import SkeletonLoader from '../components/SkeletonLoader';
import VerdictDisplay from '../components/VerdictDisplay';
import IntelligenceArchive from '../components/IntelligenceArchive';
import { useVerdictSSE } from '../hooks/useVerdictSSE';
import { ArchiveItem } from '../types/index.js';

export default function Home() {
  const { state, setState, startStream, resetStream, isStreaming } = useVerdictSSE();
  const { stage, errorMessage } = state;

  const [history, setHistory] = React.useState<ArchiveItem[]>([]);
  const [isArchiveOpen, setIsArchiveOpen] = React.useState(false);
  const [isConnecting, setIsConnecting] = React.useState(false);

  React.useEffect(() => {
    if (stage === 'classifying') {
      setIsConnecting(true);
    } else {
      setIsConnecting(false);
    }
  }, [stage]);

  const showInput = stage === 'idle';

  // Load history on mount
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('verdict_archive_v1');
      if (saved) {
        try {
          setHistory(JSON.parse(saved));
        } catch (e) {
          console.error('Failed to parse history:', e);
        }
      }
    }
  }, []);

  // Auto-save completed verdicts
  React.useEffect(() => {
    if (stage === 'done' && state.verdict && state.query) {
      setHistory(prev => {
        const queryClean = state.query.toLowerCase().trim();
        const exists = prev.some(item => item.query.toLowerCase().trim() === queryClean);
        if (exists) return prev;

        const newItem: ArchiveItem = {
          id: Math.random().toString(36).substring(2, 11),
          query: state.query,
          timestamp: Date.now(),
          category: state.category || 'CAREER',
          decisionMode: state.decisionMode || 'Balanced',
          verdict: state.verdict!,
          resolvedSources: state.resolvedSources,
          conflicts: state.conflicts,
          isBookmarked: false,
          isDemoMode: state.isDemoMode
        };
        const updated = [newItem, ...prev];
        localStorage.setItem('verdict_archive_v1', JSON.stringify(updated));
        return updated;
      });
    }
  }, [stage, state.verdict, state.query, state.category, state.resolvedSources, state.conflicts, state.isDemoMode, state.decisionMode]);

  // Restore history item
  const restoreVerdict = (item: ArchiveItem) => {
    setState({
      stage: 'verdict_ready',
      query: item.query,
      category: item.category as any,
      resolvedSources: item.resolvedSources,
      conflicts: item.conflicts,
      verdict: item.verdict,
      isDemoMode: item.isDemoMode,
      decisionMode: item.decisionMode,
      sourcesScanned: item.resolvedSources.map(s => s.source)
    });
    setIsArchiveOpen(false);
  };

  // Delete archive item
  const deleteVerdict = (id: string) => {
    setHistory(prev => {
      const updated = prev.filter(item => item.id !== id);
      localStorage.setItem('verdict_archive_v1', JSON.stringify(updated));
      return updated;
    });
  };

  // Clear all history
  const clearAllHistory = () => {
    setHistory([]);
    localStorage.removeItem('verdict_archive_v1');
  };

  // Toggle bookmark
  const toggleBookmarkHistory = (id: string) => {
    setHistory(prev => {
      const updated = prev.map(item => {
        if (item.id === id) {
          return { ...item, isBookmarked: !item.isBookmarked };
        }
        return item;
      });
      localStorage.setItem('verdict_archive_v1', JSON.stringify(updated));
      return updated;
    });
  };

  // Check if current verdict is bookmarked
  const isCurrentBookmarked = React.useMemo(() => {
    if (!state.query) return false;
    const queryClean = state.query.toLowerCase().trim();
    const item = history.find(h => h.query.toLowerCase().trim() === queryClean);
    return item ? item.isBookmarked : false;
  }, [history, state.query]);

  // Toggle bookmark on current verdict
  const handleToggleCurrentBookmark = () => {
    if (!state.query || !state.verdict) return;
    const queryClean = state.query.toLowerCase().trim();
    const exists = history.find(h => h.query.toLowerCase().trim() === queryClean);

    if (exists) {
      toggleBookmarkHistory(exists.id);
    } else {
      // Add and bookmark immediately
      setHistory(prev => {
        const newItem: ArchiveItem = {
          id: Math.random().toString(36).substring(2, 11),
          query: state.query,
          timestamp: Date.now(),
          category: state.category || 'CAREER',
          decisionMode: state.decisionMode || 'Balanced',
          verdict: state.verdict!,
          resolvedSources: state.resolvedSources,
          conflicts: state.conflicts,
          isBookmarked: true,
          isDemoMode: state.isDemoMode
        };
        const updated = [newItem, ...prev];
        localStorage.setItem('verdict_archive_v1', JSON.stringify(updated));
        return updated;
      });
    }
  };

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlQuery = params.get('q') || params.get('query');
      const mode = params.get('mode') || undefined;
      if (urlQuery && urlQuery.trim() !== '') {
        startStream(urlQuery, undefined, mode);
      }
    }
  }, [startStream]);
  const showLoading = !showInput && stage !== 'verdict_ready' && stage !== 'done' && stage !== 'error';
  const showResults = stage === 'verdict_ready' || stage === 'done';
  const showError = stage === 'error';

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center py-10 px-4 md:px-8 selection:bg-indigo-500/30 overflow-hidden bg-[#06060A] text-slate-100 font-sans bg-grid">
      {/* 1. Premium Animated Glowing Ambient Backgrounds */}
      <GlowingGlow />

      {/* Micro Overlay for establishing connection */}
      {isConnecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-page-fade-in">
          <div className="glass p-6 px-8 rounded-2xl border border-indigo-500/20 shadow-[0_0_50px_rgba(99,102,241,0.15)] flex flex-col items-center space-y-4 max-w-xs text-center animate-card-entry select-none">
            <div className="relative w-12 h-12 flex items-center justify-center bg-indigo-500/10 rounded-full border border-indigo-500/20">
              <span className="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping" />
              <span className="text-xl animate-connecting">⚡</span>
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-extrabold tracking-widest text-white font-mono uppercase">
                Connecting to Wire
              </h4>
              <p className="text-[9px] text-indigo-400 font-mono uppercase tracking-widest animate-pulse">
                Establishing live pipeline...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 2. Top Navigation Bar */}
      <header className="absolute top-0 inset-x-0 h-20 w-full max-w-7xl mx-auto px-6 md:px-8 flex items-center justify-between z-20">
        <div className="flex items-center space-x-2.5 group cursor-pointer" onClick={resetStream}>
          <Image
            src="/logo.png"
            alt="VERDICT Logo"
            width={36}
            height={36}
            className="rounded-xl shadow-[0_0_15px_rgba(124,58,237,0.4)] transition-all duration-300 group-hover:scale-105"
          />
          <span className="font-display font-extrabold text-[var(--text-md)] tracking-[var(--tracking-wide)] text-white select-none">
            VERDICT
          </span>
          <span className="px-2 py-0.5 border border-[var(--accent-purple)] bg-[var(--accent-purple-glow)] rounded-[2px] text-[11px] font-medium font-mono tracking-[0.1em] text-[var(--text-primary)] select-none">
            BETA
          </span>
        </div>
        
        <div className="flex items-center space-x-5 select-none">
          <button
            onClick={() => setIsArchiveOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-[6px] bg-white/2 border border-[var(--border-default)] hover:border-[var(--accent-purple)] hover:bg-[var(--accent-purple-glow)] text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all active:scale-95 cursor-pointer font-mono"
          >
            <span className={history.length > 0 ? "animate-archive-pulse" : ""}>📜</span>
            <span>ARCHIVE ({history.length})</span>
          </button>
          
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[13px] font-mono text-[var(--text-secondary)] hover:text-white transition-colors"
          >
            GitHub
          </a>
          
          {/* Pulsing Dot & LIVE stamp */}
          <div className="flex items-center space-x-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-live-pulse absolute inline-flex h-full w-full rounded-full bg-[var(--success)] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--success)]" />
            </span>
            <span className="font-mono text-[11px] font-bold text-[var(--success)] uppercase tracking-widest">
              LIVE
            </span>
          </div>
        </div>
      </header>

      {/* 3. Main Dashboard Core Wrapper */}
      <main className="flex-1 w-full max-w-5xl mx-auto flex flex-col justify-center items-center z-10 pt-24">
        
        {/* State View 1: Centered dilemma query launcher */}
        {showInput && (
          <div className="w-full animate-page-fade-in">
            <VerdictInput onSubmit={startStream} disabled={isStreaming} />
          </div>
        )}

        {/* State View 2: SSE pipeline activity & search loading states */}
        {showLoading && (
          <div className="w-full animate-page-fade-in">
            <SkeletonLoader 
              stage={stage} 
              sourcesScanned={state.sourcesScanned} 
              resolvedSources={state.resolvedSources} 
              category={state.category}
              isDemoMode={state.isDemoMode}
              liveConfidence={state.liveConfidence}
              confidenceHistory={state.confidenceHistory}
              failedSources={state.failedSources}
            />
          </div>
        )}

        {/* State View 3: Synthesized structured results layout */}
        {showResults && (
          <div className="w-full animate-page-fade-in">
            <VerdictDisplay 
              state={state} 
              onReset={resetStream} 
              onFollowUp={startStream} 
              isBookmarked={isCurrentBookmarked}
              onToggleBookmark={handleToggleCurrentBookmark}
            />
          </div>
        )}

        {/* State View 4: Error Handling Screen */}
        {showError && (
          <div className="w-full max-w-md mx-auto glass p-6 md:p-8 rounded-3xl border border-rose-500/15 text-center space-y-6 animate-page-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-rose-950/30 border border-rose-500/20 flex items-center justify-center text-rose-400 text-2xl mx-auto">
              ⚠️
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white">Pipeline Execution Disrupted</h2>
              <p className="text-xs md:text-sm text-slate-400 leading-relaxed">
                {errorMessage || "We encountered a socket timeout fanning out to Wire services."}
              </p>
            </div>
            <div className="flex space-x-3 pt-2">
              <button
                onClick={() => startStream(state.query, undefined, undefined, state.isDemoMode)}
                className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-xs font-semibold text-white transition-all shadow-[0_0_15px_rgba(99,102,241,0.2)]"
              >
                Retry Request
              </button>
              <button
                onClick={resetStream}
                className="flex-1 py-3 px-4 rounded-xl bg-white/5 border border-white/5 text-xs font-semibold text-white/80 hover:bg-white/10 transition-all active:scale-95"
              >
                Start Over
              </button>
            </div>
          </div>
        )}
      </main>

      {/* 4. Footer Brand Info */}
      <footer className="absolute bottom-6 inset-x-0 w-full text-center text-[10px] font-mono tracking-wider text-white/20 select-none z-10 uppercase">
        Powered by Anakin Wire API · Google Gemini · Real-time decision intelligence
      </footer>

      {/* 5. Personal Intelligence Slide-out Drawer Component */}
      <IntelligenceArchive
        isOpen={isArchiveOpen}
        onClose={() => setIsArchiveOpen(false)}
        items={history}
        onRestore={restoreVerdict}
        onDelete={deleteVerdict}
        onClearAll={clearAllHistory}
        onToggleBookmark={toggleBookmarkHistory}
      />
    </div>
  );
}
