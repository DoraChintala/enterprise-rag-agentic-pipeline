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
    // The prompt contains the retrieved CONTEXT block and the QUESTION.
    // Without a real LLM we return the most relevant context lines so the
    // end-to-end flow (and citations) still works.
    const contextMatch = prompt.match(/CONTEXT:\n([\s\S]*?)\n\nQUESTION:/);
    const context = contextMatch?.[1] ?? '';
    const firstLines = context
      .split('\n')
      .filter((l) => l.trim().length > 0)
      .slice(0, 3)
      .join(' ');
    return (
      `Based on the retrieved documents: ${firstLines}` ||
      'No relevant context was found.'
    );
  }
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
