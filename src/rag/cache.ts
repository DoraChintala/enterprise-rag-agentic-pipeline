import type { Provider, RagAnswer } from '../core/types.js';

/**
 * Semantic cache (Stage 2 + Stage 3 design). Stores past answers keyed
 * by their question embedding. On a new question, if an existing entry
 * is similar enough (cosine >= threshold), return it instead of calling
 * the LLM again. This cuts perceived latency for repeat/similar queries.
 */
export class SemanticCache {
  private entries: { vector: number[]; answer: RagAnswer }[] = [];

  constructor(
    private readonly provider: Provider,
    private readonly threshold = 0.95,
    private readonly maxEntries = 500
  ) {}

  async get(question: string): Promise<RagAnswer | null> {
    if (this.entries.length === 0) return null;
    const [qv] = await this.provider.embed([question]);
    let best = { score: -1, answer: null as RagAnswer | null };
    for (const e of this.entries) {
      const score = cosine(qv, e.vector);
      if (score > best.score) best = { score, answer: e.answer };
    }
    return best.score >= this.threshold ? best.answer : null;
  }

  async set(question: string, answer: RagAnswer): Promise<void> {
    const [qv] = await this.provider.embed([question]);
    this.entries.push({ vector: qv, answer });
    if (this.entries.length > this.maxEntries) this.entries.shift();
  }
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}
