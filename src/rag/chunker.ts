import { randomUUID } from 'node:crypto';
import type { Chunk } from '../core/types.js';

/**
 * Splits text into overlapping, word-based chunks.
 *
 * WHY OVERLAP: a sentence split across a chunk boundary loses meaning.
 * Overlapping a few words keeps context continuous between chunks
 * (this answers Stage 4, Q2).
 *
 * WHY METADATA: every chunk carries docId/source/position so the
 * answer can be CITED back to its origin (Stage 4, Q3).
 */
export function chunkText(
  text: string,
  opts: {
    docId: string;
    source: string;
    chunkSize: number; // words per chunk
    chunkOverlap: number; // words shared with the previous chunk
    page?: number;
  }
): Chunk[] {
  const { docId, source, chunkSize, chunkOverlap, page } = opts;

  if (chunkOverlap >= chunkSize) {
    throw new Error('chunkOverlap must be smaller than chunkSize');
  }

  const words = text.split(/\s+/).filter(Boolean);
  const chunks: Chunk[] = [];
  const step = chunkSize - chunkOverlap;

  let position = 0;
  for (let start = 0; start < words.length; start += step) {
    const slice = words.slice(start, start + chunkSize);
    if (slice.length === 0) break;

    chunks.push({
      id: randomUUID(),
      docId,
      source,
      page,
      position,
      text: slice.join(' '),
    });
    position += 1;

    if (start + chunkSize >= words.length) break;
  }

  return chunks;
}
