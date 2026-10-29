import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ACME_10K } from './helpers/fixtures.js';
import { getJson, postJson, startTestServer } from './helpers/server.js';

/**
 * The headline scenario: a fresh system, a user ingests a document,
 * then asks a question and gets a grounded, cited answer. This mirrors
 * exactly what you would demo in an interview.
 */
describe('E2E: full user journey', () => {
  let server: Awaited<ReturnType<typeof startTestServer>>;

  beforeAll(async () => {
    server = await startTestServer();
  });
  afterAll(async () => {
    await server.close();
  });

  it('health -> ingest -> query -> cited answer', async () => {
    // 1. system is healthy
    const health = await getJson(server.baseUrl, '/health');
    expect(health.status).toBe(200);

    // 2. querying an empty system gives a graceful "no info" answer
    const empty = await postJson(server.baseUrl, '/query', {
      question: 'What was revenue?',
    });
    expect(empty.status).toBe(200);
    expect(empty.body.citations).toHaveLength(0);

    // 3. ingest a document
    const ingest = await postJson(server.baseUrl, '/ingest', ACME_10K);
    expect(ingest.status).toBe(201);
    expect(ingest.body.chunks).toBeGreaterThan(0);

    // 4. now the same question returns an answer WITH citations
    const answer = await postJson(server.baseUrl, '/query', {
      question: 'What was Acme revenue in 2024?',
    });
    expect(answer.status).toBe(200);
    expect(answer.body.citations.length).toBeGreaterThan(0);
    expect(answer.body.citations[0].source).toBe(ACME_10K.source);
    expect(answer.body.answer.length).toBeGreaterThan(0);
  });
});
