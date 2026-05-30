'use client';

import React, { useEffect, useState, useRef } from 'react';
import { VerdictState, ConflictResolved, ConfidenceItem, WireSourceResult, FailedSource } from '../types/index.js';

interface VerdictDisplayProps {
  state: VerdictState;
  onReset: () => void;
  onFollowUp?: (query: string, context?: any) => void;
  isBookmarked?: boolean;
  onToggleBookmark?: () => void;
}

function getSourceIcon(sourceName: string) {
  const name = sourceName.toLowerCase();

  if (name.includes('reddit')) {
    return (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8a2 2 0 1 0-2 2h4a2 2 0 1 0-2-2z" />
        <line x1="12" y1="12" x2="12" y2="16" />
        <circle cx="8" cy="15" r="1" />
        <circle cx="16" cy="15" r="1" />
      </svg>
    );
  }
  if (name.includes('glassdoor')) {
    return (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3h18v18H3z" />
        <path d="M8 8h8v8H8z" />
        <path d="M12 3v18" />
        <path d="M3 12h18" />
      </svg>
    );
  }
  if (name.includes('blind')) {
    return (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        <circle cx="9" cy="10" r="1" />
        <circle cx="15" cy="10" r="1" />
      </svg>
    );
  }
  if (name.includes('linkedin')) {
    return (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
        <rect x="2" y="9" width="4" height="12" />
        <circle cx="4" cy="4" r="2" />
      </svg>
    );
  }
  if (name.includes('amazon') || name.includes('flipkart') || name.includes('purchase')) {
    return (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
    );
  }
  if (name.includes('moneycontrol') || name.includes('screener') || name.includes('finance') || name.includes('stock')) {
    return (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    );
  }
  if (name.includes('shiksha') || name.includes('placement') || name.includes('education')) {
    return (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
        <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
      </svg>
    );
  }
  if (name.includes('youtube')) {
    return (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
        <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
      </svg>
    );
  }
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  );
}

export function VerdictDisplay({ 
  state, 
  onReset, 
  onFollowUp,
  isBookmarked = false,
  onToggleBookmark
}: VerdictDisplayProps) {
  const { stage, verdict, resolvedSources, conflicts, query, isCached, failedSources } = state;
  
  const [typedVerdict, setTypedVerdict] = useState('');
  const [typedReasoning, setTypedReasoning] = useState('');
  const [headlineCompleted, setHeadlineCompleted] = useState(false);
  const [isExplainOpen, setIsExplainOpen] = useState(false);
  const [customFollowUp, setCustomFollowUp] = useState('');
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const [bookmarkClicked, setBookmarkClicked] = useState(false);
  const [shareGlow, setShareGlow] = useState(false);

  const ringRef = useRef<HTMLDivElement>(null);
  const [ringInView, setRingInView] = useState(false);

  const sensitivityRef = useRef<HTMLDivElement>(null);
  const [changesInView, setChangesInView] = useState(false);

  // Concentric ring drawing observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRingInView(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.1 }
    );
    if (ringRef.current) {
      observer.observe(ringRef.current);
    }
    return () => observer.disconnect();
  }, [verdict]);

  // Flip triggers observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setChangesInView(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.1 }
    );
    if (sensitivityRef.current) {
      observer.observe(sensitivityRef.current);
    }
    return () => observer.disconnect();
  }, [verdict?.flipConditions]);

  // 1. Client-Side High-Res Canvas Card Exporter (1200x630 Aspect Ratio)
  const exportCardAsImage = () => {
    if (!verdict) return;
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 630;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bgGrad = ctx.createLinearGradient(0, 0, 1200, 630);
    bgGrad.addColorStop(0, '#06060A');
    bgGrad.addColorStop(1, '#0C0C14');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1200, 630);

    ctx.fillStyle = 'rgba(99, 102, 241, 0.08)';
    ctx.beginPath();
    ctx.arc(600, 315, 450, 0, 2 * Math.PI);
    ctx.fill();

    ctx.fillStyle = 'rgba(139, 92, 246, 0.06)';
    ctx.beginPath();
    ctx.arc(1100, 100, 300, 0, 2 * Math.PI);
    ctx.fill();

    const drawRoundRect = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    };

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.fillStyle = 'rgba(10, 10, 16, 0.7)';
    drawRoundRect(100, 130, 1000, 370, 24);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('VERDICT ENGINE REPORT SYSTEM • DECISION ANALYSIS', 140, 80);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('VERDICT.APP', 1030, 80);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 32px sans-serif';
    
    const wrapText = (text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
      const words = text.split(' ');
      let line = '';
      let currentY = y;
      for (let n = 0; n < words.length; n++) {
        let testLine = line + words[n] + ' ';
        let metrics = ctx.measureText(testLine);
        let testWidth = metrics.width;
        if (testWidth > maxWidth && n > 0) {
          ctx.fillText(line, x, currentY);
          line = words[n] + ' ';
          currentY += lineHeight;
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line, x, currentY);
      return currentY;
    };
    wrapText(`"${query}"`, 140, 190, 920, 44);

    ctx.fillStyle = 'rgba(99, 102, 241, 0.08)';
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.2)';
    ctx.lineWidth = 1;
    drawRoundRect(140, 275, 920, 120, 16);

    ctx.fillStyle = '#A5B4FC';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('🎯 DIRECT VERDICT RECOMMENDATION', 170, 305);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 22px sans-serif';
    const recText = verdict.verdict.length > 70 ? verdict.verdict.slice(0, 70) + '...' : verdict.verdict;
    ctx.fillText(recText, 170, 350);

    ctx.fillStyle = 'rgba(16, 185, 129, 0.1)';
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.2)';
    drawRoundRect(140, 425, 230, 42, 8);
    ctx.fillStyle = '#34D399';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(`✓ CONSENSUS CONFIDENCE: ${conf}%`, 160, 450);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    let startX = 390;
    resolvedSources.slice(0, 3).forEach(src => {
      drawRoundRect(startX, 425, 150, 42, 8);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(`✓ ${src.source.toUpperCase()}`, startX + 15, 450);
      startX += 170;
    });

    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('POWERED BY ANAKIN WIRE API & GEMINI AI LENS', 100, 570);

    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `verdict_report_card.png`;
    link.href = dataUrl;
    link.click();
  };

  // Slice-based typewriter sync (Prevents character & word skipping)
  useEffect(() => {
    if (verdict?.verdict) {
      setTypedVerdict('');
      setTypedReasoning('');
      setHeadlineCompleted(false);
      
      let index = 0;
      const text = verdict.verdict;
      const interval = setInterval(() => {
        setTypedVerdict(text.slice(0, index + 1));
        index++;
        if (index >= text.length) {
          clearInterval(interval);
          setHeadlineCompleted(true);
        }
      }, 12);
      
      return () => clearInterval(interval);
    }
  }, [verdict?.verdict]);

  useEffect(() => {
    if (headlineCompleted && verdict?.reasoning) {
      const words = verdict.reasoning.split(' ');
      let wordIndex = 0;
      
      const interval = setInterval(() => {
        setTypedReasoning(words.slice(0, wordIndex + 1).join(' '));
        wordIndex++;
        if (wordIndex >= words.length) {
          clearInterval(interval);
        }
      }, 35);
      
      return () => clearInterval(interval);
    }
  }, [headlineCompleted, verdict?.reasoning]);

  if (stage !== 'verdict_ready' && stage !== 'done') return null;
  if (!verdict) return null;

  const conf = verdict.confidence || 80;

  // Resized concentric gauge metrics (30% larger dimensions)
  const radius = 28; // Increased from 22
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = ringInView ? circumference - (conf / 100) * circumference : circumference;

  const ratingCategory = 
    conf >= 80 ? '🎯 CONSENSUS HIGH' :
    conf >= 55 ? '⚖️ CONFLICTS FOUND' :
    '⚠️ STABLE UNCERTAINTY';

  const ratingBorderColor = 
    conf >= 80 ? 'border-emerald-500/20 bg-emerald-950/5' :
    conf >= 55 ? 'border-amber-500/20 bg-amber-950/5' :
    'border-rose-500/20 bg-rose-950/5';

  const strokeColor = 
    conf >= 80 ? 'text-emerald-500' :
    conf >= 55 ? 'text-amber-500' :
    'text-rose-500';

  // Dynamic fanning metric values
  const avgLatency = resolvedSources.length > 0 ? Math.round(resolvedSources.reduce((acc, s) => acc + s.latencyMs, 0) / resolvedSources.length) : 0;
  const cachedCount = isCached ? resolvedSources.length : 0;

  const handleBookmarkToggle = () => {
    setBookmarkClicked(true);
    setTimeout(() => setBookmarkClicked(false), 300);
    if (onToggleBookmark) onToggleBookmark();
  };

  const handleShareClick = () => {
    setShareGlow(true);
    setTimeout(() => setShareGlow(false), 400);
    setIsShareModalOpen(true);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 px-4 pb-24 z-10 relative select-none">
      
      {/* ── 1. Slim Breadcrumb Header ── */}
      <div className="flex items-center justify-between animate-card-entry select-none">
        <div className="flex items-center space-x-2.5 min-w-0 flex-1 mr-4 font-mono text-[14px]">
          <span className="relative w-2 h-2 flex-shrink-0">
            <span className="absolute inset-0 rounded-full bg-emerald-500/40 animate-ping" />
            <span className="w-2 h-2 rounded-full bg-emerald-500 absolute" />
          </span>
          <p className="truncate tracking-tight flex items-center space-x-2">
            <span className="text-[var(--text-secondary)] italic">"{query}"</span>
            <span className="text-[var(--text-tertiary)] font-bold">➔</span>
            
            {/* Pulsing Pill Ready Badge */}
            <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full border border-emerald-500/35 bg-emerald-500/10 text-emerald-400 text-[11px] font-bold tracking-wider uppercase scale-100 transition-all duration-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-live-pulse" />
              <span>VERDICT READY</span>
            </span>
          </p>
        </div>
        <button
          onClick={onReset}
          className="flex-shrink-0 px-3.5 py-1.5 border border-[var(--border-default)] hover:border-[var(--text-secondary)] rounded-xl font-sans font-medium text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all duration-150 -translate-x-0 hover:-translate-x-0.5 cursor-pointer active:scale-95"
        >
          ← New Query
        </button>
      </div>

      {/* ── 2. ⚡ BOTTOM LINE Card (Main Stage) ── */}
      {verdict.bottomLine && verdict.bottomLine.length > 0 && (
        <div 
          className="relative group animate-card-entry opacity-0 select-none mx-auto w-[88vw] max-w-[860px]"
          style={{ animationDelay: '0.0s', animationFillMode: 'forwards' }}
        >
          <div className="absolute -inset-0.5 bg-gradient-to-r from-[var(--accent-purple)] via-[var(--accent-cyan)] to-[var(--accent-purple)] rounded-3xl blur-md opacity-20 group-hover:opacity-35 transition duration-700 animate-pulse-live" />
          
          <div className="relative glass-premium p-8 md:p-10 rounded-3xl border border-[var(--accent-purple)]/30 overflow-hidden space-y-6 shadow-[0_0_60px_rgba(124,58,237,0.12),0_0_120px_rgba(124,58,237,0.05),inset 0 1px 0 rgba(255,255,255,0.04)]">
            <div className="absolute inset-0 bg-grid-white/[0.01] pointer-events-none" />
            <div className="absolute top-0 right-0 w-48 h-48 bg-[var(--accent-purple-glow)] rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center space-x-2.5 pb-2.5 border-b border-[var(--border-subtle)]">
              <span className="text-xl text-[var(--warning)] animate-pulse-live">⚡</span>
              <h3 className="text-[12px] font-bold tracking-[0.1em] text-[var(--accent-purple)] uppercase font-mono">
                BOTTOM LINE
              </h3>
            </div>

            <div className="space-y-4">
              {verdict.bottomLine.map((sentence, idx) => {
                const textLower = sentence.toLowerCase();
                const isStop = textLower.includes('halt') || textLower.includes('stop') || textLower.includes('avoid') || textLower.includes('decline') || textLower.includes('degrade') || textLower.includes('no ');
                const isGo = textLower.includes('go ') || textLower.includes('proceed') || textLower.includes('accept') || textLower.includes('buy') || textLower.includes('join') || textLower.includes('invest') || textLower.includes('purchase') || textLower.includes('worth');
                
                const dotColor = isStop ? 'var(--danger)' : isGo ? 'var(--success)' : 'var(--warning)';
                const stripBg = isStop ? 'rgba(239, 68, 68, 0.08)' : isGo ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)';

                return (
                  <div 
                    key={idx} 
                    className="flex items-center space-x-4 p-3.5 px-4 rounded-[8px] border-l-[3px] opacity-0 animate-stagger-reveal"
                    style={{
                      borderLeftColor: dotColor,
                      background: stripBg,
                      animationDelay: `${idx * 100}ms`,
                      animationFillMode: 'forwards'
                    }}
                  >
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />
                    <p className="font-sans font-semibold text-[18px] text-[var(--text-primary)] leading-normal tracking-wide flex-1">
                      {sentence}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Powered-by footer stamp */}
            <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between font-mono text-[10px] text-[var(--text-tertiary)] tracking-[0.08em] select-none uppercase">
              <span>Powered by Anakin Wire · Google Gemini</span>
              <span className="text-[var(--accent-purple)]/60 font-bold">VERDICT ENGINE</span>
            </div>
          </div>
        </div>
      )}

      {/* ── 3. Direct Verdict Summary Panel ── */}
      <div 
        className="glass-premium p-6 md:p-8 rounded-3xl relative overflow-hidden space-y-6 animate-card-entry opacity-0"
        style={{ animationDelay: '100ms', animationFillMode: 'forwards' }}
      >
        <div className={`absolute -top-24 -right-24 w-52 h-52 rounded-full blur-3xl opacity-15 pointer-events-none ${
          conf >= 80 ? 'bg-emerald-500' : conf >= 55 ? 'bg-amber-500' : 'bg-rose-500'
        }`} />

        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4 flex-wrap gap-3">
          <span className="text-[11px] font-bold tracking-[0.1em] text-[var(--accent-purple)] uppercase font-mono">
            🎯 DIRECT VERDICT RECOMMENDATION
          </span>
          <div className="flex items-center space-x-2 select-none">
            {state.isDemoMode && (
              <span className="px-2.5 py-0.5 rounded text-[10px] font-bold font-mono tracking-widest bg-amber-500/10 border border-amber-500/20 text-amber-400 uppercase">
                ⚖️ DEMO MODE SIMULATION
              </span>
            )}
            {isCached && (
              <span className="px-2.5 py-0.5 rounded text-[10px] font-bold font-mono tracking-widest bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 uppercase">
                ⚡ Cache Repository
              </span>
            )}
            {onToggleBookmark && (
              <button 
                onClick={handleBookmarkToggle}
                className={`px-3 py-1.5 text-[12px] font-sans font-medium rounded-[6px] border transition-all duration-150 uppercase active:scale-95 cursor-pointer ${
                  isBookmarked
                    ? 'bg-amber-500/10 border-amber-500/35 text-amber-400 hover:bg-amber-500/15'
                    : 'bg-white/2 hover:bg-white/5 border-[var(--border-default)] hover:border-[var(--warning)] text-[var(--text-secondary)] hover:text-[var(--warning)]'
                } ${bookmarkClicked ? 'scale-[1.3] border-[var(--warning)]' : ''}`}
              >
                {isBookmarked ? '★ Bookmarked' : '💾 Bookmark'}
              </button>
            )}
            <button 
              onClick={handleShareClick}
              className={`px-3 py-1.5 text-[12px] font-sans font-medium rounded-[6px] border bg-white/2 hover:bg-white/5 border-[var(--border-default)] hover:border-[var(--accent-cyan)] text-[var(--text-secondary)] hover:text-[var(--accent-cyan)] transition-all duration-150 uppercase active:scale-95 cursor-pointer ${
                shareGlow ? 'shadow-[0_0_15px_rgba(6,182,212,0.3)]' : ''
              }`}
            >
              📤 Share Card
            </button>
          </div>
        </div>

        {/* Dynamic Typewriter Paragraphs */}
        <div className="space-y-4">
          <h2 className="text-3xl md:text-[44px] font-display font-extrabold tracking-[var(--tracking-tight)] text-[var(--text-primary)] leading-[var(--leading-tight)] min-h-[56px] text-left">
            {typedVerdict}
            {!headlineCompleted && (
              <span className="inline-block w-1.5 h-9 ml-1.5 bg-[var(--accent-purple)] animate-cursor-blink align-middle" />
            )}
          </h2>
          
          {headlineCompleted && typedReasoning && (
            <p className="text-[var(--text-secondary)] text-[var(--text-md)] leading-[var(--leading-loose)] font-normal animate-card-entry text-left">
              {typedReasoning}
              <span className="inline-block w-1 h-5 ml-1 bg-slate-500 animate-cursor-blink align-middle" />
            </p>
          )}
        </div>

        {/* Confidence + Conflicts Indicator Grid Row */}
        <div className="flex items-center justify-between pt-5 border-t border-[var(--border-subtle)] flex-wrap gap-5 select-none">
          <div className="space-y-1 text-left">
            <div className="text-[14px] font-sans font-medium text-[var(--text-primary)]">Pipeline Confidence Quotient</div>
            <div className="text-[11px] text-[var(--text-tertiary)] font-mono">Normalized using identified scraper inconsistencies.</div>
          </div>
          
          <div className={`flex items-center space-x-4 p-3 px-4 rounded-[6px] border ${ratingBorderColor}`}>
            {/* Concentric Gauge SVG rescaled +30% */}
            <div ref={ringRef} className="relative w-16 h-16">
              <svg className="w-16 h-16 transform -rotate-90">
                {/* Background dashed loop */}
                <circle 
                  cx="32" 
                  cy="32" 
                  r="30" 
                  className="stroke-[var(--border-subtle)] fill-transparent" 
                  strokeWidth="2"
                  strokeDasharray="2, 4"
                />
                {/* Background base track */}
                <circle 
                  cx="32" 
                  cy="32" 
                  r={radius} 
                  className="stroke-white/3 fill-transparent" 
                  strokeWidth="6" 
                />
                
                {/* Linear gradient mapped dynamically */}
                <defs>
                  <linearGradient id="purpleCyanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--accent-purple)" />
                    <stop offset="100%" stopColor="var(--accent-cyan)" />
                  </linearGradient>
                </defs>

                {/* Animated draw outer ring */}
                <circle 
                  cx="32" 
                  cy="32" 
                  r={radius} 
                  stroke="url(#purpleCyanGrad)"
                  className="fill-transparent transition-all duration-1000 ease-out" 
                  strokeWidth="6" 
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                />
              </svg>
              {/* Score Overlay */}
              <div className="absolute inset-0 flex items-center justify-center font-display font-bold text-[28px] text-[var(--text-primary)]">
                {conf}%
              </div>
            </div>
            
            <div className="text-left font-mono">
              <span className={`text-[11px] font-extrabold block tracking-wider leading-none ${strokeColor}`}>
                {ratingCategory}
              </span>
              <span className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest block mt-1">
                CONSENSUS INDEX
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* ── 4. 🔄 What Would Flip This Verdict? (Trigger cards) ── */}
      {verdict.flipConditions && verdict.flipConditions.length > 0 && (
        <div ref={sensitivityRef} className="space-y-4 pt-2">
          <div className="flex items-center justify-between flex-wrap gap-2 pl-1 select-none">
            <h3 className="text-[22px] font-display font-bold text-[var(--text-primary)] flex items-center space-x-3.5">
              <span className="inline-block w-[3px] h-[24px] rounded-[2px] bg-[var(--accent-cyan)]" />
              <span>THIS VERDICT CHANGES IF</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {verdict.flipConditions.map((cond, idx) => {
              const barColor = 
                cond.influenceScore >= 85 ? 'bg-[var(--danger)] shadow-[0_0_10px_rgba(239,68,68,0.3)]' :
                cond.influenceScore >= 70 ? 'bg-[var(--warning)] shadow-[0_0_10px_rgba(245,158,11,0.3)]' :
                'bg-[var(--accent-cyan)] shadow-[0_0_10px_rgba(6,182,212,0.3)]';

              const influenceLabel = 
                cond.influenceScore >= 85 ? 'CRITICAL TRIGGER' :
                cond.influenceScore >= 70 ? 'HIGH INFLUENCE' :
                'MODERATE SENSITIVITY';

              return (
                <div 
                  key={idx}
                  className="glass-interactive p-5 rounded-[8px] border border-[var(--border-subtle)] flex flex-col justify-between space-y-4 cursor-default"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between select-none">
                      <span className="text-[10px] font-mono text-[var(--text-tertiary)] uppercase tracking-widest">
                        {cond.variable}
                      </span>
                      <span className="text-[12px] font-mono font-medium px-2 py-0.5 rounded-[4px] bg-[rgba(239,68,68,0.15)] border border-[rgba(239,68,68,0.3)] text-[var(--danger)] select-none">
                        {cond.threshold}
                      </span>
                    </div>

                    <p className="text-[15px] font-sans font-medium text-[var(--text-primary)] leading-normal text-left">
                      <span className="text-[var(--warning)] font-bold mr-1">→</span>
                      {cond.condition}
                    </p>
                  </div>

                  {/* Dynamic scroll-triggered width bars */}
                  <div className="space-y-1.5 pt-3 border-t border-[var(--border-subtle)] font-mono text-[10px] select-none text-left">
                    <div className="flex items-center justify-between text-[var(--text-tertiary)]">
                      <span>INFLUENCE WEIGHT</span>
                      <span className="text-[var(--text-secondary)] font-bold">{cond.influenceScore}%</span>
                    </div>
                    <div className="w-full h-[5px] bg-[var(--border-subtle)] rounded-[3px] overflow-hidden">
                      <div 
                        className={`h-full rounded-[3px] transition-all duration-[800ms] ease-out ${barColor}`}
                        style={{ width: changesInView ? `${cond.influenceScore}%` : '0%' }}
                      />
                    </div>
                    <span className={`block text-[10px] tracking-[0.08em] font-bold ${
                      cond.influenceScore >= 85 ? 'text-[var(--danger)]' : cond.influenceScore >= 70 ? 'text-[var(--warning)]' : 'text-[var(--accent-cyan)]'
                    }`}>
                      {influenceLabel}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Moved Verdict Sensitivity Index directly below triggers */}
          <div className="pt-3 max-w-md select-none text-left space-y-1">
            <div className="flex items-center justify-between font-mono text-[12px] font-bold text-[var(--text-secondary)] uppercase">
              <span>VERDICT SENSITIVITY INDEX</span>
              <span className="text-[var(--accent-cyan)] font-extrabold">
                {Math.round(
                  verdict.flipConditions.reduce((acc, curr) => acc + curr.influenceScore, 0) / 
                  verdict.flipConditions.length
                )}%
              </span>
            </div>
            {/* Visual average sensitive progress track */}
            <div className="h-[4px] bg-[var(--border-subtle)] rounded-full overflow-hidden">
              <div 
                className="h-full bg-[var(--accent-cyan)] transition-all duration-[1000ms] ease-out rounded-full"
                style={{
                  width: changesInView 
                    ? `${Math.round(verdict.flipConditions.reduce((acc, curr) => acc + curr.influenceScore, 0) / verdict.flipConditions.length)}%`
                    : '0%'
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── 5. Platform Scraped Evidence Cards ── */}
      <div className="space-y-4">
        {/* Scrapers Header Tickers */}
        <div className="flex items-center justify-between flex-wrap gap-3 pl-1 select-none border-b border-[var(--border-subtle)] pb-3">
          <div className="flex items-center space-x-2.5 font-mono">
            <span className="text-[var(--accent-cyan)]">🔗</span>
            <span className="text-[11px] font-bold tracking-[0.1em] text-[var(--text-primary)] uppercase">LIVE SOURCES QUERIED</span>
            <span className="text-[var(--text-tertiary)] font-bold">·</span>
            <span className="text-[11px] font-bold text-[var(--accent-cyan)] uppercase tracking-widest">
              {resolvedSources.length} SOURCES · REAL-TIME ACQUISITION
            </span>
          </div>

          {/* Small metrics ticker calculating average ms from live items */}
          <span className="text-[10px] font-mono text-[var(--text-tertiary)] uppercase tracking-wider">
            ⚡ Pulled via Anakin Wire &nbsp;·&nbsp; {cachedCount} cached &nbsp;·&nbsp; avg {avgLatency}ms
          </span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {resolvedSources.map((src, idx) => {
            const summaryText = verdict.evidence[src.source.charAt(0).toUpperCase() + src.source.slice(1)] || 
                                verdict.evidence[src.source] || 
                                `Scraped and aggregated live evidence records from ${src.source}.`;
            
            // Latency class rules
            const isCachedSource = isCached;
            const latencyColor = 
              isCachedSource ? 'text-[var(--accent-cyan)] border-[var(--accent-cyan)]/20' :
              src.latencyMs < 500 ? 'text-[var(--success)] border-[var(--success)]/20' :
              src.latencyMs <= 1000 ? 'text-[var(--warning)] border-[var(--warning)]/20' :
              'text-[var(--danger)] border-[var(--danger)]/20';

            const latencyLabel = 
              isCachedSource ? '⚡ CACHED' :
              src.latencyMs < 500 ? 'FAST' :
              src.latencyMs <= 1000 ? 'LIVE' :
              'SLOW';

            return (
              <div 
                key={idx} 
                className="glass-interactive p-6 rounded-[8px] border border-[var(--border-subtle)] space-y-4 flex flex-col justify-between shadow-sm cursor-default"
              >
                <div className="space-y-2.5 text-left">
                  <div className="flex items-center justify-between select-none">
                    <span className="text-[15px] font-semibold text-[var(--text-primary)] font-sans flex items-center space-x-2">
                      <span className="p-1 rounded-[4px] bg-white/5 text-[var(--text-secondary)] border border-white/5">
                        {getSourceIcon(src.source)}
                      </span>
                      <span className="capitalize">{src.source}</span>
                    </span>
                    <span className={`text-[10px] font-mono font-extrabold border px-2 py-0.5 rounded-[4px] bg-white/3 ${latencyColor}`}>
                      {latencyLabel} &nbsp;{isCachedSource ? '' : `· ${src.latencyMs}ms`}
                    </span>
                  </div>
                  <p className="text-[14px] leading-relaxed text-[var(--text-secondary)] font-normal font-sans">
                    {summaryText}
                  </p>
                </div>
                
                <div className="pt-3 flex items-center justify-between border-t border-[var(--border-subtle)] text-[10px] font-mono select-none">
                  <span className="text-[var(--accent-purple)] font-bold tracking-[0.08em] flex items-center space-x-1">
                    <span>⬡</span>
                    <span>WIRE API ATTRIBUTION</span>
                  </span>
                  <span className={`font-extrabold ${
                    (src.historicalReliability || 100) === 100 ? 'text-[var(--success)]' :
                    (src.historicalReliability || 100) >= 80 ? 'text-[var(--warning)]' : 'text-[var(--danger)]'
                  }`}>
                    RELIABILITY: {Math.round(src.historicalReliability || 100)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 5b. Failed Scraper Diagnostics ── */}
      {failedSources && failedSources.length > 0 && (
        <div className="space-y-4 pt-2">
          <h3 className="text-[11px] font-bold tracking-widest text-[var(--danger)] uppercase font-mono block pl-1 flex items-center space-x-1.5 animate-pulse-live">
            <span>⚠️</span>
            <span>DEGRADED SIGNAL TELEMETRY</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {failedSources.map((failed, idx) => {
              const failureTypeLabels = {
                timeout: 'TIMEOUT DELAY',
                rate_limit: 'API RATE LIMIT',
                parse_error: 'PARSING EXCEPTION',
                no_data: 'EMPTY PAYLOAD',
                network_error: 'NETWORK EXCEPTION'
              };
              
              const label = failureTypeLabels[failed.failureType] || 'UNKNOWN EXCEPTION';
              
              return (
                <div 
                  key={idx}
                  className="glass border border-[var(--danger)]/15 p-5 rounded-[8px] flex flex-col justify-between shadow-sm relative overflow-hidden group text-left cursor-default"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[15px] font-semibold text-[var(--text-primary)] font-sans flex items-center space-x-2">
                        <span className="p-1 rounded-[4px] bg-rose-950/20 text-[var(--danger)] border border-[var(--danger)]/10">
                          {getSourceIcon(failed.source)}
                        </span>
                        <span className="capitalize">{failed.source} unavailable</span>
                      </span>
                      <span className="text-[10px] font-mono font-bold text-[var(--danger)] bg-[var(--danger)]/10 border border-[var(--danger)]/10 px-1.5 py-0.5 rounded uppercase select-none">
                        {label}
                      </span>
                    </div>
                    
                    <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed font-normal">
                      {failed.reason}. The platform automatically compensated by fanning out alternative adapters.
                    </p>
                  </div>
                  
                  <div className="pt-3 mt-3 flex items-center justify-between border-t border-[var(--border-subtle)] text-[10px] font-mono select-none">
                    <span className="text-[var(--danger)] font-bold tracking-wider flex items-center space-x-1">
                      <span>CONFIDENCE IMPACT:</span>
                      <span className="font-extrabold">-{failed.confidencePenalty} PTS</span>
                    </span>
                    <span className="text-[var(--text-tertiary)] uppercase">
                      LATENCY: {failed.latencyMs ? `${(failed.latencyMs / 1000).toFixed(1)}s` : 'N/A'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 6. Conflict Resolutions ── */}
      {verdict.conflicts && verdict.conflicts.length > 0 && (
        <div className="space-y-4 pt-2">
          <h3 className="text-xs font-extrabold tracking-widest text-[var(--text-secondary)] uppercase font-mono block pl-1 flex items-center space-x-1.5 select-none">
            <span className="text-[var(--warning)] animate-pulse-live">⚠️</span>
            <span>IDENTIFIED CONFLICT RESOLUTION MATRIX</span>
          </h3>
          
          <div className="space-y-4">
            {verdict.conflicts.map((cf, idx) => {
              const sev = cf.severity || 'MEDIUM';
              
              const borderClass = 
                sev === 'HIGH' ? 'border-[var(--danger)]/15 bg-rose-950/2 shadow-sm' :
                sev === 'MEDIUM' ? 'border-[var(--warning)]/15 bg-amber-950/2 shadow-sm' :
                'border-sky-500/15 bg-sky-950/2';
                
              const badgeClass = 
                sev === 'HIGH' ? 'text-rose-400 bg-rose-950/30 border-rose-500/20' :
                sev === 'MEDIUM' ? 'text-amber-400 bg-amber-950/30 border-amber-500/20' :
                'text-sky-400 bg-sky-950/30 border-sky-500/20';

              const accentLine = 
                sev === 'HIGH' ? 'border-[var(--danger)]/20' :
                sev === 'MEDIUM' ? 'border-[var(--warning)]/20' :
                'border-sky-500/20';

              return (
                <div 
                  key={idx} 
                  className={`glass p-5 md:p-6 rounded-[8px] border space-y-4 animate-card-entry opacity-0 text-left ${borderClass}`}
                  style={{
                    animationDelay: `${(idx + resolvedSources.length + 1) * 100}ms`,
                    animationFillMode: 'forwards'
                  }}
                >
                  <div className="flex items-center justify-between flex-wrap gap-2 select-none">
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold font-mono tracking-widest border uppercase ${badgeClass}`}>
                        {sev} SEVERITY
                      </span>
                      <div className="flex items-center space-x-1">
                        {cf.conflictingSources.map(s => (
                          <span key={s} className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-white/5 border border-white/5 text-slate-400 uppercase">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                    {cf.confidenceImpact && (
                      <span className="text-xs font-mono font-bold text-rose-400/80">
                        -{cf.confidenceImpact}pts penalty
                      </span>
                    )}
                  </div>

                  <h4 className="text-sm font-bold text-slate-100 tracking-tight leading-snug">
                    {cf.conflict}
                  </h4>

                  <div className="space-y-3 pt-3.5 border-t border-[var(--border-subtle)] text-sm font-sans">
                    <p className={`text-slate-300 leading-relaxed pl-3.5 border-l-2 ${accentLine}`}>
                      <span className="font-bold text-slate-400 block mb-0.5">Synthesis Resolution</span>
                      {cf.explanation}
                    </p>
                    <p className="text-slate-300 leading-relaxed pl-3.5 border-l-2 border-emerald-500/25">
                      <span className="font-bold text-emerald-400 block mb-0.5">Actionable Recommendation</span>
                      {cf.recommendation}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 7. Explainability Accordion Panel ── */}
      <div 
        className="glass-premium rounded-3xl overflow-hidden animate-card-entry opacity-0 select-none"
        style={{
          animationDelay: `${(resolvedSources.length + (verdict.conflicts?.length || 0) + 1) * 100}ms`,
          animationFillMode: 'forwards'
        }}
      >
        <button 
          onClick={() => setIsExplainOpen(!isExplainOpen)}
          className="w-full flex items-center justify-between p-5 md:p-6 bg-white/2 hover:bg-[var(--accent-purple-glow)] border-b border-[var(--border-subtle)] hover:border-[var(--accent-purple)] text-left transition-all duration-300 group cursor-pointer"
        >
          <div className="flex items-center space-x-3">
            <span className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
            </span>
            <div>
              <h3 className="text-[12px] font-bold tracking-[0.08em] text-white uppercase font-mono group-hover:text-[var(--accent-purple)] transition-colors">
                ⚡ EXPLAINABILITY MATRIX: Why this verdict?
              </h3>
              <p className="text-[10px] text-[var(--text-tertiary)] font-mono mt-0.5 uppercase tracking-wide">
                Expose decision algorithms, reasoning paths & weights
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-md uppercase">
              {isExplainOpen ? 'COLLAPSE TRACE' : 'EXPAND TRACE'}
            </span>
            <span className={`text-[10px] text-slate-400 group-hover:text-white transition-transform duration-300 ${isExplainOpen ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </div>
        </button>

        <div 
          className={`transition-all duration-500 ease-in-out overflow-hidden ${
            isExplainOpen ? 'max-h-[1600px] opacity-100 p-5 md:p-8 space-y-8 border-t border-[var(--border-subtle)]' : 'max-h-0 opacity-0 p-0 pointer-events-none'
          }`}
        >
          {/* Node progression map */}
          <div className="space-y-3.5 text-left">
            <div className="text-[10px] font-extrabold tracking-widest text-slate-400 uppercase font-mono pl-1">
              ⚙️ Decision Processing Tree
            </div>
            <div className="bg-[#07070B] border border-white/3 p-5 rounded-2xl relative overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5 items-center text-center font-mono text-[9px] text-slate-400 relative z-10">
                <div className="p-3 bg-white/2 border border-white/5 rounded-xl space-y-1">
                  <span className="block text-indigo-400 font-bold uppercase tracking-wider">INPUT</span>
                  <span className="block text-[8px] text-slate-500 truncate max-w-[90px] mx-auto">{query}</span>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mt-1" />
                </div>
                <div className="hidden md:block text-slate-600 text-sm">➔</div>
                <div className="p-3 bg-white/2 border border-white/5 rounded-xl space-y-1">
                  <span className="block text-indigo-400 font-bold uppercase tracking-wider">INTENT</span>
                  <span className="block text-[8px] text-slate-300 font-extrabold uppercase truncate max-w-[90px] mx-auto">{state.category || 'GENERAL'}</span>
                  <span className="inline-block px-1 rounded text-[7px] bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 uppercase font-bold">CLASSIFIED</span>
                </div>
                <div className="hidden md:block text-slate-600 text-sm">➔</div>
                <div className="p-3 bg-white/2 border border-white/5 rounded-xl space-y-1">
                  <span className="block text-indigo-400 font-bold uppercase tracking-wider">SCRAPERS</span>
                  <span className="block text-[8px] text-slate-400 truncate max-w-[90px] mx-auto">{resolvedSources.length} Sources</span>
                  <span className="inline-block px-1 rounded text-[7px] bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 uppercase font-bold">WAVE OK</span>
                </div>
                <div className="hidden md:block text-slate-600 text-sm">➔</div>
                <div className="p-3 bg-white/2 border border-white/5 rounded-xl space-y-1">
                  <span className="block text-indigo-400 font-bold uppercase tracking-wider">CONFLICTS</span>
                  <span className="block text-[8px] text-slate-400 truncate max-w-[90px] mx-auto">{conflicts.length} Flags</span>
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[7px] font-bold uppercase ${
                    conflicts.length > 0 ? 'bg-amber-500/10 border border-amber-500/25 text-amber-400' : 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-400'
                  }`}>
                    {conflicts.length > 0 ? 'PENALIZED' : 'INTEG HIGH'}
                  </span>
                </div>
                <div className="hidden md:block text-slate-600 text-sm">➔</div>
                <div className="p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-xl space-y-1 shadow-[0_0_15px_rgba(99,102,241,0.04)]">
                  <span className="block text-indigo-300 font-extrabold uppercase tracking-wider">VERDICT</span>
                  <span className="block text-[8px] text-white font-extrabold">{conf}% CONF</span>
                  <span className="inline-block px-1.5 py-0.5 rounded text-[7px] bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 uppercase font-bold">READY</span>
                </div>
              </div>
            </div>
          </div>

          {/* Contribution Progress Bars */}
          <div className="space-y-4 text-left">
            <div className="text-xs font-extrabold tracking-widest text-slate-400 uppercase font-mono pl-1">
              📊 Weighted Scoring Breakdown
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {verdict.confidenceBreakdown.map((item, idx) => {
                const positive = item.passed;
                const scoreLabel = item.score >= 0 ? `+${item.score}` : `${item.score}`;
                const percentageWidth = Math.max(5, Math.min(100, Math.abs(item.score) * 4));
                
                const barColor = 
                  positive ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-rose-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]';
                const textColor = 
                  positive ? 'text-emerald-400' : 'text-rose-400';

                return (
                  <div key={idx} className="p-4 rounded-[8px] border border-[var(--border-subtle)] bg-white/2 space-y-2.5 font-sans">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-300 font-semibold">{item.name}</span>
                      <span className={`font-bold ${textColor}`}>{scoreLabel} pts</span>
                    </div>
                    {/* Width Animate Bar */}
                    <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-[800ms] ${barColor}`} 
                        style={{ width: isExplainOpen ? `${percentageWidth}%` : '0%' }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs font-mono text-slate-500 select-none">
                      <span>SCORING WEIGHT</span>
                      <span>{positive ? 'PASSED CHECK' : 'FAILED DEDUCTION'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Platform weights */}
          <div className="space-y-3 text-left">
            <div className="text-xs font-extrabold tracking-widest text-slate-400 uppercase font-mono pl-1">
              ⚖️ Scraper Source Weight Configuration
            </div>
            <div className="bg-[#07070B] border border-white/3 rounded-2xl p-5 divide-y divide-white/5 space-y-3.5">
              {resolvedSources.map((src, idx) => {
                const isPrimary = ['glassdoor', 'amazon', 'moneycontrol', 'shiksha', 'screener', 'linkedin'].includes(src.source.toLowerCase());
                const baseWeight = isPrimary ? 40 : 20;
                const reliabilityMultiplier = (src.historicalReliability || 100) / 100;
                const finalWeight = Math.round(baseWeight * reliabilityMultiplier);
                const percentageWidth = finalWeight * 2;

                return (
                  <div key={idx} className="flex items-center justify-between pt-3.5 first:pt-0 font-mono text-[10px] flex-wrap gap-3">
                    <div className="flex items-center space-x-2.5 min-w-[120px]">
                      <span className="p-1 rounded bg-white/5 border border-white/5 text-slate-400">
                        {getSourceIcon(src.source)}
                      </span>
                      <span className="font-extrabold text-slate-300 capitalize">{src.source}</span>
                      <span className={`px-1.5 py-0.5 rounded-[5px] text-[7px] font-bold ${
                        isPrimary ? 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-400' : 'bg-slate-500/10 border border-slate-500/20 text-slate-400'
                      }`}>
                        {isPrimary ? 'CORE DRIVER' : 'CONTEXT SUPPORT'}
                      </span>
                    </div>

                    <div className="flex-1 max-w-xs mx-4 hidden sm:block h-1 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.4)]" style={{ width: isExplainOpen ? `${percentageWidth}%` : '0%' }} />
                    </div>

                    <div className="flex items-center space-x-4 text-right">
                      <span>
                        <span className="text-slate-500 block text-xs">RELIABILITY</span>
                        <span className={`font-extrabold ${
                          (src.historicalReliability || 100) === 100 ? 'text-[var(--success)]' :
                          (src.historicalReliability || 100) >= 80 ? 'text-[var(--warning)]' : 'text-[var(--danger)]'
                        }`}>{Math.round(src.historicalReliability || 100)}%</span>
                      </span>
                      <span>
                        <span className="text-slate-500 block text-xs">DECISION WEIGHT</span>
                        <span className="text-indigo-400 font-extrabold">{finalWeight}%</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Penalty trace */}
          <div className="space-y-3 text-left border-t border-[var(--border-subtle)] pt-4">
            <div className="text-xs font-extrabold tracking-widest text-slate-400 uppercase font-mono pl-1">
              🛡️ Cross-Source Contradiction Penalty Audit
            </div>
            {conflicts.length > 0 ? (
              <div className="p-4 rounded-[8px] border border-rose-500/15 bg-rose-950/2 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between text-rose-400 font-extrabold">
                  <span>⚠️ CONTRADICTION PENALTIES DECLARED</span>
                  <span>-{conflicts.reduce((acc, c) => acc + (c.confidenceImpact || 0), 0)} pts deduction</span>
                </div>
                <div className="divide-y divide-white/5 space-y-2">
                  {conflicts.map((cf, idx) => (
                    <div key={idx} className="flex items-center justify-between pt-2 first:pt-0 text-xs text-slate-400">
                      <span>• {cf.conflict.slice(0, 65)}...</span>
                      <span className="text-rose-400 font-bold">-{cf.confidenceImpact || 0} pts</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-[8px] border border-emerald-500/15 bg-emerald-950/2 flex items-center justify-between font-mono text-[10px] text-emerald-400">
                <div className="flex items-center space-x-3">
                  <span className="text-sm">🛡️</span>
                  <div>
                    <span className="font-extrabold block">ZERO PIECE CONTRADICTIONS ENCOUNTERED</span>
                    <span className="text-[8px] text-slate-500 uppercase mt-0.5 block">Data integrity is stable</span>
                  </div>
                </div>
                <span className="font-extrabold font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md uppercase">
                  +15 pts Bonus
                </span>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── 8. DRILL DEEPER Follow-Up Section ── */}
      <div 
        className="space-y-5 pt-5 border-t border-[var(--border-subtle)] animate-card-entry opacity-0"
        style={{
          animationDelay: `${(resolvedSources.length + (verdict.conflicts?.length || 0) + 2) * 100}ms`,
          animationFillMode: 'forwards'
        }}
      >
        <div className="flex items-center justify-between font-mono select-none">
          <h3 className="text-[11px] font-bold tracking-[0.1em] text-[var(--text-secondary)] uppercase">
            💬 DRILL DEEPER
          </h3>
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold tracking-wider uppercase select-none">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-live-pulse" />
            <span>Advisor Mode Active • Preserves Evidence Graph</span>
          </span>
        </div>

        <form 
          onSubmit={(e) => {
            e.preventDefault();
            if (customFollowUp.trim() === '' || !onFollowUp) return;
            
            const context = {
              parentQuery: query,
              category: state.category,
              previousVerdict: verdict.verdict,
              previousEvidence: resolvedSources,
              previousConflicts: conflicts,
              isDemoMode: state.isDemoMode
            };

            onFollowUp(customFollowUp, context);
            setCustomFollowUp('');
          }}
          className="w-full flex items-center relative bg-[var(--bg-elevated)] rounded-[8px] border border-[var(--border-default)] p-2 focus-within:border-[var(--accent-purple)] focus-within:shadow-[0_0_0_3px_var(--accent-purple-glow),0_0_30px_rgba(124,58,237,0.1)] transition-all duration-200"
        >
          <input 
            type="text"
            value={customFollowUp}
            onChange={(e) => setCustomFollowUp(e.target.value)}
            placeholder="Ask your follow-up query (e.g., What if I plan to do an MBA later?)..."
            className="w-full bg-transparent px-4 py-3.5 border-0 outline-none text-[var(--text-primary)] font-sans text-sm placeholder-[var(--text-tertiary)] italic"
          />
          <button
            type="submit"
            disabled={customFollowUp.trim() === ''}
            className="px-5 py-3 rounded-[6px] bg-[var(--accent-purple)] hover:brightness-[1.1] hover:-translate-y-[1px] active:scale-[0.98] disabled:scale-100 font-sans font-semibold text-[14px] text-white transition-all duration-150 disabled:opacity-20 disabled:pointer-events-none cursor-pointer"
          >
            Submit Query
          </button>
        </form>

        {/* Suggested pill chips arranged directly underneath */}
        {verdict.followUpQuestions && verdict.followUpQuestions.length > 0 && (
          <div className="space-y-3 text-left select-none">
            <span className="text-[10px] font-bold font-mono tracking-[0.1em] text-[var(--text-tertiary)] uppercase block">
              SUGGESTED ANALYTICAL ANCHORS:
            </span>
            <div className="flex flex-wrap gap-2.5">
              {verdict.followUpQuestions.map((question, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    if (!onFollowUp) return;
                    
                    const context = {
                      parentQuery: query,
                      category: state.category,
                      previousVerdict: verdict.verdict,
                      previousEvidence: resolvedSources,
                      previousConflicts: conflicts,
                      isDemoMode: state.isDemoMode
                    };

                    onFollowUp(question, context);
                  }}
                  className="inline-flex items-center space-x-1.5 border border-[var(--border-default)] hover:border-[var(--accent-purple)] bg-white/2 hover:bg-[var(--accent-purple-glow)] rounded-[6px] px-4 py-2.5 text-[14px] font-sans text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all duration-150 cursor-pointer group active:scale-[0.99]"
                >
                  <span>{question}</span>
                  <span className="text-[11px] font-mono text-[var(--accent-cyan)] opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all pl-1.5">
                    Submit Trace →
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── 9. Shareable Verdict Card Modal (E2E sharing overlay) ── */}
      {isShareModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4 md:p-6 animate-page-fade-in font-sans">
          <div className="glass max-w-xl w-full rounded-3xl border border-white/10 p-6 md:p-8 space-y-6 relative shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            
            <button 
              onClick={() => setIsShareModalOpen(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 border border-white/5 text-slate-400 hover:text-white flex items-center justify-center transition-all hover:bg-white/10 text-sm font-extrabold active:scale-95 duration-100 cursor-pointer"
            >
              ✕
            </button>

            <div className="space-y-1 text-center select-none">
              <h3 className="text-sm font-bold tracking-widest text-[var(--accent-purple)] font-mono uppercase">
                📤 Share Decision Verdict
              </h3>
              <p className="text-xs text-slate-500 uppercase tracking-wide">
                Export premium image assets or E2E functional sharing links
              </p>
            </div>

            {/* Visual preview card */}
            <div className="border border-white/5 bg-[#06060A] rounded-2xl p-6 space-y-5 relative overflow-hidden select-none text-left shadow-inner">
              <div className="absolute -top-32 -right-32 w-64 h-64 rounded-full bg-indigo-500/5 blur-3xl" />
              
              <div className="flex items-center justify-between text-[8px] font-bold font-mono text-slate-500 uppercase">
                <span>VERDICT CORE REPORT ENGINE</span>
                <span>VERDICT.APP</span>
              </div>

              <div className="space-y-2 pt-2">
                <span className="text-[9px] font-bold font-mono tracking-widest text-indigo-400 uppercase">Original Dilemma:</span>
                <h4 className="text-sm md:text-md font-bold text-white leading-snug">
                  "{query}"
                </h4>
              </div>

              <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 space-y-2">
                <span className="text-[8px] font-bold font-mono text-indigo-300 uppercase tracking-wide">🎯 Direct Recommendation:</span>
                <p className="text-xs font-bold text-slate-200">
                  {verdict.verdict}
                </p>
              </div>

              <div className="flex items-center justify-between flex-wrap gap-2.5 pt-2 border-t border-white/5">
                <span className="px-2 py-0.5 rounded text-[8px] font-bold font-mono tracking-wider bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 uppercase">
                  ✓ {conf}% CONFIDENCE
                </span>
                <div className="flex items-center space-x-1.5 text-[8px] font-bold font-mono text-slate-500">
                  {resolvedSources.slice(0, 3).map(src => (
                    <span key={src.source} className="px-1.5 py-0.5 rounded bg-white/5 border border-white/5">
                      ✓ {src.source.toUpperCase()}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2 select-none">
              <button
                onClick={exportCardAsImage}
                className="flex-1 py-3 px-4 rounded-xl bg-[var(--accent-purple)] hover:brightness-[1.1] hover:-translate-y-[1px] active:scale-[0.98] text-xs font-bold text-white tracking-wide transition-all shadow-[0_0_15px_rgba(124,58,237,0.2)] flex items-center justify-center space-x-2 cursor-pointer"
              >
                <span>📥 Download PNG Card</span>
              </button>

              <button
                onClick={() => {
                  const shareUrl = `${window.location.origin}?q=${encodeURIComponent(query)}`;
                  navigator.clipboard.writeText(shareUrl);
                  setIsCopied(true);
                  setTimeout(() => setIsCopied(false), 2000);
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-white/3 border border-white/5 text-xs font-bold text-white/95 hover:bg-white/5 transition-all active:scale-[0.98] flex items-center justify-center space-x-2 cursor-pointer"
              >
                <span>{isCopied ? '✓ Share Link Copied!' : '🔗 Copy Share Link'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

export default VerdictDisplay;
