'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ConfidenceTick } from '../types/index.js';

interface LiveConfidenceMeterProps {
  liveConfidence: number;
  confidenceHistory: ConfidenceTick[];
}

// Smooth number counter hook
function useAnimatedNumber(target: number, duration = 600) {
  const [display, setDisplay] = useState(target);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(target);

  useEffect(() => {
    const from = fromRef.current;
    const to = target;
    if (from === to) return;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    startRef.current = null;

    const step = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(from + (to - from) * eased);
      setDisplay(current);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = to;
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);

  return display;
}

export default function LiveConfidenceMeter({ liveConfidence, confidenceHistory }: LiveConfidenceMeterProps) {
  const displayValue = useAnimatedNumber(liveConfidence, 700);
  const lastTick = confidenceHistory[confidenceHistory.length - 1];
  const delta = lastTick?.delta ?? 0;
  const reason = lastTick?.reason ?? 'Initialising pipeline...';
  const phase = lastTick?.phase ?? 'init';

  const [showDelta, setShowDelta] = useState(false);
  const [pulsing, setPulsing] = useState(false);
  const prevConfRef = useRef(liveConfidence);

  useEffect(() => {
    if (liveConfidence !== prevConfRef.current) {
      prevConfRef.current = liveConfidence;
      setShowDelta(true);
      setPulsing(true);
      const t1 = setTimeout(() => setShowDelta(false), 2200);
      const t2 = setTimeout(() => setPulsing(false), 800);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [liveConfidence]);

  // SVG radial gauge params
  const size = 120;
  const strokeW = 8;
  const r = (size - strokeW * 2) / 2;
  const circ = 2 * Math.PI * r;
  const fillPct = Math.min(displayValue / 100, 1);
  const dashoffset = circ * (1 - fillPct);

  // Color based on value
  const gaugeColor =
    displayValue >= 75 ? '#34d399' :   // emerald
    displayValue >= 55 ? '#f59e0b' :   // amber
    displayValue >= 35 ? '#fb923c' :   // orange
    '#f87171';                          // red

  const glowColor =
    displayValue >= 75 ? 'rgba(52,211,153,0.3)' :
    displayValue >= 55 ? 'rgba(245,158,11,0.3)' :
    displayValue >= 35 ? 'rgba(251,146,60,0.3)' :
    'rgba(248,113,113,0.3)';

  const deltaPositive = delta >= 0;
  const deltaColor = deltaPositive ? 'text-emerald-400' : 'text-rose-400';
  const deltaBg = deltaPositive ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20';
  const phaseColor =
    phase === 'conflict' ? 'text-amber-400' :
    phase === 'synthesis' ? 'text-indigo-400' :
    'text-emerald-400';

  // Sparkline dots (last 8 ticks)
  const sparkTicks = confidenceHistory.slice(-8);

  return (
    <div className="flex flex-col items-center space-y-3 select-none">
      {/* Radial SVG Gauge */}
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        {/* Outer pulse ring */}
        {pulsing && (
          <div
            className="absolute inset-0 rounded-full animate-ping"
            style={{ border: `2px solid ${gaugeColor}`, opacity: 0.35 }}
          />
        )}

        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          {/* Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={strokeW}
          />
          {/* Progress arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={gaugeColor}
            strokeWidth={strokeW}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={dashoffset}
            style={{
              transition: 'stroke-dashoffset 0.7s cubic-bezier(0.4,0,0.2,1), stroke 0.5s ease',
              filter: `drop-shadow(0 0 6px ${glowColor})`
            }}
          />
        </svg>

        {/* Center: number */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-extrabold font-mono leading-none tabular-nums"
            style={{ fontSize: 26, color: gaugeColor, textShadow: `0 0 12px ${glowColor}` }}
          >
            {displayValue}
          </span>
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
            CONF
          </span>
        </div>

        {/* Delta badge — floats top-right */}
        {showDelta && delta !== 0 && (
          <div
            className={`absolute -top-1 -right-1 px-1.5 py-0.5 rounded-md text-[10px] font-extrabold font-mono border ${deltaBg} ${deltaColor} animate-fade-in-up`}
          >
            {deltaPositive ? '+' : ''}{delta}
          </div>
        )}
      </div>

      {/* Current phase label */}
      <div className="text-center space-y-0.5 px-2">
        <div className={`text-[10px] font-extrabold uppercase tracking-widest font-mono ${phaseColor}`}>
          {phase === 'init' && '⬡ INITIALISED'}
          {phase === 'source' && '◉ SOURCE VERIFIED'}
          {phase === 'conflict' && '⚠ CONFLICT PENALTY'}
          {phase === 'synthesis' && '✦ SYNTHESIS LOCKED'}
        </div>
        <div className="text-[10px] text-slate-400 font-sans truncate max-w-[130px]" title={reason}>
          {reason}
        </div>
      </div>

      {/* Sparkline history */}
      {sparkTicks.length > 1 && (
        <div className="flex items-end space-x-1 h-6 px-1">
          {sparkTicks.map((tick, i) => {
            const dotColor =
              tick.phase === 'conflict' ? '#f59e0b' :
              tick.phase === 'synthesis' ? '#818cf8' :
              '#34d399';
            const heightPct = Math.max(20, (tick.value / 100) * 100);
            return (
              <div
                key={i}
                className="w-1.5 rounded-full transition-all duration-300"
                style={{
                  height: `${heightPct}%`,
                  backgroundColor: dotColor,
                  opacity: 0.5 + (i / sparkTicks.length) * 0.5,
                  boxShadow: i === sparkTicks.length - 1 ? `0 0 4px ${dotColor}` : 'none'
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
