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
- [ ] Stage 4 — Ingestion Pipeline
- [ ] Stage 5 — Retrieval + RAG Core
- [ ] Stage 6 — Agentic Layer
- [ ] Stage 7 — API, Scaling, Reliability
- [ ] Stage 8 — DevOps, Monitoring, Trade-offs

See [`docs/system-design.md`](docs/system-design.md) for the full design log.
See [`docs/architecture.md`](docs/architecture.md) for the architecture + flow diagrams.

## Run it locally

```bash
npm install          # install dependencies
cp .env.example .env # defaults: local provider + in-memory store (no API key)

npm run ingest       # demo: ingest a sample 10-K + ask a question
npm run dev          # start the API on http://localhost:3000
```

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
