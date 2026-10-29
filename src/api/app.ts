import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { logger } from '../core/logger.js';
import type { Provider, VectorStore } from '../core/types.js';
import { AgentOrchestrator } from '../agents/orchestrator.js';
import { ingestDocument } from '../rag/ingest.js';
import { RagPipeline } from '../rag/pipeline.js';

const ingestSchema = z.object({
  text: z.string().min(1),
  source: z.string().min(1),
  docId: z.string().optional(),
  page: z.number().int().positive().optional(),
});

const querySchema = z.object({
  question: z.string().min(1),
  // Optional persona. Changes how the answer is FRAMED, never the facts.
  role: z.string().max(60).optional(),
});

/**
 * Builds the Fastify app with all routes. Dependencies (provider, store)
 * are injected so the same app can be tested with in-memory fakes.
 */
export async function buildApp(deps: {
  provider: Provider;
  store: VectorStore;
  serveUi?: boolean;
}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(cors, { origin: true });

  // Serve the static UI from /public (enabled in the real server, off in tests).
  if (deps.serveUi) {
    // app.ts lives at <root>/src/api -> go up two levels to <root>/public
    const here = dirname(fileURLToPath(import.meta.url));
    const publicDir = join(here, '..', '..', 'public');
    await app.register(fastifyStatic, { root: publicDir, prefix: '/' });
  }

  const rag = new RagPipeline(deps.provider, deps.store);
  const agent = new AgentOrchestrator(rag);

  // Health check (used by Docker/K8s probes in Stage 8)
  app.get('/health', async () => ({ status: 'ok' }));

  // Ingestion endpoint (write path)
  app.post('/ingest', async (request, reply) => {
    const parsed = ingestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const result = await ingestDocument(parsed.data, deps);
    return reply.status(201).send(result);
  });

  // RAG query endpoint (single-step)
  app.post('/query', async (request, reply) => {
    const parsed = querySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const answer = await rag.answer(parsed.data.question, parsed.data.role);
    return reply.send(answer);
  });

  // Agentic endpoint (multi-step)
  app.post('/agent', async (request, reply) => {
    const parsed = querySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const answer = await agent.run(parsed.data.question);
    return reply.send(answer);
  });

  // Basic error handler
  app.setErrorHandler((err, _req, reply) => {
    logger.error({ err }, 'request failed');
    reply.status(500).send({ error: 'internal_error' });
  });

  return app;
}
