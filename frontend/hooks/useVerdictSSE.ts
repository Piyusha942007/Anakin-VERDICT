'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { VerdictState, StreamStage, WireSourceResult, VerdictResponse, ConfidenceTick, FailedSource } from '../types/index.js';

export function useVerdictSSE() {
  const [state, setState] = useState<VerdictState>({
    stage: 'idle',
    query: '',
    sourcesScanned: [],
    resolvedSources: [],
    conflicts: [],
    liveConfidence: undefined,
    confidenceHistory: [],
    failedSources: []
  });
  const [isStreaming, setIsStreaming] = useState(false);
  const activeReaderRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  const resetStream = useCallback(() => {
    if (activeReaderRef.current) {
      activeReaderRef.current.cancel();
      activeReaderRef.current = null;
    }
    setState({
      stage: 'idle',
      query: '',
      sourcesScanned: [],
      resolvedSources: [],
      conflicts: [],
      liveConfidence: undefined,
      confidenceHistory: [],
      failedSources: []
    });
    setIsStreaming(false);
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (activeReaderRef.current) {
        activeReaderRef.current.cancel();
      }
    };
  }, []);

  const startStream = useCallback(async (query: string, context?: any, decisionMode?: string, isDemoMode?: boolean) => {
    if (!query || query.trim() === '') return;

    resetStream();
    setIsStreaming(true);
    setState({
      stage: 'classifying',
      query: query,
      sourcesScanned: [],
      resolvedSources: [],
      conflicts: [],
      isDemoMode: isDemoMode,
      decisionMode: decisionMode || 'Balanced',
      liveConfidence: undefined,
      confidenceHistory: [],
      failedSources: []
    });

    try {
      const url = process.env.NEXT_PUBLIC_API_URL 
        ? `${process.env.NEXT_PUBLIC_API_URL}/api/verdict`
        : 'http://localhost:5000/api/verdict';

      // Natively trigger a POST request with the query in request body
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, context, decisionMode, isDemoMode })
      });

      if (!response.ok || !response.body) {
        throw new Error(`Failed to initiate stream: HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      activeReaderRef.current = reader;
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // SSE frames are demarcated by double newlines
        const blocks = buffer.split('\n\n');
        buffer = blocks.pop() || ''; // Keep trailing partial chunk

        for (const block of blocks) {
          if (block.trim() === '') continue;

          let eventName = '';
          let dataStr = '';

          // Parse lines in block
          const lines = block.split('\n');
          for (const line of lines) {
            if (line.startsWith('event:')) {
              eventName = line.substring(6).trim();
            } else if (line.startsWith('data:')) {
              dataStr = line.substring(5).trim();
            }
          }

          if (eventName && dataStr) {
            try {
              const payload = JSON.parse(dataStr);
              
              setState(prev => {
                const updated = { ...prev };

                switch (eventName) {
                  case 'intent_classified':
                    updated.stage = 'intent_classified';
                    updated.category = payload.category;
                    updated.entities = payload.entities;
                    updated.reason = payload.reason;
                    break;

                  case 'source_started':
                    updated.stage = 'wave1_start';
                    // Prevent duplicates
                    if (!prev.sourcesScanned.includes(payload.source)) {
                      updated.sourcesScanned = [...prev.sourcesScanned, payload.source];
                    }
                    break;

                  case 'source_completed':
                    updated.stage = 'source_resolved';
                    if (!prev.resolvedSources.some(s => s.source === payload.source)) {
                      const newSource: WireSourceResult = {
                        source: payload.source,
                        success: payload.success,
                        latencyMs: payload.latencyMs,
                        data: payload.data,
                        historicalReliability: payload.historicalReliability || 100
                      };
                      updated.resolvedSources = [...prev.resolvedSources, newSource];
                    }
                    break;

                  case 'source_failed': {
                    const failedEntry: FailedSource = {
                      source: payload.source,
                      reason: payload.reason || 'Source unavailable',
                      latencyMs: payload.latencyMs || 0,
                      confidencePenalty: payload.confidencePenalty || 3,
                      retryStatus: payload.retryStatus || 'not_retried',
                      failureType: payload.failureType || 'network_error',
                      timestamp: Date.now()
                    };
                    if (!prev.failedSources?.some(f => f.source === failedEntry.source)) {
                      updated.failedSources = [...(prev.failedSources || []), failedEntry];
                    }
                    break;
                  }

                  case 'evidence_update':
                    if (!updated.verdict) {
                      updated.verdict = {
                        verdict: '',
                        confidence: 0,
                        reasoning: '',
                        evidence: {},
                        conflicts: [],
                        confidenceBreakdown: [],
                        followUpQuestions: []
                      };
                    }
                    const sourceKey = payload.source.charAt(0).toUpperCase() + payload.source.slice(1);
                    updated.verdict.evidence = {
                      ...updated.verdict.evidence,
                      [sourceKey]: payload.summary
                    };
                    break;

                  case 'conflict_detected':
                    updated.stage = 'conflicts_detected';
                    updated.conflicts = payload.conflicts;
                    if (updated.verdict) {
                      updated.verdict.conflicts = payload.conflicts;
                    }
                    break;

                  case 'confidence_update':
                    updated.stage = 'synthesizing';
                    updated.liveConfidence = payload.confidence;
                    if (payload.delta !== undefined) {
                      const tick: ConfidenceTick = {
                        value: payload.confidence,
                        delta: payload.delta,
                        reason: payload.reason || '',
                        phase: payload.phase || 'source',
                        timestamp: Date.now()
                      };
                      updated.confidenceHistory = [...(prev.confidenceHistory || []), tick];
                    }
                    if (updated.verdict) {
                      updated.verdict.confidence = payload.confidence;
                      if (payload.confidenceBreakdown) {
                        updated.verdict.confidenceBreakdown = payload.confidenceBreakdown;
                      }
                    }
                    break;

                  case 'verdict_ready':
                    updated.stage = 'verdict_ready';
                    updated.verdict = {
                      verdict: payload.verdict,
                      confidence: payload.confidence,
                      reasoning: payload.reasoning || payload.explanation || '',
                      evidence: { ...prev.verdict?.evidence, ...payload.evidence },
                      conflicts: payload.conflicts || payload.conflictsResolved || prev.conflicts || [],
                      confidenceBreakdown: payload.confidenceBreakdown || [],
                      followUpQuestions: payload.followUpQuestions || [],
                      bottomLine: payload.bottomLine || [],
                      flipConditions: payload.flipConditions || [],
                      indiaContext: payload.indiaContext || undefined
                    };
                    break;

                  case 'done':
                    updated.stage = 'done';
                    updated.isCached = payload.source === 'cache';
                    break;

                  case 'error':
                    updated.stage = 'error';
                    updated.errorMessage = payload.message || 'Stream processing failure.';
                    break;
                }

                return updated;
              });

            } catch (err) {
              console.error('Error parsing individual SSE data frame:', err, dataStr);
            }
          }
        }
      }

      setIsStreaming(false);

    } catch (err: any) {
      console.error('E2E stream fetch reader crashed:', err);
      setState(prev => ({
        ...prev,
        stage: 'error',
        errorMessage: err.message || 'Pipeline fetch streaming error occurred.'
      }));
      setIsStreaming(false);
    }
  }, [resetStream]);

  return {
    state,
    setState,
    startStream,
    resetStream,
    isStreaming
  };
}
