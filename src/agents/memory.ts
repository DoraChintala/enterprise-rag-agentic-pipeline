import type { Provider } from '../core/types.js';

/**
 * Cross-run memory (Netflix JD: "memory that compounds across runs").
 *
 * After each agent run we store a compact MEMORY RECORD (the task, a short
 * summary, and the outcome). On a new run we RETRIEVE the most relevant
 * past records by embedding similarity, so the agent can benefit from prior
 * experience instead of starting cold every time.
 *
 * In-memory for the demo; the same interface could back onto a vector DB
 * for durable, large-scale memory.
 */
export interface MemoryRecord {
  runId: string;
  task: string;
  summary: string;
  outcome: 'success' | 'failure';
  createdAt: string;
  vector: number[];
}

export class AgentMemory {
  private records: MemoryRecord[] = [];
  private readonly max = 500;

  constructor(private readonly provider: Provider) {}

  /** Persist what happened in a run so future runs can learn from it. */
  async remember(params: {
    runId: string;
    task: string;
    summary: string;
    outcome: 'success' | 'failure';
  }): Promise<void> {
    const [vector] = await this.provider.embed([params.task]);
    this.records.push({
      runId: params.runId,
      task: params.task,
      summary: params.summary,
      outcome: params.outcome,
      createdAt: new Date().toISOString(),
      vector,
    });
    if (this.records.length > this.max) this.records.shift();
  }

  /** Retrieve the most relevant prior runs for a new task. */
  async recall(task: string, k = 3): Promise<MemoryRecord[]> {
    if (this.records.length === 0) return [];
    const [qv] = await this.provider.embed([task]);
    return this.records
      .map((r) => ({ r, score: cosine(qv, r.vector) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      .map((x) => x.r);
  }

  size(): number {
    return this.records.length;
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
