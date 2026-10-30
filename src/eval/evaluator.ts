import type { RagPipeline } from '../rag/pipeline.js';
import type { EvalCase, EvalCaseResult, EvalReport } from './types.js';

/**
 * Runs an eval suite against the RAG pipeline and produces a scored report.
 *
 * Metrics:
 * - accuracy:     % of answers that contain an expected string
 * - groundedness: % of answers backed by >= 1 citation (no ungrounded claims)
 * - p50/p95 latency: speed distribution across cases
 * - byType:       accuracy split by question type (where is it weak?)
 *
 * This is the "test suite" for a non-deterministic system: it turns quality
 * into numbers so changes can be shown to be measurably better (or worse).
 */
export async function evaluate(
  rag: RagPipeline,
  suite: EvalCase[]
): Promise<EvalReport> {
  const cases: EvalCaseResult[] = [];

  for (const c of suite) {
    const result = await rag.answer(c.question);
    const answerLower = result.answer.toLowerCase();
    const correct = c.expectedContains.some((e) =>
      answerLower.includes(e.toLowerCase())
    );
    cases.push({
      id: c.id,
      question: c.question,
      type: c.type,
      answer: result.answer,
      correct,
      grounded: result.citations.length > 0,
      latencyMs: result.latencyMs,
    });
  }

  return aggregate(cases);
}

function aggregate(cases: EvalCaseResult[]): EvalReport {
  const total = cases.length;
  const correct = cases.filter((c) => c.correct).length;
  const grounded = cases.filter((c) => c.grounded).length;
  const latencies = cases.map((c) => c.latencyMs).sort((a, b) => a - b);

  const byType: Record<string, { total: number; accuracy: number }> = {};
  for (const c of cases) {
    const bucket = (byType[c.type] ??= { total: 0, accuracy: 0 });
    bucket.total += 1;
  }
  for (const type of Object.keys(byType)) {
    const ofType = cases.filter((c) => c.type === type);
    const ok = ofType.filter((c) => c.correct).length;
    byType[type].accuracy = pct(ok, ofType.length);
  }

  return {
    total,
    accuracy: pct(correct, total),
    groundedness: pct(grounded, total),
    p50LatencyMs: percentile(latencies, 50),
    p95LatencyMs: percentile(latencies, 95),
    byType,
    cases,
  };
}

function pct(n: number, d: number): number {
  return d === 0 ? 0 : Math.round((n / d) * 1000) / 10; // one decimal %
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(
    sorted.length - 1,
    Math.ceil((p / 100) * sorted.length) - 1
  );
  return sorted[Math.max(0, idx)];
}
