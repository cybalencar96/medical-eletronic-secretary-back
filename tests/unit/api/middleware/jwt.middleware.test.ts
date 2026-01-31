/**
 * Unit tests for JWT authentication middleware
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authenticateJWT, AuthenticatedRequest } from '../../../../src/api/middleware/jwt.middleware';
import { AppError } from '../../../../src/shared/errors/AppError';
import { UserRole } from '../../../../src/shared/types/auth.types';

// Mock environment config
jest.mock('../../../../src/infrastructure/config/env', () => ({
  env: {
    JWT_SECRET: 'test-secret-key',
  },
}));

describe('JWT Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {},
    };
    mockResponse = {};
    nextFunction = jest.fn();
  });

  describe('Valid token', () => {
    it('should authenticate valid JWT token', () => {
      const payload = { userId: '123', username: 'testuser', role: UserRole.DOCTOR };
      const token = jwt.sign(payload, 'test-secret-key');

      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      authenticateJWT(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
      expect((mockRequest as AuthenticatedRequest).user).toEqual(payload);
    });

    it('should attach user information to request', () => {
      const payload = { userId: 'user-456', username: 'dr.smith', role: UserRole.DOCTOR };
      const token = jwt.sign(payload, 'test-secret-key');

      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      authenticateJWT(mockRequest as Request, mockResponse as Response, nextFunction);

      const authenticatedReq = mockRequest as AuthenticatedRequest;
      expect(authenticatedReq.user).toBeDefined();
      expect(authenticatedReq.user?.userId).toBe('user-456');
      expect(authenticatedReq.user?.username).toBe('dr.smith');
      expect(authenticatedReq.user?.role).toBe(UserRole.DOCTOR);
    });

    it('should extract correct role from token payload', () => {
      const payload = { userId: 'sec-789', username: 'secretary1', role: UserRole.SECRETARY };
      const token = jwt.sign(payload, 'test-secret-key');

      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      authenticateJWT(mockRequest as Request, mockResponse as Response, nextFunction);

      const authenticatedReq = mockRequest as AuthenticatedRequest;
      expect(authenticatedReq.user?.role).toBe(UserRole.SECRETARY);
    });
  });

  describe('Missing authorization header', () => {
    it('should return 401 when authorization header is missing', () => {
      mockRequest.headers = {};

      authenticateJWT(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      const error = (nextFunction as jest.Mock).mock.calls[0][0];
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(401);
      expect(error.message).toContain('Missing authorization header');
    });
  });

  describe('Invalid authorization header format', () => {
    it('should return 401 for malformed authorization header', () => {
      mockRequest.headers = {
        authorization: 'InvalidFormat token123',
      };

      authenticateJWT(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      const error = (nextFunction as jest.Mock).mock.calls[0][0];
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(401);
      expect(error.message).toContain('Invalid authorization header format');
    });

    it('should return 401 for missing Bearer prefix', () => {
      const token = jwt.sign(
        { userId: '123', username: 'test', role: UserRole.DOCTOR },
        'test-secret-key'
      );
      mockRequest.headers = {
        authorization: token,
      };

      authenticateJWT(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      const error = (nextFunction as jest.Mock).mock.calls[0][0];
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(401);
    });
  });

  describe('Invalid token', () => {
    it('should return 403 for invalid token signature', () => {
      const token = jwt.sign(
        { userId: '123', username: 'test', role: UserRole.DOCTOR },
        'wrong-secret'
      );

      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      authenticateJWT(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      const error = (nextFunction as jest.Mock).mock.calls[0][0];
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(403);
      expect(error.message).toContain('Invalid or malformed token');
    });

    it('should return 403 for malformed token', () => {
      mockRequest.headers = {
        authorization: 'Bearer not-a-valid-jwt-token',
      };

      authenticateJWT(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      const error = (nextFunction as jest.Mock).mock.calls[0][0];
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(403);
    });

    it('should return 403 for expired token', () => {
      const token = jwt.sign(
        { userId: '123', username: 'test', role: UserRole.DOCTOR },
        'test-secret-key',
        {
          expiresIn: '-1s',
        }
      );

      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      authenticateJWT(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      const error = (nextFunction as jest.Mock).mock.calls[0][0];
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(403);
      expect(error.message).toContain('expired');
    });
  });
});
