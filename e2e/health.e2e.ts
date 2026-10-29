import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getJson, startTestServer } from './helpers/server.js';

describe('E2E: health check', () => {
  let server: Awaited<ReturnType<typeof startTestServer>>;

  beforeAll(async () => {
    server = await startTestServer();
  });
  afterAll(async () => {
    await server.close();
  });

  it('GET /health returns ok (used by Docker/K8s probes)', async () => {
    const res = await getJson(server.baseUrl, '/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
