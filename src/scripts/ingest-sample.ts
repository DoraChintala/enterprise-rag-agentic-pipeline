import { config } from '../core/config.js';
import { logger } from '../core/logger.js';
import { createProvider } from '../providers/index.js';
import { ingestDocument } from '../rag/ingest.js';
import { RagPipeline } from '../rag/pipeline.js';
import { createStore } from '../store/index.js';

/**
 * Demo script: ingests a small sample "10-K"-style document, then asks a
 * question so you can see the end-to-end RAG flow in the terminal.
 *
 * Run: npm run ingest
 */
const SAMPLE = `
Acme Corp Annual Report 2024.
Total revenue for fiscal year 2024 was 5.2 billion dollars, up from
4.1 billion dollars in 2023. Research and development expenses were
820 million dollars in 2024 compared to 610 million dollars in 2023.
Net income was 1.1 billion dollars. The company employs 12,400 people
across 14 countries. Operating margin improved to 21 percent.
`;

async function main() {
  const provider = createProvider();
  const store = createStore();
  await store.init();

  const { docId, chunks } = await ingestDocument(
    { text: SAMPLE, source: 'acme-10k-2024.pdf' },
    { provider, store }
  );
  logger.info({ docId, chunks }, 'sample ingested');

  const rag = new RagPipeline(provider, store);
  const result = await rag.answer('What was Acme revenue in 2024?');

  logger.info({ provider: config.provider }, '--- RAG answer ---');
  console.log('\nANSWER:\n' + result.answer);
  console.log('\nCITATIONS:');
  for (const c of result.citations) {
    console.log(`  - ${c.source} (pos ${c.position}): ${c.snippet}`);
  }
  console.log(`\nlatency: ${result.latencyMs}ms | cache: ${result.usedCache}\n`);
}

main().catch((err) => {
  logger.error({ err }, 'sample failed');
  process.exit(1);
});
