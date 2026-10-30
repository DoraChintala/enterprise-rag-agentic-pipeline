import { randomUUID } from 'node:crypto';

/**
 * Trajectory capture (Netflix JD: "capture each run's full
 * reasoning-and-tool-call trajectory as structured, replayable data").
 *
 * A Trajectory is the complete, structured record of ONE agent run:
 * the task, every step (thought + action + observation), timing/cost,
 * and the final outcome. It is replayable and auditable.
 */

export type StepAction =
  | { type: 'tool'; tool: string; input: unknown }
  | { type: 'final'; answer: string };

export interface TrajectoryStep {
  index: number;
  thought: string; // the agent's reasoning for this step
  action: StepAction; // what it decided to do
  observation?: string; // what came back (tool result)
  latencyMs: number;
  guardrail?: 'allow' | 'block';
}

export interface Trajectory {
  runId: string;
  task: string;
  startedAt: string;
  finishedAt?: string;
  steps: TrajectoryStep[];
  outcome: 'success' | 'failure' | 'in_progress';
  totalLatencyMs: number;
}

/**
 * Tracer records the steps of a run and exposes replayable trajectories.
 * In-memory for the demo; the same interface could back onto a durable
 * store (Postgres/S3) for production replay + evaluation.
 */
export class Tracer {
  private runs = new Map<string, Trajectory>();
  private order: string[] = [];
  private readonly max = 200;

  startRun(task: string): string {
    const runId = randomUUID();
    this.runs.set(runId, {
      runId,
      task,
      startedAt: new Date().toISOString(),
      steps: [],
      outcome: 'in_progress',
      totalLatencyMs: 0,
    });
    this.order.push(runId);
    if (this.order.length > this.max) {
      const evicted = this.order.shift();
      if (evicted) this.runs.delete(evicted);
    }
    return runId;
  }

  recordStep(runId: string, step: Omit<TrajectoryStep, 'index'>): void {
    const run = this.runs.get(runId);
    if (!run) return;
    run.steps.push({ ...step, index: run.steps.length });
    run.totalLatencyMs += step.latencyMs;
  }

  finishRun(runId: string, outcome: 'success' | 'failure'): void {
    const run = this.runs.get(runId);
    if (!run) return;
    run.outcome = outcome;
    run.finishedAt = new Date().toISOString();
  }

  get(runId: string): Trajectory | undefined {
    return this.runs.get(runId);
  }

  /** Most recent trajectories first (for an activity/replay view). */
  list(limit = 20): Trajectory[] {
    return this.order
      .slice(-limit)
      .reverse()
      .map((id) => this.runs.get(id))
      .filter((t): t is Trajectory => Boolean(t));
  }
}
