import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ACME_10K } from './helpers/fixtures.js';
import { postJson, startTestServer } from './helpers/server.js';

describe('E2E: ingestion (write path)', () => {
  let server: Awaited<ReturnType<typeof startTestServer>>;

  beforeAll(async () => {
    server = await startTestServer();
  });
  afterAll(async () => {
    await server.close();
  });

  it('POST /ingest stores a document and returns docId + chunk count', async () => {
    const res = await postJson(server.baseUrl, '/ingest', ACME_10K);
    expect(res.status).toBe(201);
    expect(res.body.docId).toBeTruthy();
    expect(res.body.chunks).toBeGreaterThan(0);
  });

  it('POST /ingest rejects missing text (400 validation)', async () => {
    const res = await postJson(server.baseUrl, '/ingest', {
      source: 'no-text.pdf',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });

  it('POST /ingest rejects missing source (400 validation)', async () => {
    const res = await postJson(server.baseUrl, '/ingest', {
      text: 'some text but no source',
    });
    expect(res.status).toBe(400);
  });
});
