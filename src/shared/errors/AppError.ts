/**
 * Custom application error class for operational errors.
 *
 * Operational errors are expected errors that are part of normal application flow,
 * such as validation failures, unauthorized access, or resource not found.
 * These errors are intentionally thrown and should be handled gracefully.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }

    this.statusCode = statusCode;
    this.isOperational = isOperational;

    // Set the prototype explicitly to ensure instanceof works correctly
    Object.setPrototypeOf(this, AppError.prototype);

    // Set the name property to the class name
    this.name = this.constructor.name;
  }
}
