import {
  checkPostgres,
  checkRedis,
  waitForServices,
} from '../../utils/service-health';

/**
 * Integration tests for service health checks
 * These tests require Docker services to be running:
 * docker compose --profile test up -d
 */
describe('service-health integration', () => {
  describe('checkPostgres', () => {
    it('should successfully connect to PostgreSQL when service is running', async () => {
      const result = await checkPostgres();

      expect(result).toBe(true);
    });

    it('should return false when PostgreSQL is unavailable', async () => {
      // Save original environment
      const originalEnv = { ...process.env };

      // Set invalid port to simulate unavailable service
      process.env.DB_PORT = '9999';

      const result = await checkPostgres();

      expect(result).toBe(false);

      // Restore environment
      process.env = originalEnv;
    });
  });

  describe('checkRedis', () => {
    it('should successfully connect to Redis when service is running', async () => {
      const result = await checkRedis();

      expect(result).toBe(true);
    });

    it('should return false when Redis is unavailable', async () => {
      // Save original environment
      const originalEnv = { ...process.env };

      // Set invalid port to simulate unavailable service
      process.env.REDIS_PORT = '9999';

      const result = await checkRedis();

      expect(result).toBe(false);

      // Restore environment
      process.env = originalEnv;
    });
  });

  describe('waitForServices', () => {
    it('should successfully wait for both services when they are running', async () => {
      // Suppress console.warn for this test
      const originalWarn = console.warn;
      console.warn = jest.fn();

      await expect(
        waitForServices({ maxRetries: 5, retryDelayMs: 1000, timeoutMs: 10000 })
      ).resolves.toBeUndefined();

      // Restore console.warn
      console.warn = originalWarn;
    });

    it('should throw error when services are unavailable', async () => {
      // Save original environment
      const originalEnv = { ...process.env };

      // Set invalid ports to simulate unavailable services
      process.env.DB_PORT = '9999';
      process.env.REDIS_PORT = '9998';

      // Suppress console.warn for this test
      const originalWarn = console.warn;
      console.warn = jest.fn();

      await expect(
        waitForServices({ maxRetries: 2, retryDelayMs: 500, timeoutMs: 3000 })
      ).rejects.toThrow(/unavailable after 3000ms timeout/);

      // Restore environment and console
      process.env = originalEnv;
      console.warn = originalWarn;
    });
  });
});
