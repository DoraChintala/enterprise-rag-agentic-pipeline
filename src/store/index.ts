import { config } from '../core/config.js';
import type { VectorStore } from '../core/types.js';
import { MemoryStore } from './memory.js';
import { QdrantStore } from './qdrant.js';

/** Factory: pick the vector store based on config (memory vs qdrant). */
export function createStore(): VectorStore {
  switch (config.vectorStore) {
    case 'qdrant':
      return new QdrantStore();
    case 'memory':
    default:
      return new MemoryStore();
  }
}
