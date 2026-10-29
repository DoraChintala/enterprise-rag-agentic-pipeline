# Architecture & Flow Diagrams

GitHub renders the Mermaid diagrams below automatically.

---

## 1. High-Level Architecture (Components + Data Flow)

```mermaid
flowchart TB
    UI[UI / Client]
    GW[API Gateway<br/>auth · routing · rate limit]
    APP[App Service<br/>orchestrator]

    subgraph WRITE[WRITE PATH — Ingestion]
        Q[Queue<br/>async buffer]
        W[Ingestion Worker<br/>parse · chunk]
        EMB1[Embedding Model]
    end

    subgraph READ[READ PATH — Query]
        CACHE[Semantic Cache]
        EMB2[Embedding Model]
        LLM[LLM<br/>streams answer]
    end

    S3[(Object Storage / S3<br/>RAW files ~2.5TB)]
    VDB[(Vector DB / Qdrant<br/>embeddings ~90GB)]
    META[(Metadata DB<br/>docs · status · users)]

    UI -->|upload PDF / ask Q| GW
    GW --> APP

    %% write path
    APP -->|1 store raw| S3
    APP -->|2 enqueue job| Q
    Q --> W
    W --> EMB1
    EMB1 -->|store vectors| VDB
    W -->|update status| META

    %% read path
    APP -->|check first| CACHE
    APP --> EMB2
    EMB2 -->|top-k search| VDB
    VDB --> LLM
    LLM -->|answer + citations| APP
    APP -->|save answer| CACHE
    APP -->|response| UI
```

---

## 2. Request Flow (Sequence Diagram)

```mermaid
sequenceDiagram
    actor U as User
    participant GW as API Gateway
    participant APP as App Service
    participant Q as Queue
    participant W as Ingestion Worker
    participant S3 as Object Storage (S3)
    participant EMB as Embedding Model
    participant VDB as Vector DB
    participant C as Semantic Cache
    participant LLM as LLM

    rect rgb(230, 240, 255)
    note over U,VDB: WRITE PATH — Ingest a Document (async)
    U->>GW: upload PDF
    GW->>APP: forward (auth, size check)
    APP->>S3: store raw file
    APP->>Q: enqueue ingest job
    APP-->>U: 202 "processing"
    Q->>W: deliver job
    W->>S3: fetch raw file
    W->>W: parse + chunk (~500 words)
    W->>EMB: embed chunks
    EMB-->>W: vectors
    W->>VDB: store vectors + metadata
    end

    rect rgb(230, 255, 235)
    note over U,LLM: READ PATH — Ask a Question
    U->>GW: ask question
    GW->>APP: forward
    APP->>C: check semantic cache
    alt cache hit
        C-->>APP: cached answer
        APP-->>U: answer (~50ms)
    else cache miss
        APP->>EMB: embed question
        EMB-->>APP: query vector
        APP->>VDB: top-k search
        VDB-->>APP: relevant chunks
        APP->>LLM: prompt (question + chunks)
        LLM-->>APP: stream answer + citations
        APP->>C: store answer
        APP-->>U: streamed answer + sources
    end
    end
```

---

## Key Design Decisions

- **Raw files → S3; embeddings → Vector DB** (never store raw PDFs in the vector DB).
- Ingestion is **async via a queue** so the user never waits on parsing.
- The read path is **cache-first** for repeated/similar questions.
- The LLM **streams** its answer to cut perceived latency.
- **Citations** are attached on the return path to satisfy auditability.
