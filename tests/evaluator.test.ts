import { describe, expect, it } from 'vitest';
import { evaluate } from '../src/eval/evaluator.js';
import type { EvalCase } from '../src/eval/types.js';
import { ingestDocument } from '../src/rag/ingest.js';
import { RagPipeline } from '../src/rag/pipeline.js';
import { LocalProvider } from '../src/providers/local.js';
import { MemoryStore } from '../src/store/memory.js';

async function seededPipeline() {
  const provider = new LocalProvider();
  const store = new MemoryStore();
  await store.init();
  await ingestDocument(
    {
      text: 'Acme revenue in 2024 was 5.2 billion dollars. Net income was 1.1 billion dollars.',
      source: 'acme.pdf',
    },
    { provider, store }
  );
  return new RagPipeline(provider, store);
}

describe('evaluator', () => {
  it('scores a passing case as correct and grounded', async () => {
    const rag = await seededPipeline();
    const suite: EvalCase[] = [
      {
        id: 'rev',
        question: 'What was Acme revenue?',
        expectedContains: ['5.2'],
        type: 'single-fact',
      },
    ];
    const report = await evaluate(rag, suite);

    expect(report.total).toBe(1);
    expect(report.accuracy).toBe(100);
    expect(report.groundedness).toBe(100);
    expect(report.cases[0].correct).toBe(true);
  });

  it('scores a wrong-expectation case as incorrect', async () => {
    const rag = await seededPipeline();
    const suite: EvalCase[] = [
      {
        id: 'bogus',
        question: 'What was Acme revenue?',
        expectedContains: ['999 trillion'], // not in the doc
        type: 'single-fact',
      },
    ];
    const report = await evaluate(rag, suite);

    expect(report.accuracy).toBe(0);
    expect(report.cases[0].correct).toBe(false);
  });

  it('reports accuracy by question type', async () => {
    const rag = await seededPipeline();
    const suite: EvalCase[] = [
      { id: 'a', question: 'revenue?', expectedContains: ['5.2'], type: 'single-fact' },
      { id: 'b', question: 'net income?', expectedContains: ['1.1'], type: 'single-fact' },
    ];
    const report = await evaluate(rag, suite);

    expect(report.byType['single-fact'].total).toBe(2);
    expect(report.byType['single-fact'].accuracy).toBe(100);
  });
});
