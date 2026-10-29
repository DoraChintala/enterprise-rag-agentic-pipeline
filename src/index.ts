import { buildApp } from './api/app.js';
import { config } from './core/config.js';
import { logger } from './core/logger.js';
import { createProvider } from './providers/index.js';
import { createStore } from './store/index.js';

/** Server entry point: wire dependencies and start listening. */
async function main() {
  const provider = createProvider();
  const store = createStore();
  await store.init();

  const app = await buildApp({ provider, store });

  await app.listen({ port: config.port, host: '0.0.0.0' });
  logger.info(
    {
      port: config.port,
      provider: config.provider,
      vectorStore: config.vectorStore,
    },
    'RAG API started'
  );
}

main().catch((err) => {
  logger.error({ err }, 'failed to start');
  process.exit(1);
});
