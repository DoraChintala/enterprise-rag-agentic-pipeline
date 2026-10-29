import { randomUUID } from 'node:crypto';
import { config } from '../core/config.js';
import { logger } from '../core/logger.js';
import type { Provider, VectorStore } from '../core/types.js';
import { chunkText } from './chunker.js';

/**
 * Ingestion pipeline (Stage 4): PARSE -> CHUNK -> EMBED -> STORE.
 *
 * Here "parse" is simplified to accepting raw text (a real system would
 * extract text from PDF/HTML first). Embedding is BATCHED for speed
 * (Stage 4, Q5).
 */
export async function ingestDocument(
  params: {
    text: string;
    source: string;
    docId?: string;
    page?: number;
  },
  deps: { provider: Provider; store: VectorStore }
): Promise<{ docId: string; chunks: number }> {
  const docId = params.docId ?? randomUUID();

  // 1. CHUNK (with overlap + metadata)
  const chunks = chunkText(params.text, {
    docId,
    source: params.source,
    chunkSize: config.retrieval.chunkSize,
    chunkOverlap: config.retrieval.chunkOverlap,
    page: params.page,
  });

  if (chunks.length === 0) {
    logger.warn({ source: params.source }, 'no chunks produced');
    return { docId, chunks: 0 };
  }

  // 2. EMBED (batched — one call for all chunk texts)
  const vectors = await deps.provider.embed(chunks.map((c) => c.text));

  // 3. STORE
  const embedded = chunks.map((chunk, i) => ({
    ...chunk,
    vector: vectors[i],
  }));
  await deps.store.upsert(embedded);

  logger.info(
    { docId, source: params.source, chunks: chunks.length },
    'document ingested'
  );
  return { docId, chunks: chunks.length };
}
