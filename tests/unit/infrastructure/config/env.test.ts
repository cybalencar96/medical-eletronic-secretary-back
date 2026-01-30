/**
 * Unit tests for environment configuration module.
 *
 * Note: These tests use dynamic imports to ensure fresh module loading
 * for each test case, allowing us to test different environment configurations.
 */

describe('Environment Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Clear module cache to allow fresh imports
    jest.resetModules();
    // Create a fresh copy of process.env
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('required environment variables', () => {
    it('should load configuration when all required variables are present', async () => {
      process.env.NODE_ENV = 'test';
      process.env.PORT = '3000';

      const { env } = await import('../../../../src/infrastructure/config/env');

      expect(env.NODE_ENV).toBe('test');
      expect(env.PORT).toBe(3000);
    });

    it('should throw AppError when NODE_ENV is missing', async () => {
      delete process.env.NODE_ENV;
      process.env.PORT = '3000';

      await expect(async () => {
        await import('../../../../src/infrastructure/config/env');
      }).rejects.toThrow('Missing required environment variables: NODE_ENV');
    });

    it('should throw AppError when PORT is missing', async () => {
      process.env.NODE_ENV = 'test';
      delete process.env.PORT;

      await expect(async () => {
        await import('../../../../src/infrastructure/config/env');
      }).rejects.toThrow('Missing required environment variables: PORT');
    });

    it('should throw AppError when both NODE_ENV and PORT are missing', async () => {
      delete process.env.NODE_ENV;
      delete process.env.PORT;

      await expect(async () => {
        await import('../../../../src/infrastructure/config/env');
      }).rejects.toThrow('Missing required environment variables: NODE_ENV, PORT');
    });

    it('should parse PORT as number', async () => {
      process.env.NODE_ENV = 'test';
      process.env.PORT = '8080';

      const { env } = await import('../../../../src/infrastructure/config/env');

      expect(env.PORT).toBe(8080);
      expect(typeof env.PORT).toBe('number');
    });
  });

  describe('optional environment variables', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'test';
      process.env.PORT = '3000';
    });

    it('should handle missing database configuration gracefully', async () => {
      const { env } = await import('../../../../src/infrastructure/config/env');

      expect(env.DB_HOST).toBeUndefined();
      expect(env.DB_PORT).toBeUndefined();
      expect(env.DB_NAME).toBeUndefined();
      expect(env.DB_USER).toBeUndefined();
      expect(env.DB_PASSWORD).toBeUndefined();
    });

    it('should load database configuration when provided', async () => {
      process.env.DB_HOST = 'localhost';
      process.env.DB_PORT = '5432';
      process.env.DB_NAME = 'testdb';
      process.env.DB_USER = 'testuser';
      process.env.DB_PASSWORD = 'testpass';

      const { env } = await import('../../../../src/infrastructure/config/env');

      expect(env.DB_HOST).toBe('localhost');
      expect(env.DB_PORT).toBe(5432);
      expect(env.DB_NAME).toBe('testdb');
      expect(env.DB_USER).toBe('testuser');
      expect(env.DB_PASSWORD).toBe('testpass');
    });

    it('should handle missing Redis configuration gracefully', async () => {
      const { env } = await import('../../../../src/infrastructure/config/env');

      expect(env.REDIS_HOST).toBeUndefined();
      expect(env.REDIS_PORT).toBeUndefined();
      expect(env.REDIS_PASSWORD).toBeUndefined();
    });

    it('should load Redis configuration when provided', async () => {
      process.env.REDIS_HOST = 'localhost';
      process.env.REDIS_PORT = '6379';
      process.env.REDIS_PASSWORD = 'redispass';

      const { env } = await import('../../../../src/infrastructure/config/env');

      expect(env.REDIS_HOST).toBe('localhost');
      expect(env.REDIS_PORT).toBe(6379);
      expect(env.REDIS_PASSWORD).toBe('redispass');
    });

    it('should handle missing WhatsApp configuration gracefully', async () => {
      const { env } = await import('../../../../src/infrastructure/config/env');

      expect(env.WHATSAPP_PHONE_NUMBER_ID).toBeUndefined();
      expect(env.WHATSAPP_ACCESS_TOKEN).toBeUndefined();
      expect(env.WHATSAPP_VERIFY_TOKEN).toBeUndefined();
      expect(env.WHATSAPP_WEBHOOK_SECRET).toBeUndefined();
    });

    it('should load WhatsApp configuration when provided', async () => {
      process.env.WHATSAPP_PHONE_NUMBER_ID = '123456789';
      process.env.WHATSAPP_ACCESS_TOKEN = 'access_token';
      process.env.WHATSAPP_VERIFY_TOKEN = 'verify_token';
      process.env.WHATSAPP_WEBHOOK_SECRET = 'webhook_secret';

      const { env } = await import('../../../../src/infrastructure/config/env');

      expect(env.WHATSAPP_PHONE_NUMBER_ID).toBe('123456789');
      expect(env.WHATSAPP_ACCESS_TOKEN).toBe('access_token');
      expect(env.WHATSAPP_VERIFY_TOKEN).toBe('verify_token');
      expect(env.WHATSAPP_WEBHOOK_SECRET).toBe('webhook_secret');
    });

    it('should handle missing OpenAI configuration gracefully', async () => {
      const { env } = await import('../../../../src/infrastructure/config/env');

      expect(env.OPENAI_API_KEY).toBeUndefined();
    });

    it('should load OpenAI configuration when provided', async () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';

      const { env } = await import('../../../../src/infrastructure/config/env');

      expect(env.OPENAI_API_KEY).toBe('sk-test-key');
    });

    it('should handle missing JWT configuration gracefully', async () => {
      const { env } = await import('../../../../src/infrastructure/config/env');

      expect(env.JWT_SECRET).toBeUndefined();
      expect(env.JWT_EXPIRES_IN).toBeUndefined();
    });

    it('should load JWT configuration when provided', async () => {
      process.env.JWT_SECRET = 'secret-key';
      process.env.JWT_EXPIRES_IN = '7d';

      const { env } = await import('../../../../src/infrastructure/config/env');

      expect(env.JWT_SECRET).toBe('secret-key');
      expect(env.JWT_EXPIRES_IN).toBe('7d');
    });
  });

  describe('environment-specific configurations', () => {
    it('should support development environment', async () => {
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';

      const { env } = await import('../../../../src/infrastructure/config/env');

      expect(env.NODE_ENV).toBe('development');
    });

    it('should support production environment', async () => {
      process.env.NODE_ENV = 'production';
      process.env.PORT = '3000';

      const { env } = await import('../../../../src/infrastructure/config/env');

      expect(env.NODE_ENV).toBe('production');
    });

    it('should support test environment', async () => {
      process.env.NODE_ENV = 'test';
      process.env.PORT = '3000';

      const { env } = await import('../../../../src/infrastructure/config/env');

      expect(env.NODE_ENV).toBe('test');
    });
  });
});
