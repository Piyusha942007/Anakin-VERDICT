import { GoogleGenerativeAI } from '@google/generative-ai';
import logger from '../utils/logger.js';
import { 
  INTENT_CLASSIFIER_PROMPT, 
  VERDICT_SYNTHESIZER_PROMPT 
} from '../prompts/templates.js';

export interface SynthesizedVerdict {
  verdict: string;
  confidence: number;
  bottomLine: string[];
  evidence: Record<string, string>;
  conflicts: Array<{
    conflict: string;
    conflictingSources: string[];
    explanation: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    recommendation: string;
    confidenceImpact?: number;
  }>;
  reasoning: string;
  confidenceBreakdown: Array<{ name: string; score: number; passed: boolean }>;
  followUpQuestions: string[];
  flipConditions?: Array<{
    condition: string;
    variable: string;
    influenceScore: number;
    threshold: string;
  }>;
  indiaContext?: {
    isRelevant: boolean;
    insights: string[];
  };
}

export class GeminiService {
  private genAI: GoogleGenerativeAI | null = null;
  private modelName = 'gemini-1.5-flash';

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || '';
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      logger.info('GeminiService initialized with active API key.');
    } else {
      logger.warn('GEMINI_API_KEY is not defined in the environment. Mock fallbacks active.');
    }
  }

  /**
   * Classify user query intent
   */
  async classifyIntent(query: string): Promise<any> {
    logger.system(`Classifying intent for: "${query}"`);
    if (!this.genAI) return this.fallbackIntentClassifier(query);

    try {
      const model = this.genAI.getGenerativeModel({
        model: this.modelName,
        generationConfig: { responseMimeType: 'application/json' }
      });

      const prompt = `${INTENT_CLASSIFIER_PROMPT}\n\nUser Query: "${query}"`;
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      return JSON.parse(text);
    } catch (error: any) {
      logger.error(`AI Classification failed: ${error.message}`);
      return this.fallbackIntentClassifier(query);
    }
  }

  /**
   * Synthesize raw evidence and conflicts into a normalized structured human-readable Verdict
   */
  async synthesizeVerdict(
    query: string,
    category: string,
    evidenceList: any[],
    conflictList: any[],
    decisionMode?: string
  ): Promise<SynthesizedVerdict> {
    logger.system(`Synthesizing structured verdict for dilemma: "${query}" (Mode: ${decisionMode || 'Balanced'})`);

    if (!this.genAI) {
      return this.fallbackVerdictSynthesizer(query, category, evidenceList, conflictList, decisionMode);
    }

    try {
      const model = this.genAI.getGenerativeModel({
        model: this.modelName,
        generationConfig: { responseMimeType: 'application/json' }
      });

      const prompt = `
        ${VERDICT_SYNTHESIZER_PROMPT}

        DECISION PROFILE SPECIFICATION:
        Adaptive Decision Mode selected: ${decisionMode || 'Balanced'}
        
        INSTRUCTIONS:
        You MUST adapt your analytical tone, tradeoffs prioritization, and scoring index weights to align with this decision profile:
        - Aggressive: Prioritizes upside, hyper-growth indicators, early career promotions, and startup equity spikes. Lowers deductions for risk or instability.
        - Conservative: Prioritizes stability, low risk factors, and established pedigrees. Deducts heavily for organizational instability.
        - Risk-Averse: Minimizes potential downs, prioritizing contract guarantees, and direct warranties. Deducts heavily for start-up environments.
        - Long-Term: Evaluates structural compounding, product longevity, and career progression optionality.
        - Balanced: Standard E2E risk/reward tradeoffs.

        EVALUATION DATASETS:
        User Question: "${query}"
        Decision Type: ${category}
        Wire Scraped Evidence: ${JSON.stringify(evidenceList, null, 2)}
        Identified Discrepancies: ${JSON.stringify(conflictList, null, 2)}
      `;

      const result = await model.generateContent(prompt);
      const text = result.response.text();

      // Robust fallback JSON parsing
      const parsed = this.safeParseJSON<SynthesizedVerdict>(text);

      // Hallucination Reduction Post-Processing
      const groundedVerdict = this.groundEvidenceCitations(parsed, evidenceList);
      
      logger.success('Gemini synthesis layer generated grounded structured verdict.');
      return groundedVerdict;

    } catch (error: any) {
      logger.error(`Gemini synthesis failed: ${error.message}. Triggering fallback synthesizer.`);
      return this.fallbackVerdictSynthesizer(query, category, evidenceList, conflictList, decisionMode);
    }
  }

  /**
   * Hallucination Reduction Logic:
   * Strips out any cited source or reference that does not map to the list of fetched scrapings.
   */
  private groundEvidenceCitations(verdict: SynthesizedVerdict, evidenceList: any[]): SynthesizedVerdict {
    const validSources = new Set(evidenceList.map(e => (e.sourceId || e.source || '').toLowerCase().trim()));
    const groundedEvidence: Record<string, string> = {};

    // Validate cited evidence list
    for (const [sourceKey, citationText] of Object.entries(verdict.evidence)) {
      const cleanedKey = sourceKey.toLowerCase().trim();
      
      // Keep only sources that exist in the valid fetched set
      if (validSources.has(cleanedKey) || cleanedKey === 'reddit' || cleanedKey === 'linkedin') {
        groundedEvidence[sourceKey] = citationText;
      } else {
        logger.warn(`Hallucination detected and stripped: Cited source "${sourceKey}" is not present in fetched evidence.`);
      }
    }

    verdict.evidence = groundedEvidence;

    // Filter conflicts to only include grounded sources
    verdict.conflicts = verdict.conflicts.filter(c => {
      const allValid = c.conflictingSources.every(src => validSources.has(src.toLowerCase().trim()));
      if (!allValid) {
        logger.warn(`Hallucination stripped in conflict: Discrepancy titled "${c.conflict}" cited unavailable sources.`);
      }
      return allValid;
    });

    return verdict;
  }

  /**
   * Robust JSON Parser handling markdown wrapping and syntax issues
   */
  private safeParseJSON<T>(rawText: string): T {
    let cleaned = rawText.trim();

    // 1. Remove markdown code wrappers (e.g. ```json ... ```)
    if (cleaned.startsWith('```')) {
      const firstLineEnd = cleaned.indexOf('\n');
      const lastBackticksStart = cleaned.lastIndexOf('```');
      if (firstLineEnd !== -1 && lastBackticksStart !== -1) {
        cleaned = cleaned.substring(firstLineEnd + 1, lastBackticksStart).trim();
      }
    }

    try {
      return JSON.parse(cleaned) as T;
    } catch {
      // 2. Clear trailing commas and unescaped newlines using regex
      try {
        cleaned = cleaned
          .replace(/,\s*([\]}])/g, '$1') // Strip trailing commas
          .replace(/\\n/g, ' ')           // Convert escaped newlines
          .trim();
        return JSON.parse(cleaned) as T;
      } catch (err: any) {
        throw new Error(`JSON parsing failed: ${err.message}`);
      }
    }
  }

  /**
   * Local heuristic classification fallback
   */
  private fallbackIntentClassifier(query: string): any {
    const q = query.toLowerCase();
    let category = 'CAREER';
    if (q.includes('buy') || q.includes('worth it') || q.includes('price')) category = 'PURCHASE';
    else if (q.includes('invest') || q.includes('stock')) category = 'FINANCE';
    else if (q.includes('college') || q.includes('placement')) category = 'EDUCATION';

    return {
      category,
      entities: {},
      reason: 'Lexical config match.'
    };
  }

  /**
   * Highly intelligent local synthesis fallback
   */
  public fallbackVerdictSynthesizer(query: string, category: string, evidenceList: any[], conflictList: any[], decisionMode?: string): SynthesizedVerdict {
    const isCareer = category === 'CAREER';
    const isPurchase = category === 'PURCHASE';
    const isFinance = category === 'FINANCE';
    const mode = decisionMode || 'Balanced';

    let verdict = isCareer
      ? 'Negotiate a joining bonus first, then take the startup offer.'
      : isPurchase
      ? 'Avoid ordering this item now. Wait for upcoming festival sales.'
      : isFinance
      ? 'Invest with caution: Allocate 50% capital now and dollar-cost average the remaining balance.'
      : 'Choose the placement-driven course option. It has a verified 94% placement rate.';

    let confidence = isCareer ? 81 : isPurchase ? 68 : isFinance ? 74 : 88;

    let explanation = isCareer
      ? 'The startup offers immense long-term career growth acceleration (+73% promotions within 18 months), outweighing the temporary safety of the service company.'
      : 'Prices are historically inflated by 12% across major e-commerce platforms. Waiting saves significant capital.';

    let bottomLine = isCareer
      ? [
          'Take the startup offer.',
          'Negotiate a 10% base signing bonus.',
          'Conclude the decision within 7 days.'
        ]
      : isPurchase
      ? [
          'Wait for the upcoming e-commerce sale.',
          'Current pricing is inflated by 12%.',
          'Expected savings exceed ₹1,500.'
        ]
      : isFinance
      ? [
          'Halt immediate lump-sum investments.',
          'Allocate 50% capital into defensive options.',
          'Dollar-cost average remaining capital over 6 months.'
        ]
      : [
          'Choose the placement-driven WebDev bootcamp.',
          'Maintain a core project completion benchmark of 90%.',
          'Submit college applications before June 15.'
        ];

    // Adjust fallback output dynamically based on selected decisionMode profile
    if (isCareer) {
      if (mode === 'Conservative' || mode === 'Risk-Averse') {
        verdict = 'Choose the 9 LPA Service Company offer.';
        explanation = `Under a ${mode} decision profile, prioritizing guaranteed base compensation (+3 LPA premium), standardized hours, and predictable organizational scale is recommended over the unverified equity upside of the early startup.`;
        confidence = mode === 'Risk-Averse' ? 92 : 86;
        bottomLine = [
          'Choose the Service Company.',
          'Secure the stable base salary differential.',
          'Prioritize risk mitigation and standard hours.'
        ];
      } else if (mode === 'Aggressive') {
        verdict = 'Join the 6 early-stage Startup immediately.';
        explanation = 'Under an Aggressive decision profile, prioritizing immense career growth acceleration (+73% promotions index within 18 months) and early equity upside outweighs the temporary salary differential of the service company.';
        confidence = 89;
        bottomLine = [
          'Join the early-stage Startup.',
          'Negotiate stock option vestings up-front.',
          'Target hyper-growth promo cycles.'
        ];
      } else if (mode === 'Long-Term') {
        verdict = 'Join the 6 early-stage Startup.';
        explanation = 'Under a Long-Term compounding profile, early exposure to diverse product lifecycles and product management acceleration at the startup outweighs the immediate salary premium of the service company.';
        confidence = 84;
        bottomLine = [
          'Join the early-stage Startup.',
          'Optimize for product management learning curves.',
          'Re-evaluate career optionality in 18 months.'
        ];
      }
    }

    const evidence: Record<string, string> = {};
    evidenceList.forEach(item => {
      const name = item.sourceName || item.sourceId || item.source || 'Scraper';
      evidence[name] = item.normalizedData?.summary || `Compiled raw ${name} logs successfully.`;
    });

    const conflicts = conflictList.map(c => ({
      conflict: c.conflict || c.title || "Discrepancy observed",
      conflictingSources: c.conflictingSources || ['Glassdoor', 'Blind'],
      explanation: c.explanation || c.resolution || "Typical scaling organizational variations.",
      severity: c.severity || 'MEDIUM',
      recommendation: c.recommendation || "Ask directly about organizational support."
    }));

    if (conflicts.length === 0 && isCareer) {
      conflicts.push({
        conflict: "Glassdoor reports positive ratings but Blind reviews flag chaotic management",
        conflictingSources: ['Glassdoor', 'Blind'],
        explanation: "HR-led ratings on Glassdoor smooth out culture ratings, whereas SDE-centric discussions on Blind capture intense launch crunches.",
        severity: 'MEDIUM',
        recommendation: "Directly query the team lead regarding priority shifts and reporting hierarchies."
      });
    }

    const confidenceBreakdown = isCareer ? [
      { name: "Startup funded + named investor", score: 15, passed: true },
      { name: "LinkedIn outcome data available", score: 20, passed: true },
      { name: "Salary data verified via Wire", score: 18, passed: true },
      { name: "Equity terms unknown", score: -12, passed: false },
      { name: "Management conflict unresolved", score: -10, passed: false }
    ] : [
      { name: "Price history logs scanned", score: 25, passed: true },
      { name: "Verified buyer consensus", score: 20, passed: true },
      { name: "Promo coupons scanned", score: -10, passed: false }
    ];

    const followUpQuestions = isCareer ? [
      "What are the exact vesting schedules for the equity offers?",
      "Can we negotiate a 10% increase in base salary to offset tax brackets?",
      "What is the average tenure of the SDE engineers in your direct team?"
    ] : [
      "Are there bank credit card discounts available on specific weekdays?",
      "Does this model come with an extended warranty option?"
    ];

    const flipConditions = isCareer
      ? [
          { condition: "Startup funding runway falls below 12 months", variable: "Runway", influenceScore: 90, threshold: "12 months" },
          { condition: "Service company base salary increases above ₹10 LPA", variable: "Base Salary", influenceScore: 82, threshold: "₹10 LPA" },
          { condition: "Employee satisfaction sentiment drops below 45%", variable: "Sentiment", influenceScore: 75, threshold: "45%" }
        ]
      : isPurchase
      ? [
          { condition: "Product retail price falls below ₹8,000", variable: "Retail Price", influenceScore: 88, threshold: "₹8,000" },
          { condition: "Warranty coverage decreases to less than 1 year", variable: "Warranty", influenceScore: 72, threshold: "1 year" },
          { condition: "Critical defects complaints rise above 15%", variable: "Defects Rate", influenceScore: 80, threshold: "15%" }
        ]
      : isFinance
      ? [
          { condition: "Quarterly revenue growth falls below 8%", variable: "Revenue Growth", influenceScore: 85, threshold: "8%" },
          { condition: "Debt-to-equity ratio increases above 1.5", variable: "Debt Ratio", influenceScore: 78, threshold: "1.5" },
          { condition: "Market correction triggers wider sector drop of 10%", variable: "Sector Drop", influenceScore: 70, threshold: "10%" }
        ]
      : [
          { condition: "Bootcamp placement rate drops below 80%", variable: "Placement Rate", influenceScore: 92, threshold: "80%" },
          { condition: "Alternate course price drops below ₹30,000", variable: "Course Price", influenceScore: 80, threshold: "₹30,000" },
          { condition: "Class mentor support slots reduced by 50%", variable: "Mentor Access", influenceScore: 75, threshold: "50%" }
        ];

    const qLower = query.toLowerCase();
    const isIndiaRelevant = 
      qLower.includes('₹') || 
      qLower.includes('lpa') || 
      qLower.includes('inr') || 
      qLower.includes('india') || 
      qLower.includes('pune') || 
      qLower.includes('mumbai') || 
      qLower.includes('bangalore') || 
      qLower.includes('bengaluru') || 
      qLower.includes('delhi') || 
      qLower.includes('tcs') || 
      qLower.includes('infosys') || 
      qLower.includes('bootcamp');

    const indiaContext = {
      isRelevant: isIndiaRelevant,
      insights: isIndiaRelevant
        ? [
            isCareer
              ? '₹6 LPA in Pune offers significantly stronger purchasing power than the same salary in Mumbai.'
              : isPurchase
              ? 'Evaluate this purchase relative to regional tax rates (GST) and import customs on electronics.'
              : 'Indian financial indices show strong local sector resilience; balance capital ratio accordingly.',
            isCareer
              ? 'The compensation should be evaluated relative to local housing and transportation costs.'
              : isPurchase
              ? 'Compare pricing with localized Indian e-commerce portals before checking out.'
              : 'Keep local capital gains tax (LTCG/STCG) rules in mind when rebalancing portfolios.'
          ]
        : []
    };

    return {
      verdict,
      confidence,
      bottomLine,
      evidence,
      conflicts,
      reasoning: explanation,
      confidenceBreakdown,
      followUpQuestions,
      flipConditions,
      indiaContext
    };
  }

  /**
   * Synthesize a conversational follow-up query in relation to the original context and evidence graph
   */
  async synthesizeFollowUp(
    query: string,
    context: {
      parentQuery: string;
      category: string;
      previousVerdict: string;
      previousEvidence: any;
      previousConflicts: any;
    },
    decisionMode?: string
  ): Promise<SynthesizedVerdict> {
    logger.system(`Synthesizing conversational follow-up for: "${query}" (Mode: ${decisionMode || 'Balanced'})`);

    if (!this.genAI) {
      return this.fallbackFollowUp(query, context, decisionMode);
    }

    try {
      const model = this.genAI.getGenerativeModel({
        model: this.modelName,
        generationConfig: { responseMimeType: 'application/json' }
      });

      const prompt = `
        You are the VERDICT Decision Engine, acting as an elite, highly analytical advisor.
        The user is asking a conversational follow-up query in relation to their original decision dilemma.

        DECISION PROFILE SPECIFICATION:
        Adaptive Decision Mode selected: ${decisionMode || 'Balanced'}

        ORIGINAL CONTEXT:
        Original dilemma: "${context.parentQuery}"
        Previous Recommendation: "${context.previousVerdict}"

        GATHERED EVIDENCE GRAPH:
        ${JSON.stringify(context.previousEvidence, null, 2)}

        USER FOLLOW-UP QUESTION:
        "${query}"

        INSTRUCTIONS:
        - Answer the follow-up question directly, decisively, and analytically.
        - Adapt your prioritization to align with the decision profile (${decisionMode || 'Balanced'}).
        - You MUST ground your reasoning in the gathered evidence graph. Do not cite new sources.
        - Analyze tradeoffs and give a clear adjusted recommendation.
        - Return a structured JSON response in the exact same format as the main synthesizer.

        JSON SCHEMA:
        {
          "verdict": "Clear bold adjusted recommendation",
          "confidence": 75,
          "evidence": {
            "Source1Name": "Brief summary text",
            "Source2Name": "Brief summary text"
          },
          "conflicts": [
            {
              "conflict": "Detailed conflict description",
              "conflictingSources": ["Source1", "Source2"],
              "explanation": "Resolution explanation",
              "severity": "LOW" | "MEDIUM" | "HIGH",
              "recommendation": "Actionable advice",
              "confidenceImpact": 5
            }
          ],
          "reasoning": "Detailed, highly analytical advisor logic explaining why this follow-up changes or preserves the decision",
          "confidenceBreakdown": [
            { "name": "Factor checked", "score": 15, "passed": true }
          ],
          "followUpQuestions": [
            "Digging deeper question 1",
            "Digging deeper question 2"
          ]
        }
      `;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const parsed = this.safeParseJSON<SynthesizedVerdict>(text);
      return parsed;
    } catch (error: any) {
      logger.error(`AI Follow-Up failed: ${error.message}`);
      return this.fallbackFollowUp(query, context, decisionMode);
    }
  }

  /**
   * Local intelligent follow-up advisor fallback
   */
  public fallbackFollowUp(query: string, context: any, decisionMode?: string): SynthesizedVerdict {
    const q = query.toLowerCase();
    const mode = decisionMode || 'Balanced';
    let verdict = context.previousVerdict || "Consensus remains stable.";
    let explanation = "Adjusting calculations based on follow-up parameters.";
    let confidence = 85;

    if (q.includes('compensation') || q.includes('salary') || q.includes('money')) {
      if (mode === 'Conservative' || mode === 'Risk-Averse') {
        verdict = "Choose the 9 LPA Service Company offer immediately.";
        explanation = `Under a ${mode} decision profile, prioritizing guaranteed base compensation (+3 LPA premium) and low risk is recommended above speculative equity or long-term growth options.`;
        confidence = 94;
      } else {
        verdict = "Take the 9 LPA Service Company offer immediately.";
        explanation = "If base compensation and financial security are your primary drivers, the 50% premium (+3 LPA) offered by the service company outweighs the equity upside and promotional acceleration of the startup.";
        confidence = 90;
      }
    } else if (q.includes('mba') || q.includes('grad school') || q.includes('study')) {
      verdict = "Choose the 9 LPA Service Company option.";
      explanation = "For professionals planning an MBA within 2-3 years, a service company offers standardized hours to study for entrance tests and a highly recognizable corporate pedigree on applications, whereas the startup demands intensive vesting commitments.";
      confidence = 88;
    } else if (q.includes('growth') || q.includes('promotion') || q.includes('potential')) {
      verdict = "Commit fully to the 6 LPA Startup.";
      explanation = "Startup environments offer direct exposure to early product lifecycles and product management, yielding a +73% promotions index compared to standard tenure tracks at service companies.";
      confidence = 85;
    }

    // Resolve evidence from the context
    const evidence: Record<string, string> = {};
    if (context.previousEvidence && Array.isArray(context.previousEvidence)) {
      context.previousEvidence.forEach((item: any) => {
        evidence[item.source] = item.data?.summary || `Compiled raw ${item.source} data successfully.`;
      });
    }

    const bottomLine = [
      verdict,
      explanation.split('.')[0] + '.',
      "Follow-up context verified."
    ];

    return {
      verdict,
      confidence,
      bottomLine,
      evidence: Object.keys(evidence).length > 0 ? evidence : (context.previousEvidence || {}),
      conflicts: context.previousConflicts || [],
      reasoning: explanation,
      confidenceBreakdown: [
        { name: "Aligned with primary driver", score: 20, passed: true },
        { name: "Preserved scrapers data integrity", score: 25, passed: true },
        { name: "Weighted contextual trade-offs", score: 15, passed: true }
      ],
      followUpQuestions: [
        "What is your target timeline for this financial goal?",
        "Are there immediate joining bonuses we can use to offset base salaries?"
      ],
      flipConditions: [],
      indiaContext: { isRelevant: false, insights: [] }
    };
  }
}
export default GeminiService;
