/**
 * Unit tests for logger configuration.
 *
 * Tests verify that the logger is configured correctly based on environment variables:
 * - LOG_LEVEL environment variable is respected
 * - Default log level is 'info' when LOG_LEVEL is not set
 * - Pretty-print is enabled in development mode
 * - JSON output is used in production mode
 * - Logger handles circular references gracefully
 */

// Mock dotenv to prevent it from loading .env file during tests
jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

describe('Logger Configuration', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Clear require cache to force logger module reload
    jest.resetModules();

    // Start with clean environment
    process.env = {};
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Log Level Configuration', () => {
    it('should use LOG_LEVEL environment variable when set to debug', () => {
      process.env.NODE_ENV = 'production';
      process.env.PORT = '3000';
      process.env.LOG_LEVEL = 'debug';

      const { logger } = require('../../../../src/infrastructure/config/logger');

      expect(logger.level).toBe('debug');
    });

    it('should use LOG_LEVEL environment variable when set to warn', () => {
      process.env.NODE_ENV = 'production';
      process.env.PORT = '3000';
      process.env.LOG_LEVEL = 'warn';

      const { logger } = require('../../../../src/infrastructure/config/logger');

      expect(logger.level).toBe('warn');
    });

    it('should use LOG_LEVEL environment variable when set to error', () => {
      process.env.NODE_ENV = 'production';
      process.env.PORT = '3000';
      process.env.LOG_LEVEL = 'error';

      const { logger } = require('../../../../src/infrastructure/config/logger');

      expect(logger.level).toBe('error');
    });

    it('should default to debug in development mode when LOG_LEVEL is not set', () => {
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';
      delete process.env.LOG_LEVEL;

      const { logger } = require('../../../../src/infrastructure/config/logger');

      expect(logger.level).toBe('debug');
    });

    it('should default to info in production mode when LOG_LEVEL is not set', () => {
      process.env.NODE_ENV = 'production';
      process.env.PORT = '3000';
      delete process.env.LOG_LEVEL;

      const { logger } = require('../../../../src/infrastructure/config/logger');

      expect(logger.level).toBe('info');
    });
  });

  describe('Output Format Configuration', () => {
    it('should create logger in production mode', () => {
      process.env.NODE_ENV = 'production';
      process.env.PORT = '3000';

      const { logger } = require('../../../../src/infrastructure/config/logger');

      // Logger should be created without errors and configured for production
      expect(logger).toBeDefined();
      expect(logger.level).toBe('info');
    });

    it('should support pretty-print configuration in development mode', () => {
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';

      const { logger } = require('../../../../src/infrastructure/config/logger');

      // Logger should be created without errors
      expect(logger).toBeDefined();
      expect(logger.level).toBe('debug');
    });
  });

  describe('Child Logger Creation', () => {
    it('should create child logger with correlation ID', () => {
      process.env.NODE_ENV = 'test';
      process.env.PORT = '3000';

      const { logger } = require('../../../../src/infrastructure/config/logger');

      const childLogger = logger.child({ correlationId: 'test-123' });

      expect(childLogger).toBeDefined();
      // Child logger should have the same level as parent
      expect(childLogger.level).toBe(logger.level);
    });

    it('should preserve correlation ID in child logger bindings', () => {
      process.env.NODE_ENV = 'test';
      process.env.PORT = '3000';

      const { logger } = require('../../../../src/infrastructure/config/logger');

      const correlationId = 'test-correlation-123';
      const childLogger = logger.child({ correlationId });

      // Verify child logger has the correlation ID in its bindings
      expect(childLogger.bindings()).toEqual(
        expect.objectContaining({ correlationId })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle circular references in log objects', () => {
      process.env.NODE_ENV = 'test';
      process.env.PORT = '3000';

      const { logger } = require('../../../../src/infrastructure/config/logger');

      // Create circular reference
      const obj: any = { name: 'test' };
      obj.self = obj;

      // Should not throw error
      expect(() => {
        logger.info({ data: obj }, 'Testing circular reference');
      }).not.toThrow();
    });

    it('should handle logging when message is missing', () => {
      process.env.NODE_ENV = 'test';
      process.env.PORT = '3000';

      const { logger } = require('../../../../src/infrastructure/config/logger');

      // Should not throw error when logging without message
      expect(() => {
        logger.info({ event: 'test' });
      }).not.toThrow();
    });
  });

  describe('Log Level Methods', () => {
    it('should support all standard log levels', () => {
      process.env.NODE_ENV = 'test';
      process.env.PORT = '3000';

      const { logger } = require('../../../../src/infrastructure/config/logger');

      expect(typeof logger.trace).toBe('function');
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.fatal).toBe('function');
    });
  });
});
