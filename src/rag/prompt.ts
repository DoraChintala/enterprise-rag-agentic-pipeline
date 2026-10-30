import type { RetrievedChunk } from '../core/types.js';
import { TYPE_FRAMING, type DocType } from './classify.js';

/**
 * Optional PERSONA framing (the signed-in role). Adjusts tone/focus only,
 * never the facts — the grounding rules always apply.
 */
const ROLE_FRAMING: Record<string, string> = {
  'Financial Analyst':
    'Tailor the tone for a financial analyst: focus on figures, trends, and drivers.',
  'Portfolio Manager':
    'Tailor the tone for a portfolio manager: focus on risk, exposure, and performance.',
  'Investment Banker':
    'Tailor the tone for an investment banker: focus on valuation, growth, and comparables.',
  'Tech Lead':
    'Tailor the tone for a technical lead: be precise and structured.',
  'Compliance Officer':
    'Tailor the tone for a compliance officer: be literal and cite sources.',
};

/**
 * Builds the grounded prompt. Retrieved chunks are injected as CONTEXT and
 * the model is told to answer ONLY from them. Numbered context blocks let
 * answers reference sources.
 *
 * The prompt adapts on two axes WITHOUT changing the facts:
 *  - docType: what KIND of document this is (resume, financial, legal, …) —
 *    detected automatically, drives domain-appropriate framing.
 *  - role:    the signed-in user's persona — adjusts tone/focus.
 * The anti-hallucination rules always apply regardless.
 */
export function buildPrompt(
  question: string,
  chunks: RetrievedChunk[],
  role?: string,
  docType: DocType = 'general'
): string {
  const context = chunks
    .map(
      (c, i) =>
        `[${i + 1}] (source: ${c.source}${
          c.page ? `, p.${c.page}` : ''
        }) ${c.text}`
    )
    .join('\n');

  const typeFraming = TYPE_FRAMING[docType];
  const roleFraming = role && ROLE_FRAMING[role] ? ROLE_FRAMING[role] : null;

  // Framing lines (drop any null ones) go in the instruction header.
  const framingLines = [typeFraming, roleFraming].filter(
    (l): l is string => Boolean(l)
  );

  return [
    'You are a helpful document assistant. Use ONLY the context below.',
    'If the answer is not in the context, say you do not have enough',
    'information. Never invent facts or numbers. Ground every claim in the context.',
    ...framingLines,
    '',
    'CONTEXT:',
    context,
    '',
    `QUESTION: ${question}`,
    '',
    'ANSWER:',
  ].join('\n');
}
