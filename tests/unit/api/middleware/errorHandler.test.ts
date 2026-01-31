import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../../../../src/api/middleware/errorHandler';
import { AppError } from '../../../../src/shared/errors/AppError';
import { logger } from '../../../../src/infrastructure/config/logger';

// Mock the logger
jest.mock('../../../../src/infrastructure/config/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('errorHandler middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup mock request with correlation ID
    mockRequest = {
      id: 'test-correlation-id',
      method: 'GET',
      path: '/api/test',
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  describe('operational errors (AppError)', () => {
    it('should return correct status code for AppError instances', () => {
      const error = new AppError('Validation failed', 400);

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          data: null,
          error: 'Validation failed',
        }),
      );
    });

    it('should handle 404 Not Found errors', () => {
      const error = new AppError('Resource not found', 404);

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          data: null,
          error: 'Resource not found',
        }),
      );
    });

    it('should handle 401 Unauthorized errors', () => {
      const error = new AppError('Unauthorized access', 401);

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          data: null,
          error: 'Unauthorized access',
        }),
      );
    });

    it('should not log operational errors', () => {
      const error = new AppError('Validation failed', 400);

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(logger.error).not.toHaveBeenCalled();
    });
  });

  describe('unexpected errors (non-AppError)', () => {
    it('should return 500 for unexpected errors', () => {
      const error = new Error('Unexpected system error');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          data: null,
          error: 'Unexpected system error',
        }),
      );
    });

    it('should log unexpected errors with correlation ID', () => {
      const error = new Error('Database connection failed');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Database connection failed',
            stack: expect.any(String),
            name: 'Error',
          }),
          correlationId: 'test-correlation-id',
          statusCode: 500,
          method: 'GET',
          path: '/api/test',
          isOperational: false,
        }),
        'Unexpected error occurred'
      );
    });

    it('should return default message if error message is empty', () => {
      const error = new Error();

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Internal server error',
        }),
      );
    });

    it('should use "unknown" correlation ID when request.id is not available', () => {
      const error = new Error('Test error');
      mockRequest.id = undefined;

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          correlationId: 'unknown',
        }),
        'Unexpected error occurred'
      );
    });
  });

  describe('development mode', () => {
    const originalEnv = process.env.NODE_ENV;

    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('should include stack trace in development mode', () => {
      const error = new AppError('Test error', 400);

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          stack: expect.any(String),
        }),
      );
    });

    it('should include isOperational flag in development mode', () => {
      const error = new AppError('Test error', 400);

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          isOperational: true,
        }),
      );
    });

    it('should show isOperational: false for unexpected errors in development mode', () => {
      const error = new Error('System error');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          isOperational: false,
        }),
      );
    });
  });

  describe('production mode', () => {
    const originalEnv = process.env.NODE_ENV;

    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('should not include stack trace in production mode', () => {
      const error = new AppError('Test error', 400);

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      const jsonCall = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(jsonCall).not.toHaveProperty('stack');
    });

    it('should not include isOperational flag in production mode', () => {
      const error = new AppError('Test error', 400);

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      const jsonCall = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(jsonCall).not.toHaveProperty('isOperational');
    });
  });

  describe('non-operational AppError', () => {
    it('should log non-operational AppError instances with correlation ID', () => {
      const error = new AppError('Critical system failure', 500, false);

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          correlationId: 'test-correlation-id',
          isOperational: false,
        }),
        'Unexpected error occurred'
      );
    });

    it('should still return correct status code for non-operational AppError', () => {
      const error = new AppError('Critical system failure', 500, false);

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          data: null,
          error: 'Critical system failure',
        }),
      );
    });
  });
});
