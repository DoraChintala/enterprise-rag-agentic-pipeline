/**
 * Central configuration loaded from environment variables.
 * Everything that varies between environments lives here.
 */

function env(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function envInt(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export type Provider = 'local' | 'openai';
export type VectorStoreKind = 'memory' | 'qdrant';

export const config = {
  port: envInt('PORT', 3000),
  logLevel: env('LOG_LEVEL', 'info'),

  provider: env('PROVIDER', 'local') as Provider,

  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? '',
    chatModel: env('OPENAI_CHAT_MODEL', 'gpt-4o-mini'),
    embedModel: env('OPENAI_EMBED_MODEL', 'text-embedding-3-small'),
  },

  vectorStore: env('VECTOR_STORE', 'memory') as VectorStoreKind,
  qdrant: {
    url: env('QDRANT_URL', 'http://localhost:6333'),
    collection: env('QDRANT_COLLECTION', 'financial_docs'),
  },

  retrieval: {
    topK: envInt('TOP_K', 4),
    chunkSize: envInt('CHUNK_SIZE', 500),
    chunkOverlap: envInt('CHUNK_OVERLAP', 75),
  },
} as const;
