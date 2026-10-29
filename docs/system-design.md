# System Design Log

A Bloomberg-style system design walkthrough for an Enterprise RAG & Agentic
pipeline. Documented stage by stage.

---

## Stage 1 — Requirements

### Users

- **Primary:** Financial analyst (asks questions about filings/reports)
- Research teams (compare companies, trends)
- Portfolio managers (fast, trustworthy decisions)
- Compliance officers (need audit trail / citations)

### Functional Requirements (what it MUST do)

| ID | Requirement |
| --- | --- |
| F1 | Ingest documents (PDF, 10-K, 10-Q, news) |
| F2 | Keep documents private (no data leaves the system) |
| F3 | Chunk + embed + store in a vector DB |
| F4 | Accept a natural-language question |
| F5 | Retrieve relevant chunks |
| F6 | Generate an answer **with citations** |
| F7 | (Agentic) handle multi-step questions |

### Non-Functional Requirements (how WELL)

| ID | Requirement | Target |
| --- | --- | --- |
| N1 | Accuracy (grounded, no hallucination) | top priority |
| N2 | Auditability (every answer cites its source) | always |
| N3 | Security (private docs, access control) | required |
| N4 | Latency | < 5s per answer |
| N5 | Scalability (many docs + many users) | horizontal |
| N6 | Availability | 99.9% uptime |

### Out of Scope (v1)

- No fancy UI (API only)
- No real-time streaming market data
- No billing / payments
- English only
- No mobile app

### Key Lessons

- Don't jump to architecture before nailing requirements.
- RAG is **query → cited answer**, not just ingestion.
- "Unlimited size" is a red flag — real systems set limits.
- Under uncertainty, state an assumption and ask to confirm.

---

## Stage 2 — Scale & Constraints

### Assumptions

| Dimension | Value | Notes |
| --- | --- | --- |
| Documents | 100/day → ~50,000 total | 2-year headroom, role-based limits |
| Users | ~20–50 internal | devs, testers, PO, PA, delivery lead |
| Queries | 50/day, ~5 follow-ups each | ~250 retrievals/day |
| Doc size limit | 50 MB/doc | explicit cap (not "unlimited") |
| Access pattern | balanced, read-sensitive | user waits on reads |
| Latency target | p95 < 3s | LLM generation is the bottleneck |

### Storage Estimate

```
Docs total            = 50,000
Text per doc          ≈ 2 MB (~300,000 words)
Chunk size            = ~500 words
Chunks per doc        = 600
Total chunks/vectors  = 50,000 × 600 = 30,000,000

Vector size           = 768 dims × 4 bytes ≈ 3 KB
Vectors               = 30M × 3 KB ≈ 90 GB
+ metadata/text       ≈ 150–200 GB total
Raw files             = 50,000 × 50 MB = 2.5 TB (object storage, not vector DB)
```

### Latency Budget (per query)

| Step | Time |
| --- | --- |
| Embed question | ~50 ms |
| Vector search (top-k) | ~100 ms |
| Build prompt | ~10 ms |
| LLM generation | ~1,500 ms (bottleneck) |
| Format + citations | ~50 ms |
| **Total** | **~1.7s (p95 < 3s ✅)** |

### Key Lessons

- Convert "per day" into a **total** for sizing.
- Replace "instant/fast" with a **number** (p95 < 3s).
- Store raw files in **object storage**, vectors in the **vector DB**.
- Separate **users** (concurrency) from **query load** (throughput).

### Stage 2 — Interview Drill (deep dive Q&A)

**Q1 — LLM is ~1.5s of the 1.7s total; can't swap models. Make it feel faster.**
- **Stream tokens** (⭐ biggest win) — show words as they generate; perceived
  latency drops from ~1.5s to ~300ms even though real time is unchanged.
- **Semantic cache** — embed the question, return cached answers for
  identical/similar questions (~50ms).
- **Parallelize** embedding + vector search where possible.
- Insight: you can't make the model faster, but streaming changes perception.

**Q2 — Why design for scale when it's 50 queries/day? What's the real stress?**
- Real stressors: (1) unbounded **storage growth** (100 docs/day forever),
  (2) **peak concurrency** (requests in the same second, not per day),
  (3) **follow-ups** — 1 question ≈ 5 LLM calls = 5× load.
- Prefer **horizontal scaling** ("scale out, not up"). Vertical scaling has a
  ceiling, is a single point of failure, and is costly.

**Q3 — Sync or async ingestion for a 50MB PDF?**
- **Asynchronous.** Return immediately, process in the background.
- Put a **queue** (SQS/RabbitMQ) between upload and processing to absorb bursts.
- **Retry with backoff**; after N retries send to a **dead-letter queue**.
- Track status (pending/processing/done/failed) so the user can check progress.

**Q4 — When to shard the vector DB and how to split?**
- Shard when: data exceeds one node, query latency grows, or write throughput
  saturates one node.
- Split by **company/tenant** or by **time** (queries usually scope to one
  company/period); hash-by-doc-ID for even distribution.
- **Replicate** each shard for availability + read throughput.
- Pattern: shard for size/speed, replicate for availability.

**Q5 — What breaks first under a burst, and the fix?**
- On a **query burst**, the **LLM layer breaks first** (slowest, GPU-bound /
  rate-limited). 50 concurrent questions → LLM queue backs up.
- Fixes (horizontal): queue + concurrency limit before the LLM, **autoscale LLM
  replicas**, semantic cache for repeats, graceful degradation/load shedding.
- S3 helps the raw-file/write path, not a query burst. Vertical scaling is not
  the burst fix — autoscaling replicas is.

**Two big lessons:**
1. Streaming is the #1 fix for perceived LLM latency (not just caching).
2. "Scale out, not up" — horizontal + autoscaling beats vertical for growth/bursts.

---

## Stage 3 — High-Level Architecture

### Components

| Box | Role |
| --- | --- |
| UI / Client | user uploads docs + asks questions |
| API Gateway | entry point; auth, routing, rate limiting |
| App Service | orchestrates everything (backend; LangChain lives here) |
| Queue | async ingestion buffer (SQS/RabbitMQ) |
| Ingestion Worker | parse → chunk → embed |
| Embedding Model | turns text into vectors |
| Object Storage (S3) | stores RAW files (~2.5 TB) |
| Vector DB (Qdrant) | stores EMBEDDINGS (~90 GB) |
| LLM | generates the answer (streamed) |
| Semantic Cache | returns answers for repeat questions |
| Metadata DB | doc info, job status, users |

### Write Path (ingest a PDF)

```
1. User uploads PDF via UI
2. API Gateway → App Service (auth, validate size < 50MB)
3. App Service stores RAW file in Object Storage (S3)
4. App Service enqueues a job → returns "processing" to user
5. Ingestion Worker picks up the job (async)
6. Parse the PDF → extract text
7. Chunk text (~500 words/chunk)
8. Embed each chunk
9. Store vectors + metadata in Vector DB
10. Update status to "done" in Metadata DB
```

### Read Path (ask a question)

```
1. User asks a question via UI
2. API Gateway → App Service
3. Check Semantic Cache → if hit, return cached answer (~50ms)
4. (miss) Embed the question
5. Vector DB search → top-k relevant chunks
6. Build prompt (question + chunks + citation metadata)
7. Send to LLM → stream the answer back
8. Attach citations (which chunks/docs the answer came from)
9. Store answer in cache + return to user
```

### Key Design Decisions

- **Raw files → S3; vectors → Vector DB** (never store raw PDFs in the vector DB).
- Ingestion is **async via a queue** (user doesn't wait).
- Read path is **cache-first** (fast path for repeats).
- LLM **streams** the answer (perceived-latency fix).
- **Citations** attached on the way back (auditability requirement).

### Key Lessons

- Separate storage: files in S3, embeddings in the vector DB.
- Ingestion = parse → chunk → embed → store (not just "upload").
- Read path = cache → embed → search → prompt → LLM → cite.
- LangChain is glue inside the App Service / Worker, not a separate box.

> Architecture + sequence diagrams: see [`architecture.md`](architecture.md).

---

## Stages 4–8 — Implementation Notes

These stages were implemented in code (see `src/`). Summary of the decisions:

### Stage 4 — Ingestion Pipeline (`src/rag/`)
- `chunker.ts`: word-based chunks with **overlap** so meaning is not lost at
  boundaries; each chunk carries `docId`, `source`, `position` for **citations**.
- `ingest.ts`: parse → chunk → **embed (batched)** → store.

### Stage 5 — Retrieval + RAG Core (`src/rag/`)
- `retrieve.ts`: embed the question, top-k similarity search.
- `prompt.ts`: grounded prompt — answer ONLY from context, never invent numbers.
- `pipeline.ts`: cache → retrieve → prompt → generate → **attach citations**.
- `cache.ts`: **semantic cache** keyed by question embedding (perceived latency).

### Stage 6 — Agentic Layer (`src/agents/orchestrator.ts`)
- Detects multi-step/comparison questions, splits into sub-questions,
  answers each via the pipeline, then combines results + merges citations.

### Stage 7 — API, Scaling, Reliability (`src/api/app.ts`)
- Fastify API: `/health`, `/ingest`, `/query`, `/agent` + static UI.
- Zod request validation; central error handler.
- Pluggable providers (local/OpenAI) and stores (memory/Qdrant) via factories,
  so the system scales from a laptop to Qdrant without code changes.

### Stage 8 — DevOps, Monitoring, Trade-offs
- **Dockerfile**: multi-stage build, non-root user, container healthcheck.
- **docker-compose.yml**: API + Qdrant with a healthcheck dependency.
- **CI** (`.github/workflows/ci.yml`): typecheck → unit tests → E2E tests →
  build → Docker image build, with test reports uploaded as artifacts.

### Trade-offs recorded
- Local provider gives a zero-cost, no-key demo path; OpenAI gives real quality.
- In-memory store is great for tests/demo; Qdrant is the production path.
- UI is intentionally framework-free (zero build) to keep the focus on the
  backend + AI pipeline.
