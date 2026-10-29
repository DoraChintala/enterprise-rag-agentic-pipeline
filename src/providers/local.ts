import { createHash } from 'node:crypto';
import type { Provider } from '../core/types.js';

const DIM = 256;

/**
 * Local, dependency-free provider so the system runs with NO API key.
 *
 * - embed(): a deterministic hashing-based embedding (bag-of-words into a
 *   fixed vector). It is NOT semantically strong, but it is fast, free,
 *   and good enough to demonstrate the end-to-end pipeline + tests.
 * - chat(): an extractive "answer" that stitches the retrieved context.
 *
 * Swap PROVIDER=openai for real semantic quality.
 */
export class LocalProvider implements Provider {
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => embedOne(t));
  }

  async chat(prompt: string): Promise<string> {
    // The prompt contains a CONTEXT block and the QUESTION. Without a real
    // LLM we do lightweight *extractive* QA: pick the sentences from the
    // context that best overlap with the question's keywords. This makes
    // the answer actually respond to the question instead of dumping text.
    const context =
      prompt.match(/CONTEXT:\n([\s\S]*?)\n\nQUESTION:/)?.[1]?.trim() ?? '';
    const question =
      prompt.match(/QUESTION:\s*([\s\S]*?)\n/)?.[1]?.trim() ?? '';

    if (!context) return 'I do not have enough information to answer that.';

    // Strip the "[n] (source: …)" prefixes, then split into sentences.
    const cleaned = context.replace(/\[\d+\]\s*\(source:[^)]*\)\s*/g, ' ');
    const sentences = cleaned
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const keywords = tokenize(question);

    // Score each sentence by how many question keywords it contains.
    const scored = sentences
      .map((sentence) => {
        const words = new Set(tokenize(sentence));
        const overlap = keywords.reduce(
          (n, k) => n + (words.has(k) ? 1 : 0),
          0
        );
        return { sentence, overlap };
      })
      .sort((a, b) => b.overlap - a.overlap);

    const best = scored.filter((s) => s.overlap > 0).slice(0, 2);

    // If nothing overlaps, fall back to the first sentence of the top chunk.
    const picked =
      best.length > 0 ? best.map((s) => s.sentence) : [sentences[0]];

    return picked.join(' ');
  }
}

// Lowercase word tokens, ignoring short stop-ish words.
const STOP = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'of', 'to', 'in', 'on',
  'for', 'and', 'or', 'what', 'how', 'did', 'does', 'do', 'it', 'this',
  'that', 'with', 'at', 'by', 'from', 'as', 'be',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

function embedOne(text: string): number[] {
  const vec = new Array<number>(DIM).fill(0);
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  for (const word of words) {
    const h = createHash('md5').update(word).digest();
    const idx = h.readUInt32BE(0) % DIM;
    vec[idx] += 1;
  }
  // L2 normalize so cosine similarity behaves well.
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}
