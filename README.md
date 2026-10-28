# Enterprise RAG & Agentic Pipeline

An end-to-end Retrieval-Augmented Generation (RAG) and agentic system for
answering natural-language questions over large financial document sets —
with **source-cited answers** and production DevOps infrastructure.

> Built in public as a Bloomberg-style system design + implementation exercise.

## The Problem

Financial analysts drown in long, dense, constantly-updated documents
(10-K, 10-Q, earnings reports, news). Generic LLMs can't help because they:

- don't know your private documents
- hallucinate numbers (dangerous in finance)
- can't cite where an answer came from (no audit trail)

## The Solution

| Problem | Solution in this project |
| --- | --- |
| LLM doesn't know your docs | RAG retrieval layer |
| LLM hallucinates numbers | grounding + source citations |
| Questions need multiple steps | agentic orchestration layer |
| Must be trustworthy/auditable | logging + traceability |
| Must handle many users reliably | API + containers + scaling |
| Must deploy safely + repeatedly | CI/CD + Docker + K8s |

## Status

🚧 In progress — learning + building in public.

- [x] Stage 1 — Requirements
- [ ] Stage 2 — Scale & Constraints
- [ ] Stage 3 — High-Level Architecture
- [ ] Stage 4 — Ingestion Pipeline
- [ ] Stage 5 — Retrieval + RAG Core
- [ ] Stage 6 — Agentic Layer
- [ ] Stage 7 — API, Scaling, Reliability
- [ ] Stage 8 — DevOps, Monitoring, Trade-offs

See [`docs/system-design.md`](docs/system-design.md) for the full design log.
