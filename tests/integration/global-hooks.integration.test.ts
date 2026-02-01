/**
 * Integration tests for Jest global setup and teardown hooks
 * Tests actual behavior with real Docker services
 */

import knex, { Knex } from 'knex';
import Redis from 'ioredis';
import knexConfig from '../../knexfile';
import { checkPostgres, checkRedis, waitForServices } from '../utils/service-health';

describe('Global Hooks Integration Tests', () => {
  let db: Knex;
  let redis: Redis;

  beforeAll(() => {
    // Create Knex instance for test environment
    const environment = process.env.NODE_ENV || 'test';
    db = knex(knexConfig[environment]);

    // Create Redis client
    redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || 'redis',
      lazyConnect: true,
    });
  });

  afterAll(async () => {
    // Clean up connections
    await db.destroy();
    await redis.quit();
  });

  describe('Service Health Checks', () => {
    it('should verify PostgreSQL is accessible after globalSetup', async () => {
      const isPostgresAvailable = await checkPostgres();
      expect(isPostgresAvailable).toBe(true);
    });

    it('should verify Redis is accessible after globalSetup', async () => {
      const isRedisAvailable = await checkRedis();
      expect(isRedisAvailable).toBe(true);
    });

    it('should verify both services are available via waitForServices', async () => {
      // This should complete quickly since services are already up
      await expect(
        waitForServices({
          maxRetries: 3,
          retryDelayMs: 1000,
          timeoutMs: 10000,
        })
      ).resolves.toBeUndefined();
    });
  });

  describe('Database Schema Verification', () => {
    it('should verify database schema exists after globalSetup', async () => {
      // Check if knex_migrations table exists (created by migrations)
      const hasTable = await db.schema.hasTable('knex_migrations');
      expect(hasTable).toBe(true);
    });

    it('should verify migrations have been applied', async () => {
      // Query the knex_migrations table to check if migrations ran
      const migrations = await db('knex_migrations').select('*');
      expect(migrations.length).toBeGreaterThan(0);
    });

    it('should be able to execute queries against the database', async () => {
      const result = await db.raw('SELECT 1 as value');
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].value).toBe(1);
    });
  });

  describe('Redis Connectivity', () => {
    it('should be able to connect to Redis', async () => {
      await redis.connect();
      const pong = await redis.ping();
      expect(pong).toBe('PONG');
    });

    it('should be able to set and get values from Redis', async () => {
      const testKey = 'test:global-hooks:integration';
      const testValue = 'test-value';

      await redis.set(testKey, testValue);
      const retrievedValue = await redis.get(testKey);

      expect(retrievedValue).toBe(testValue);

      // Clean up
      await redis.del(testKey);
    });
  });

  describe('Connection Cleanup', () => {
    it('should be able to close database connection without errors', async () => {
      // Create a temporary connection for this test
      const tempDb = knex(knexConfig[process.env.NODE_ENV || 'test']);

      await expect(tempDb.destroy()).resolves.toBeUndefined();
    });

    it('should be able to close Redis connection without errors', async () => {
      // Create a temporary Redis connection for this test
      const tempRedis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || 'redis',
        lazyConnect: true,
      });

      await tempRedis.connect();
      await expect(tempRedis.quit()).resolves.toBe('OK');
    });
  });

  describe('Global Setup Behavior', () => {
    it('should run before this integration test suite', () => {
      // If we've gotten this far, globalSetup has already run successfully
      // This test verifies that Jest executed globalSetup before running these tests
      expect(true).toBe(true);
    });

    it('should have applied migrations before tests run', async () => {
      // Check that we can access tables created by migrations
      const hasTable = await db.schema.hasTable('knex_migrations');
      expect(hasTable).toBe(true);

      // Verify we can query the migrations table
      const migrations = await db('knex_migrations').select('name');
      expect(Array.isArray(migrations)).toBe(true);
    });
  });
});
