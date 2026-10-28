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
