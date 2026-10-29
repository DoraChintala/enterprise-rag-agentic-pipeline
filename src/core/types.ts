/**
 * Shared domain types for the RAG pipeline.
 */

/** A single chunk of a document, with metadata needed for citations. */
export interface Chunk {
  id: string;
  docId: string;
  source: string; // original file / document name
  page?: number; // page number if known (for citations)
  position: number; // chunk index within the document
  text: string;
}

/** A chunk plus its embedding vector, as stored in the vector DB. */
export interface EmbeddedChunk extends Chunk {
  vector: number[];
}

/** A retrieval result: a chunk plus how well it matched the query. */
export interface RetrievedChunk extends Chunk {
  score: number;
}

/** A citation returned to the user so every answer is auditable. */
export interface Citation {
  docId: string;
  source: string;
  page?: number;
  position: number;
  snippet: string;
}

/** The final answer payload returned by the RAG pipeline. */
export interface RagAnswer {
  answer: string;
  citations: Citation[];
  usedCache: boolean;
  latencyMs: number;
}

/** Minimal interface every vector store implementation must satisfy. */
export interface VectorStore {
  init(): Promise<void>;
  upsert(chunks: EmbeddedChunk[]): Promise<void>;
  search(vector: number[], topK: number): Promise<RetrievedChunk[]>;
  count(): Promise<number>;
}

/** Minimal interface every embedding + chat provider must satisfy. */
export interface Provider {
  embed(texts: string[]): Promise<number[][]>;
  chat(prompt: string): Promise<string>;
}
