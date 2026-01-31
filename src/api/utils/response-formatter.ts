import { Response } from 'express';

/**
 * Standard success response structure
 */
export interface SuccessResponse<T> {
  success: true;
  data: T;
}

/**
 * Standard error response structure
 */
export interface ErrorResponse {
  success: false;
  data: null;
  error: string;
}

/**
 * Standard API response type
 */
export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

/**
 * Sends a success response with data
 *
 * @param res - Express response object
 * @param data - Response data payload
 * @param statusCode - HTTP status code (default: 200)
 */
export const sendSuccess = <T>(res: Response, data: T, statusCode = 200): void => {
  res.status(statusCode).json({
    success: true,
    data,
  } as SuccessResponse<T>);
};

/**
 * Sends an error response with error message
 *
 * @param res - Express response object
 * @param error - Error message
 * @param statusCode - HTTP status code (default: 500)
 */
export const sendError = (res: Response, error: string, statusCode = 500): void => {
  res.status(statusCode).json({
    success: false,
    data: null,
    error,
  } as ErrorResponse);
};
