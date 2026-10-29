import type { RagAnswer } from '../core/types.js';
import type { RagPipeline } from '../rag/pipeline.js';

/**
 * Agentic layer (Stage 6) — a minimal planner for multi-step questions.
 *
 * If a question contains comparison/multi-part signals (e.g. "compare",
 * "vs", "and"), it is split into sub-questions, each answered via the
 * RAG pipeline, then the results are combined. This demonstrates the
 * retrieve -> reason -> combine loop without a heavy agent framework.
 */
export class AgentOrchestrator {
  constructor(private readonly rag: RagPipeline) {}

  async run(question: string): Promise<RagAnswer & { steps: string[] }> {
    const started = Date.now();
    const subQuestions = this.plan(question);

    if (subQuestions.length <= 1) {
      const single = await this.rag.answer(question);
      return { ...single, steps: [question] };
    }

    const answers: RagAnswer[] = [];
    for (const sub of subQuestions) {
      answers.push(await this.rag.answer(sub));
    }

    const combined = answers
      .map((a, i) => `(${i + 1}) ${subQuestions[i]}\n${a.answer}`)
      .join('\n\n');

    return {
      answer: `Multi-step analysis:\n\n${combined}`,
      citations: answers.flatMap((a) => a.citations),
      usedCache: answers.every((a) => a.usedCache),
      latencyMs: Date.now() - started,
      steps: subQuestions,
    };
  }

  /** Very small heuristic planner. A real system would use an LLM here. */
  private plan(question: string): string[] {
    const lower = question.toLowerCase();
    const isMultiStep =
      lower.includes(' compare ') ||
      lower.includes(' vs ') ||
      lower.includes(' versus ') ||
      lower.includes(' and ');

    if (!isMultiStep) return [question];

    return question
      .split(/\s+(?:compare|vs|versus|and)\s+/i)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
}
