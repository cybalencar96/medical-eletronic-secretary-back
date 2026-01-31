import { Client } from 'pg';
import Redis from 'ioredis';
import {
  checkPostgres,
  checkRedis,
  waitForServices,
  ServiceHealthOptions,
} from '../../utils/service-health';

// Create mock instances
const mockPgClient = {
  connect: jest.fn(),
  query: jest.fn(),
  end: jest.fn(),
};

const mockRedisClient = {
  connect: jest.fn(),
  ping: jest.fn(),
  quit: jest.fn(),
};

// Mock pg Client
jest.mock('pg', () => {
  return {
    Client: jest.fn(() => mockPgClient),
  };
});

// Mock ioredis
jest.mock('ioredis', () => {
  return jest.fn(() => mockRedisClient);
});

// Mock timers
jest.useFakeTimers();

describe('service-health', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
  });

  describe('checkPostgres', () => {
    it('should return true when PostgreSQL connection succeeds', async () => {
      mockPgClient.connect.mockResolvedValueOnce(undefined);
      mockPgClient.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
      mockPgClient.end.mockResolvedValueOnce(undefined);

      const result = await checkPostgres();

      expect(result).toBe(true);
      expect(mockPgClient.connect).toHaveBeenCalledTimes(1);
      expect(mockPgClient.query).toHaveBeenCalledWith('SELECT 1');
      expect(mockPgClient.end).toHaveBeenCalledTimes(1);
    });

    it('should return false when PostgreSQL connection fails', async () => {
      mockPgClient.connect.mockRejectedValueOnce(new Error('Connection refused'));
      mockPgClient.end.mockResolvedValueOnce(undefined);

      const result = await checkPostgres();

      expect(result).toBe(false);
      expect(mockPgClient.connect).toHaveBeenCalledTimes(1);
      expect(mockPgClient.end).toHaveBeenCalledTimes(1);
    });

    it('should return false when query fails', async () => {
      mockPgClient.connect.mockResolvedValueOnce(undefined);
      mockPgClient.query.mockRejectedValueOnce(new Error('Query error'));
      mockPgClient.end.mockResolvedValueOnce(undefined);

      const result = await checkPostgres();

      expect(result).toBe(false);
      expect(mockPgClient.end).toHaveBeenCalledTimes(1);
    });

    it('should handle cleanup errors gracefully', async () => {
      mockPgClient.connect.mockRejectedValueOnce(new Error('Connection refused'));
      mockPgClient.end.mockRejectedValueOnce(new Error('End error'));

      const result = await checkPostgres();

      expect(result).toBe(false);
    });

    it('should use environment variables for connection config', async () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        DB_HOST: 'test-host',
        DB_PORT: '5433',
        DB_USER: 'test-user',
        DB_PASSWORD: 'test-pass',
        DB_NAME: 'test-db',
      };

      mockPgClient.connect.mockResolvedValueOnce(undefined);
      mockPgClient.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
      mockPgClient.end.mockResolvedValueOnce(undefined);

      await checkPostgres();

      // Verify Client was instantiated with correct config
      expect(Client).toHaveBeenCalledWith({
        host: 'test-host',
        port: 5433,
        user: 'test-user',
        password: 'test-pass',
        database: 'test-db',
      });

      process.env = originalEnv;
    });
  });

  describe('checkRedis', () => {
    it('should return true when Redis PING succeeds', async () => {
      mockRedisClient.connect.mockResolvedValueOnce(undefined);
      mockRedisClient.ping.mockResolvedValueOnce('PONG');
      mockRedisClient.quit.mockResolvedValueOnce(undefined);

      const result = await checkRedis();

      expect(result).toBe(true);
      expect(mockRedisClient.connect).toHaveBeenCalledTimes(1);
      expect(mockRedisClient.ping).toHaveBeenCalledTimes(1);
      expect(mockRedisClient.quit).toHaveBeenCalledTimes(1);
    });

    it('should return false when Redis connection fails', async () => {
      mockRedisClient.connect.mockRejectedValueOnce(new Error('Connection refused'));
      mockRedisClient.quit.mockResolvedValueOnce(undefined);

      const result = await checkRedis();

      expect(result).toBe(false);
      expect(mockRedisClient.connect).toHaveBeenCalledTimes(1);
      expect(mockRedisClient.quit).toHaveBeenCalledTimes(1);
    });

    it('should return false when PING fails', async () => {
      mockRedisClient.connect.mockResolvedValueOnce(undefined);
      mockRedisClient.ping.mockRejectedValueOnce(new Error('PING error'));
      mockRedisClient.quit.mockResolvedValueOnce(undefined);

      const result = await checkRedis();

      expect(result).toBe(false);
      expect(mockRedisClient.quit).toHaveBeenCalledTimes(1);
    });

    it('should return false when PING returns unexpected response', async () => {
      mockRedisClient.connect.mockResolvedValueOnce(undefined);
      mockRedisClient.ping.mockResolvedValueOnce('UNEXPECTED');
      mockRedisClient.quit.mockResolvedValueOnce(undefined);

      const result = await checkRedis();

      expect(result).toBe(false);
    });

    it('should handle cleanup errors gracefully', async () => {
      mockRedisClient.connect.mockRejectedValueOnce(new Error('Connection refused'));
      mockRedisClient.quit.mockRejectedValueOnce(new Error('Quit error'));

      const result = await checkRedis();

      expect(result).toBe(false);
    });

    it('should use environment variables for connection config', async () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        REDIS_HOST: 'test-redis-host',
        REDIS_PORT: '6380',
      };

      mockRedisClient.connect.mockResolvedValueOnce(undefined);
      mockRedisClient.ping.mockResolvedValueOnce('PONG');
      mockRedisClient.quit.mockResolvedValueOnce(undefined);

      await checkRedis();

      // Verify Redis was instantiated with correct config
      expect(Redis).toHaveBeenCalledWith({
        host: 'test-redis-host',
        port: 6380,
        maxRetriesPerRequest: 1,
        retryStrategy: expect.any(Function),
        lazyConnect: true,
      });

      process.env = originalEnv;
    });
  });

  describe('waitForServices', () => {
    beforeEach(() => {
      jest.spyOn(console, 'warn').mockImplementation();
    });

    afterEach(() => {
      (console.warn as jest.Mock).mockRestore();
    });

    it('should succeed on first attempt when both services are available', async () => {
      mockPgClient.connect.mockResolvedValue(undefined);
      mockPgClient.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });
      mockPgClient.end.mockResolvedValue(undefined);
      mockRedisClient.connect.mockResolvedValue(undefined);
      mockRedisClient.ping.mockResolvedValue('PONG');
      mockRedisClient.quit.mockResolvedValue(undefined);

      const promise = waitForServices();
      await jest.runAllTimersAsync();
      await promise;

      expect(console.warn).toHaveBeenCalledWith(
        'Checking service health (attempt 1/10)...'
      );
      expect(console.warn).toHaveBeenCalledWith('All services are healthy');
    });

    it('should retry and succeed when services become available', async () => {
      // Fail first attempt, succeed on second
      mockPgClient.connect
        .mockRejectedValueOnce(new Error('Connection refused'))
        .mockResolvedValue(undefined);
      mockPgClient.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });
      mockPgClient.end.mockResolvedValue(undefined);
      mockRedisClient.connect
        .mockRejectedValueOnce(new Error('Connection refused'))
        .mockResolvedValue(undefined);
      mockRedisClient.ping.mockResolvedValue('PONG');
      mockRedisClient.quit.mockResolvedValue(undefined);

      const promise = waitForServices({ retryDelayMs: 100 });
      await jest.runAllTimersAsync();
      await promise;

      expect(console.warn).toHaveBeenCalledWith(
        'Checking service health (attempt 1/10)...'
      );
      expect(console.warn).toHaveBeenCalledWith(
        'Services unavailable: PostgreSQL, Redis. Retrying in 100ms...'
      );
      expect(console.warn).toHaveBeenCalledWith(
        'Checking service health (attempt 2/10)...'
      );
      expect(console.warn).toHaveBeenCalledWith('All services are healthy');
    });

    it('should log specific unavailable services', async () => {
      // PostgreSQL fails, Redis succeeds on second attempt
      mockPgClient.connect.mockRejectedValue(new Error('Connection refused'));
      mockPgClient.end.mockResolvedValue(undefined);
      mockRedisClient.connect
        .mockRejectedValueOnce(new Error('Connection refused'))
        .mockRejectedValueOnce(new Error('Connection refused'))
        .mockResolvedValue(undefined);
      mockRedisClient.ping.mockResolvedValue('PONG');
      mockRedisClient.quit.mockResolvedValue(undefined);

      const promise = waitForServices({ retryDelayMs: 100, maxRetries: 15 });
      const runTimers = jest.runAllTimersAsync();

      // Let the promise reject naturally
      await expect(Promise.all([promise, runTimers])).rejects.toThrow();

      expect(console.warn).toHaveBeenCalledWith(
        'Services unavailable: PostgreSQL, Redis. Retrying in 100ms...'
      );
      expect(console.warn).toHaveBeenCalledWith(
        'Services unavailable: PostgreSQL. Retrying in 100ms...'
      );
    });

    it('should throw error after max retries with both services unavailable', async () => {
      mockPgClient.connect.mockRejectedValue(new Error('Connection refused'));
      mockPgClient.end.mockResolvedValue(undefined);
      mockRedisClient.connect.mockRejectedValue(new Error('Connection refused'));
      mockRedisClient.quit.mockResolvedValue(undefined);

      const promise = waitForServices({ maxRetries: 2, retryDelayMs: 50, timeoutMs: 5000 });
      const runTimers = jest.runAllTimersAsync();

      await expect(Promise.all([promise, runTimers])).rejects.toThrow(
        'PostgreSQL, Redis unavailable after 5000ms timeout (2 retries). ' +
          'Ensure Docker services are running with: docker compose --profile test up -d'
      );

      expect(console.warn).toHaveBeenCalledWith(
        'Checking service health (attempt 1/2)...'
      );
      expect(console.warn).toHaveBeenCalledWith(
        'Checking service health (attempt 2/2)...'
      );
    });

    it('should throw error after max retries with PostgreSQL unavailable', async () => {
      mockPgClient.connect.mockRejectedValue(new Error('Connection refused'));
      mockPgClient.end.mockResolvedValue(undefined);
      mockRedisClient.connect.mockResolvedValue(undefined);
      mockRedisClient.ping.mockResolvedValue('PONG');
      mockRedisClient.quit.mockResolvedValue(undefined);

      const promise = waitForServices({ maxRetries: 2, retryDelayMs: 50, timeoutMs: 5000 });
      const runTimers = jest.runAllTimersAsync();

      await expect(Promise.all([promise, runTimers])).rejects.toThrow(
        'PostgreSQL unavailable after 5000ms timeout (2 retries). ' +
          'Ensure Docker services are running with: docker compose --profile test up -d'
      );
    });

    it('should throw error after max retries with Redis unavailable', async () => {
      mockPgClient.connect.mockResolvedValue(undefined);
      mockPgClient.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });
      mockPgClient.end.mockResolvedValue(undefined);
      mockRedisClient.connect.mockRejectedValue(new Error('Connection refused'));
      mockRedisClient.quit.mockResolvedValue(undefined);

      const promise = waitForServices({ maxRetries: 2, retryDelayMs: 50, timeoutMs: 5000 });
      const runTimers = jest.runAllTimersAsync();

      await expect(Promise.all([promise, runTimers])).rejects.toThrow(
        'Redis unavailable after 5000ms timeout (2 retries). ' +
          'Ensure Docker services are running with: docker compose --profile test up -d'
      );
    });

    it('should respect custom options', async () => {
      mockPgClient.connect.mockRejectedValue(new Error('Connection refused'));
      mockPgClient.end.mockResolvedValue(undefined);
      mockRedisClient.connect.mockRejectedValue(new Error('Connection refused'));
      mockRedisClient.quit.mockResolvedValue(undefined);

      const customOptions: Partial<ServiceHealthOptions> = {
        maxRetries: 3,
        retryDelayMs: 100,
        timeoutMs: 10000,
      };

      const promise = waitForServices(customOptions);
      const runTimers = jest.runAllTimersAsync();

      await expect(Promise.all([promise, runTimers])).rejects.toThrow(
        'PostgreSQL, Redis unavailable after 10000ms timeout (3 retries)'
      );

      expect(console.warn).toHaveBeenCalledWith(
        'Checking service health (attempt 1/3)...'
      );
      expect(console.warn).toHaveBeenCalledWith(
        'Checking service health (attempt 2/3)...'
      );
      expect(console.warn).toHaveBeenCalledWith(
        'Checking service health (attempt 3/3)...'
      );
    });

    it('should use default options when none provided', async () => {
      mockPgClient.connect.mockResolvedValue(undefined);
      mockPgClient.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });
      mockPgClient.end.mockResolvedValue(undefined);
      mockRedisClient.connect.mockResolvedValue(undefined);
      mockRedisClient.ping.mockResolvedValue('PONG');
      mockRedisClient.quit.mockResolvedValue(undefined);

      const promise = waitForServices();
      await jest.runAllTimersAsync();
      await promise;

      expect(console.warn).toHaveBeenCalledWith(
        'Checking service health (attempt 1/10)...'
      );
    });

    it('should handle zero retries configuration', async () => {
      mockPgClient.connect.mockRejectedValue(new Error('Connection refused'));
      mockPgClient.end.mockResolvedValue(undefined);
      mockRedisClient.connect.mockRejectedValue(new Error('Connection refused'));
      mockRedisClient.quit.mockResolvedValue(undefined);

      await expect(
        waitForServices({ maxRetries: 0, retryDelayMs: 100, timeoutMs: 5000 })
      ).rejects.toThrow(
        'PostgreSQL, Redis unavailable after 5000ms timeout (0 retries)'
      );
    });

    it('should throw timeout error when timeout is exceeded before max retries', async () => {
      mockPgClient.connect.mockRejectedValue(new Error('Connection refused'));
      mockPgClient.end.mockResolvedValue(undefined);
      mockRedisClient.connect.mockRejectedValue(new Error('Connection refused'));
      mockRedisClient.quit.mockResolvedValue(undefined);

      // Set a very short timeout
      const promise = waitForServices({ maxRetries: 100, retryDelayMs: 1000, timeoutMs: 100 });
      const advanceTimers = jest.advanceTimersByTimeAsync(101);

      await expect(Promise.all([promise, advanceTimers])).rejects.toThrow(
        'Services unavailable after 100ms timeout. ' +
          'Ensure Docker services are running with: docker compose --profile test up -d'
      );
    });

    it('should implement exponential backoff delay', async () => {
      mockPgClient.connect
        .mockRejectedValueOnce(new Error('Connection refused'))
        .mockRejectedValueOnce(new Error('Connection refused'))
        .mockResolvedValue(undefined);
      mockPgClient.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });
      mockPgClient.end.mockResolvedValue(undefined);
      mockRedisClient.connect
        .mockRejectedValueOnce(new Error('Connection refused'))
        .mockRejectedValueOnce(new Error('Connection refused'))
        .mockResolvedValue(undefined);
      mockRedisClient.ping.mockResolvedValue('PONG');
      mockRedisClient.quit.mockResolvedValue(undefined);

      const promise = waitForServices({ retryDelayMs: 1000, maxRetries: 5, timeoutMs: 30000 });
      await jest.runAllTimersAsync();
      await promise;

      // Verify console.warn was called for retries showing exponential backoff
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Retrying in 1000ms...')
      );
    });
  });
});
