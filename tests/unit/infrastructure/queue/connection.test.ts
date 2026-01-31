import { redisConnection } from '../../../../src/infrastructure/queue/connection';
import { RedisOptions } from 'ioredis';

describe('Queue Connection Configuration', () => {
  it('should have Redis connection configuration', () => {
    expect(redisConnection).toBeDefined();
    const config = redisConnection as RedisOptions;
    expect(config.host).toBeDefined();
    expect(config.port).toBeDefined();
  });

  it('should set maxRetriesPerRequest to null for BullMQ compatibility', () => {
    const config = redisConnection as RedisOptions;
    expect(config.maxRetriesPerRequest).toBeNull();
  });

  it('should enable ready check', () => {
    const config = redisConnection as RedisOptions;
    expect(config.enableReadyCheck).toBe(true);
  });

  it('should have a retry strategy function', () => {
    const config = redisConnection as RedisOptions;
    expect(config.retryStrategy).toBeDefined();
    expect(typeof config.retryStrategy).toBe('function');
  });

  it('should calculate exponential backoff with max delay', () => {
    const config = redisConnection as RedisOptions;
    const retryStrategy = config.retryStrategy!;

    // First retry: 50ms
    expect(retryStrategy(1)).toBe(50);

    // 10th retry: 500ms
    expect(retryStrategy(10)).toBe(500);

    // 100th retry: should cap at 3000ms
    expect(retryStrategy(100)).toBe(3000);
  });

  it('should use default localhost and port if env vars not set', () => {
    const config = redisConnection as RedisOptions;
    expect(config.host).toBe(process.env.REDIS_HOST || 'localhost');
    expect(config.port).toBe(
      process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379
    );
  });
});
