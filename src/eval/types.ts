/**
 * Types for the agent/RAG EVALUATION loop.
 *
 * Evaluation turns "I think it's better" into measurable numbers.
 * An eval SUITE is a list of labeled cases; running it against the system
 * produces a REPORT with accuracy, groundedness, and latency.
 */

/** One labeled test case: a question + what a correct answer must contain. */
export interface EvalCase {
  id: string;
  question: string;
  /** Answer is correct if it contains ANY of these (case-insensitive). */
  expectedContains: string[];
  /** Question category, so we can score by type (single-fact vs multi-hop). */
  type: 'single-fact' | 'relationship' | 'multi-hop';
}

/** Result of evaluating ONE case. */
export interface EvalCaseResult {
  id: string;
  question: string;
  type: EvalCase['type'];
  answer: string;
  correct: boolean; // did the answer contain an expected string?
  grounded: boolean; // was the answer backed by at least one citation?
  latencyMs: number;
}

/** Aggregate report across all cases. */
export interface EvalReport {
  total: number;
  accuracy: number; // % of cases correct
  groundedness: number; // % of cases with a supporting citation
  p50LatencyMs: number;
  p95LatencyMs: number;
  byType: Record<string, { total: number; accuracy: number }>;
  cases: EvalCaseResult[];
}
