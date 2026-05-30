'use client';

import React, { useState, useEffect, useRef } from 'react';

interface VerdictInputProps {
  onSubmit: (query: string, context?: any, decisionMode?: string, isDemoMode?: boolean) => void;
  disabled: boolean;
}

const PLACEHOLDERS = [
  "Ask anything — job offer, gadget, investment...",
  "e.g., Scaler vs self-study for a CS fresher?",
  "e.g., boAt Airdopes 141 — buy now or wait?",
  "e.g., Is a funded startup safer than Infosys?",
  "e.g., Should I invest in Nifty50 right now?"
];

const SUGGESTIONS = [
  "Scaler vs self-study for a CS fresher?",
  "boAt Airdopes 141 — buy now or wait?",
  "Is a funded startup safer than Infosys?",
  "Should I invest in Nifty50 right now?"
];

export function VerdictInput({ onSubmit, disabled }: VerdictInputProps) {
  const [query, setQuery] = useState('');
  const [decisionMode, setDecisionMode] = useState<'Conservative' | 'Balanced' | 'Aggressive' | 'Long-Term' | 'Risk-Averse'>('Balanced');
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);

  const quoteRef = useRef<HTMLDivElement>(null);
  const [isQuoteVisible, setIsQuoteVisible] = useState(false);

  // Rotate placeholder every 3.5s
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIdx(prev => (prev + 1) % PLACEHOLDERS.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  // Intersection Observer for Slide-in Quote Bar
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsQuoteVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );
    if (quoteRef.current) {
      observer.observe(quoteRef.current);
    }
    return () => observer.disconnect();
  }, []);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (query.trim() === '' || disabled) return;
    onSubmit(query, undefined, decisionMode, isDemoMode);
  };

  const handleSuggestionClick = (text: string) => {
    if (disabled) return;
    setQuery(text);
    setTimeout(() => {
      onSubmit(text, undefined, decisionMode, isDemoMode);
    }, 300);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-10 text-center px-4 z-10 relative">

      {/* ── 1. Brand Tag Pill ── */}
      <div 
        className="inline-flex items-center space-x-2.5 px-3.5 py-1.5 rounded-full border border-[var(--border-default)] bg-[var(--bg-elevated)] shadow-sm animate-stagger-reveal"
        style={{ animationDelay: '0.0s', animationFillMode: 'forwards' }}
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-live-pulse absolute inline-flex h-full w-full rounded-full bg-[var(--accent-cyan)] opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--accent-cyan)]" />
        </span>
        <span className="text-[12px] font-bold tracking-[var(--tracking-wide)] text-[var(--text-primary)] font-mono uppercase">
          VERDICT — DECISION INTELLIGENCE ENGINE
        </span>
      </div>

      {/* ── 2. Headline ── */}
      <div className="space-y-4">
        <h1 className="text-[42px] md:text-[var(--text-hero)] font-display font-extrabold text-[var(--text-primary)] leading-[var(--leading-tight)] tracking-[var(--tracking-tight)] select-none flex justify-center flex-wrap gap-x-4">
          <span className="inline-block animate-stagger-reveal" style={{ animationDelay: '0.1s', animationFillMode: 'forwards' }}>Stop</span>
          <span className="inline-block animate-stagger-reveal" style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}>deciding</span>
          <span className="inline-block animate-stagger-reveal" style={{ animationDelay: '0.3s', animationFillMode: 'forwards' }}>on</span>
          <span className="inline-block animate-stagger-reveal" style={{ animationDelay: '0.4s', animationFillMode: 'forwards' }}>vibes.</span>
        </h1>

        {/* ── 3. Subtitle ── */}
        <div 
          className="space-y-2 opacity-0 animate-stagger-reveal select-none"
          style={{ animationDelay: '0.7s', animationFillMode: 'forwards' }}
        >
          <p className="text-[13px] md:text-[14px] font-mono text-[var(--text-secondary)] tracking-wide">
            Google gives you ads. &nbsp;•&nbsp; Reddit is 3 years old. &nbsp;•&nbsp; AI guesses.
          </p>
          <p className="text-[17px] md:text-[18px] font-sans font-medium text-[var(--text-primary)]">
            VERDICT pulls <span className="text-[var(--accent-cyan)] font-bold">live evidence</span> from 8 sources right now.
          </p>
        </div>
      </div>

      {/* ── 4. Problem Cards ── */}
      <div 
        className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto opacity-0 animate-stagger-reveal select-none"
        style={{ animationDelay: '0.9s', animationFillMode: 'forwards' }}
      >
        {/* Card 1 */}
        <div className="glass-interactive p-6 rounded-[8px] border border-[var(--border-subtle)] text-left flex flex-col justify-between space-y-3 cursor-default">
          <div className="space-y-2">
            <span className="text-[10px] font-bold font-mono tracking-[0.12em] text-[var(--accent-purple)] uppercase block">THE INDEX</span>
            <h3 className="text-[20px] font-display font-bold text-[var(--text-primary)] leading-snug">
              Google gives you ads.
            </h3>
            <p className="text-[14px] leading-relaxed text-[var(--text-secondary)]">
              Sponsored links, SEO farms, and duplicate affiliate blogs dominate your results. No signals.
            </p>
          </div>
        </div>

        {/* Card 2 */}
        <div className="glass-interactive p-6 rounded-[8px] border border-[var(--border-subtle)] text-left flex flex-col justify-between space-y-3 cursor-default">
          <div className="space-y-2">
            <span className="text-[10px] font-bold font-mono tracking-[0.12em] text-[var(--accent-purple)] uppercase block">THE ARCHIVE</span>
            <h3 className="text-[20px] font-display font-bold text-[var(--text-primary)] leading-snug">
              Reddit is outdated.
            </h3>
            <p className="text-[14px] leading-relaxed text-[var(--text-secondary)]">
              Stagnant 3-year-old threads, deleted feedback, and stale user opinions leave you with old context.
            </p>
          </div>
        </div>

        {/* Card 3 */}
        <div className="glass-interactive p-6 rounded-[8px] border border-[var(--border-subtle)] text-left flex flex-col justify-between space-y-3 cursor-default">
          <div className="space-y-2">
            <span className="text-[10px] font-bold font-mono tracking-[0.12em] text-[var(--accent-purple)] uppercase block">THE SYNTHESIS</span>
            <h3 className="text-[20px] font-display font-bold text-[var(--text-primary)] leading-snug">
              AI guesses.
            </h3>
            <p className="text-[14px] leading-relaxed text-[var(--text-secondary)]">
              Static training checkpoints, lack of current wage rates, and generic formatting dilute execution accuracy.
            </p>
          </div>
        </div>
      </div>

      {/* ── 5. Intersection Observer Quote Bar ── */}
      <div 
        ref={quoteRef}
        className={`max-w-3xl mx-auto py-4 pl-5 border-l-3 border-[var(--accent-cyan)] text-left bg-[rgba(6,182,212,0.02)] transition-all duration-700 ease-out select-none ${
          isQuoteVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-5'
        }`}
      >
        <p className="text-[17px] md:text-[18px] font-sans font-medium text-[var(--text-primary)] leading-relaxed">
          VERDICT pulls live evidence from multiple sources in parallel, then delivers{' '}
          <a 
            href="#search" 
            className="text-[var(--accent-cyan)] font-bold transition-all hover:underline"
          >
            one clear recommendation.
          </a>
        </p>
      </div>

      {/* ── 6. Search Input Area (Centerpiece) ── */}
      <div 
        id="search"
        className="max-w-2xl mx-auto space-y-3 opacity-0 animate-stagger-reveal text-left"
        style={{ animationDelay: '1.3s', animationFillMode: 'forwards' }}
      >
        <form onSubmit={handleSubmit} className="w-full">
          <div className="relative flex items-center bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-[8px] p-2 focus-within:border-[var(--accent-purple)] focus-within:shadow-[0_0_0_3px_var(--accent-purple-glow),0_0_30px_rgba(124,58,237,0.1)] transition-all duration-200">
            
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={disabled}
              placeholder={PLACEHOLDERS[placeholderIdx]}
              maxLength={200}
              className="w-full pl-4 pr-16 py-3.5 bg-transparent border-0 outline-none text-[var(--text-primary)] font-sans font-medium text-[16px] placeholder-[var(--text-tertiary)] disabled:opacity-50"
            />
            
            {/* Character count indicator */}
            {query.length > 0 && (
              <span className="absolute right-36 md:right-40 font-mono text-[11px] text-[var(--text-tertiary)] select-none">
                {query.length}/200
              </span>
            )}

            <button
              type="submit"
              disabled={disabled || query.trim() === ''}
              className="px-5 py-3 rounded-[6px] bg-[var(--accent-purple)] hover:brightness-[1.1] hover:-translate-y-[1px] active:scale-[0.98] disabled:scale-100 font-sans font-semibold text-[14px] text-white transition-all duration-150 disabled:opacity-20 disabled:pointer-events-none cursor-pointer flex items-center justify-center min-w-[120px]"
            >
              {disabled ? (
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                "Get Verdict →"
              )}
            </button>
          </div>
        </form>

        {/* ── Clickable Suggestion Chips ── */}
        <div className="flex flex-wrap gap-2 pt-1 select-none">
          {SUGGESTIONS.map((sug, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSuggestionClick(sug)}
              disabled={disabled}
              className="font-sans text-[13px] font-medium border border-[var(--border-default)] hover:border-[var(--accent-purple)] hover:bg-[var(--accent-purple-glow)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-[4px] px-3 py-1.5 transition-all duration-150 cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
            >
              {sug}
            </button>
          ))}
        </div>
      </div>

      {/* ── 7. Demo & Lens Controls (Bottom section) ── */}
      <div 
        className="space-y-6 select-none opacity-0 animate-stagger-reveal"
        style={{ animationDelay: '1.5s', animationFillMode: 'forwards' }}
      >
        {/* Demo Mode Toggle (Promoted to elegant hero button) */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setIsDemoMode(!isDemoMode)}
            disabled={disabled}
            className={`relative flex items-center space-x-2.5 px-5 py-2.5 rounded-full border transition-all duration-300 active:scale-95 text-xs font-mono font-bold tracking-widest cursor-pointer overflow-hidden ${
              isDemoMode
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                : 'bg-white/2 border-white/8 text-slate-400 hover:text-white hover:border-white/15'
            }`}
          >
            {isDemoMode && (
              <span className="absolute inset-0 animate-wire-sweep pointer-events-none rounded-full" />
            )}
            <span className={`relative w-2 h-2 rounded-full flex-shrink-0 ${isDemoMode ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-slate-600'}`} />
            <span className="relative">
              {isDemoMode ? '⚡ JUDGE DEMO MODE ACTIVE — Stable Mock Responses' : '⚡ ACTIVATE JUDGE DEMO MODE'}
            </span>
          </button>
        </div>

        {/* Decision Mode Selector (Sharp and segment style) */}
        <div className="flex flex-col items-center space-y-3">
          <span className="text-[10px] font-bold font-mono tracking-[var(--tracking-wide)] text-[var(--text-tertiary)] uppercase">
            ADVISOR LENS — CHOOSE YOUR DECISION MODE:
          </span>
          <div className="relative flex p-1 glass-premium rounded-2xl w-full max-w-2xl font-mono text-[10px] font-bold text-[var(--text-secondary)]">
            {(['Conservative', 'Balanced', 'Aggressive', 'Long-Term', 'Risk-Averse'] as const).map((mode) => {
              const isActive = decisionMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setDecisionMode(mode)}
                  disabled={disabled}
                  className={`flex-1 py-2.5 rounded-xl transition-all duration-200 active:scale-95 uppercase tracking-wider relative z-10 cursor-pointer text-[9px] md:text-[10px] ${
                    isActive
                      ? 'text-[var(--text-primary)] bg-[var(--bg-elevated)] border border-[var(--border-default)] shadow-[0_0_15px_rgba(99,102,241,0.08)]'
                      : 'hover:text-[var(--text-primary)] hover:bg-white/3'
                  }`}
                >
                  {mode}
                </button>
              );
            })}
          </div>
        </div>
      </div>

    </div>
  );
}

export default VerdictInput;
