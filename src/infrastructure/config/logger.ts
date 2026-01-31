import pino from 'pino';
import { env } from './env';

/**
 * Pino logger configuration.
 *
 * Creates a structured JSON logger with:
 * - Configurable log levels via LOG_LEVEL environment variable (defaults to 'info')
 * - Pretty-print format in development mode for human readability
 * - JSON format in production mode for structured logging systems
 * - Timestamp and hostname information
 * - Correlation ID support for request tracking (when used with pino-http)
 *
 * @example
 * ```typescript
 * import { logger } from './infrastructure/config/logger';
 *
 * logger.info({ userId: '123', correlationId: 'abc' }, 'User logged in');
 * logger.error({ error, correlationId: 'abc' }, 'Failed to process request');
 * ```
 */
export const logger = pino({
  level: env.LOG_LEVEL || (env.NODE_ENV === 'development' ? 'debug' : 'info'),
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  transport:
    env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'yyyy-mm-dd HH:MM:ss',
            ignore: 'pid,hostname',
            singleLine: false,
          },
        }
      : undefined,
});
