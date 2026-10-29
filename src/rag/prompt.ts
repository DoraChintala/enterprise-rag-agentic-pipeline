import type { RetrievedChunk } from '../core/types.js';

/**
 * How to FRAME the answer for each persona. This only changes tone/focus,
 * never the facts — every persona is still bound by the grounding rules.
 */
const ROLE_FRAMING: Record<string, string> = {
  'Financial Analyst':
    'Frame the answer for a financial analyst: focus on figures, trends, and drivers.',
  'Portfolio Manager':
    'Frame the answer for a portfolio manager: focus on risk, exposure, and performance implications.',
  'Investment Banker':
    'Frame the answer for an investment banker: focus on valuation signals, growth, and comparables.',
  'Tech Lead':
    'Frame the answer for a technical lead: be precise and structured.',
  'Compliance Officer':
    'Frame the answer for a compliance officer: be literal, cite sources, and avoid interpretation beyond the text.',
};

/**
 * Builds the grounded prompt. The retrieved chunks are injected as
 * CONTEXT and the model is instructed to answer ONLY from them.
 * Each context block is numbered so answers can reference sources.
 *
 * An optional `role` adjusts how the answer is FRAMED (tone/focus) but
 * never the underlying facts — the anti-hallucination rules always apply.
 */
export function buildPrompt(
  question: string,
  chunks: RetrievedChunk[],
  role?: string
): string {
  const context = chunks
    .map(
      (c, i) =>
        `[${i + 1}] (source: ${c.source}${
          c.page ? `, p.${c.page}` : ''
        }) ${c.text}`
    )
    .join('\n');

  const framing =
    role && ROLE_FRAMING[role] ? ROLE_FRAMING[role] : ROLE_FRAMING['Financial Analyst'];

  return [
    'You are a financial research assistant. Use ONLY the context below.',
    'If the answer is not in the context, say you do not have enough',
    'information. Never invent numbers. Always ground every claim in the context.',
    framing,
    '',
    'CONTEXT:',
    context,
    '',
    `QUESTION: ${question}`,
    '',
    'ANSWER:',
  ].join('\n');
}
