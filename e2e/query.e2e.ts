import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ACME_10K } from './helpers/fixtures.js';
import { postJson, startTestServer } from './helpers/server.js';

describe('E2E: RAG query (read path)', () => {
  let server: Awaited<ReturnType<typeof startTestServer>>;

  beforeAll(async () => {
    server = await startTestServer();
    // seed one document so queries have something to retrieve
    await postJson(server.baseUrl, '/ingest', ACME_10K);
  });
  afterAll(async () => {
    await server.close();
  });

  it('POST /query returns an answer WITH citations', async () => {
    const res = await postJson(server.baseUrl, '/query', {
      question: 'What was Acme revenue in 2024?',
    });
    expect(res.status).toBe(200);
    expect(res.body.answer.length).toBeGreaterThan(0);
    expect(res.body.citations.length).toBeGreaterThan(0);
    expect(res.body.citations[0].source).toBe(ACME_10K.source);
    expect(typeof res.body.latencyMs).toBe('number');
  });

  it('POST /query rejects empty question (400)', async () => {
    const res = await postJson(server.baseUrl, '/query', { question: '' });
    expect(res.status).toBe(400);
  });

  it('serves a repeated question from the semantic cache', async () => {
    const q = { question: 'What was Acme net income?' };
    const first = await postJson(server.baseUrl, '/query', q);
    expect(first.body.usedCache).toBe(false);

    const second = await postJson(server.baseUrl, '/query', q);
    expect(second.body.usedCache).toBe(true);
  });
});
