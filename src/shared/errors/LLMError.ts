import { AppError } from './AppError';

/**
 * Custom error class for LLM (OpenAI API) related errors.
 * Extends AppError with LLM-specific context for better error tracking and debugging.
 */
export class LLMError extends AppError {
  public readonly errorType: string;
  public readonly requestId?: string;
  public readonly model?: string;

  constructor(
    message: string,
    errorType: string = 'unknown',
    statusCode: number = 500,
    metadata?: {
      requestId?: string;
      model?: string;
    },
  ) {
    super(message, statusCode, true);

    this.errorType = errorType;
    this.requestId = metadata?.requestId;
    this.model = metadata?.model;

    // Set the prototype explicitly to ensure instanceof works correctly
    Object.setPrototypeOf(this, LLMError.prototype);

    // Set the name property to the class name
    this.name = 'LLMError';
  }
}

/**
 * Specific error types for LLM operations
 */
export const LLM_ERROR_TYPES = {
  /** OpenAI API authentication failed */
  AUTHENTICATION_FAILED: 'authentication_failed',
  /** OpenAI API rate limit exceeded */
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  /** Invalid response from OpenAI API */
  INVALID_RESPONSE: 'invalid_response',
  /** Network error during OpenAI API call */
  NETWORK_ERROR: 'network_error',
  /** OpenAI API internal server error */
  API_ERROR: 'api_error',
  /** Response validation failed (Zod schema) */
  VALIDATION_FAILED: 'validation_failed',
  /** Configuration error (missing API key, etc.) */
  CONFIGURATION_ERROR: 'configuration_error',
  /** Request timeout */
  TIMEOUT: 'timeout',
  /** Unknown error */
  UNKNOWN: 'unknown',
} as const;
