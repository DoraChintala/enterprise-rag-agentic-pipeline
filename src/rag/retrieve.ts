import type { Provider, RetrievedChunk, VectorStore } from '../core/types.js';

/**
 * Retrieval (Stage 5, read path): embed the question, then do a
 * top-k similarity search against the vector store.
 */
export async function retrieve(
  question: string,
  topK: number,
  deps: { provider: Provider; store: VectorStore }
): Promise<RetrievedChunk[]> {
  const [queryVector] = await deps.provider.embed([question]);
  return deps.store.search(queryVector, topK);
}
