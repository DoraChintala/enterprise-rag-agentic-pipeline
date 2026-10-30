import type { EvalCase } from './types.js';

/**
 * A small labeled evaluation suite over a known sample corpus.
 *
 * These cases assume the two sample 10-K documents (Acme + Globex) are
 * ingested first (see src/eval/run-eval.ts). Each case states what a
 * correct answer MUST contain, so scoring is objective.
 */
export const EVAL_SUITE: EvalCase[] = [
  {
    id: 'acme-revenue',
    question: 'What was Acme total revenue in 2024?',
    expectedContains: ['5.2 billion', '5.2'],
    type: 'single-fact',
  },
  {
    id: 'acme-net-income',
    question: 'What was Acme net income?',
    expectedContains: ['1.1 billion', '1.1'],
    type: 'single-fact',
  },
  {
    id: 'acme-rd',
    question: 'What were Acme research and development expenses in 2024?',
    expectedContains: ['820 million', '820'],
    type: 'single-fact',
  },
  {
    id: 'acme-employees',
    question: 'How many people does Acme employ?',
    expectedContains: ['12,400', '12400'],
    type: 'single-fact',
  },
  {
    id: 'globex-revenue',
    question: 'What was Globex total revenue in 2024?',
    expectedContains: ['3.8 billion', '3.8'],
    type: 'single-fact',
  },
  {
    id: 'globex-net-income',
    question: 'What was Globex net income?',
    expectedContains: ['600 million', '600'],
    type: 'single-fact',
  },
  {
    id: 'compare-revenue',
    question: 'Compare Acme revenue and Globex revenue',
    // a correct comparison should surface BOTH figures
    expectedContains: ['5.2', '3.8'],
    type: 'relationship',
  },
];
