import type {
  EmbeddedChunk,
  RetrievedChunk,
  VectorStore,
} from '../core/types.js';

/**
 * In-memory vector store. Zero dependencies, so the system runs out of
 * the box with no Docker/Qdrant. Does a brute-force cosine search —
 * fine for a demo / tests; swap to Qdrant for scale.
 */
export class MemoryStore implements VectorStore {
  private items: EmbeddedChunk[] = [];

  async init(): Promise<void> {
    // nothing to do
  }

  async upsert(chunks: EmbeddedChunk[]): Promise<void> {
    this.items.push(...chunks);
  }

  async search(vector: number[], topK: number): Promise<RetrievedChunk[]> {
    return this.items
      .map((item) => ({
        ...item,
        score: cosine(vector, item.vector),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(({ vector: _v, ...rest }) => rest);
  }

  async count(): Promise<number> {
    return this.items.length;
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
