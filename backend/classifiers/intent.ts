import { GoogleGenerativeAI } from '@google/generative-ai';
import logger from '../utils/logger.js';

export interface WireSourceInfo {
  id: string;
  name: string;
  reliabilityWeight: number; // Decimal weight representing historical credibility (0.0 to 1.0)
  description: string;
}

// 1. REUSABLE SOURCE REGISTRY
export const SOURCE_REGISTRY: Record<string, WireSourceInfo> = {
  // Career Scrapers
  'glassdoor': { id: 'glassdoor.company_reviews', name: 'Glassdoor Reviews', reliabilityWeight: 0.85, description: 'Employee ratings, pros, cons, and management metrics.' },
  'blind': { id: 'blind.company_reviews', name: 'Blind Sentiment', reliabilityWeight: 0.90, description: 'Professional anonymous salary discussions and consensus.' },
  'linkedin': { id: 'linkedin.career_outcomes', name: 'LinkedIn Outcomes', reliabilityWeight: 0.95, description: 'Alumni retention, roles progression, and career velocity.' },
  'reddit': { id: 'reddit.search', name: 'Reddit Search', reliabilityWeight: 0.80, description: 'Community threads consensus and unfiltered user feedback.' },
  'news': { id: 'news.recent', name: 'Recent News Scraper', reliabilityWeight: 0.85, description: 'Layoff reports, dynamic corporate hiring and leadership updates.' },
  'crunchbase': { id: 'crunchbase.company', name: 'Crunchbase Funding', reliabilityWeight: 0.95, description: 'Venture funding history, lead investor logs, and growth signals.' },
  'ambitionbox': { id: 'ambitionbox.salaries', name: 'AmbitionBox Salaries', reliabilityWeight: 0.90, description: 'Verified salary range distributions and role averages.' },

  // Purchase Scrapers
  'amazon': { id: 'amazon.product', name: 'Amazon Product Scanner', reliabilityWeight: 0.90, description: 'Verified buyer reviews, product specs, and rating distributions.' },
  'flipkart': { id: 'flipkart.product', name: 'Flipkart Product Scanner', reliabilityWeight: 0.85, description: 'Alternative price scans and reviews.' },
  'pricehistory': { id: 'pricehistory.track', name: 'Price History Tracker', reliabilityWeight: 0.95, description: 'Scapes price timeline graphs to spot artificial inflation.' },

  // Finance Scrapers
  'screener': { id: 'screener.ratios', name: 'Screener Financials', reliabilityWeight: 0.95, description: 'P/E ratios, debt-to-equity levels, and quarterly profit margins.' },
  'moneycontrol': { id: 'moneycontrol.search', name: 'Moneycontrol Trends', reliabilityWeight: 0.90, description: 'Market cap indicators, investor posts, and broker ratings.' },

  // Education Scrapers
  'shiksha': { id: 'shiksha.college_stats', name: 'Shiksha placements', reliabilityWeight: 0.88, description: 'Placement percentiles, highest/average packages, and course fees.' }
};

export type DecisionType = 'PURCHASE' | 'CAREER' | 'FINANCE' | 'EDUCATION';

export interface ClassificationResult {
  decisionType: DecisionType;
  confidence: number; // 0 - 100
  reasoning: string;
  sources: string[]; // Mapped to SOURCE_REGISTRY keys
}

// 2. BUNDLE CONFIGURATION SYSTEM
export interface BundleConfig {
  type: DecisionType;
  baseSources: string[]; // References to SOURCE_REGISTRY keys
  keywords: string[];
}

export const BUNDLE_CONFIGS: Record<DecisionType, BundleConfig> = {
  PURCHASE: {
    type: 'PURCHASE',
    baseSources: ['amazon', 'flipkart', 'reddit'],
    keywords: ['buy', 'purchase', 'worth', 'laptop', 'phone', 'price', 'gadget', 'review', 'recommend', 'flipkart', 'amazon', 'monitor', 'keyboard']
  },
  CAREER: {
    type: 'CAREER',
    baseSources: ['glassdoor', 'blind', 'linkedin', 'reddit', 'news'],
    keywords: ['join', 'job', 'offer', 'startup', 'service company', 'salary', 'lpa', 'tcs', 'wipro', 'infosys', 'accenture', 'promotion', 'hiring', 'workplace', 'employer']
  },
  FINANCE: {
    type: 'FINANCE',
    baseSources: ['screener', 'moneycontrol', 'reddit', 'news'],
    keywords: ['invest', 'stock', 'shares', 'mutual fund', 'crypto', 'bitcoin', 'screener', 'moneycontrol', 'dividend', 'debt', 'return', 'etf', 'portfolio']
  },
  EDUCATION: {
    type: 'EDUCATION',
    baseSources: ['shiksha', 'reddit', 'linkedin'],
    keywords: ['college', 'course', 'university', 'shiksha', 'placement', 'mba', 'engineering', 'degree', 'admission', 'fees', 'bootcamp']
  }
};

// 3. INTENT CLASSIFICATION ENGINE
export class IntentClassifier {
  private genAI: GoogleGenerativeAI | null = null;
  private modelName = 'gemini-1.5-flash';

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || '';
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
  }

  /**
   * Routes query dynamically utilizing Gemini API with strict rule-based keyword fallbacks
   */
  async classify(query: string): Promise<ClassificationResult> {
    logger.system(`IntentClassifier resolving routing for dilemma: "${query}"`);

    if (!this.genAI) {
      logger.warn('Gemini client absent. Executing offline heuristic routing utility.');
      return this.fallbackKeywordClassifier(query);
    }

    try {
      const model = this.genAI.getGenerativeModel({
        model: this.modelName,
        generationConfig: { responseMimeType: 'application/json' }
      });

      const prompt = `
        You are the core intent classifier and bundle selector for the VERDICT decision engine.
        Your job is to categorize the user's dilemma query into one of 4 decision types:
        - PURCHASE: Scans for products, gadgets, software purchase reviews, worth, or pricing.
        - CAREER: Scans for job offers, joining a company, company comparisons, salary numbers, or career acceleration.
        - FINANCE: Scans for stock investments, mutual funds, assets, or trading portfolio options.
        - EDUCATION: Scans for college placement checks, courses worth, degrees, admissions, or fees.

        AVAILABLE DATA SOURCES REGISTRY (You must only select source identifiers present in this registry):
        ${JSON.stringify(Object.keys(SOURCE_REGISTRY))}

        Output strictly a JSON block and nothing else. No explanation, no backticks, matching the format:
        {
          "decisionType": "PURCHASE" | "CAREER" | "FINANCE" | "EDUCATION",
          "confidence": number (confidence rating from 0 to 100),
          "reasoning": "1-sentence explanation of intent classification",
          "sources": ["source_key_1", "source_key_2", ...]
        }

        User query: "${query}"
      `;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const parsed = JSON.parse(text) as ClassificationResult;

      // Validate parsed outputs and fall back to configs if schema mismatch
      if (!['PURCHASE', 'CAREER', 'FINANCE', 'EDUCATION'].includes(parsed.decisionType)) {
        throw new Error('Invalid decisionType returned from AI model.');
      }

      // Enforce only registered sources are passed
      const validatedSources = parsed.sources.filter(s => s in SOURCE_REGISTRY);
      if (validatedSources.length === 0) {
        parsed.sources = BUNDLE_CONFIGS[parsed.decisionType].baseSources;
      } else {
        parsed.sources = validatedSources;
      }

      logger.success(`Classifier routed to "${parsed.decisionType}" bundle with ${parsed.confidence}% confidence.`);
      return parsed;

    } catch (err: any) {
      logger.error(`AI Classifier failed: ${err.message}. Invoking configuration fallback routing.`);
      return this.fallbackKeywordClassifier(query);
    }
  }

  /**
   * Extensible Rule-based Fallback Router (Keyword scanning)
   */
  private fallbackKeywordClassifier(query: string): ClassificationResult {
    const q = query.toLowerCase();
    let bestType: DecisionType = 'CAREER'; // Default fallback
    let maxMatches = 0;

    // Scan through all bundle configs to count keyword intersections
    for (const key of Object.keys(BUNDLE_CONFIGS)) {
      const type = key as DecisionType;
      const config = BUNDLE_CONFIGS[type];
      
      let matches = 0;
      for (const word of config.keywords) {
        if (q.includes(word)) {
          matches++;
        }
      }

      if (matches > maxMatches) {
        maxMatches = matches;
        bestType = type;
      }
    }

    const config = BUNDLE_CONFIGS[bestType];
    const confidence = maxMatches > 0 ? Math.min(60 + (maxMatches * 10), 95) : 50;

    return {
      decisionType: bestType,
      confidence,
      reasoning: `Rule-based lexical match: Found ${maxMatches} intersection keywords inside config registry. Fallback active.`,
      sources: config.baseSources
    };
  }
}
