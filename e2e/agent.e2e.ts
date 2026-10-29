import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ACME_10K, GLOBEX_10K } from './helpers/fixtures.js';
import { postJson, startTestServer } from './helpers/server.js';

describe('E2E: agentic layer (multi-step)', () => {
  let server: Awaited<ReturnType<typeof startTestServer>>;

  beforeAll(async () => {
    server = await startTestServer();
    await postJson(server.baseUrl, '/ingest', ACME_10K);
    await postJson(server.baseUrl, '/ingest', GLOBEX_10K);
  });
  afterAll(async () => {
    await server.close();
  });

  it('POST /agent answers a single-step question (1 step)', async () => {
    const res = await postJson(server.baseUrl, '/agent', {
      question: 'What was Acme revenue?',
    });
    expect(res.status).toBe(200);
    expect(res.body.steps).toHaveLength(1);
    expect(res.body.citations.length).toBeGreaterThan(0);
  });

  it('POST /agent splits a comparison into multiple steps', async () => {
    const res = await postJson(server.baseUrl, '/agent', {
      question: 'Acme revenue compare Globex revenue',
    });
    expect(res.status).toBe(200);
    expect(res.body.steps.length).toBeGreaterThan(1);
    expect(res.body.answer).toContain('Multi-step');
  });

  it('POST /agent rejects empty question (400)', async () => {
    const res = await postJson(server.baseUrl, '/agent', { question: '' });
    expect(res.status).toBe(400);
  });
});
