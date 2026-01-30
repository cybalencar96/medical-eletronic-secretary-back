import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/errors/AppError';

/**
 * Centralized error handling middleware.
 *
 * This middleware catches all errors thrown in the application and formats
 * them into a consistent response structure. It distinguishes between:
 * - Operational errors (AppError): Expected errors with known status codes
 * - Unexpected errors: System failures that should return 500
 *
 * In development mode, full stack traces are included in the response.
 * In production mode, only the error message is returned for security.
 */
export const errorHandler = (
  err: Error | AppError,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

  // Check if this is an operational error (AppError)
  const isOperational = err instanceof AppError && err.isOperational;
  const statusCode = err instanceof AppError ? err.statusCode : 500;

  // Base error response
  const errorResponse: {
    status: 'error';
    statusCode: number;
    message: string;
    stack?: string;
    isOperational?: boolean;
  } = {
    status: 'error',
    statusCode,
    message: err.message || 'Internal server error',
  };

  // Include additional details in development mode
  if (isDevelopment) {
    errorResponse.stack = err.stack;
    errorResponse.isOperational = isOperational;
  }

  // Log unexpected errors (non-operational)
  if (!isOperational) {
    // eslint-disable-next-line no-console
    console.error('Unexpected error:', err);
  }

  res.status(statusCode).json(errorResponse);
};
