import { config } from '../core/config.js';
import type {
  EmbeddedChunk,
  RetrievedChunk,
  VectorStore,
} from '../core/types.js';

/**
 * Qdrant-backed vector store (used when VECTOR_STORE=qdrant).
 * Talks to Qdrant's REST API via fetch — no SDK dependency.
 * Run Qdrant locally with docker-compose (see infra/).
 */
export class QdrantStore implements VectorStore {
  private readonly url = config.qdrant.url;
  private readonly collection = config.qdrant.collection;

  async init(): Promise<void> {
    // Create the collection if it does not exist. Dimension is detected
    // lazily on first upsert, so we create with a sane default here.
    const exists = await fetch(`${this.url}/collections/${this.collection}`);
    if (exists.ok) return;

    await fetch(`${this.url}/collections/${this.collection}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vectors: { size: 256, distance: 'Cosine' },
      }),
    });
  }

  async upsert(chunks: EmbeddedChunk[]): Promise<void> {
    if (chunks.length === 0) return;
    const points = chunks.map((c) => ({
      id: c.id,
      vector: c.vector,
      payload: {
        docId: c.docId,
        source: c.source,
        page: c.page ?? null,
        position: c.position,
        text: c.text,
      },
    }));

    const res = await fetch(
      `${this.url}/collections/${this.collection}/points?wait=true`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points }),
      }
    );
    if (!res.ok) {
      throw new Error(`Qdrant upsert failed: ${res.status} ${await res.text()}`);
    }
  }

  async search(vector: number[], topK: number): Promise<RetrievedChunk[]> {
    const res = await fetch(
      `${this.url}/collections/${this.collection}/points/search`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vector, limit: topK, with_payload: true }),
      }
    );
    if (!res.ok) {
      throw new Error(`Qdrant search failed: ${res.status} ${await res.text()}`);
    }
    const json = (await res.json()) as {
      result: { score: number; payload: Record<string, unknown> }[];
    };
    return json.result.map((r) => ({
      id: String(r.payload.docId) + ':' + String(r.payload.position),
      docId: String(r.payload.docId),
      source: String(r.payload.source),
      page: (r.payload.page as number | null) ?? undefined,
      position: Number(r.payload.position),
      text: String(r.payload.text),
      score: r.score,
    }));
  }

  async count(): Promise<number> {
    const res = await fetch(
      `${this.url}/collections/${this.collection}/points/count`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exact: true }),
      }
    );
    if (!res.ok) return 0;
    const json = (await res.json()) as { result: { count: number } };
    return json.result.count;
  }
}
