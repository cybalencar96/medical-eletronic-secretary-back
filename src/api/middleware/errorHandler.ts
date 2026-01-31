import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/errors/AppError';
import { logger } from '../../infrastructure/config/logger';

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
 *
 * All errors are logged with correlation IDs for request tracing.
 */
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

  // Check if this is an operational error (AppError)
  const isOperational = err instanceof AppError && err.isOperational;
  const statusCode = err instanceof AppError ? err.statusCode : 500;

  // Extract correlation ID from request (added by pino-http middleware)
  const correlationId = req.id || 'unknown';

  // Base error response following consistent API format
  const errorResponse: {
    success: false;
    data: null;
    error: string;
    stack?: string;
    isOperational?: boolean;
  } = {
    success: false,
    data: null,
    error: err.message || 'Internal server error',
  };

  // Include additional details in development mode
  if (isDevelopment) {
    errorResponse.stack = err.stack;
    errorResponse.isOperational = isOperational;
  }

  // Log unexpected errors (non-operational) with correlation ID
  if (!isOperational) {
    logger.error(
      {
        error: {
          message: err.message,
          stack: err.stack,
          name: err.name,
        },
        correlationId,
        statusCode,
        method: req.method,
        path: req.path,
        isOperational,
      },
      'Unexpected error occurred'
    );
  }

  res.status(statusCode).json(errorResponse);
};
