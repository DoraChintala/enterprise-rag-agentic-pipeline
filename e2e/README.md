# End-to-End (E2E) Tests

These tests boot the **real HTTP server** (Fastify) on a random free port
and exercise every endpoint and user scenario over real HTTP — no mocks of
the app itself. They use the local provider + in-memory store, so they run
with **no API key and no Docker**.

## Run

```bash
npm run test:e2e      # E2E only
npm run test          # unit tests only
npm run test:all      # unit + E2E
```

## What each suite covers

| Suite | Scenario |
| --- | --- |
| `health.e2e.ts` | `GET /health` returns ok (Docker/K8s probe) |
| `ingest.e2e.ts` | `POST /ingest` stores a doc; rejects invalid input (400) |
| `query.e2e.ts` | `POST /query` returns a **cited** answer; validation; **cache hit** |
| `agent.e2e.ts` | `POST /agent` single-step vs multi-step (comparison) planning |
| `full-flow.e2e.ts` | health → empty query → ingest → **cited answer** (the demo path) |

## Scenarios verified

- Health probe responds.
- A document can be ingested and produces chunks.
- Invalid ingest/query payloads are rejected with HTTP 400.
- A query over an **empty** system returns a graceful "no info" answer with
  zero citations (no hallucination).
- A query over a **seeded** system returns an answer **with citations**
  pointing back to the source document (auditability).
- Repeating the same question is served from the **semantic cache**
  (`usedCache: true`).
- The agent splits a comparison question ("A compare B") into multiple
  steps and combines the results.

## How it works

`e2e/helpers/server.ts` builds the app with `buildApp()` and listens on
port `0` (OS-assigned free port). Tests hit it with `fetch`. Each suite
tears the server down in `afterAll`.
