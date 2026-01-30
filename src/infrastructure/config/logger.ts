import pino from 'pino';
import { env } from './env';

/**
 * Pino logger configuration.
 *
 * Creates a structured JSON logger with:
 * - Different log levels for development vs production
 * - Timestamp and hostname information
 * - Correlation ID support for request tracking (when used with pino-http)
 */
export const logger = pino({
  level: env.NODE_ENV === 'development' ? 'debug' : 'info',
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
