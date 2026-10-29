import type { RetrievedChunk } from '../core/types.js';

/**
 * Builds the grounded prompt. The retrieved chunks are injected as
 * CONTEXT and the model is instructed to answer only from them.
 * Each context block is numbered so answers can reference sources.
 */
export function buildPrompt(question: string, chunks: RetrievedChunk[]): string {
  const context = chunks
    .map(
      (c, i) =>
        `[${i + 1}] (source: ${c.source}${
          c.page ? `, p.${c.page}` : ''
        }) ${c.text}`
    )
    .join('\n');

  return [
    'You are a financial research assistant. Use ONLY the context below.',
    'If the answer is not in the context, say you do not have enough',
    'information. Never invent numbers.',
    '',
    'CONTEXT:',
    context,
    '',
    `QUESTION: ${question}`,
    '',
    'ANSWER:',
  ].join('\n');
}
