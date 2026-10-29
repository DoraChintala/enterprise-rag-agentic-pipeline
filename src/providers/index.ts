import { config } from '../core/config.js';
import type { Provider } from '../core/types.js';
import { LocalProvider } from './local.js';
import { OpenAIProvider } from './openai.js';

/** Factory: pick the provider based on config (local vs openai). */
export function createProvider(): Provider {
  switch (config.provider) {
    case 'openai':
      return new OpenAIProvider();
    case 'local':
    default:
      return new LocalProvider();
  }
}
