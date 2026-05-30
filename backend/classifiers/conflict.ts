import { NormalizedEvidence } from '../orchestrators/wave.js';
import logger from '../utils/logger.js';

export interface Conflict {
  conflict: string; // The title/description of the disagreement
  conflictingSources: string[]; // List of source names (e.g., ['Glassdoor', 'Blind'])
  explanation: string; // Intelligent explanation of why they disagree
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  recommendation: string; // Actionable advice for the user
  confidenceImpact: number; // Negative point impact on overall score (e.g., -10)
}

export class ConflictDetector {
  /**
   * Scans normalized evidence across sources to identify and explain contradictions
   */
  detect(evidence: NormalizedEvidence[]): Conflict[] {
    logger.system('ConflictDetector scanning normalized evidence logs...');
    const conflicts: Conflict[] = [];

    // Helper: find successful evidence
    const findEvidence = (id: string) => evidence.find(e => e.sourceId === id && e.success);

    const glassdoor = findEvidence('glassdoor');
    const blind = findEvidence('blind');
    const reddit = findEvidence('reddit');
    const linkedin = findEvidence('linkedin');
    const amazon = findEvidence('amazon');
    const flipkart = findEvidence('flipkart');
    const moneycontrol = findEvidence('moneycontrol');
    const shiksha = findEvidence('shiksha');

    // 1. CAREER: Glassdoor Positive vs Blind Negative Sentiment
    if (glassdoor && blind) {
      const gdRating = glassdoor.normalizedData.score || 3.9;
      const blindQuotes = blind.rawPayload?.quotes || [];
      const blindNegative = blind.rawPayload?.sentiment === 'mixed' || 
                            blindQuotes.some((q: string) => q.toLowerCase().includes('poor') || q.toLowerCase().includes('chaotic') || q.toLowerCase().includes('terrible'));

      if (gdRating >= 3.7 && blindNegative) {
        conflicts.push({
          conflict: `Glassdoor reports healthy work culture (${gdRating}★) but Blind flags chaotic management`,
          conflictingSources: ['Glassdoor', 'Blind'],
          explanation: "Glassdoor reviews are often written by a broader range of employees (including HR and non-technical staff), smoothing out ratings. Blind is highly technical SDE-centric, reflecting intense development crunches and middle-management friction.",
          severity: 'MEDIUM',
          recommendation: "Query the engineering lead directly during interviews regarding team priority shifts and direct reporting hierarchies.",
          confidenceImpact: -10
        });
      }
    }

    // 2. PURCHASE: Amazon rating is high but Reddit reviews flag bottleneck flaws
    if (amazon && reddit) {
      const azRating = amazon.normalizedData.score || 4.4;
      const redditText = reddit.rawPayload?.topPost?.toLowerCase() || '';
      const redditNegative = redditText.includes('bottleneck') || redditText.includes('lag') || redditText.includes('poor') || redditText.includes('avoid') || redditText.includes('battery');

      if (azRating >= 4.2 && redditNegative) {
        conflicts.push({
          conflict: `Amazon buyer rating is positive (${azRating}★) but Reddit reviews report hardware bottleneck flaws`,
          conflictingSources: ['Amazon', 'Reddit'],
          explanation: "Amazon reviews capture immediate out-of-the-box buyer satisfaction. Reddit discussions represent enthusiast-grade long-term durability assessments, highlighting subtle flaws like thermal throttling or battery degradation over 12 months.",
          severity: 'MEDIUM',
          recommendation: "Evaluate your reliance on intensive long-term processing or continuous battery life prior to ordering.",
          confidenceImpact: -12
        });
      }
    }

    // 3. PURCHASE: Pricing discrepancy (Amazon vs Flipkart)
    if (amazon && flipkart) {
      const azPrice = amazon.rawPayload?.priceCurrent;
      const fkPrice = flipkart.rawPayload?.priceCurrent;
      if (azPrice && fkPrice && Math.abs(azPrice - fkPrice) > 1000) {
        const cheaper = azPrice < fkPrice ? 'Amazon' : 'Flipkart';
        const diff = Math.abs(azPrice - fkPrice);
        conflicts.push({
          conflict: `Ecommerce pricing mismatch: Item is ₹${diff} cheaper on ${cheaper}`,
          conflictingSources: ['Amazon', 'Flipkart'],
          explanation: "Dynamic pricing algorithms, localized vendor sales, or exclusive banking tie-up events are currently active on one portal, causing a pricing mismatch.",
          severity: 'LOW',
          recommendation: `Proceed with your purchase directly via ${cheaper} to maximize savings.`,
          confidenceImpact: -5
        });
      }
    }

    // 4. FINANCE: Broker target is positive (BUY) but Reddit sentiment has debt or P/E worries
    if (moneycontrol && reddit) {
      const moneycontrolConsensus = moneycontrol.rawPayload?.analystConsensus || 'Buy';
      const redditText = reddit.rawPayload?.topPost?.toLowerCase() || '';
      const redditBearish = redditText.includes('bubble') || redditText.includes('debt') || redditText.includes('overvalued') || redditText.includes('pe') || redditText.includes('bearish');

      if (moneycontrolConsensus.toLowerCase().includes('buy') && redditBearish) {
        conflicts.push({
          conflict: "Market analysts recommend BUY but retail Reddit investors flag debt/valuation overvaluation",
          conflictingSources: ['Moneycontrol', 'Reddit'],
          explanation: "Institutional brokers evaluate long-term macro scale and asset pipelines. Retail Reddit investors highlight immediate P/E inflation, promoter holdings, or debt risks that create volatility.",
          severity: 'MEDIUM',
          recommendation: "Mitigate risk by placing 50% capital initially and dollar-cost averaging the remaining balance.",
          confidenceImpact: -8
        });
      }
    }

    // 5. EDUCATION: Shiksha high placements but LinkedIn alumni stats show slow outcomes
    if (shiksha && linkedin) {
      const placementRate = shiksha.rawPayload?.placementPercent || 94;
      const linkedinOutcome = linkedin.normalizedData.score || 73; // e.g. startup joiner outcomes or comparable promotions

      if (placementRate >= 90 && linkedinOutcome < 50) {
        conflicts.push({
          conflict: `College reports a high placement rate (${placementRate}%) but LinkedIn alumni data shows slow career trajectory outcomes`,
          conflictingSources: ['Shiksha', 'LinkedIn'],
          explanation: "College placement indices count generic job allocations on graduation day. LinkedIn tracks active SDE-centric promotions and career trajectories, reflecting lower retention or slow career acceleration post graduation.",
          severity: 'HIGH',
          recommendation: "Directly message recent alumni on LinkedIn to verify placement transparency and quality of recruiters.",
          confidenceImpact: -15
        });
      }
    }

    if (conflicts.length > 0) {
      logger.warn(`ConflictDetector flagged ${conflicts.length} cross-source disagreements.`);
    } else {
      logger.success('ConflictDetector resolved all datasets with zero contradictions.');
    }

    return conflicts;
  }
}
export default ConflictDetector;
