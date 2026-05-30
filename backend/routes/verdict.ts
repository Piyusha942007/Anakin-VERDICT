import { Router, Request, Response } from 'express';
import logger from '../utils/logger.js';
import { getDb } from '../db/connection.js';
import { GeminiService } from '../services/gemini.js';
import { WaveOrchestrator } from '../orchestrators/wave.js';
import { IntentClassifier } from '../classifiers/intent.js';

const router = Router();
const geminiService = new GeminiService();
const orchestrator = new WaveOrchestrator();
const classifier = new IntentClassifier();

// --- Confidence Delta Weights ---
const SOURCE_WEIGHTS: Record<string, number> = {
  glassdoor: 12,
  linkedin:  13,
  moneycontrol: 12,
  screener:  11,
  shiksha:   11,
  amazon:    10,
  flipkart:  9,
  blind:     9,
  reddit:    8,
  ambitionbox: 9,
  crunchbase: 11,
  youtube:   7,
  placement: 8,
};

function getSourceDelta(sourceId: string, success: boolean): number {
  if (!success) return -3;
  const base = SOURCE_WEIGHTS[sourceId.toLowerCase()] ?? 8;
  return base;
}

function getConflictPenalty(severity: string): number {
  if (severity === 'HIGH')   return -14;
  if (severity === 'MEDIUM') return -8;
  return -4; // LOW
}

// Failure type classifier based on latency and error message
function classifyFailure(latencyMs: number, errMessage?: string): 'timeout' | 'rate_limit' | 'parse_error' | 'no_data' | 'network_error' {
  const msg = (errMessage || '').toLowerCase();
  if (latencyMs > 3000 || msg.includes('timeout') || msg.includes('abort')) return 'timeout';
  if (msg.includes('rate') || msg.includes('429') || msg.includes('throttle')) return 'rate_limit';
  if (msg.includes('parse') || msg.includes('json') || msg.includes('malformed')) return 'parse_error';
  if (msg.includes('empty') || msg.includes('no data') || msg.includes('not found')) return 'no_data';
  return 'network_error';
}

function getFailureReason(failureType: string, source: string, latencyMs: number): string {
  switch (failureType) {
    case 'timeout': return `Timeout after ${(latencyMs / 1000).toFixed(1)}s — ${source} scraper exceeded response window`;
    case 'rate_limit': return `Rate limited by ${source} — API quota exhausted, cooldown active`;
    case 'parse_error': return `Response parsing failed — ${source} returned malformed payload`;
    case 'no_data': return `No matching records found — ${source} returned empty dataset`;
    case 'network_error': return `Network error — connection to ${source} endpoint dropped`;
    default: return `${source} source unavailable`;
  }
}

/**
 * Shared handler to process verdict queries and stream SSE events
 */
async function processVerdictStream(query: string, res: Response, context?: any, decisionMode?: string, isDemoMode?: boolean) {
  // Setup SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable proxy buffering (Nginx)

  logger.info(`Processing SSE verdict pipeline for query: "${query}"`);

  // Helper to send formatted SSE messages matching exact required names
  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    // 0. Conversational Follow-Up Fast-Track Handler
    if (context) {
      logger.info(`Context detected. Launching conversational follow-up pipeline for: "${query}"`);
      const isDemoModeActive = isDemoMode || context.isDemoMode;

    // A. Intent Classified immediately — seed confidence at 50
      sendEvent('intent_classified', {
        category: context.category || 'CAREER',
        entities: {},
        reason: isDemoModeActive 
          ? "[DEMO_SIMULATOR] Focusing evaluation on follow-up question."
          : `Focusing evaluation on follow-up question: "${query}"`
      });
      sendEvent('confidence_update', { confidence: 50, delta: 0, reason: 'Pipeline initialised', phase: 'init' });
      await new Promise(resolve => setTimeout(resolve, 150));

      // B. Preserved Scrapers Evidence Graph (streamed instantly)
      let runningConf = 50;
      if (context.previousEvidence && Array.isArray(context.previousEvidence)) {
        for (const item of context.previousEvidence) {
          sendEvent('source_started', { source: item.source });
          await new Promise(resolve => setTimeout(resolve, 35));
          sendEvent('source_completed', {
            source: item.source,
            latencyMs: item.latencyMs || 8,
            success: item.success,
            data: item.data
          });
          const delta = getSourceDelta(item.source, item.success);
          runningConf = Math.min(95, Math.max(10, runningConf + delta));
          sendEvent('confidence_update', {
            confidence: runningConf,
            delta,
            reason: `${item.source} evidence preserved`,
            phase: 'source'
          });
          
          const sourceTitle = item.source.charAt(0).toUpperCase() + item.source.slice(1);
          const summary = context.previousEvidence?.find((e: any) => e.source === item.source)?.data?.summary || 
                          item.data?.summary || 
                          `Preserved E2E evidence graph from ${item.source}.`;
          sendEvent('evidence_update', { source: item.source, summary });
          await new Promise(resolve => setTimeout(resolve, 35));
        }
      }

      // C. Preserved Conflict Resolution matrix
      if (context.previousConflicts && Array.isArray(context.previousConflicts)) {
        sendEvent('conflict_detected', { conflicts: context.previousConflicts });
        for (const cf of context.previousConflicts) {
          const penalty = getConflictPenalty(cf.severity || 'MEDIUM');
          runningConf = Math.min(95, Math.max(10, runningConf + penalty));
          sendEvent('confidence_update', {
            confidence: runningConf,
            delta: penalty,
            reason: `Conflict: ${(cf.conflict || '').slice(0, 40)}...`,
            phase: 'conflict'
          });
          await new Promise(resolve => setTimeout(resolve, 80));
        }
        await new Promise(resolve => setTimeout(resolve, 80));
      }

      // D. Trigger Gemini Follow-up Synthesis
      sendEvent('stage', { 
        type: 'synthesizing', 
        message: isDemoModeActive 
          ? '[DEMO_SIMULATOR] Synthesizing conversational follow-up response...' 
          : 'Synthesizing conversational follow-up response...' 
      });

      const finalVerdict = isDemoModeActive
        ? geminiService.fallbackFollowUp(query, {
            parentQuery: context.parentQuery || query,
            category: context.category || 'CAREER',
            previousVerdict: context.previousVerdict || '',
            previousEvidence: context.previousEvidence || [],
            previousConflicts: context.previousConflicts || []
          }, decisionMode)
        : await geminiService.synthesizeFollowUp(query, {
            parentQuery: context.parentQuery || query,
            category: context.category || 'CAREER',
            previousVerdict: context.previousVerdict || '',
            previousEvidence: context.previousEvidence || [],
            previousConflicts: context.previousConflicts || []
          }, decisionMode);

      // E. Final confidence update — lock to Gemini's value
      sendEvent('confidence_update', { 
        confidence: finalVerdict.confidence, 
        delta: finalVerdict.confidence - runningConf,
        reason: 'Gemini synthesis complete',
        phase: 'synthesis'
      });
      await new Promise(resolve => setTimeout(resolve, 150));

      // F. Verdict Ready
      sendEvent('verdict_ready', { 
        verdict: finalVerdict.verdict, 
        confidence: finalVerdict.confidence,
        evidence: finalVerdict.evidence,
        conflicts: finalVerdict.conflicts,
        reasoning: finalVerdict.reasoning,
        confidenceBreakdown: finalVerdict.confidenceBreakdown,
        followUpQuestions: finalVerdict.followUpQuestions,
        bottomLine: finalVerdict.bottomLine || [],
        flipConditions: finalVerdict.flipConditions || [],
        indiaContext: finalVerdict.indiaContext
      });

      sendEvent('done', { source: isDemoModeActive ? 'demo' : 'followup' });
      res.end();
      return;
    }

    if (isDemoMode) {
      logger.info(`Demo Mode active. Launching simulator streaming loop for query: "${query}"`);
      try {
        const q = query.toLowerCase();
        let category = 'CAREER';
        if (q.includes('buy') || q.includes('worth it') || q.includes('price') || q.includes('kindle')) category = 'PURCHASE';
        else if (q.includes('invest') || q.includes('stock') || q.includes('apple')) category = 'FINANCE';
        else if (q.includes('college') || q.includes('placement') || q.includes('bootcamp') || q.includes('worth')) category = 'EDUCATION';

        // 1. Intent Classified — seed at 50
        sendEvent('intent_classified', {
          category,
          entities: {},
          reason: "[DEMO_SIMULATOR] Bypassed live classifier. Resolved from pre-seeded registry."
        });
        sendEvent('confidence_update', { confidence: 50, delta: 0, reason: 'Pipeline initialised', phase: 'init' });
        await new Promise(resolve => setTimeout(resolve, 200));

        // 2. Generate and stream mock evidence items
        let demoRunningConf = 50;
        let mockEvidence: any[] = [];
        let mockConflicts: any[] = [];

        if (category === 'CAREER') {
          mockEvidence = [
            { sourceId: 'glassdoor', source: 'glassdoor', latencyMs: 120, success: true, rawPayload: { rating: 4.1, reviewCount: 145 }, normalizedData: { summary: "Glassdoor: Average rating of 4.1★ over 145 employee reviews." } },
            { sourceId: 'blind', source: 'blind', latencyMs: 145, success: true, rawPayload: { quotes: ["Chaotic leadership but high learning curve", "WLB is highly team dependent"] }, normalizedData: { summary: "Blind: Community threads flag chaotic management style." } },
            { sourceId: 'reddit', source: 'reddit', latencyMs: 95, success: true, rawPayload: { topPost: "Is it worth joining early stage startup?", upvotes: 34 }, normalizedData: { summary: "Reddit: Consensus suggests joining early startup for high growth potential." } },
            { sourceId: 'linkedin', source: 'linkedin', latencyMs: 180, success: true, rawPayload: { stats: { startupJoinersMovedUp18MoPercent: 73, serviceJoinersMovedUp18MoPercent: 12 } }, normalizedData: { summary: "LinkedIn: Verified 73% startup promotions within 18 months." } },
            { sourceId: 'ambitionbox', source: 'ambitionbox', latencyMs: 150, success: true, rawPayload: { avgSalaryLPA: 7.2 }, normalizedData: { summary: "AmbitionBox: Benchmark Salary tracks SDE averages around 7.2 LPA." } }
          ];
          mockConflicts = [
            {
              conflict: "Glassdoor reports positive ratings but Blind reviews flag chaotic management",
              conflictingSources: ['Glassdoor', 'Blind'],
              explanation: "HR-led ratings on Glassdoor smooth out culture ratings, whereas SDE-centric discussions on Blind capture intense launch crunches.",
              severity: 'MEDIUM',
              recommendation: "Directly query the team lead regarding priority shifts and reporting hierarchies."
            }
          ];
        } else if (category === 'PURCHASE') {
          mockEvidence = [
            { sourceId: 'amazon', source: 'amazon', latencyMs: 110, success: true, rawPayload: { rating: 4.6, price: 11999 }, normalizedData: { summary: "Amazon: High 4.6★ customer satisfaction across 12,400+ purchases." } },
            { sourceId: 'flipkart', source: 'flipkart', latencyMs: 130, success: true, rawPayload: { price: 11499 }, normalizedData: { summary: "Flipkart: Price trends track stable averages at ₹11,499." } },
            { sourceId: 'reddit', source: 'reddit', latencyMs: 105, success: true, rawPayload: { topPost: "Kindle Paperwhite long-term review", upvotes: 112 }, normalizedData: { summary: "Reddit: Community highly recommends Paperwhite for distraction-free reading." } },
            { sourceId: 'youtube', source: 'youtube', latencyMs: 160, success: true, rawPayload: { videoCount: 8, consensus: "Highly Positive" }, normalizedData: { summary: "YouTube: Tech reviewers rate display crispness and battery life as best-in-class." } }
          ];
          mockConflicts = [
            {
              conflict: "Reddit threads recommend waiting for sales whereas Amazon prices show immediate discount eligibility",
              conflictingSources: ['Reddit', 'Amazon'],
              explanation: "Amazon is currently offering a limited bank card discount of 10% which offsets waiting for major festival events.",
              severity: 'LOW',
              recommendation: "Complete the checkout using eligible credit cards to lock in the 10% discount immediately."
            }
          ];
        } else if (category === 'FINANCE') {
          mockEvidence = [
            { sourceId: 'moneycontrol', source: 'moneycontrol', latencyMs: 125, success: true, rawPayload: { peRatio: 28.4, recommendations: "Buy" }, normalizedData: { summary: "Moneycontrol: Strong buy consensus. PE ratio is well-positioned relative to 5-year averages." } },
            { sourceId: 'screener', source: 'screener', latencyMs: 140, success: true, rawPayload: { ROCE: 32.5, debtToEquity: 0.12 }, normalizedData: { summary: "Screener: Financials show superior capital efficiency (32.5% ROCE) and low leverage (0.12 D/E)." } },
            { sourceId: 'reddit', source: 'reddit', latencyMs: 115, success: true, rawPayload: { topPost: "Apple stocks valuation analysis", upvotes: 88 }, normalizedData: { summary: "Reddit: Subreddit discussions recommend dollar-cost averaging to cushion against near-term macro volatility." } },
            { sourceId: 'youtube', source: 'youtube', latencyMs: 175, success: true, rawPayload: { sentiment: "Neutral-Bullish" }, normalizedData: { summary: "YouTube: Market analysts highlight strong services growth offsets hardware cycles." } }
          ];
          mockConflicts = [
            {
              conflict: "Screener logs confirm record cash positions but Reddit retail threads express valuation fatigue",
              conflictingSources: ['Screener', 'Reddit'],
              explanation: "Institutional metrics favor strong balance sheet cushions, while retail discussions react to temporary high-PE multiples.",
              severity: 'MEDIUM',
              recommendation: "Mitigate near-term variance by staggering purchases over three monthly tranches."
            }
          ];
        } else {
          mockEvidence = [
            { sourceId: 'shiksha', source: 'shiksha', latencyMs: 115, success: true, rawPayload: { rating: 4.3, placementRate: 85 }, normalizedData: { summary: "Shiksha: High ratings for structured curriculum and job placement guidance." } },
            { sourceId: 'placement', source: 'placement', latencyMs: 135, success: true, rawPayload: { avgSalaryLPA: 6.5 }, normalizedData: { summary: "Placement Logs: Historical statistics benchmark graduating batch average salary at ₹6.5 LPA." } },
            { sourceId: 'reddit', source: 'reddit', latencyMs: 110, success: true, rawPayload: { topPost: "Is ₹50k bootcamp worth it?", upvotes: 56 }, normalizedData: { summary: "Reddit: Alumni emphasize that networking value outpaces standard curriculum." } },
            { sourceId: 'youtube', source: 'youtube', latencyMs: 155, success: true, rawPayload: { reviews: "Positive for self-starters" }, normalizedData: { summary: "YouTube: Industry mentors suggest self-guided learning is cheaper but lacks job networks." } }
          ];
          mockConflicts = [
            {
              conflict: "Placement reports list high recruitment averages but Reddit alumni flag uneven support",
              conflictingSources: ['Placement', 'Reddit'],
              explanation: "Top 20% of the batch secures premium roles skewing average statistics, while retail reviews capture placement variance.",
              severity: 'MEDIUM',
              recommendation: "Ensure eligibility for corporate placement drives by maintaining high core project benchmarks."
            }
          ];
        }

        // Inject 1 simulated failed source per category for demo showcase
        const demoFailedSources: Array<{source: string; reason: string; latencyMs: number; confidencePenalty: number; failureType: string; retryStatus: string}> = [];
        if (category === 'CAREER') {
          demoFailedSources.push({ source: 'crunchbase', reason: 'Timeout after 4.2s — crunchbase scraper exceeded response window', latencyMs: 4200, confidencePenalty: 5, failureType: 'timeout', retryStatus: 'retried_failed' });
        } else if (category === 'PURCHASE') {
          demoFailedSources.push({ source: 'pricehistory', reason: 'Rate limited by pricehistory — API quota exhausted, cooldown active', latencyMs: 850, confidencePenalty: 4, failureType: 'rate_limit', retryStatus: 'not_retried' });
        } else if (category === 'FINANCE') {
          demoFailedSources.push({ source: 'economictimes', reason: 'Response parsing failed — economictimes returned malformed payload', latencyMs: 1200, confidencePenalty: 3, failureType: 'parse_error', retryStatus: 'retried_failed' });
        } else {
          demoFailedSources.push({ source: 'collegedunia', reason: 'No matching records found — collegedunia returned empty dataset', latencyMs: 680, confidencePenalty: 3, failureType: 'no_data', retryStatus: 'not_retried' });
        }

        // Stream sources starts and completions
        for (const item of mockEvidence) {
          sendEvent('source_started', { source: item.sourceId });
          await new Promise(resolve => setTimeout(resolve, 80));

          sendEvent('source_completed', {
            source: item.sourceId,
            latencyMs: item.latencyMs,
            success: item.success,
            data: item.rawPayload
          });
          await new Promise(resolve => setTimeout(resolve, 50));

          // Live confidence tick per source
          const delta = getSourceDelta(item.sourceId, item.success);
          demoRunningConf = Math.min(95, Math.max(10, demoRunningConf + delta));
          sendEvent('confidence_update', {
            confidence: demoRunningConf,
            delta,
            reason: `${item.sourceId} verified ✓`,
            phase: 'source'
          });

          sendEvent('evidence_update', {
            source: item.sourceId,
            summary: item.normalizedData.summary
          });
          await new Promise(resolve => setTimeout(resolve, 80));
        }

        // Stream demo failed sources
        for (const failedSrc of demoFailedSources) {
          sendEvent('source_started', { source: failedSrc.source });
          await new Promise(resolve => setTimeout(resolve, 120));
          sendEvent('source_failed', {
            source: failedSrc.source,
            reason: failedSrc.reason,
            latencyMs: failedSrc.latencyMs,
            confidencePenalty: failedSrc.confidencePenalty,
            retryStatus: failedSrc.retryStatus,
            failureType: failedSrc.failureType
          });
          const penalty = -failedSrc.confidencePenalty;
          demoRunningConf = Math.min(95, Math.max(10, demoRunningConf + penalty));
          sendEvent('confidence_update', {
            confidence: demoRunningConf,
            delta: penalty,
            reason: `${failedSrc.source} unavailable`,
            phase: 'source'
          });
          await new Promise(resolve => setTimeout(resolve, 80));
        }

        // 3. Conflicts Detected — apply penalties
        if (mockConflicts.length > 0) {
          sendEvent('conflict_detected', { conflicts: mockConflicts });
          for (const cf of mockConflicts) {
            const penalty = getConflictPenalty(cf.severity || 'MEDIUM');
            demoRunningConf = Math.min(95, Math.max(10, demoRunningConf + penalty));
            sendEvent('confidence_update', {
              confidence: demoRunningConf,
              delta: penalty,
              reason: `Conflict flagged (${cf.severity})`,
              phase: 'conflict'
            });
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          await new Promise(resolve => setTimeout(resolve, 80));
        }

        // 4. Synthesize final response using geminiService.fallbackVerdictSynthesizer
        sendEvent('stage', { type: 'synthesizing', message: "[DEMO_SIMULATOR] Running simulator synthesis models..." });
        
        const finalVerdict = geminiService.fallbackVerdictSynthesizer(
          query,
          category,
          mockEvidence,
          mockConflicts,
          decisionMode
        );
        await new Promise(resolve => setTimeout(resolve, 150));

        // 5. Final confidence — lock to synthesized value
        sendEvent('confidence_update', {
          confidence: finalVerdict.confidence,
          delta: finalVerdict.confidence - demoRunningConf,
          reason: 'Gemini synthesis complete',
          phase: 'synthesis'
        });
        await new Promise(resolve => setTimeout(resolve, 150));

        // 6. Verdict Ready
        sendEvent('verdict_ready', {
          verdict: finalVerdict.verdict,
          confidence: finalVerdict.confidence,
          evidence: finalVerdict.evidence,
          conflicts: finalVerdict.conflicts,
          reasoning: finalVerdict.reasoning,
          confidenceBreakdown: finalVerdict.confidenceBreakdown,
          followUpQuestions: finalVerdict.followUpQuestions,
          bottomLine: finalVerdict.bottomLine || [],
          flipConditions: finalVerdict.flipConditions || [],
          indiaContext: finalVerdict.indiaContext
        });
        await new Promise(resolve => setTimeout(resolve, 100));

        // 7. Done
        sendEvent('done', { source: 'demo' });
        res.end();
        return;
      } catch (err: any) {
        logger.error('Demo simulation crashed:', err);
        sendEvent('error', { message: err.message || 'Severe demo simulation exception.' });
        res.end();
        return;
      }
    }

    const db = await getDb();
    
    // Check SQLite cache first
    const cachedRow = await db.get(
      'SELECT * FROM verdict_cache WHERE query = ?',
      query.toLowerCase().trim()
    );

    if (cachedRow) {
      logger.success(`Cache HIT for query: "${query}"`);
      
      // Simulate live streaming from cache for premium Perplexity/Cursor feel
      const parsedVerdict = JSON.parse(cachedRow.verdict);
      const evidenceList = JSON.parse(cachedRow.evidence);
      const conflictsList = JSON.parse(cachedRow.conflicts);

      // 1. Intent Classified
      sendEvent('intent_classified', { 
        category: cachedRow.category, 
        entities: {}, 
        reason: 'Resolved from caching repository.' 
      });
      await new Promise(resolve => setTimeout(resolve, 300));

      // 2. Stream sources start/complete with live confidence ticks
      let cacheRunningConf = 50;
      sendEvent('confidence_update', { confidence: 50, delta: 0, reason: 'Pipeline initialised', phase: 'init' });

      for (const item of evidenceList) {
        const sourceNameId = item.sourceId || item.source;
        sendEvent('source_started', { source: sourceNameId });
        await new Promise(resolve => setTimeout(resolve, 150));
        
        sendEvent('source_completed', { 
          source: sourceNameId, 
          latencyMs: item.attribution?.latencyMs || item.latencyMs || 200, 
          success: item.success !== false, 
          data: item.rawPayload || item.data 
        });

        // Emit source_failed for unsuccessful cached sources
        if (item.success === false) {
          const fType = classifyFailure(item.attribution?.latencyMs || item.latencyMs || 0);
          sendEvent('source_failed', {
            source: sourceNameId,
            reason: getFailureReason(fType, sourceNameId, item.attribution?.latencyMs || item.latencyMs || 0),
            latencyMs: item.attribution?.latencyMs || item.latencyMs || 0,
            confidencePenalty: 3,
            retryStatus: 'not_retried',
            failureType: fType
          });
        }

        const delta = getSourceDelta(sourceNameId, item.success !== false);
        cacheRunningConf = Math.min(95, Math.max(10, cacheRunningConf + delta));
        sendEvent('confidence_update', {
          confidence: cacheRunningConf,
          delta,
          reason: item.success === false ? `${sourceNameId} unavailable` : `${sourceNameId} verified ✓`,
          phase: 'source'
        });

        // 3. Evidence update
        const sourceTitle = sourceNameId.charAt(0).toUpperCase() + sourceNameId.slice(1);
        const summary = parsedVerdict.evidenceSummary?.[sourceTitle] || 
                        parsedVerdict.evidenceSummary?.[sourceNameId] || 
                        `Live ${sourceNameId} data verified.`;
        
        sendEvent('evidence_update', { source: sourceNameId, summary });
        await new Promise(resolve => setTimeout(resolve, 150));
      }

      // 4. Conflicts — apply penalties
      if (conflictsList.length > 0) {
        sendEvent('conflict_detected', { conflicts: conflictsList });
        for (const cf of conflictsList) {
          const penalty = getConflictPenalty(cf.severity || 'MEDIUM');
          cacheRunningConf = Math.min(95, Math.max(10, cacheRunningConf + penalty));
          sendEvent('confidence_update', {
            confidence: cacheRunningConf,
            delta: penalty,
            reason: `Conflict flagged (${cf.severity || 'MEDIUM'})`,
            phase: 'conflict'
          });
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        await new Promise(resolve => setTimeout(resolve, 150));
      }

      // 5. Final confidence — lock to cached value
      sendEvent('confidence_update', { 
        confidence: parsedVerdict.confidence,
        delta: parsedVerdict.confidence - cacheRunningConf,
        reason: 'Synthesis complete (cached)',
        phase: 'synthesis'
      });
      await new Promise(resolve => setTimeout(resolve, 300));

      // 6. Verdict ready
      sendEvent('verdict_ready', { 
        verdict: parsedVerdict.verdict, 
        explanation: parsedVerdict.explanation,
        evidenceSummary: parsedVerdict.evidenceSummary,
        conflictsResolved: parsedVerdict.conflictsResolved,
        confidenceBreakdown: parsedVerdict.confidenceBreakdown,
        confidence: parsedVerdict.confidence,
        bottomLine: parsedVerdict.bottomLine || [],
        flipConditions: parsedVerdict.flipConditions || [],
        indiaContext: parsedVerdict.indiaContext
      });

      sendEvent('done', { source: 'cache' });
      res.end();
      return;
    }

    // Cache Miss: Run Live Pipeline
    logger.info(`Cache MISS. Launching real pipeline for: "${query}"`);

    // 1. Intent Classification
    sendEvent('stage', { type: 'classifying', message: 'Analyzing question dilemma intent...' });
    const classification = await classifier.classify(query);
    sendEvent('intent_classified', { 
      category: classification.decisionType, 
      entities: {}, 
      reason: classification.reasoning 
    });

    // 2. Wave Orchestration with progressive streaming + live confidence
    let liveRunningConf = 50;
    sendEvent('confidence_update', { confidence: 50, delta: 0, reason: 'Pipeline initialised', phase: 'init' });

    const { evidence, conflicts } = await orchestrator.orchestrate(
      query,
      classification.decisionType,
      {},
      (stage, payload) => {
        if (stage === 'wave1_start' || stage === 'wave2_start') {
          payload.sources.forEach((src: string) => {
            sendEvent('source_started', { source: src.split('.')[0] });
          });
        } 
        else if (stage === 'source_resolved') {
          sendEvent('source_completed', {
            source: payload.source,
            latencyMs: payload.latencyMs,
            success: payload.success,
            data: payload.data
          });

          // Emit source_failed for failed live sources
          if (!payload.success) {
            const fType = classifyFailure(payload.latencyMs);
            sendEvent('source_failed', {
              source: payload.source,
              reason: getFailureReason(fType, payload.source, payload.latencyMs),
              latencyMs: payload.latencyMs,
              confidencePenalty: Math.abs(getSourceDelta(payload.source, false)),
              retryStatus: 'not_retried',
              failureType: fType
            });
          }

          const delta = getSourceDelta(payload.source, payload.success);
          liveRunningConf = Math.min(95, Math.max(10, liveRunningConf + delta));
          sendEvent('confidence_update', {
            confidence: liveRunningConf,
            delta,
            reason: payload.success ? `${payload.source} verified ✓` : `${payload.source} unavailable`,
            phase: 'source'
          });
        }
      }
    );

    // Stream initial raw previews as evidence updates before the final synthesis
    for (const item of evidence) {
      let previewSummary = `Scanned ${item.sourceId} logs. Found active matching records.`;
      if (item.sourceId === 'glassdoor' && item.rawPayload?.rating) {
        previewSummary = `Glassdoor: Average rating of ${item.rawPayload.rating}★ over ${item.rawPayload.reviewCount} employee reviews.`;
      } else if (item.sourceId === 'blind' && item.rawPayload?.quotes?.length > 0) {
        previewSummary = `Blind: Community threads highlights: "${item.rawPayload.quotes[0].slice(0, 75)}..."`;
      } else if (item.sourceId === 'reddit' && item.rawPayload?.topPost) {
        previewSummary = `Reddit: consensus discussion "${item.rawPayload.topPost.slice(0, 70)}..." with ${item.rawPayload.upvotes} upvotes.`;
      } else if (item.sourceId === 'linkedin' && item.rawPayload?.stats) {
        previewSummary = `LinkedIn: Verified ${item.rawPayload.stats.startupJoinersMovedUp18MoPercent}% startup promotions vs ${item.rawPayload.stats.serviceJoinersMovedUp18MoPercent}% in service companies.`;
      } else if (item.sourceId === 'crunchbase' && item.rawPayload?.fundingStage) {
        previewSummary = `Crunchbase: Identified ${item.rawPayload.fundingStage} funding round. Led by ${item.rawPayload.leadInvestors?.join(', ')}.`;
      } else if (item.sourceId === 'ambitionbox' && item.rawPayload?.avgSalaryLPA) {
        previewSummary = `AmbitionBox: Benchmark Salary tracks SDE averages around ${item.rawPayload.avgSalaryLPA} LPA.`;
      }

      sendEvent('evidence_update', { source: item.sourceId, summary: previewSummary });
      await new Promise(resolve => setTimeout(resolve, 150));
    }

    // 3. Conflicts Detected — apply penalties
    if (conflicts.length > 0) {
      sendEvent('conflict_detected', { conflicts });
      for (const cf of conflicts) {
        const penalty = getConflictPenalty((cf as any).severity || 'MEDIUM');
        liveRunningConf = Math.min(95, Math.max(10, liveRunningConf + penalty));
        sendEvent('confidence_update', {
          confidence: liveRunningConf,
          delta: penalty,
          reason: `Conflict flagged (${(cf as any).severity || 'MEDIUM'})`,
          phase: 'conflict'
        });
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // 4. Gemini Synthesis
    const finalVerdict = await geminiService.synthesizeVerdict(
      query,
      classification.decisionType,
      evidence,
      conflicts,
      decisionMode
    );

    // 5. Final Confidence — lock to Gemini's value
    sendEvent('confidence_update', { 
      confidence: finalVerdict.confidence,
      delta: finalVerdict.confidence - liveRunningConf,
      reason: 'Gemini synthesis complete',
      phase: 'synthesis'
    });
    await new Promise(resolve => setTimeout(resolve, 200));

    // 6. Verdict Ready (Emit complete synthesized verdict)
    sendEvent('verdict_ready', { 
      verdict: finalVerdict.verdict, 
      confidence: finalVerdict.confidence,
      evidence: finalVerdict.evidence,
      conflicts: finalVerdict.conflicts,
      reasoning: finalVerdict.reasoning,
      confidenceBreakdown: finalVerdict.confidenceBreakdown,
      followUpQuestions: finalVerdict.followUpQuestions,
      bottomLine: finalVerdict.bottomLine || [],
      flipConditions: finalVerdict.flipConditions || []
    });

    // 7. Save cache in SQLite
    try {
      await db.run(`
        INSERT INTO verdict_cache (query, category, verdict, confidence, evidence, conflicts)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
        query.toLowerCase().trim(),
        classification.decisionType,
        JSON.stringify(finalVerdict),
        finalVerdict.confidence,
        JSON.stringify(evidence),
        JSON.stringify(conflicts)
      );
      logger.success('Verdict cached successfully.');
    } catch (err: any) {
      logger.error('Database caching error:', err.message);
    }

    sendEvent('done', { source: 'live' });
    res.end();

  } catch (err: any) {
    logger.error('Pipeline SSE stream crashed:', err);
    sendEvent('error', { message: err.message || 'Severe pipeline exception.' });
    res.end();
  }
}

/**
 * GET /api/verdict - Direct EventSource endpoint
 */
router.get('/', async (req: Request, res: Response) => {
  const query = req.query.query as string;
  if (!query || query.trim() === '') {
    res.status(400).json({ error: 'Query is required' });
    return;
  }
  await processVerdictStream(query, res);
});

/**
 * POST /api/verdict - Modern fetch-readable stream endpoint
 */
router.post('/', async (req: Request, res: Response) => {
  const { query, context, decisionMode, isDemoMode } = req.body;
  if (!query || query.trim() === '') {
    res.status(400).json({ error: 'Query in request body is required' });
    return;
  }
  await processVerdictStream(query, res, context, decisionMode, isDemoMode);
});

export default router;
