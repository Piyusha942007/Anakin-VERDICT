'use client';

import React, { useState } from 'react';
import { ArchiveItem } from '../types/index.js';

interface IntelligenceArchiveProps {
  isOpen: boolean;
  onClose: () => void;
  items: ArchiveItem[];
  onRestore: (item: ArchiveItem) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
  onToggleBookmark: (id: string) => void;
}

export function IntelligenceArchive({
  isOpen,
  onClose,
  items,
  onRestore,
  onDelete,
  onClearAll,
  onToggleBookmark
}: IntelligenceArchiveProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [showOnlyBookmarks, setShowOnlyBookmarks] = useState(false);
  const [selectedCompareIds, setSelectedCompareIds] = useState<string[]>([]);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);

  if (!isOpen) return null;

  // Utility to format timestamps nicely
  const formatTimestamp = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(ts).toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Filter items
  const filteredItems = items.filter(item => {
    const matchesSearch = item.query.toLowerCase().includes(search.toLowerCase()) || 
                          (item.verdict?.verdict || '').toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'ALL' || item.category === selectedCategory;
    const matchesBookmark = !showOnlyBookmarks || item.isBookmarked;
    return matchesSearch && matchesCategory && matchesBookmark;
  });

  // Handle comparison selection
  const handleToggleCompare = (id: string) => {
    setSelectedCompareIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(item => item !== id);
      }
      if (prev.length >= 2) {
        // Swap last selected
        return [prev[1], id];
      }
      return [...prev, id];
    });
  };

  // Get selected items for comparison
  const compareItems = items.filter(item => selectedCompareIds.includes(item.id));

  return (
    <div className="fixed inset-y-0 right-0 w-full md:w-[500px] bg-[#07070C]/95 backdrop-blur-xl border-l border-white/10 z-50 flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.8)] animate-page-fade-in font-sans">
      {/* Header section */}
      <div className="p-6 border-b border-white/5 flex items-center justify-between select-none">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="p-1 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs">📜</span>
            <h2 className="text-base font-bold tracking-widest text-indigo-400 font-mono uppercase">
              Intelligence Archive
            </h2>
          </div>
          <p className="text-xs text-slate-500 uppercase tracking-wider font-mono">
            Personal Decision Repository ({filteredItems.length} records)
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full bg-white/5 border border-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-all duration-150 text-sm active:scale-90"
        >
          ✕
        </button>
      </div>

      {/* Filter and Search HUD */}
      <div className="p-5 border-b border-white/5 space-y-4">
        {/* Terminal search box */}
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search past decisions & verdicts..."
            className="w-full bg-[#030305] border border-white/5 focus:border-indigo-500/25 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-all duration-200"
          />
          {search && (
            <button 
              onClick={() => setSearch('')}
              className="absolute right-3 top-2.5 text-xs text-slate-500 hover:text-white"
            >
              Clear
            </button>
          )}
        </div>

        {/* Quick Category Badges */}
        <div className="flex flex-wrap gap-1.5 select-none font-mono text-xs font-bold">
          {['ALL', 'CAREER', 'PURCHASE', 'FINANCE', 'EDUCATION'].map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1.5 rounded-lg border transition-all ${
                  isActive
                    ? 'text-white bg-indigo-500/15 border-indigo-500/30'
                    : 'text-slate-500 border-white/5 hover:text-slate-300 hover:border-white/10'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Bookmark Filters and Clear Action */}
        <div className="flex items-center justify-between text-xs select-none font-mono text-slate-500">
          <button
            type="button"
            onClick={() => setShowOnlyBookmarks(prev => !prev)}
            className={`flex items-center space-x-1.5 px-2 py-1 rounded transition-colors ${
              showOnlyBookmarks ? 'text-indigo-400 bg-indigo-500/5' : 'hover:text-slate-300'
            }`}
          >
            <span>⭐️</span>
            <span>Bookmarks Only</span>
          </button>

          {items.length > 0 && (
            <button
              onClick={() => {
                if (confirm('Are you sure you want to wipe the entire decision archive?')) {
                  onClearAll();
                }
              }}
              className="hover:text-rose-400 transition-colors flex items-center space-x-1"
            >
              <span>🗑️</span>
              <span>Wipe Archive</span>
            </button>
          )}
        </div>
      </div>

      {/* Comparison Drawer Trigger Bar (glowing footer anchor if 2 selected) */}
      {selectedCompareIds.length > 0 && (
        <div className="bg-indigo-950/20 border-b border-indigo-500/10 p-3 px-5 flex items-center justify-between text-sm select-none">
          <div className="flex items-center space-x-2 text-indigo-300 font-mono text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
            <span>COMPARISON SANDBOX: {selectedCompareIds.length}/2 SELECT</span>
          </div>
          {selectedCompareIds.length === 2 ? (
            <button
              onClick={() => setIsCompareModalOpen(true)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-xs font-bold font-mono text-white rounded-lg transition-all active:scale-95 shadow-[0_0_15px_rgba(99,102,241,0.3)] animate-pulse"
            >
              ⚖️ COMPARE DECISIONS
            </button>
          ) : (
            <span className="text-xs text-slate-500 italic font-mono">Select 1 more to compare</span>
          )}
        </div>
      )}

      {/* Archive List Container */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-thin">
        {filteredItems.length === 0 ? (
          <div className="text-center py-16 space-y-3 font-mono">
            <span className="text-2xl opacity-30">📁</span>
            <div className="text-xs text-slate-500">No matching historical files found.</div>
            <div className="text-[9px] text-slate-600">Decide on dilemas to automatically seed logs.</div>
          </div>
        ) : (
          filteredItems.map((item) => {
            const isComparing = selectedCompareIds.includes(item.id);
            const score = item.verdict?.confidence || 80;
            const ratingColor = 
              score >= 80 ? 'text-emerald-400 bg-emerald-500/5 border-emerald-500/15' :
              score >= 55 ? 'text-amber-400 bg-amber-500/5 border-amber-500/15' :
              'text-rose-400 bg-rose-500/5 border-rose-500/15';

            return (
              <div
                key={item.id}
                className={`glass p-4.5 rounded-2xl border transition-all duration-300 flex flex-col space-y-3 relative group hover:border-white/10 ${
                  isComparing ? 'border-indigo-500/35 bg-indigo-950/2' : 'border-white/5'
                }`}
              >
                {/* Action overlays on hover */}
                <div className="absolute top-3.5 right-3.5 flex items-center space-x-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => onToggleBookmark(item.id)}
                    className={`w-6 h-6 rounded-lg bg-white/3 border border-white/5 hover:border-indigo-500/25 flex items-center justify-center text-xs transition-all duration-100 ${
                      item.isBookmarked ? 'text-amber-400 bg-amber-500/5 border-amber-500/10' : 'text-slate-500 hover:text-slate-300'
                    }`}
                    title="Bookmark verdict"
                  >
                    ★
                  </button>
                  <button
                    onClick={() => onDelete(item.id)}
                    className="w-6 h-6 rounded-lg bg-white/3 border border-white/5 hover:border-rose-500/25 flex items-center justify-center text-[10px] text-slate-500 hover:text-rose-400 transition-all duration-100"
                    title="Wipe record"
                  >
                    🗑️
                  </button>
                </div>

                {/* Meta details & checkbox row */}
                <div className="flex items-center justify-between select-none">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={isComparing}
                      onChange={() => handleToggleCompare(item.id)}
                      className="rounded border-white/10 bg-transparent text-indigo-600 focus:ring-0 cursor-pointer h-3.5 w-3.5"
                      title="Add to Compare Sandbox"
                    />
                    <span className="text-xs font-mono font-bold text-slate-500 uppercase tracking-widest">
                      {formatTimestamp(item.timestamp)}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1.5 font-mono text-xs font-bold">
                    {item.isDemoMode && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400">
                        SIM
                      </span>
                    )}
                    <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/5 text-slate-400">
                      {item.decisionMode}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded border ${ratingColor}`}>
                      {score}%
                    </span>
                  </div>
                </div>

                {/* Dilemma Question link */}
                <button
                  onClick={() => onRestore(item)}
                  className="text-left font-bold text-slate-200 hover:text-indigo-400 text-sm md:text-base leading-snug cursor-pointer transition-colors"
                >
                  "{item.query}"
                </button>

                {/* Brief preview of the verdict recommendation */}
                <div className="p-2.5 rounded-xl bg-white/2 border border-white/3 text-sm text-slate-400 leading-normal line-clamp-2">
                  <span className="font-bold text-slate-300 block mb-0.5 font-mono text-xs">DIRECT RECOMMENDATION:</span>
                  {item.verdict?.verdict}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 8. Comparison Sandbox Side-By-Side Modal Overlay */}
      {isCompareModalOpen && compareItems.length === 2 && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4 md:p-6 animate-page-fade-in font-sans">
          <div className="glass max-w-4xl w-full rounded-3xl border border-white/10 p-6 md:p-8 space-y-6 relative flex flex-col shadow-[0_20px_50px_rgba(0,0,0,0.6)] max-h-[90vh]">
            
            <button 
              onClick={() => setIsCompareModalOpen(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 border border-white/5 text-slate-400 hover:text-white flex items-center justify-center transition-all hover:bg-white/10 text-sm font-extrabold active:scale-95 duration-100"
            >
              ✕
            </button>

            {/* Sandbox Headings */}
            <div className="space-y-1 text-center select-none">
              <h3 className="text-sm font-bold tracking-widest text-indigo-400 font-mono uppercase">
                ⚖️ Decision Comparison Sandbox
              </h3>
              <p className="text-xs text-slate-500 uppercase tracking-wide">
                Side-by-Side contrast of past advisor reports
              </p>
            </div>

            {/* Comparison Grid layout */}
            <div className="grid grid-cols-2 gap-4 md:gap-6 overflow-y-auto pr-1 flex-1 py-2 scrollbar-thin">
              {compareItems.map((item, idx) => {
                const conf = item.verdict?.confidence || 80;
                const strokeColor = 
                  conf >= 80 ? 'text-emerald-400' :
                  conf >= 55 ? 'text-amber-400' :
                  'text-rose-400';
                
                const cardBorder = 
                  conf >= 80 ? 'border-emerald-500/10 bg-emerald-950/2' :
                  conf >= 55 ? 'border-amber-500/10 bg-amber-950/2' :
                  'border-rose-500/10 bg-rose-950/2';

                return (
                  <div key={item.id} className="space-y-5 text-left">
                    {/* Dilemma Question Badge */}
                    <div className="space-y-1.5">
                      <span className="text-xs font-bold font-mono tracking-widest text-indigo-400 uppercase select-none block">
                        Dilemma Query #{idx + 1}:
                      </span>
                      <h4 className="text-base font-extrabold text-white leading-snug">
                        "{item.query}"
                      </h4>
                      <div className="flex items-center space-x-1.5 text-xs font-bold font-mono text-slate-500 select-none">
                        <span>MODE: {item.decisionMode}</span>
                        <span>•</span>
                        <span>{formatTimestamp(item.timestamp)}</span>
                      </div>
                    </div>

                    {/* Consensus Gauge & Score Box */}
                    <div className={`p-4 rounded-2xl border ${cardBorder} flex items-center justify-between`}>
                      <div className="text-left font-mono">
                        <span className={`text-[10px] font-extrabold block tracking-wider ${strokeColor}`}>
                          {conf}% CONFIDENCE
                        </span>
                        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block mt-0.5">
                          Consensus Index
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold uppercase border ${
                        conf >= 80 ? 'text-emerald-400/90 border-emerald-500/20 bg-emerald-500/5' :
                        conf >= 55 ? 'text-amber-400/90 border-amber-500/20 bg-amber-500/5' :
                        'text-rose-400/90 border-rose-500/20 bg-rose-500/5'
                      }`}>
                        {conf >= 80 ? '🎯 High' : conf >= 55 ? '⚖️ Medium' : '⚠️ Low'}
                      </span>
                    </div>

                    {/* Final Verdict Summary */}
                    <div className="p-4.5 rounded-2xl border border-indigo-500/15 bg-indigo-500/5 space-y-2">
                      <span className="text-xs font-bold font-mono text-indigo-300 uppercase tracking-widest select-none block">
                        🎯 Direct Verdict Recommendation:
                      </span>
                      <p className="text-sm font-bold text-slate-100 leading-relaxed font-sans">
                        {item.verdict?.verdict}
                      </p>
                    </div>

                    {/* Analytical Reasoning summary */}
                    <div className="space-y-1.5">
                      <span className="text-xs font-bold font-mono text-slate-500 uppercase tracking-widest select-none block">
                        🛡️ Core Tradeoffs & Reasoning:
                      </span>
                      <p className="text-sm text-slate-400 leading-relaxed font-sans max-h-[140px] overflow-y-auto scrollbar-thin pr-1">
                        {item.verdict?.reasoning}
                      </p>
                    </div>

                    {/* Sources Scanned List */}
                    <div className="space-y-2 pt-2 border-t border-white/5 select-none">
                      <span className="text-[8px] font-bold font-mono text-slate-500 uppercase tracking-widest block">
                        📊 Attributable Sources Footprint:
                      </span>
                      <div className="flex flex-wrap gap-1.5 font-mono text-[8px] font-bold">
                        {item.resolvedSources.map(src => (
                          <span key={src.source} className="px-1.5 py-0.5 rounded bg-white/5 border border-white/5 text-slate-400 uppercase">
                            ✓ {src.source} ({src.latencyMs}ms)
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Sandbox footer actions */}
            <div className="pt-2 border-t border-white/5 flex justify-end space-x-3 select-none">
              <button
                onClick={() => {
                  setSelectedCompareIds([]);
                  setIsCompareModalOpen(false);
                }}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-xs font-bold text-white transition-all active:scale-95"
              >
                Clear Selection
              </button>
              <button
                onClick={() => {
                  onRestore(compareItems[0]);
                  setIsCompareModalOpen(false);
                  onClose();
                }}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition-all shadow-[0_0_15px_rgba(99,102,241,0.2)] active:scale-95"
              >
                Load Dilemma #1 Report
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

export default IntelligenceArchive;
