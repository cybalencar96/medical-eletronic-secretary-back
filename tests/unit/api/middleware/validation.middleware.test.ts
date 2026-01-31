/**
 * Unit tests for validation middleware
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../../../../src/api/middleware/validation.middleware';
import { AppError } from '../../../../src/shared/errors/AppError';

describe('Validation Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockRequest = {
      body: {},
      query: {},
      params: {},
    };
    mockResponse = {};
    nextFunction = jest.fn();
  });

  describe('Body validation', () => {
    const testSchema = z.object({
      name: z.string().min(1),
      age: z.number().int().min(0),
    });

    it('should pass validation with valid body', async () => {
      mockRequest.body = { name: 'John', age: 30 };

      const middleware = validate(testSchema, 'body');
      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
      expect(mockRequest.body).toEqual({ name: 'John', age: 30 });
    });

    it('should fail validation with invalid body', async () => {
      mockRequest.body = { name: '', age: -1 };

      const middleware = validate(testSchema, 'body');
      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      const error = (nextFunction as jest.Mock).mock.calls[0][0];
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(400);
      expect(error.message).toContain('Validation failed');
    });

    it('should fail validation with missing required fields', async () => {
      mockRequest.body = {};

      const middleware = validate(testSchema, 'body');
      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      const error = (nextFunction as jest.Mock).mock.calls[0][0];
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(400);
    });
  });

  describe('Query validation', () => {
    const testSchema = z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(10),
    });

    it('should pass validation with valid query parameters', async () => {
      mockRequest.query = { page: '2', limit: '25' };

      const middleware = validate(testSchema, 'query');
      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
      expect(mockRequest.query).toEqual({ page: 2, limit: 25 });
    });

    it('should apply defaults for missing query parameters', async () => {
      mockRequest.query = {};

      const middleware = validate(testSchema, 'query');
      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
      expect(mockRequest.query).toEqual({ page: 1, limit: 10 });
    });

    it('should fail validation with out of range values', async () => {
      mockRequest.query = { page: '0', limit: '200' };

      const middleware = validate(testSchema, 'query');
      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      const error = (nextFunction as jest.Mock).mock.calls[0][0];
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(400);
    });
  });

  describe('Params validation', () => {
    const testSchema = z.object({
      id: z.string().uuid(),
    });

    it('should pass validation with valid UUID param', async () => {
      mockRequest.params = { id: '550e8400-e29b-41d4-a716-446655440000' };

      const middleware = validate(testSchema, 'params');
      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
      expect(mockRequest.params.id).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should fail validation with invalid UUID param', async () => {
      mockRequest.params = { id: 'not-a-uuid' };

      const middleware = validate(testSchema, 'params');
      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      const error = (nextFunction as jest.Mock).mock.calls[0][0];
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(400);
      expect(error.message).toContain('Invalid uuid');
    });
  });

  describe('Error message formatting', () => {
    const testSchema = z.object({
      email: z.string().email(),
      password: z.string().min(8),
    });

    it('should format multiple validation errors', async () => {
      mockRequest.body = { email: 'invalid-email', password: 'short' };

      const middleware = validate(testSchema, 'body');
      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      const error = (nextFunction as jest.Mock).mock.calls[0][0];
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toContain('email');
      expect(error.message).toContain('password');
    });
  });
});
