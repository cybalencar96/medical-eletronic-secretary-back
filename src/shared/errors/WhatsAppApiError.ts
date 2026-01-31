import { AppError } from './AppError';

/**
 * Custom error class for WhatsApp Cloud API errors.
 *
 * This error class extends AppError to provide additional context
 * specific to WhatsApp Cloud API failures, including WhatsApp-specific
 * error codes and trace IDs for debugging.
 *
 * @extends AppError
 *
 * @example
 * ```typescript
 * throw new WhatsAppApiError(
 *   'Invalid phone number format',
 *   400,
 *   100,
 *   'ABC123XYZ'
 * );
 * ```
 */
export class WhatsAppApiError extends AppError {
  /**
   * WhatsApp-specific error code for categorization
   */
  public readonly whatsappCode?: number;

  /**
   * Facebook trace ID for debugging
   */
  public readonly traceId?: string;

  /**
   * Creates a new WhatsAppApiError instance.
   *
   * @param {string} message - Error message describing what went wrong
   * @param {number} statusCode - HTTP status code (400, 401, 429, 500, etc.)
   * @param {number} [whatsappCode] - WhatsApp-specific error code
   * @param {string} [traceId] - Facebook trace ID for debugging
   * @param {boolean} [isOperational=true] - Whether this is an operational error
   */
  constructor(
    message: string,
    statusCode: number,
    whatsappCode?: number,
    traceId?: string,
    isOperational: boolean = true
  ) {
    super(message, statusCode, isOperational);
    this.whatsappCode = whatsappCode;
    this.traceId = traceId;

    // Set the prototype explicitly to ensure instanceof works correctly
    Object.setPrototypeOf(this, WhatsAppApiError.prototype);

    // Maintain proper stack trace for debugging
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Serializes the error to a JSON-compatible object.
   *
   * @returns {object} JSON representation of the error
   */
  toJSON(): {
    message: string;
    statusCode: number;
    isOperational: boolean;
    whatsappCode?: number;
    traceId?: string;
  } {
    return {
      message: this.message,
      statusCode: this.statusCode,
      isOperational: this.isOperational,
      whatsappCode: this.whatsappCode,
      traceId: this.traceId,
    };
  }
}
