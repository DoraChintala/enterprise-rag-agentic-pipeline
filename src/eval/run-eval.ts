import { logger } from '../core/logger.js';
import { createProvider } from '../providers/index.js';
import { ingestDocument } from '../rag/ingest.js';
import { RagPipeline } from '../rag/pipeline.js';
import { createStore } from '../store/index.js';
import { evaluate } from './evaluator.js';
import { EVAL_SUITE } from './suite.js';

/**
 * Eval harness entry point.
 *
 *   npm run eval
 *
 * It ingests the sample corpus, runs the labeled eval suite against the RAG
 * pipeline, and prints a scored report (accuracy, groundedness, latency).
 * This is how we prove changes make the system measurably better.
 */
const ACME = `
Acme Corp Annual Report 2024. Total revenue for fiscal year 2024 was 5.2
billion dollars, up from 4.1 billion dollars in 2023. Research and
development expenses were 820 million dollars in 2024 compared to 610
million dollars in 2023. Net income was 1.1 billion dollars. The company
employs 12,400 people across 14 countries. Operating margin improved to 21
percent.
`;

const GLOBEX = `
Globex Industries Annual Report 2024. Total revenue for fiscal year 2024 was
3.8 billion dollars, up from 3.3 billion dollars in 2023. Research and
development expenses were 450 million dollars in 2024. Net income was 600
million dollars. Globex operates 9 manufacturing plants worldwide.
`;

async function main() {
  const provider = createProvider();
  const store = createStore();
  await store.init();

  // Seed the corpus the eval suite expects.
  await ingestDocument({ text: ACME, source: 'acme-10k-2024.pdf' }, { provider, store });
  await ingestDocument({ text: GLOBEX, source: 'globex-10k-2024.pdf' }, { provider, store });

  const rag = new RagPipeline(provider, store);
  const report = await evaluate(rag, EVAL_SUITE);

  // Print a readable report.
  console.log('\n===== EVALUATION REPORT =====');
  console.log(`cases:        ${report.total}`);
  console.log(`accuracy:     ${report.accuracy}%`);
  console.log(`groundedness: ${report.groundedness}%`);
  console.log(`p50 latency:  ${report.p50LatencyMs}ms`);
  console.log(`p95 latency:  ${report.p95LatencyMs}ms`);
  console.log('\nby question type:');
  for (const [type, s] of Object.entries(report.byType)) {
    console.log(`  ${type.padEnd(14)} ${s.accuracy}%  (${s.total} cases)`);
  }
  console.log('\nper-case:');
  for (const c of report.cases) {
    const mark = c.correct ? 'PASS' : 'FAIL';
    console.log(`  [${mark}] ${c.id.padEnd(18)} grounded=${c.grounded}`);
  }
  console.log('=============================\n');

  logger.info(
    { accuracy: report.accuracy, groundedness: report.groundedness },
    'eval complete'
  );
}

main().catch((err) => {
  logger.error({ err }, 'eval failed');
  process.exit(1);
});
