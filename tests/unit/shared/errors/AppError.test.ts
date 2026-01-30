import { AppError } from '../../../../src/shared/errors/AppError';

describe('AppError', () => {
  describe('constructor', () => {
    it('should create an instance with message and default status code 500', () => {
      const error = new AppError('Test error');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(true);
    });

    it('should create an instance with custom status code', () => {
      const error = new AppError('Not found', 404);

      expect(error.message).toBe('Not found');
      expect(error.statusCode).toBe(404);
      expect(error.isOperational).toBe(true);
    });

    it('should create an instance with custom isOperational flag', () => {
      const error = new AppError('System error', 500, false);

      expect(error.message).toBe('System error');
      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(false);
    });

    it('should set the error name to "AppError"', () => {
      const error = new AppError('Test error');

      expect(error.name).toBe('AppError');
    });

    it('should capture stack trace', () => {
      const error = new AppError('Test error');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('AppError');
    });

    it('should work with instanceof checks', () => {
      const error = new AppError('Test error');

      expect(error instanceof Error).toBe(true);
      expect(error instanceof AppError).toBe(true);
    });

    it('should create operational errors with common HTTP status codes', () => {
      const badRequest = new AppError('Bad request', 400);
      const unauthorized = new AppError('Unauthorized', 401);
      const forbidden = new AppError('Forbidden', 403);
      const notFound = new AppError('Not found', 404);
      const conflict = new AppError('Conflict', 409);

      expect(badRequest.statusCode).toBe(400);
      expect(unauthorized.statusCode).toBe(401);
      expect(forbidden.statusCode).toBe(403);
      expect(notFound.statusCode).toBe(404);
      expect(conflict.statusCode).toBe(409);

      expect(badRequest.isOperational).toBe(true);
      expect(unauthorized.isOperational).toBe(true);
      expect(forbidden.isOperational).toBe(true);
      expect(notFound.isOperational).toBe(true);
      expect(conflict.isOperational).toBe(true);
    });
  });
});
