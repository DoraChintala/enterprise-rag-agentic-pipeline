import pino, { type LoggerOptions } from 'pino';
import { config } from './config.js';

/**
 * Structured JSON logger. In production, JSON logs are easy to ship
 * to observability tools (Stage 8).
 *
 * We use pretty-printing in dev ONLY if `pino-pretty` is installed.
 * It is an optional dev convenience, so we never hard-fail (e.g. in
 * tests or CI) when it is missing — we fall back to plain JSON.
 */
const options: LoggerOptions = { level: config.logLevel };

const wantPretty =
  process.env.NODE_ENV !== 'production' && process.env.LOG_PRETTY === 'true';

if (wantPretty) {
  // Use an indirect specifier so TypeScript does not statically require
  // pino-pretty's types. It is an optional dev-only dependency.
  const prettyModule = 'pino-pretty';
  try {
    await import(prettyModule);
    options.transport = {
      target: 'pino-pretty',
      options: { colorize: true },
    };
  } catch {
    // pino-pretty not installed — stay on plain JSON logs.
  }
}

export const logger = pino(options);
