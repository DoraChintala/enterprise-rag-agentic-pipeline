import type { Provider, RagAnswer } from '../core/types.js';
import type { RagPipeline } from '../rag/pipeline.js';
import { CostMeter, type CostBudget } from './cost.js';
import { identityForRole, isAllowed, type Identity } from './identity.js';
import { AgentMemory } from './memory.js';
import { Tracer } from './trajectory.js';

/**
 * Agentic layer — plans multi-step questions, runs them through the RAG
 * tool, and makes four platform capabilities first-class:
 *
 *  - TRAJECTORY CAPTURE: every run records plan, tool calls, observations.
 *  - CROSS-RUN MEMORY: recall similar prior runs; remember outcomes.
 *  - IDENTITY & PERMISSIONING: each tool call is checked against the
 *    identity's scopes; unauthorized calls are BLOCKED.
 *  - COST GOVERNANCE: token/cost tracked per run with a per-run budget that
 *    stops runaway agents.
 */
export interface AgentResult extends RagAnswer {
  steps: string[];
  runId: string;
  memoryUsed: number;
  cost: { steps: number; tokens: number; estimatedCostUsd: number };
  blocked: string[]; // tool calls denied by permissioning / budget
}

export class AgentOrchestrator {
  readonly tracer: Tracer;
  readonly memory: AgentMemory;

  constructor(
    private readonly rag: RagPipeline,
    provider: Provider,
    deps?: { tracer?: Tracer; memory?: AgentMemory; budget?: CostBudget }
  ) {
    this.tracer = deps?.tracer ?? new Tracer();
    this.memory = deps?.memory ?? new AgentMemory(provider);
    this.budget = deps?.budget;
  }

  private readonly budget?: CostBudget;

  async run(question: string, role?: string): Promise<AgentResult> {
    const started = Date.now();
    const identity = identityForRole(role);
    const cost = new CostMeter(this.budget);
    const blocked: string[] = [];
    const runId = this.tracer.startRun(question);

    // Recall relevant prior runs (memory that compounds across runs).
    const recalled = await this.memory.recall(question);

    // Plan — requires the "planner" tool scope.
    let subQuestions: string[];
    if (isAllowed(identity, 'planner')) {
      subQuestions = this.plan(question);
    } else {
      // No planning permission -> treat as a single-step question.
      subQuestions = [question];
      blocked.push('planner');
    }
    cost.record(question);
    this.tracer.recordStep(runId, {
      thought:
        `Identity ${identity.principal} (${identity.role}). ` +
        `Planned ${subQuestions.length} step(s). ` +
        `Recalled ${recalled.length} prior run(s).`,
      action: { type: 'tool', tool: 'planner', input: { subQuestions } },
      observation: subQuestions.join(' | '),
      latencyMs: Date.now() - started,
      guardrail: isAllowed(identity, 'planner') ? 'allow' : 'block',
    });

    // Execute each step via the RAG tool, enforcing scope + budget.
    const answers: RagAnswer[] = [];
    for (const sub of subQuestions) {
      // Permission check.
      if (!isAllowed(identity, 'rag')) {
        blocked.push('rag');
        this.tracer.recordStep(runId, {
          thought: `Denied: ${identity.role} lacks tool:rag scope.`,
          action: { type: 'tool', tool: 'rag', input: { question: sub } },
          observation: 'BLOCKED by permissioning',
          latencyMs: 0,
          guardrail: 'block',
        });
        continue;
      }
      // Budget check.
      const over = cost.exceeded();
      if (over.over) {
        blocked.push(`budget:${over.reason}`);
        this.tracer.recordStep(runId, {
          thought: `Stopped: ${over.reason}.`,
          action: { type: 'tool', tool: 'rag', input: { question: sub } },
          observation: 'BLOCKED by cost budget',
          latencyMs: 0,
          guardrail: 'block',
        });
        break;
      }

      const stepStart = Date.now();
      const ans = await this.rag.answer(sub, identity.role);
      answers.push(ans);
      cost.record(sub + ans.answer);
      this.tracer.recordStep(runId, {
        thought: `Answer sub-question: "${sub}"`,
        action: { type: 'tool', tool: 'rag', input: { question: sub } },
        observation: `${ans.answer.slice(0, 120)} (${ans.citations.length} citation(s))`,
        latencyMs: Date.now() - stepStart,
        guardrail: ans.citations.length > 0 ? 'allow' : 'block',
      });
    }

    // Combine.
    const isMulti = subQuestions.length > 1 && answers.length > 1;
    const answerText =
      answers.length === 0
        ? 'The agent could not complete this request (blocked by policy or budget).'
        : isMulti
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

    // Remember this run so future runs can learn from it.
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
      cost: cost.summary(),
      blocked,
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
