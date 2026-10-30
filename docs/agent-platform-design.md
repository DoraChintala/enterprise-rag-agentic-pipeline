# Agent Platform — HLD & LLD

Design reframed around an **Agent Platform** requirement (runtime, SDK,
memory, evaluation, tracing, guardrails, identity) rather than a single RAG
app. The RAG pipeline becomes ONE agent capability on this platform.

> Driving requirement (from a senior AI platform role): a durable substrate
> every agent is built on — the runtime they execute in, the SDK developers
> build with, the memory that carries context across runs, the
> identity/permissioning that lets them act safely, and the tool interfaces
> they reach services through. Plus the loop that makes agents **measurably
> better**: trajectory capture → evaluation → memory → safe rollout.

---

## 1. Requirements

### Functional
| ID | Requirement |
| --- | --- |
| F1 | Agent runtime: plan → call tool → observe → iterate |
| F2 | Agent SDK: a stable contract developers build agents on |
| F3 | Tool interface: register + call tools (function-calling / MCP style) |
| F4 | Memory: context that compounds across runs |
| F5 | Trajectory capture: full reasoning + tool-call trace per run |
| F6 | Evaluation: eval suites + quality signals that score agents |
| F7 | Feedback loop: outcomes → eval → improved behavior behind gates |
| F8 | Guardrails: safety hooks that contain non-deterministic behavior |
| F9 | Identity & permissioning: an agent acts within allowed scopes |

### Non-functional
Reliability (day-2 ops), observability (tracing/metrics), horizontal
scalability, safety (guardrails before prod), SDK-grade developer
experience, and cost governance for LLM/agent spend.

---

## 2. High-Level Design

```
 Agent Developers ---> Agent SDK (Agent, Tool, Memory, Tracer contracts)
                              |
                              v
 Clients ---> AGENT RUNTIME: plan -> call tool -> observe -> iterate
                 |        |          |            |
                 v        v          v            v
             Tool     Memory    Identity     Tracer / Trajectory
             Registry  Store     & Perms      Store
             (RAG is                              |
              a tool)                             v
                                          EVALUATION loop:
                                          trajectories -> eval suite ->
                                          quality signal -> eval gate ->
                                          safe rollout
```

### Request flow (one agent run)
```
1. Client calls Runtime with a task (+ identity/scope)
2. Runtime loads the agent + its memory
3. Loop: plan (LLM) -> guardrail/permission check -> call tool ->
         observe -> append step to Trajectory -> repeat until done
4. Write run outcome to Memory (long-term, for future runs)
5. Return answer + trajectory id (auditable, replayable)
6. Async: evaluation consumes the trajectory -> quality signal
```

---

## 3. Status (implemented so far)

| Component | Status | Code |
| --- | --- | --- |
| RAG as a capability | done | `src/rag/` |
| Basic agent orchestrator | done | `src/agents/orchestrator.ts` |
| **Evaluation loop** | **done** | `src/eval/` |
| Guardrails (grounding) | partial | `src/rag/prompt.ts` |
| Identity (role) | partial | API `role` field |
| Tool registry (formal) | planned | — |
| Memory across runs | planned | — |
| Trajectory store | planned | — |

### Evaluation loop (the first platform capability shipped)
- `src/eval/suite.ts` — a labeled eval suite (questions + expected answers).
- `src/eval/evaluator.ts` — scores accuracy, groundedness, p50/p95 latency,
  and accuracy by question type.
- `src/eval/run-eval.ts` — `npm run eval` seeds the corpus, runs the suite,
  prints a report.

Why it matters: a non-deterministic system needs a repeatable way to
measure quality. This turns "I think it's better" into
"accuracy X%, groundedness Y%, p95 Z ms" — and catches regressions when the
prompt, chunking, or retrieval changes.

---

## 4. Build order (remaining)

```
1. [done] Evaluation loop (measure quality)
2. Tool interface + registry; wrap RAG as the first Tool
3. Runtime: real plan -> act -> observe -> iterate loop
4. Trajectory store (structured, replayable runs)
5. Memory: short-term, then long-term retrieval across runs
6. Eval gate + safe rollout (only ship a version that passes)
7. Guardrail hooks (allow/block per step) + identity scopes
```
