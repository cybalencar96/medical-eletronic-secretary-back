import request from 'supertest';
import { Client } from 'pg';
import Redis from 'ioredis';
import app from '../../src/index';

describe('Docker Services Integration', () => {
  let pgClient: Client;
  let redisClient: Redis;

  beforeAll(async () => {
    // PostgreSQL client setup
    pgClient = new Client({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'medical_secretary',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    });

    // Redis client setup
    redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || 'redis',
      maxRetriesPerRequest: 3,
    });
  });

  afterAll(async () => {
    if (pgClient) {
      await pgClient.end();
    }
    if (redisClient) {
      await redisClient.quit();
    }
  });

  describe('Application Service', () => {
    it('should respond to health check endpoint', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('environment');
    });

    it('should respond to root endpoint', async () => {
      const response = await request(app).get('/').expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('version');
    });
  });

  describe('PostgreSQL Service', () => {
    it('should connect to PostgreSQL successfully', async () => {
      await expect(pgClient.connect()).resolves.not.toThrow();
    });

    it('should execute a simple query', async () => {
      const result = await pgClient.query('SELECT 1 as test');
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].test).toBe(1);
    });

    it('should verify PostgreSQL version is 15.x', async () => {
      const result = await pgClient.query('SHOW server_version');
      const version = result.rows[0].server_version;
      expect(version).toMatch(/^15\./);
    });
  });

  describe('Redis Service', () => {
    it('should connect to Redis successfully', async () => {
      const pong = await redisClient.ping();
      expect(pong).toBe('PONG');
    });

    it('should set and get a value', async () => {
      const testKey = 'test:docker:setup';
      const testValue = 'docker-integration-test';

      await redisClient.set(testKey, testValue);
      const retrievedValue = await redisClient.get(testKey);

      expect(retrievedValue).toBe(testValue);

      // Cleanup
      await redisClient.del(testKey);
    });

    it('should verify Redis version is 7.x', async () => {
      const info = await redisClient.info('server');
      const versionMatch = info.match(/redis_version:(\d+)\./);
      expect(versionMatch).not.toBeNull();
      if (versionMatch) {
        expect(versionMatch[1]).toBe('7');
      }
    });

    it('should support persistence (AOF)', async () => {
      const info = await redisClient.info('persistence');
      expect(info).toContain('aof_enabled');
    });
  });

  describe('Service Connectivity', () => {
    it('should allow application to connect to PostgreSQL', async () => {
      const testClient = new Client({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'medical_secretary',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
      });

      await expect(testClient.connect()).resolves.not.toThrow();
      await testClient.end();
    });

    it('should allow application to connect to Redis', async () => {
      const testRedis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || 'redis',
      });

      const pong = await testRedis.ping();
      expect(pong).toBe('PONG');
      await testRedis.quit();
    });
  });

  describe('Volume Persistence', () => {
    it('should persist data in PostgreSQL across reconnections', async () => {
      // Create a test table
      await pgClient.query(`
        CREATE TABLE IF NOT EXISTS test_persistence (
          id SERIAL PRIMARY KEY,
          value TEXT
        )
      `);

      // Insert data
      await pgClient.query(
        "INSERT INTO test_persistence (value) VALUES ('persistence-test')"
      );

      // Verify data exists
      const result = await pgClient.query(
        "SELECT value FROM test_persistence WHERE value = 'persistence-test'"
      );
      expect(result.rows).toHaveLength(1);

      // Cleanup
      await pgClient.query('DROP TABLE IF EXISTS test_persistence');
    });

    it('should persist data in Redis with AOF enabled', async () => {
      const persistKey = 'test:persist:key';
      const persistValue = 'persistent-value';

      // Set value
      await redisClient.set(persistKey, persistValue);

      // Verify persistence is configured
      const config = (await redisClient.config('GET', 'appendonly')) as string[];
      expect(config[1]).toBe('yes');

      // Cleanup
      await redisClient.del(persistKey);
    });
  });
});
