import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../../../../src/api/middleware/errorHandler';
import { AppError } from '../../../../src/shared/errors/AppError';

describe('errorHandler middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    mockRequest = {};
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
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

    it('should not log operational errors to console', () => {
      const error = new AppError('Validation failed', 400);

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(consoleErrorSpy).not.toHaveBeenCalled();
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

    it('should log unexpected errors to console', () => {
      const error = new Error('Database connection failed');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(consoleErrorSpy).toHaveBeenCalledWith('Unexpected error:', error);
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
    it('should log non-operational AppError instances', () => {
      const error = new AppError('Critical system failure', 500, false);

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(consoleErrorSpy).toHaveBeenCalledWith('Unexpected error:', error);
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
