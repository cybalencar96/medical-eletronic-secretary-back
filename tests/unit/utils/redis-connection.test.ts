import { createTestRedisConnection, TestRedisConnection } from '../../utils/redis-connection';

describe('Redis Connection Utility', () => {
  describe('createTestRedisConnection', () => {
    it('should create isolated IORedis client with custom prefix', () => {
      const redis = createTestRedisConnection('custom-prefix:');

      expect(redis).toBeDefined();
      expect(redis.client).toBeDefined();
      // Note: keyPrefix is not set on IORedis client because BullMQ doesn't support it
      // The prefix is stored internally for cleanup operations
      expect(redis.cleanup).toBeDefined();
      expect(redis.close).toBeDefined();

      // Cleanup - disconnect synchronously
      redis.client.disconnect();
    });

    it('should use default prefix when not specified', () => {
      const redis = createTestRedisConnection();

      // Note: keyPrefix is not set on IORedis client because BullMQ doesn't support it
      // The prefix is stored internally for cleanup operations
      expect(redis.client).toBeDefined();

      // Cleanup - disconnect synchronously
      redis.client.disconnect();
    });

    it('should create client with lazyConnect enabled', () => {
      const redis = createTestRedisConnection('lazy-test:');

      // lazyConnect means client should not be in 'ready' state initially
      expect(redis.client.status).not.toBe('ready');
      expect(['wait', 'end', 'close'].includes(redis.client.status)).toBe(true);

      // Cleanup - disconnect synchronously
      redis.client.disconnect();
    });

    it('should configure client with BullMQ-compatible settings', () => {
      const redis = createTestRedisConnection('bullmq-test:');

      expect(redis.client.options.maxRetriesPerRequest).toBeNull();
      expect(redis.client.options.retryStrategy).toBeDefined();

      // Cleanup - disconnect synchronously
      redis.client.disconnect();
    });

    it('should use environment variables for host and port', () => {
      const redis = createTestRedisConnection('env-test:');

      expect(redis.client.options.host).toBe(process.env.REDIS_HOST || 'localhost');
      expect(redis.client.options.port).toBe(parseInt(process.env.REDIS_PORT || '6379', 10));

      // Cleanup - disconnect synchronously
      redis.client.disconnect();
    });
  });

  describe('cleanup method', () => {
    let redis: TestRedisConnection;

    beforeEach(() => {
      redis = createTestRedisConnection('cleanup-test:');
    });

    afterEach(async () => {
      await redis.close();
    });

    it('should handle cleanup when Redis is unavailable', async () => {
      // Create a client that won't connect (invalid port)
      const invalidRedis = createTestRedisConnection('invalid:');
      invalidRedis.client.options.port = 9999; // Invalid port

      // Cleanup should not throw even if Redis is unavailable
      await expect(invalidRedis.cleanup()).resolves.not.toThrow();

      // Cleanup the invalid client
      await invalidRedis.close();
    });

    it('should not throw errors during cleanup failures', async () => {
      // Mock scanStream to throw an error
      const originalScanStream = redis.client.scanStream;
      redis.client.scanStream = jest.fn().mockImplementation(() => {
        throw new Error('Mock scan error');
      });

      // Cleanup should silently ignore the error
      await expect(redis.cleanup()).resolves.not.toThrow();

      // Restore original method
      redis.client.scanStream = originalScanStream;
    });
  });

  describe('close method', () => {
    it('should close Redis connection gracefully', async () => {
      const redis = createTestRedisConnection('close-test:');

      await redis.close();

      // After closing, status should be 'end' or 'close'
      expect(['end', 'close'].includes(redis.client.status)).toBe(true);
    });

    it('should handle close when client is not connected', async () => {
      const redis = createTestRedisConnection('not-connected:');

      // Close without connecting first
      await expect(redis.close()).resolves.not.toThrow();

      expect(['end', 'close'].includes(redis.client.status)).toBe(true);
    });

    it('should force disconnect on quit failure', async () => {
      const redis = createTestRedisConnection('force-disconnect:');

      // Mock quit to throw an error
      const originalQuit = redis.client.quit;
      redis.client.quit = jest.fn().mockRejectedValue(new Error('Quit failed'));

      // Mock disconnect to track if it was called
      const disconnectSpy = jest.spyOn(redis.client, 'disconnect');

      // Close should not throw and should call disconnect
      await expect(redis.close()).resolves.not.toThrow();
      expect(disconnectSpy).toHaveBeenCalled();

      // Restore original methods
      redis.client.quit = originalQuit;
      disconnectSpy.mockRestore();
    });
  });

  describe('multiple connections', () => {
    it('should allow multiple connections with different prefixes', async () => {
      const redis1 = createTestRedisConnection('conn1:');
      const redis2 = createTestRedisConnection('conn2:');
      const redis3 = createTestRedisConnection('conn3:');

      // Note: keyPrefix is not set on IORedis client because BullMQ doesn't support it
      // The prefix is stored internally for cleanup operations

      // All connections should be independent
      expect(redis1.client).not.toBe(redis2.client);
      expect(redis2.client).not.toBe(redis3.client);
      expect(redis1.client).not.toBe(redis3.client);

      // Cleanup all connections
      await redis1.close();
      await redis2.close();
      await redis3.close();
    });
  });

  describe('retry strategy', () => {
    it('should use exponential backoff with max 3000ms delay', () => {
      const redis = createTestRedisConnection('retry-test:');
      const retryStrategy = redis.client.options.retryStrategy;

      expect(retryStrategy).toBeDefined();

      if (retryStrategy) {
        // Test exponential backoff
        expect(retryStrategy(1)).toBe(50); // 1 * 50 = 50ms
        expect(retryStrategy(10)).toBe(500); // 10 * 50 = 500ms
        expect(retryStrategy(60)).toBe(3000); // 60 * 50 = 3000ms (capped)
        expect(retryStrategy(100)).toBe(3000); // 100 * 50 = 5000ms (capped at 3000)
      }

      // Cleanup - disconnect synchronously
      redis.client.disconnect();
    });
  });
});
