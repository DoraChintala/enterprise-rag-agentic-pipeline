import { describe, expect, it } from 'vitest';
import { ingestDocument } from '../src/rag/ingest.js';
import { RagPipeline } from '../src/rag/pipeline.js';
import { LocalProvider } from '../src/providers/local.js';
import { MemoryStore } from '../src/store/memory.js';

describe('RAG pipeline (end to end, local provider)', () => {
  it('ingests a document and returns a cited answer', async () => {
    const provider = new LocalProvider();
    const store = new MemoryStore();
    await store.init();

    await ingestDocument(
      {
        text: 'Acme revenue in 2024 was 5.2 billion dollars. R&D was 820 million.',
        source: 'acme.pdf',
      },
      { provider, store }
    );

    const rag = new RagPipeline(provider, store);
    const result = await rag.answer('What was Acme revenue?');

    expect(result.answer.length).toBeGreaterThan(0);
    expect(result.citations.length).toBeGreaterThan(0);
    expect(result.citations[0].source).toBe('acme.pdf');
  });

  it('returns a graceful message when nothing is ingested', async () => {
    const provider = new LocalProvider();
    const store = new MemoryStore();
    await store.init();

    const rag = new RagPipeline(provider, store);
    const result = await rag.answer('anything?');

    expect(result.citations).toHaveLength(0);
    expect(result.answer.toLowerCase()).toContain('not have enough');
  });
});
