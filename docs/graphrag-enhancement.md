# Enhancement: Hybrid GraphRAG

A design + defense document for extending the vector RAG pipeline into a
**hybrid GraphRAG** system. Written so the work can be explained and
defended in interviews.

---

## 1. The business problem

Plain vector RAG retrieves chunks by **semantic similarity**. It is strong
for "what does the document say about X" but **weak for questions about
RELATIONSHIPS and MULTI-HOP reasoning**:

| Question type | Vector RAG | Why it fails |
| --- | --- | --- |
| "How did R&D relate to revenue growth?" | fails | finds R&D *or* revenue chunk, not the link |
| "Which companies share Acme's auditor?" | fails | similarity does not group by a shared entity |
| "If Company X defaults, what is the exposure chain?" | fails | needs graph traversal, not nearest-neighbor |
| "What was Acme's revenue in 2024?" | works | single-fact lookup — similarity is enough |

### Why this matters in banking
- **Fraud:** "Which accounts/entities connect to this flagged one?" (rings)
- **Risk:** "What is the counterparty exposure chain for this position?"
- **Compliance/KYC:** "Which subsidiaries roll up to this parent entity?"

These are **connection** questions. Similarity search cannot answer them;
a graph can.

---

## 2. The enhancement

Extend retrieval from "vectors only" to a **hybrid** of vector + graph:

```
Documents
   |  (ingest)
   |--> Chunk + Embed --> Vector DB        (existing: similarity search)
   |--> Extract Entities + Relations --> Knowledge Graph   (NEW)

Query
   |--> Router --> vector | graph | hybrid --> combine --> grounded answer
```

Components to build:
1. **Entity extraction** — companies, metrics, dates, people from each doc.
2. **Relationship extraction** — edges like
   `(Acme) --reported--> (revenue=5.2B) --in--> (2024)`.
3. **Knowledge graph store** — nodes + edges (start in-memory; Neo4j later).
4. **Graph retrieval** — answer by **traversing** connections (multi-hop).
5. **Hybrid retrieval** — merge graph hits + vector hits, de-duplicate.
6. **Router** — single-fact -> vector; relationship/multi-hop -> graph;
   mixed -> hybrid.

---

## 3. Outcomes (what gets better)

| Outcome | Before (vector only) | After (hybrid GraphRAG) |
| --- | --- | --- |
| Relationship questions answerable | no | yes |
| Multi-hop questions answerable | no | yes |
| Single-fact accuracy | good | same (unchanged) |
| Explainability | citation of chunk | citation + the **path** used |
| Over-retrieval / noise | higher | lower (graph is precise) |

The key new capability: **answering connected questions with an auditable
reasoning path**, not just a similar chunk.

---

## 4. How it is measured (the defense)

Build a small **evaluation set** of labeled questions and measure both
systems on it. Numbers, not claims.

### Metrics
- **Answer accuracy** (contains the gold fact): % correct, split by
  question type (single-fact vs relationship vs multi-hop).
- **Retrieval precision@k** and **recall@k**.
- **Latency** (p50/p95) vs the p95 < 3s budget.
- **Groundedness**: % of answers fully supported by retrieved context.

### Method (A/B)
```
For each question in the eval set:
  run vector-only  -> accuracy, precision@k, latency
  run hybrid       -> accuracy, precision@k, latency
Report the delta, segmented by question type.
```

### What "success" looks like
```
- Relationship/multi-hop accuracy:  0% (vector) -> clearly positive (hybrid)
- Single-fact accuracy:             unchanged (no regression)
- p95 latency:                      still within the < 3s budget
- Groundedness:                     maintained or improved
```

---

## 5. Tradeoffs (be ready for these)

| Tradeoff | Discussion |
| --- | --- |
| Graph build cost at ingest | extraction adds ingest latency; it is async, so users do not wait |
| Extraction quality | rule/LLM extraction can miss/err; measure recall, allow re-extraction |
| Storage | a graph adds storage next to vectors; small vs the raw files |
| Complexity | more moving parts; justified only for connection-heavy workloads |
| When NOT to use graph | pure single-fact lookups — vector is simpler and enough |

---

## 6. Skills this demonstrates (maps to the JD)

- **GraphRAG** (exact JD title keyword).
- **Agentic routing** — the router is a decision step (vector/graph/hybrid).
- **Retrieval tradeoffs** — cost/latency/accuracy, measured via A/B.
- **Evaluation & observability** — labeled eval set + segmented metrics.
- **End-to-end AI architecture** — ingest -> dual index -> hybrid retrieve.
- **Guardrails** — groundedness measured, answers stay cited.

---

## 7. Interview one-liner

> "I extended my vector RAG into a hybrid GraphRAG system. Vector search
> handles single-fact questions; a knowledge graph handles relationship and
> multi-hop questions that similarity search gets wrong. A router picks the
> strategy per question, and I measured accuracy, precision@k, and latency
> with an A/B eval set — showing relationship-question accuracy went from
> zero to positive with no regression on single-fact questions or the p95
> latency budget."
