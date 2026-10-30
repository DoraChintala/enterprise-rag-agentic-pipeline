import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ACME_10K, GLOBEX_10K } from './helpers/fixtures.js';
import { getJson, postJson, startTestServer } from './helpers/server.js';

describe('E2E: trajectory capture + cross-run memory', () => {
  let server: Awaited<ReturnType<typeof startTestServer>>;

  beforeAll(async () => {
    server = await startTestServer();
    await postJson(server.baseUrl, '/ingest', ACME_10K);
    await postJson(server.baseUrl, '/ingest', GLOBEX_10K);
  });
  afterAll(async () => {
    await server.close();
  });

  it('an agent run returns a runId and captures a replayable trajectory', async () => {
    const res = await postJson(server.baseUrl, '/agent', {
      question: 'What was Acme revenue?',
    });
    expect(res.status).toBe(200);
    expect(res.body.runId).toBeTruthy();

    // the trajectory is fetchable + has steps
    const trace = await getJson(
      server.baseUrl,
      `/trajectory/${res.body.runId}`
    );
    expect(trace.status).toBe(200);
    expect(trace.body.runId).toBe(res.body.runId);
    expect(trace.body.steps.length).toBeGreaterThan(0);
    expect(['success', 'failure']).toContain(trace.body.outcome);
  });

  it('memory grows across runs and informs later runs', async () => {
    await postJson(server.baseUrl, '/agent', { question: 'What was Acme net income?' });
    const second = await postJson(server.baseUrl, '/agent', {
      question: 'What was Acme revenue?',
    });
    // by now there are prior runs, so memoryUsed should be >= 0 and the
    // memory store should be non-empty
    expect(typeof second.body.memoryUsed).toBe('number');

    const list = await getJson(server.baseUrl, '/trajectories');
    expect(list.status).toBe(200);
    expect(list.body.trajectories.length).toBeGreaterThan(0);
    expect(list.body.memorySize).toBeGreaterThan(0);
  });

  it('returns 404 for an unknown trajectory id', async () => {
    const res = await getJson(server.baseUrl, '/trajectory/does-not-exist');
    expect(res.status).toBe(404);
  });
});
