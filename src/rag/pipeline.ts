import { config } from '../core/config.js';
import type {
  Citation,
  Provider,
  RagAnswer,
  VectorStore,
} from '../core/types.js';
import { SemanticCache } from './cache.js';
import { buildPrompt } from './prompt.js';
import { retrieve } from './retrieve.js';

/**
 * The RAG core (Stage 5): cache -> retrieve -> prompt -> generate -> cite.
 * Returns a grounded answer with citations and timing info.
 */
export class RagPipeline {
  private readonly cache: SemanticCache;

  constructor(
    private readonly provider: Provider,
    private readonly store: VectorStore
  ) {
    this.cache = new SemanticCache(provider);
  }

  async answer(question: string, role?: string): Promise<RagAnswer> {
    const started = Date.now();

    // 1. Cache-first (fast path)
    const cached = await this.cache.get(question);
    if (cached) {
      return { ...cached, usedCache: true, latencyMs: Date.now() - started };
    }

    // 2. Retrieve
    const chunks = await retrieve(question, config.retrieval.topK, {
      provider: this.provider,
      store: this.store,
    });

    if (chunks.length === 0) {
      return {
        answer:
          'I do not have enough information to answer that. Try ingesting ' +
          'relevant documents first.',
        citations: [],
        usedCache: false,
        latencyMs: Date.now() - started,
      };
    }

    // 3. Build prompt + 4. Generate
    const prompt = buildPrompt(question, chunks, role);
    const text = await this.provider.chat(prompt);

    // 5. Citations (auditability requirement)
    const citations: Citation[] = chunks.map((c) => ({
      docId: c.docId,
      source: c.source,
      page: c.page,
      position: c.position,
      snippet: c.text.slice(0, 160),
    }));

    const result: RagAnswer = {
      answer: text,
      citations,
      usedCache: false,
      latencyMs: Date.now() - started,
    };

    await this.cache.set(question, result);
    return result;
  }
}
