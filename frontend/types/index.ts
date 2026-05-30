export type StreamStage =
  | 'idle'
  | 'classifying'
  | 'intent_classified'
  | 'wave1_start'
  | 'source_resolved'
  | 'wave1_complete'
  | 'wave2_start'
  | 'wave2_complete'
  | 'conflicts_detected'
  | 'synthesizing'
  | 'verdict_ready'
  | 'error'
  | 'done';

export interface WireSourceResult {
  source: string;
  success: boolean;
  latencyMs: number;
  data: any;
  historicalReliability?: number;
}

export interface FailedSource {
  source: string;
  reason: string;
  latencyMs: number;
  confidencePenalty: number;
  retryStatus: 'not_retried' | 'retried_failed' | 'retried_success';
  failureType: 'timeout' | 'rate_limit' | 'parse_error' | 'no_data' | 'network_error';
  timestamp: number;
}

export interface ConflictResolved {
  conflict: string;
  conflictingSources: string[];
  explanation: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  recommendation: string;
  confidenceImpact?: number;
}

export interface ConfidenceItem {
  name: string;
  score: number;
  passed: boolean;
}

export interface ConfidenceTick {
  value: number;
  delta: number;
  reason: string;
  phase: 'source' | 'conflict' | 'synthesis' | 'init';
  timestamp: number;
}

export interface FlipCondition {
  condition: string;
  variable: string;
  influenceScore: number;
  threshold: string;
}

export interface VerdictResponse {
  verdict: string;
  confidence: number;
  evidence: Record<string, string>;
  conflicts: ConflictResolved[];
  reasoning: string;
  confidenceBreakdown: ConfidenceItem[];
  followUpQuestions: string[];
  bottomLine?: string[];
  flipConditions?: FlipCondition[];
  indiaContext?: {
    isRelevant: boolean;
    insights: string[];
  };
}

export interface VerdictState {
  stage: StreamStage;
  query: string;
  category?: 'PURCHASE' | 'CAREER' | 'FINANCE' | 'EDUCATION';
  entities?: Record<string, any>;
  reason?: string;
  sourcesScanned: string[];
  resolvedSources: WireSourceResult[];
  conflicts: ConflictResolved[];
  verdict?: VerdictResponse;
  errorMessage?: string;
  isCached?: boolean;
  isDemoMode?: boolean;
  decisionMode?: string;
  liveConfidence?: number;
  confidenceHistory?: ConfidenceTick[];
  failedSources?: FailedSource[];
}

export interface ArchiveItem {
  id: string;
  query: string;
  timestamp: number;
  category: string;
  decisionMode: string;
  verdict: VerdictResponse;
  resolvedSources: WireSourceResult[];
  conflicts: ConflictResolved[];
  isBookmarked: boolean;
  isDemoMode?: boolean;
}
