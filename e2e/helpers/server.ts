import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/api/app.js';
import { LocalProvider } from '../../src/providers/local.js';
import { MemoryStore } from '../../src/store/memory.js';

/**
 * Boots a REAL Fastify server on an ephemeral port for end-to-end tests.
 * Uses the local provider + in-memory store so E2E runs with no API key
 * and no Docker. Returns the base URL and a close() to tear down.
 */
export async function startTestServer(): Promise<{
  app: FastifyInstance;
  baseUrl: string;
  close: () => Promise<void>;
}> {
  const provider = new LocalProvider();
  const store = new MemoryStore();
  await store.init();

  const app = await buildApp({ provider, store });
  await app.listen({ port: 0, host: '127.0.0.1' }); // port 0 = random free port

  const address = app.server.address();
  if (!address || typeof address === 'string') {
    throw new Error('failed to get server address');
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    app,
    baseUrl,
    close: async () => {
      await app.close();
    },
  };
}

/** Small helper to POST JSON and return { status, body }. */
export async function postJson(
  baseUrl: string,
  path: string,
  body: unknown
): Promise<{ status: number; body: any }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

/** Small helper to GET and return { status, body }. */
export async function getJson(
  baseUrl: string,
  path: string
): Promise<{ status: number; body: any }> {
  const res = await fetch(`${baseUrl}${path}`);
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}
