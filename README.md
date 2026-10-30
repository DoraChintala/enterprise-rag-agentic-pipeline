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
- [x] Stage 2 — Scale & Constraints
- [x] Stage 3 — High-Level Architecture
- [x] Stage 4 — Ingestion Pipeline (chunker + embeddings + store)
- [x] Stage 5 — Retrieval + RAG Core (search, prompt, citations, cache)
- [x] Stage 6 — Agentic Layer (multi-step orchestrator)
- [x] Stage 7 — API, Scaling, Reliability (Fastify API, async-ready, health checks)
- [x] Stage 8 — DevOps, Monitoring, Trade-offs (Docker, docker-compose, CI/CD)

See [`docs/system-design.md`](docs/system-design.md) for the full design log.
See [`docs/architecture.md`](docs/architecture.md) for the architecture + flow diagrams.

## Run it locally

```bash
npm install          # install dependencies
cp .env.example .env # defaults: local provider + in-memory store (no API key)

npm run ingest       # demo: ingest a sample 10-K + ask a question
npm run dev          # start the API + UI on http://localhost:3000
```

Open http://localhost:3000 in a browser for the web UI: ingest a document,
ask a question, and see the answer with its citations.

Try the API:

```bash
curl -s localhost:3000/health

curl -s -X POST localhost:3000/ingest \
  -H 'content-type: application/json' \
  -d '{"text":"Acme revenue in 2024 was 5.2 billion dollars.","source":"acme.pdf"}'

curl -s -X POST localhost:3000/query \
  -H 'content-type: application/json' \
  -d '{"question":"What was Acme revenue in 2024?"}'
```

By default it runs with a free local provider and an in-memory vector store.
Set `PROVIDER=openai` (+ `OPENAI_API_KEY`) and `VECTOR_STORE=qdrant` for the
production path.

## Testing

```bash
npm run test       # unit tests (chunker, pipeline)
npm run test:e2e   # end-to-end tests (real HTTP server, all endpoints)
npm run test:all   # both
```

Reports (HTML + JSON + JUnit) are written to `reports/`. View the HTML report:

```bash
npx vite preview --outDir reports/e2e
```

See [`e2e/README.md`](e2e/README.md) for the full list of E2E scenarios.

## Evaluation loop

A non-deterministic AI system needs a repeatable way to measure quality.
The eval harness scores the pipeline against a labeled suite:

```bash
npm run eval
```

It reports **accuracy**, **groundedness** (answers backed by a citation —
i.e. no hallucination), **p50/p95 latency**, and accuracy **by question
type**. Re-run it after any change (prompt, chunking, retrieval) to catch
regressions and prove the system is *measurably* better — not just
different.

## Agent trajectory + memory

Every agent run (`POST /agent`) is captured as a structured, **replayable
trajectory** — the plan, each tool call, each observation, and the outcome:

```bash
# run an agent query -> response includes a runId
# then fetch the full trace:
curl localhost:3000/trajectory/<runId>
curl localhost:3000/trajectories   # recent runs + memory size
```

The agent also keeps **cross-run memory**: after each run it stores a
summary + outcome, and recalls similar prior runs on the next question — so
it improves from experience. See
[`docs/agent-platform-design.md`](docs/agent-platform-design.md).

## Deploy (live demo)

The app is container-ready and deploys to [Render](https://render.com) via
the included `render.yaml` (free tier, no API key needed — uses the local
provider + in-memory store).

1. Push this repo to GitHub.
2. On Render: **New → Blueprint** → select this repo.
3. Render reads `render.yaml`, builds the `Dockerfile`, and gives you a public URL.
4. Health check: `GET /health`.

For a stronger demo, set `PROVIDER=openai` + `OPENAI_API_KEY` and
`VECTOR_STORE=qdrant` in the service environment.
