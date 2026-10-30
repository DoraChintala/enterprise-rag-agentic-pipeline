import type { Provider, RagAnswer } from '../core/types.js';
import type { RagPipeline } from '../rag/pipeline.js';
import { AgentMemory } from './memory.js';
import { Tracer } from './trajectory.js';

/**
 * Agentic layer — plans multi-step questions, runs them through the RAG
 * tool, and makes two platform capabilities first-class:
 *
 *  - TRAJECTORY CAPTURE: every run records its plan, each tool call, each
 *    observation, and the outcome as a structured, replayable trace.
 *  - CROSS-RUN MEMORY: before answering, it recalls similar prior runs;
 *    after answering, it remembers the outcome so future runs benefit.
 *
 * The Tracer and Memory are shared (constructed once) so traces and memory
 * accumulate across requests.
 */
export interface AgentResult extends RagAnswer {
  steps: string[];
  runId: string;
  memoryUsed: number; // how many prior memories informed this run
}

export class AgentOrchestrator {
  readonly tracer: Tracer;
  readonly memory: AgentMemory;

  constructor(
    private readonly rag: RagPipeline,
    provider: Provider,
    deps?: { tracer?: Tracer; memory?: AgentMemory }
  ) {
    this.tracer = deps?.tracer ?? new Tracer();
    this.memory = deps?.memory ?? new AgentMemory(provider);
  }

  async run(question: string): Promise<AgentResult> {
    const started = Date.now();
    const runId = this.tracer.startRun(question);

    // 1. Recall relevant prior runs (memory that compounds across runs).
    const recalled = await this.memory.recall(question);

    // 2. Plan the steps.
    const subQuestions = this.plan(question);
    this.tracer.recordStep(runId, {
      thought:
        `Planned ${subQuestions.length} step(s). ` +
        `Recalled ${recalled.length} related prior run(s).`,
      action: { type: 'tool', tool: 'planner', input: { subQuestions } },
      observation: subQuestions.join(' | '),
      latencyMs: Date.now() - started,
    });

    // 3. Execute each step via the RAG tool, tracing each call.
    const answers: RagAnswer[] = [];
    for (const sub of subQuestions) {
      const stepStart = Date.now();
      const ans = await this.rag.answer(sub);
      answers.push(ans);
      this.tracer.recordStep(runId, {
        thought: `Answer sub-question: "${sub}"`,
        action: { type: 'tool', tool: 'rag', input: { question: sub } },
        observation: `${ans.answer.slice(0, 120)} (${ans.citations.length} citation(s))`,
        latencyMs: Date.now() - stepStart,
        guardrail: ans.citations.length > 0 ? 'allow' : 'block',
      });
    }

    // 4. Combine.
    const isMulti = subQuestions.length > 1;
    const answerText = isMulti
      ? 'Multi-step analysis:\n\n' +
        answers
          .map((a, i) => `(${i + 1}) ${subQuestions[i]}\n${a.answer}`)
          .join('\n\n')
      : answers[0].answer;

    const citations = answers.flatMap((a) => a.citations);
    const outcome: 'success' | 'failure' =
      citations.length > 0 ? 'success' : 'failure';

    this.tracer.recordStep(runId, {
      thought: 'Combine sub-answers into the final response.',
      action: { type: 'final', answer: answerText },
      latencyMs: 0,
    });
    this.tracer.finishRun(runId, outcome);

    // 5. Remember this run so future runs can learn from it.
    await this.memory.remember({
      runId,
      task: question,
      summary: answerText.slice(0, 200),
      outcome,
    });

    return {
      answer: answerText,
      citations,
      usedCache: answers.every((a) => a.usedCache),
      latencyMs: Date.now() - started,
      steps: subQuestions,
      runId,
      memoryUsed: recalled.length,
    };
  }

  /** Small heuristic planner. A production system would plan with an LLM. */
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
