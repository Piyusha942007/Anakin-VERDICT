'use client';

import React from 'react';

export function GlowingGlow() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {/* Orb 1: Violet/Purple Ambient Glow */}
      <div 
        className="absolute rounded-full blur-2xl opacity-100 animate-orb-1"
        style={{
          top: '-200px',
          left: '20%',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(124, 58, 237, 0.08) 0%, transparent 70%)'
        }}
      />
      {/* Orb 2: Cyan/Teal Ambient Glow */}
      <div 
        className="absolute rounded-full blur-2xl opacity-100 animate-orb-2"
        style={{
          top: '100px',
          right: '15%',
          width: '400px',
          height: '400px',
          background: 'radial-gradient(circle, rgba(6, 182, 212, 0.06) 0%, transparent 70%)'
        }}
      />
    </div>
  );
}

export default GlowingGlow;
