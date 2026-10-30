/**
 * Cost governance (Netflix JD: "cost governance for LLM and agent
 * workloads").
 *
 * Tracks approximate token usage and cost per agent run, and enforces a
 * per-run BUDGET so a runaway/looping agent cannot rack up unbounded spend.
 *
 * Tokens are estimated (~4 chars/token) which is accurate enough for a
 * budget guard; with a real LLM provider you would use the token counts
 * returned by the API.
 */
export interface CostBudget {
  maxSteps: number; // hard cap on tool calls per run
  maxTokens: number; // hard cap on total tokens per run
}

export const DEFAULT_BUDGET: CostBudget = {
  maxSteps: 10,
  maxTokens: 20000,
};

// Rough price per 1K tokens (USD) — mirrors a small hosted model so the
// demo reports a realistic-looking cost. Local provider is free, but we
// still report the estimate to demonstrate governance.
const USD_PER_1K_TOKENS = 0.0005;

export class CostMeter {
  private steps = 0;
  private tokens = 0;

  constructor(private readonly budget: CostBudget = DEFAULT_BUDGET) {}

  /** Estimate tokens for a piece of text. */
  static estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /** Record a step's token usage. Returns the running totals. */
  record(text: string): { steps: number; tokens: number } {
    this.steps += 1;
    this.tokens += CostMeter.estimateTokens(text);
    return { steps: this.steps, tokens: this.tokens };
  }

  /** Would the NEXT step exceed the budget? If so, the run must stop. */
  exceeded(): { over: boolean; reason?: string } {
    if (this.steps >= this.budget.maxSteps) {
      return { over: true, reason: `step budget reached (${this.budget.maxSteps})` };
    }
    if (this.tokens >= this.budget.maxTokens) {
      return { over: true, reason: `token budget reached (${this.budget.maxTokens})` };
    }
    return { over: false };
  }

  /** Final cost summary for the run. */
  summary(): { steps: number; tokens: number; estimatedCostUsd: number } {
    return {
      steps: this.steps,
      tokens: this.tokens,
      estimatedCostUsd:
        Math.round((this.tokens / 1000) * USD_PER_1K_TOKENS * 1e6) / 1e6,
    };
  }
}
