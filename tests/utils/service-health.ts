import { Client } from 'pg';
import Redis from 'ioredis';

/**
 * Configuration options for service health checks
 */
export interface ServiceHealthOptions {
  /**
   * Maximum number of retry attempts before failing
   * @default 10
   */
  maxRetries: number;

  /**
   * Base delay in milliseconds between retry attempts
   * Uses exponential backoff: Math.min(attempt * retryDelayMs, timeoutMs)
   * @default 3000
   */
  retryDelayMs: number;

  /**
   * Maximum timeout in milliseconds for all retry attempts
   * @default 30000
   */
  timeoutMs: number;
}

/**
 * Default configuration for service health checks
 */
const DEFAULT_OPTIONS: ServiceHealthOptions = {
  maxRetries: 10,
  retryDelayMs: 3000,
  timeoutMs: 30000,
};

/**
 * Checks if PostgreSQL service is available and accepting connections
 *
 * @returns Promise<boolean> - true if connection successful, false otherwise
 *
 * @example
 * ```typescript
 * const isAvailable = await checkPostgres();
 * if (!isAvailable) {
 *   console.error('PostgreSQL is not available');
 * }
 * ```
 */
export async function checkPostgres(): Promise<boolean> {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'medical_secretary_test',
  });

  try {
    await client.connect();
    await client.query('SELECT 1');
    await client.end();
    return true;
  } catch (error) {
    try {
      await client.end();
    } catch (_cleanupError) {
      // Ignore cleanup errors
    }
    return false;
  }
}

/**
 * Checks if Redis service is available and responding to PING commands
 *
 * @returns Promise<boolean> - true if PING receives PONG, false otherwise
 *
 * @example
 * ```typescript
 * const isAvailable = await checkRedis();
 * if (!isAvailable) {
 *   console.error('Redis is not available');
 * }
 * ```
 */
export async function checkRedis(): Promise<boolean> {
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    maxRetriesPerRequest: 1,
    retryStrategy: () => null, // Don't retry, we handle retries ourselves
    lazyConnect: true,
  });

  try {
    await redis.connect();
    const pong = await redis.ping();
    await redis.quit();
    return pong === 'PONG';
  } catch (error) {
    try {
      await redis.quit();
    } catch (_cleanupError) {
      // Ignore cleanup errors
    }
    return false;
  }
}

/**
 * Waits for both PostgreSQL and Redis services to become available
 * Implements retry logic with exponential backoff
 *
 * @param options - Optional configuration to override defaults
 * @throws Error when services are unavailable after timeout
 *
 * @example
 * ```typescript
 * // Use default options (10 retries, 3s delay, 30s timeout)
 * await waitForServices();
 *
 * // Custom configuration
 * await waitForServices({
 *   maxRetries: 5,
 *   retryDelayMs: 2000,
 *   timeoutMs: 20000
 * });
 * ```
 */
export async function waitForServices(options?: Partial<ServiceHealthOptions>): Promise<void> {
  const config: ServiceHealthOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const startTime = Date.now();
  let attempt = 0;

  while (attempt < config.maxRetries) {
    attempt++;

    // Check if we've exceeded the timeout
    const elapsed = Date.now() - startTime;
    if (elapsed >= config.timeoutMs) {
      throw new Error(
        `Services unavailable after ${config.timeoutMs}ms timeout. ` +
          `Ensure Docker services are running with: docker compose --profile test up -d`
      );
    }

    console.warn(`Checking service health (attempt ${attempt}/${config.maxRetries})...`);

    // Check both services in parallel
    const [postgresAvailable, redisAvailable] = await Promise.all([checkPostgres(), checkRedis()]);

    // If both services are available, we're done
    if (postgresAvailable && redisAvailable) {
      console.warn('All services are healthy');
      return;
    }

    // Log which services are unavailable
    const unavailableServices: string[] = [];
    if (!postgresAvailable) {
      unavailableServices.push('PostgreSQL');
    }
    if (!redisAvailable) {
      unavailableServices.push('Redis');
    }

    console.warn(
      `Services unavailable: ${unavailableServices.join(', ')}. ` +
        `Retrying in ${config.retryDelayMs}ms...`
    );

    // Calculate delay with exponential backoff
    // Using Math.min to cap at retryDelayMs to keep it simple
    const delay = Math.min(attempt * config.retryDelayMs, config.timeoutMs);

    // Wait before next attempt
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  // If we've exhausted all retries, throw an error
  const [postgresAvailable, redisAvailable] = await Promise.all([checkPostgres(), checkRedis()]);

  const unavailableServices: string[] = [];
  if (!postgresAvailable) {
    unavailableServices.push('PostgreSQL');
  }
  if (!redisAvailable) {
    unavailableServices.push('Redis');
  }

  throw new Error(
    `${unavailableServices.join(', ')} unavailable after ${config.timeoutMs}ms timeout ` +
      `(${config.maxRetries} retries). ` +
      `Ensure Docker services are running with: docker compose --profile test up -d`
  );
}
