'use client';

import React, { useEffect, useState, useRef } from 'react';
import { StreamStage, WireSourceResult, ConfidenceTick, FailedSource } from '../types/index.js';
import LiveConfidenceMeter from './LiveConfidenceMeter';

interface SkeletonLoaderProps {
  stage: StreamStage;
  sourcesScanned: string[];
  resolvedSources: WireSourceResult[];
  category?: string;
  isDemoMode?: boolean;
  liveConfidence?: number;
  confidenceHistory?: ConfidenceTick[];
  failedSources?: FailedSource[];
}

interface TimelineNode {
  id: string;
  title: string;
  shortTitle: string;
  stageTrigger: StreamStage[];
  completedTrigger: StreamStage[];
  baseMessage: string;
  getLiveMessage: (category?: string, sourcesCount?: number) => string;
}

export function SkeletonLoader({
  stage,
  sourcesScanned,
  resolvedSources,
  category,
  isDemoMode,
  liveConfidence,
  confidenceHistory,
  failedSources = []
}: SkeletonLoaderProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const consoleBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ts = () => new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    let newLog = '';
    const prefix = isDemoMode ? '[DEMO]' : '';

    switch (stage) {
      case 'classifying':
        newLog = `${ts()} [CLASSIFIER] ${prefix} Routing semantic intent through NLP pipeline...`;
        break;
      case 'intent_classified':
        newLog = `${ts()} [ROUTER] ${prefix} Category mapped → ${category || 'GENERAL'}. Adapters selected.`;
        break;
      case 'wave1_start':
        newLog = `${ts()} [WIRE] ${prefix} Wave 1 fan-out initiated — ${sourcesScanned.length} parallel requests fired.`;
        break;
      case 'source_resolved':
        if (resolvedSources.length > 0) {
          const latest = resolvedSources[resolvedSources.length - 1];
          newLog = `${ts()} [WIRE] ${prefix} ✓ ${latest.source.toUpperCase()} responded in ${latest.latencyMs}ms`;
        }
        break;
      case 'wave2_start':
        newLog = `${ts()} [WIRE] ${prefix} Wave 2 deep scan triggered — conditional adapters spawned.`;
        break;
      case 'conflicts_detected':
        newLog = `${ts()} [RESOLVER] ${prefix} Cross-source contradictions mapped and penalized.`;
        break;
      case 'synthesizing':
        newLog = `${ts()} [GEMINI] ${prefix} Synthesis initiated — grounding evidence under Gemini.`;
        break;
    }

    if (newLog) {
      setLogs(prev => {
        if (prev.length > 0 && prev[prev.length - 1] === newLog) return prev;
        return [...prev, newLog];
      });
    }
  }, [stage, resolvedSources, category, sourcesScanned.length, isDemoMode]);

  useEffect(() => {
    if (failedSources && failedSources.length > 0) {
      const latest = failedSources[failedSources.length - 1];
      const ts = () => new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      const failureLog = `${ts()} [WIRE] ⚠ ${latest.source.toUpperCase()} failed — ${latest.reason}`;
      setLogs(prev => {
        if (prev.includes(failureLog)) return prev;
        return [...prev, failureLog];
      });
    }
  }, [failedSources]);

  useEffect(() => {
    if (consoleBottomRef.current) {
      consoleBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  if (stage === 'idle' || stage === 'done' || stage === 'verdict_ready') return null;

  // Simplified, judge-readable timeline labels
  const timelineNodes: TimelineNode[] = [
    {
      id: 'intent',
      title: 'Intent Classification Router',
      shortTitle: 'Intent',
      stageTrigger: ['classifying', 'intent_classified'],
      completedTrigger: ['intent_classified', 'wave1_start', 'source_resolved', 'wave1_complete', 'wave2_start', 'wave2_complete', 'conflicts_detected', 'synthesizing', 'verdict_ready', 'done'],
      baseMessage: 'Classifying decision type...',
      getLiveMessage: (cat) => cat ? `Mapped to: ${cat} bundle` : 'Parsing intent...'
    },
    {
      id: 'wave1',
      title: 'Wave 1 — Live Scrape',
      shortTitle: 'Wave 1',
      stageTrigger: ['wave1_start', 'source_resolved', 'wave1_complete'],
      completedTrigger: ['wave1_complete', 'wave2_start', 'wave2_complete', 'conflicts_detected', 'synthesizing', 'verdict_ready', 'done'],
      baseMessage: 'Preparing primary scrapers...',
      getLiveMessage: (_, count) => count && count > 0 ? `${count} sources queried in parallel` : 'Scrapers active...'
    },
    {
      id: 'wave2',
      title: 'Wave 2 — Deep Scan',
      shortTitle: 'Wave 2',
      stageTrigger: ['wave2_start', 'wave2_complete'],
      completedTrigger: ['wave2_complete', 'conflicts_detected', 'synthesizing', 'verdict_ready', 'done'],
      baseMessage: 'Evaluating secondary signals...',
      getLiveMessage: () => 'Conditional adapters spawned'
    },
    {
      id: 'conflicts',
      title: 'Conflict Detection',
      shortTitle: 'Conflicts',
      stageTrigger: ['conflicts_detected'],
      completedTrigger: ['synthesizing', 'verdict_ready', 'done'],
      baseMessage: 'Comparing data arrays...',
      getLiveMessage: () => 'Mismatches flagged and penalized'
    },
    {
      id: 'synthesis',
      title: 'Gemini Synthesis',
      shortTitle: 'Synthesis',
      stageTrigger: ['synthesizing'],
      completedTrigger: ['verdict_ready', 'done'],
      baseMessage: 'Preparing Gemini grounding...',
      getLiveMessage: () => 'Compiling final verdict...'
    },
  ];

  const resolvedCount = resolvedSources.length;
  const totalSources = sourcesScanned.length || 1;
  const progressPct = Math.round((resolvedCount / totalSources) * 100);
  const totalLatency = [...resolvedSources, ...failedSources].reduce((a, s) => a + s.latencyMs, 0);

  const activePhase = stage.includes('wave2')
    ? 'WAVE 2'
    : stage.includes('wave1') || stage.includes('source')
    ? 'WAVE 1'
    : stage === 'synthesizing'
    ? 'GEMINI'
    : 'INIT';

  return (
    <div className="w-full space-y-5 max-w-3xl mx-auto">

      {/* ═══════════════════════════════════════════════
          ⚡ WIRE LIVE — Hero Banner (Top Priority)
      ═══════════════════════════════════════════════ */}
      <div className="relative rounded-3xl border border-indigo-500/30 bg-[#07070D] overflow-hidden shadow-[0_0_40px_rgba(99,102,241,0.1)]">
        {/* Sweep animation overlay */}
        <div className="absolute inset-0 animate-wire-sweep pointer-events-none rounded-3xl" />
        {/* Radar scan line */}
        <div className="absolute inset-x-0 top-0 bottom-0 pointer-events-none">
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent animate-radar-scan" />
        </div>

        <div className="relative z-10 p-5 md:p-6 space-y-5">

          {/* Header row */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center space-x-3">
              {/* Live pulsing indicator */}
              <div className="relative w-3 h-3 flex-shrink-0">
                <span className="absolute w-3 h-3 rounded-full bg-indigo-500/40 animate-ping" />
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 absolute top-0.5 left-0.5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-base md:text-lg font-extrabold tracking-widest text-white font-mono uppercase">
                    ⚡ WIRE LIVE
                  </span>
                  {isDemoMode && (
                    <span className="text-[8px] font-bold font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase animate-pulse">
                      DEMO STABLE
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest mt-0.5">
                  Querying {totalSources} live sources in parallel · Anakin Wire API
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 font-mono text-[10px]">
              <span className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-2.5 py-1 rounded-lg font-bold uppercase tracking-widest">
                {activePhase}
              </span>
              <span className="bg-white/3 border border-white/5 text-slate-400 px-2.5 py-1 rounded-lg font-bold uppercase">
                {stage.replace(/_/g, ' ')}
              </span>
            </div>
          </div>

          {/* Source badges — larger and prominent */}
          <div className="flex flex-wrap gap-2">
            {sourcesScanned.map(src => {
              const name = src.split('.')[0];
              const resolved = resolvedSources.find(s => s.source === name);
              const failed = failedSources.find(f => f.source === name);
              const pending = !resolved && !failed;
              const success = !!resolved?.success && !failed;

              return (
                <div
                  key={src}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold tracking-wide uppercase border transition-all duration-300 ${
                    pending
                      ? 'bg-indigo-500/5 border-indigo-500/15 text-indigo-300 animate-pulse'
                      : success
                      ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                  }`}
                >
                  {pending ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping flex-shrink-0" />
                  ) : success ? (
                    <span className="text-emerald-400 font-extrabold">✓</span>
                  ) : (
                    <span className="text-rose-400 font-extrabold">✗</span>
                  )}
                  <span>{name}</span>
                  {resolved && <span className="text-[9px] text-slate-500 font-normal">({resolved.latencyMs}ms)</span>}
                  {failed && <span className="text-[9px] text-rose-400/70 font-normal">({failed.reason.split(' ')[0]})</span>}
                </div>
              );
            })}
            {sourcesScanned.length === 0 && (
              <span className="text-[10px] text-slate-600 italic font-mono animate-connecting">
                Waiting for intent router...
              </span>
            )}
          </div>

          {/* Source progress bar */}
          {sourcesScanned.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between font-mono text-[9px] text-slate-500">
                <span className="uppercase tracking-widest">{resolvedCount} / {totalSources} sources resolved</span>
                <span className="text-indigo-400 font-bold">{progressPct}%</span>
              </div>
              <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)] transition-all duration-500 ease-out rounded-full"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Telemetry metrics row — large numbers */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 border-t border-white/5">
            <div className="space-y-0.5">
              <span className="block text-[8px] font-extrabold tracking-widest text-slate-600 uppercase font-mono">SOURCES</span>
              <span className="block text-2xl font-extrabold text-white font-mono leading-none">
                {totalSources}
              </span>
              <span className="block text-[8px] text-slate-600 font-mono">queried</span>
            </div>

            <div className="space-y-0.5 border-l border-white/5 pl-3">
              <span className="block text-[8px] font-extrabold tracking-widest text-slate-600 uppercase font-mono">RESOLVED</span>
              <span className="block text-2xl font-extrabold text-emerald-400 font-mono leading-none">
                {resolvedCount}
              </span>
              <span className="block text-[8px] text-slate-600 font-mono">confirmed</span>
            </div>

            <div className="space-y-0.5 border-l border-white/5 pl-3">
              <span className="block text-[8px] font-extrabold tracking-widest text-slate-600 uppercase font-mono">PHASE</span>
              <span className="block text-xl font-extrabold text-indigo-400 font-mono leading-none uppercase">
                {activePhase}
              </span>
              <span className="block text-[8px] text-slate-600 font-mono">active</span>
            </div>

            <div className="space-y-0.5 border-l border-white/5 pl-3">
              <span className="block text-[8px] font-extrabold tracking-widest text-slate-600 uppercase font-mono">LATENCY</span>
              <span className="block text-2xl font-extrabold text-amber-400 font-mono leading-none">
                {totalLatency ? `${(totalLatency / 1000).toFixed(1)}s` : '—'}
              </span>
              <span className="block text-[8px] text-slate-600 font-mono">cumulative</span>
            </div>
          </div>

        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          Pipeline Timeline
      ═══════════════════════════════════════════════ */}
      <div className="glass p-5 md:p-6 rounded-3xl border border-white/5 space-y-5 relative overflow-hidden">

        {/* Section header */}
        <div className="flex items-center justify-between select-none">
          <span className="text-[10px] font-extrabold tracking-widest text-slate-500 uppercase font-mono">
            PIPELINE EXECUTION TRACE
          </span>
          {isDemoMode && (
            <span className="text-[8px] font-bold font-mono text-indigo-400 bg-indigo-500/5 border border-indigo-500/15 px-2 py-0.5 rounded-lg uppercase animate-pulse">
              ⚖️ JUDGE DEMO ACTIVE
            </span>
          )}
        </div>

        {/* Live Confidence Meter */}
        {liveConfidence !== undefined && (
          <div className="flex flex-col items-center space-y-1 py-2 border-b border-white/5 pb-4">
            <div className="text-[9px] font-extrabold tracking-widest text-slate-600 uppercase font-mono mb-1">
              ⬡ LIVE CONFIDENCE SIGNAL
            </div>
            <LiveConfidenceMeter
              liveConfidence={liveConfidence}
              confidenceHistory={confidenceHistory || []}
            />
          </div>
        )}

        {/* Timeline nodes */}
        <div className="relative pl-7 space-y-5 font-mono text-xs select-none">
          <div className="absolute top-2 bottom-2 left-3 w-[1px] bg-white/5" />

          {timelineNodes.map((node) => {
            const isCompleted = node.completedTrigger.includes(stage);
            const isActive = !isCompleted && node.stageTrigger.includes(stage);
            const isPending = !isCompleted && !isActive;

            const displayLog = isActive
              ? node.getLiveMessage(category, resolvedSources.length)
              : isCompleted
              ? node.getLiveMessage(category, resolvedSources.length)
              : node.baseMessage;

            return (
              <div
                key={node.id}
                className={`relative transition-all duration-300 ${
                  isPending ? 'opacity-20' : isActive ? 'opacity-100' : 'opacity-75'
                }`}
              >
                {/* Node dot */}
                <div className="absolute -left-7 top-1 w-4 h-4 flex items-center justify-center">
                  {isCompleted ? (
                    <span className="w-3 h-3 rounded-full bg-emerald-950 border border-emerald-500/50 flex items-center justify-center text-[7px] text-emerald-400 font-bold shadow-[0_0_8px_rgba(16,185,129,0.3)]">✓</span>
                  ) : isActive ? (
                    <span className="relative w-3 h-3 flex items-center justify-center">
                      <span className="absolute w-3 h-3 rounded-full bg-indigo-500/40 animate-ping" />
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                    </span>
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-white/8" />
                  )}
                </div>

                <div className="space-y-0.5">
                  <div className="flex items-center space-x-2">
                    <span className={`text-[10px] font-extrabold uppercase tracking-widest ${
                      isCompleted ? 'text-emerald-400/80' : isActive ? 'text-indigo-400' : 'text-slate-600'
                    }`}>
                      {node.title}
                    </span>
                    {isActive && (
                      <span className="text-[8px] font-bold text-indigo-400 bg-indigo-500/8 border border-indigo-500/15 px-1.5 py-0.5 rounded uppercase animate-pulse">
                        LIVE
                      </span>
                    )}
                  </div>
                  <p className={`text-[11px] font-normal leading-relaxed ${
                    isActive ? 'text-white' : isCompleted ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    {displayLog}
                  </p>

                  {/* Source sub-badges under Wave 1 */}
                  {node.id === 'wave1' && (isActive || isCompleted) && sourcesScanned.length > 0 && (
                    <div className="pt-2 flex flex-wrap gap-1.5 animate-card-entry">
                      {sourcesScanned.map(src => {
                        const resolved = resolvedSources.find(s => s.source === src.split('.')[0]);
                        const failed = failedSources.find(f => f.source === src.split('.')[0]);
                        const pending = !resolved && !failed;
                        const success = !!resolved?.success && !failed;
                        return (
                          <div
                            key={src}
                            className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[9px] border ${
                              pending ? 'bg-indigo-500/3 border-indigo-500/10 text-indigo-300 animate-pulse'
                              : success ? 'bg-emerald-500/5 border-emerald-500/15 text-emerald-400'
                              : 'bg-rose-500/5 border-rose-500/15 text-rose-400'
                            }`}
                          >
                            <span>{pending ? '·' : success ? '✓' : '✗'}</span>
                            <span className="capitalize">{src.split('.')[0]}</span>
                            {resolved && <span className="text-[8px] text-slate-500">({resolved.latencyMs}ms)</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Terminal log console */}
        <div className="space-y-2 pt-3 border-t border-white/5">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold font-mono tracking-widest text-slate-600 uppercase select-none">
              LIVE DIAGNOSTIC STREAM
            </span>
            <span className="text-[8px] text-slate-700 font-mono">
              {logs.length} events
            </span>
          </div>
          <div className="h-[140px] bg-[#05050A] border border-white/3 rounded-2xl p-4 overflow-y-auto font-mono text-[10px] space-y-1.5 scrollbar-thin select-none">
            {logs.length === 0 ? (
              <div className="text-slate-700 italic animate-connecting">Initializing logging channel...</div>
            ) : (
              logs.map((log, idx) => {
                // Color-code by prefix
                const isWire = log.includes('[WIRE]');
                const isGemini = log.includes('[GEMINI]');
                const isWarning = log.includes('⚠');
                const prefixColor = isWarning ? 'text-rose-400' : isGemini ? 'text-purple-400' : 'text-indigo-400';
                const parts = log.split('] ');
                const prefix = parts.length > 1 ? parts[0] + ']' : '';
                const rest = parts.length > 1 ? parts.slice(1).join('] ') : log;
                return (
                  <div key={idx} className="leading-relaxed whitespace-pre-wrap animate-card-entry flex space-x-2">
                    <span className={`font-bold flex-shrink-0 ${prefixColor}`}>{prefix}</span>
                    <span className="text-slate-400">{rest}</span>
                  </div>
                );
              })
            )}
            <div className="flex items-center space-x-1 pt-0.5">
              <span className="text-slate-700">SYS@VERDICT:~$</span>
              <span className="inline-block w-1.5 h-3 bg-indigo-500 animate-cursor-blink" />
            </div>
            <div ref={consoleBottomRef} />
          </div>
        </div>

      </div>
    </div>
  );
}

export default SkeletonLoader;
