import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { postJson, startTestServer } from './helpers/server.js';

describe('E2E: file upload (write path via /upload)', () => {
  let server: Awaited<ReturnType<typeof startTestServer>>;

  beforeAll(async () => {
    server = await startTestServer();
  });
  afterAll(async () => {
    await server.close();
  });

  async function uploadFile(name: string, content: string, type: string) {
    const form = new FormData();
    form.append('file', new Blob([content], { type }), name);
    const res = await fetch(`${server.baseUrl}/upload`, {
      method: 'POST',
      body: form,
    });
    const body = await res.json().catch(() => ({}));
    return { status: res.status, body };
  }

  it('uploads a text file, extracts content, and makes it queryable', async () => {
    const up = await uploadFile(
      'acme.txt',
      'Acme revenue in 2024 was 5.2 billion dollars.',
      'text/plain'
    );
    expect(up.status).toBe(201);
    expect(up.body.chunks).toBeGreaterThan(0);

    const ans = await postJson(server.baseUrl, '/query', {
      question: 'What was Acme revenue?',
    });
    expect(ans.status).toBe(200);
    expect(ans.body.citations.length).toBeGreaterThan(0);
    expect(ans.body.citations[0].source).toBe('acme.txt');
  });

  it('rejects an empty file (400)', async () => {
    const up = await uploadFile('empty.txt', '', 'text/plain');
    expect(up.status).toBe(400);
  });
});
