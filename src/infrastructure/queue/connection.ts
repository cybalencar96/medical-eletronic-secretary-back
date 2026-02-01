import { ConnectionOptions } from 'bullmq';
import { env } from '../config/env';
import { logger } from '../config/logger';

/**
 * Redis connection configuration for BullMQ.
 *
 * This configuration is shared across all queue and worker instances to prevent
 * connection pool exhaustion. BullMQ uses IORedis internally.
 *
 * @example
 * ```typescript
 * import { redisConnection } from './infrastructure/queue/connection';
 *
 * const queue = new Queue('my-queue', { connection: redisConnection });
 * ```
 */
export const redisConnection: ConnectionOptions = {
  host: env.REDIS_HOST || 'localhost',
  port: env.REDIS_PORT || 6379,
  // Default to 'redis' for development/test environments (matches docker-compose defaults)
  password: env.REDIS_PASSWORD || process.env.REDIS_PASSWORD || 'redis',
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: true, // Ensures connection is ready before operations
  retryStrategy: (times: number) => {
    // Exponential backoff with max delay of 3 seconds
    const delay = Math.min(times * 50, 3000);
    logger.warn({ attempt: times, delayMs: delay }, 'Redis connection retry attempt');
    return delay;
  },
};

logger.info(
  {
    host: redisConnection.host,
    port: redisConnection.port,
    passwordConfigured: !!redisConnection.password,
  },
  'Redis connection configuration initialized'
);
