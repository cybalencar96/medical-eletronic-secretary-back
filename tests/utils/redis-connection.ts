import Redis from 'ioredis';

/**
 * Test Redis connection interface
 * Provides isolated Redis client instance with cleanup capabilities
 */
export interface TestRedisConnection {
  /**
   * IORedis client instance with optional key prefix for isolation
   */
  client: Redis;

  /**
   * Cleanup method that flushes only keys matching the prefix
   * Safe to call even if Redis is unavailable
   */
  cleanup(): Promise<void>;

  /**
   * Close the Redis connection
   * Should be called in afterAll/afterEach to prevent connection leaks
   */
  close(): Promise<void>;
}

/**
 * Creates an isolated Redis connection for testing
 * Uses lazyConnect to prevent automatic connection on instantiation
 *
 * @param prefix - Optional key prefix for isolating test data (default: 'test:')
 * @returns TestRedisConnection object with client, cleanup, and close methods
 *
 * @example
 * ```typescript
 * describe('Queue tests', () => {
 *   let redis: TestRedisConnection;
 *
 *   beforeEach(() => {
 *     redis = createTestRedisConnection('queue-test:');
 *   });
 *
 *   afterEach(async () => {
 *     await redis.cleanup();
 *     await redis.close();
 *   });
 *
 *   it('should process job', async () => {
 *     await redis.client.set('queue-test:job:1', 'data');
 *     // Test logic here
 *   });
 * });
 * ```
 */
export function createTestRedisConnection(prefix = 'test:'): TestRedisConnection {
  const client = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    maxRetriesPerRequest: null, // Compatible with BullMQ
    retryStrategy: (times: number) => {
      // Exponential backoff with max delay of 3000ms
      return Math.min(times * 50, 3000);
    },
    lazyConnect: true, // Don't connect automatically
    keyPrefix: prefix, // All keys will be prefixed automatically
  });

  return {
    client,

    /**
     * Cleanup keys matching the prefix
     * Uses SCAN to find keys and DEL to remove them
     * Ignores errors during cleanup to prevent test failures
     */
    async cleanup(): Promise<void> {
      try {
        // Ensure connection is established
        if (client.status !== 'ready') {
          await client.connect();
        }

        // Get all keys matching the prefix pattern
        // Note: IORedis automatically adds the keyPrefix, so we search for '*'
        const stream = client.scanStream({
          match: '*',
          count: 100,
        });

        const keysToDelete: string[] = [];

        // Collect all matching keys
        for await (const keys of stream) {
          if (keys.length > 0) {
            keysToDelete.push(...keys);
          }
        }

        // Delete keys in batches if any were found
        if (keysToDelete.length > 0) {
          // Remove the prefix before deleting since IORedis will add it back
          const keysWithoutPrefix = keysToDelete.map((key) =>
            key.startsWith(prefix) ? key.substring(prefix.length) : key
          );
          await client.del(...keysWithoutPrefix);
        }
      } catch (_error) {
        // Ignore cleanup errors to prevent test failures
        // Tests should handle Redis unavailability gracefully
      }
    },

    /**
     * Close the Redis connection
     * Uses quit() for graceful shutdown, falls back to disconnect() if needed
     */
    async close(): Promise<void> {
      try {
        // Quit gracefully if connected
        if (client.status === 'ready' || client.status === 'connect') {
          await client.quit();
        } else if (client.status !== 'end') {
          // Force disconnect if not already ended
          client.disconnect();
        }
      } catch (_error) {
        // Ignore close errors
        // Force disconnect as fallback
        try {
          client.disconnect();
        } catch (_disconnectError) {
          // Ignore disconnect errors
        }
      }
    },
  };
}
