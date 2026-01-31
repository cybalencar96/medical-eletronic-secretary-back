import axios, { AxiosInstance } from 'axios';
import { logger } from '../../../infrastructure/config/logger';
import { WhatsAppApiError } from '../../../shared/errors/WhatsAppApiError';
import { whatsappConfig } from '../config/whatsapp.config';
import {
  SendMessageRequest,
  SendMessageResponse,
  WhatsAppApiErrorResponse,
} from '../types/send-message.interface';

/**
 * Interface for WhatsApp Cloud API client.
 * Defines contract for sending messages via WhatsApp Cloud API.
 */
export interface IWhatsAppCloudApiClient {
  /**
   * Sends a text message via WhatsApp Cloud API.
   * @param {SendMessageRequest} request - Message request payload
   * @returns {Promise<SendMessageResponse>} WhatsApp API response with message ID
   * @throws {WhatsAppApiError} If API request fails
   */
  sendMessage(request: SendMessageRequest): Promise<SendMessageResponse>;
}

/**
 * WhatsApp Cloud API client.
 *
 * This client handles:
 * - HTTP communication with WhatsApp Cloud API
 * - Bearer token authentication
 * - Request/response formatting
 * - Error handling and categorization
 * - Retry logic with exponential backoff for rate limits and transient failures
 *
 * @example
 * ```typescript
 * const client = new WhatsAppCloudApiClient();
 * const response = await client.sendMessage({
 *   messaging_product: 'whatsapp',
 *   to: '+5511999999999',
 *   type: 'text',
 *   text: { body: 'Hello from WhatsApp!' }
 * });
 * console.log('Message ID:', response.messages[0].id);
 * ```
 */
export class WhatsAppCloudApiClient implements IWhatsAppCloudApiClient {
  private readonly httpClient: AxiosInstance;

  /**
   * Creates a new WhatsAppCloudApiClient instance.
   *
   * @param {AxiosInstance} [axiosInstance] - Optional axios instance for testing
   */
  constructor(axiosInstance?: AxiosInstance) {
    this.httpClient = axiosInstance || this.createHttpClient();
  }

  /**
   * Creates and configures the axios HTTP client.
   *
   * @returns {AxiosInstance} Configured axios instance
   * @private
   */
  private createHttpClient(): AxiosInstance {
    const baseURL = `${whatsappConfig.apiBaseUrl}/${whatsappConfig.apiVersion}`;

    return axios.create({
      baseURL,
      timeout: 30000, // 30 seconds
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${whatsappConfig.accessToken}`,
      },
    });
  }

  /**
   * Sends a text message via WhatsApp Cloud API.
   *
   * Implements retry logic with exponential backoff for:
   * - HTTP 429 (rate limit exceeded)
   * - HTTP 500 (server errors)
   * - Network errors (timeout, connection refused)
   *
   * Does NOT retry on:
   * - HTTP 400 (bad request - client error)
   * - HTTP 401 (unauthorized - invalid token)
   *
   * @param {SendMessageRequest} request - Message request payload
   * @returns {Promise<SendMessageResponse>} WhatsApp API response with message ID
   * @throws {WhatsAppApiError} If API request fails after all retry attempts
   */
  async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
    const endpoint = `/${whatsappConfig.phoneId}/messages`;

    logger.debug(
      {
        endpoint,
        to: request.to,
        messagePreview: request.text.body.substring(0, 50),
      },
      'Sending WhatsApp message via Cloud API'
    );

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= whatsappConfig.retry.maxAttempts; attempt++) {
      try {
        const response = await this.httpClient.post<SendMessageResponse>(endpoint, request);

        logger.info(
          {
            messageId: response.data.messages[0]?.id,
            to: request.to,
            attempts: attempt + 1,
          },
          'WhatsApp message sent successfully'
        );

        return response.data;
      } catch (error) {
        const isRetryable = this.isRetryableError(error);
        const statusCode = this.getStatusCode(error);

        logger.warn(
          {
            error: error instanceof Error ? error.message : String(error),
            statusCode,
            attempt: attempt + 1,
            maxAttempts: whatsappConfig.retry.maxAttempts + 1,
            isRetryable,
            to: request.to,
          },
          'WhatsApp API request failed'
        );

        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on non-retryable errors
        if (!isRetryable) {
          break;
        }

        // Don't retry if this was the last attempt
        if (attempt === whatsappConfig.retry.maxAttempts) {
          break;
        }

        // Calculate exponential backoff delay
        const delay =
          whatsappConfig.retry.initialDelay * Math.pow(whatsappConfig.retry.multiplier, attempt);

        logger.debug(
          {
            attempt: attempt + 1,
            delay,
            nextAttempt: attempt + 2,
          },
          'Retrying WhatsApp API request after delay'
        );

        // Wait before retrying
        await this.sleep(delay);
      }
    }

    // All retries exhausted or non-retryable error
    throw this.handleError(lastError!);
  }

  /**
   * Determines if an error is retryable.
   *
   * Retryable errors:
   * - HTTP 429 (rate limit exceeded)
   * - HTTP 500, 502, 503, 504 (server errors)
   * - Network errors (ECONNRESET, ETIMEDOUT, ENOTFOUND, etc.)
   *
   * Non-retryable errors:
   * - HTTP 400 (bad request)
   * - HTTP 401 (unauthorized)
   * - HTTP 403 (forbidden)
   * - HTTP 404 (not found)
   *
   * @param {unknown} error - Error object
   * @returns {boolean} True if error is retryable, false otherwise
   * @private
   */
  private isRetryableError(error: unknown): boolean {
    if (!axios.isAxiosError(error)) {
      return false;
    }

    // Network errors are retryable
    if (!error.response) {
      return true;
    }

    const statusCode = error.response.status;

    // Rate limit and server errors are retryable
    if (statusCode === 429 || (statusCode >= 500 && statusCode < 600)) {
      return true;
    }

    // Client errors are not retryable
    return false;
  }

  /**
   * Extracts HTTP status code from error.
   *
   * @param {unknown} error - Error object
   * @returns {number} HTTP status code or 500 if not available
   * @private
   */
  private getStatusCode(error: unknown): number {
    if (axios.isAxiosError(error) && error.response) {
      return error.response.status;
    }
    return 500; // Default to server error for network errors
  }

  /**
   * Converts axios error to WhatsAppApiError.
   *
   * @param {Error} error - Error object
   * @returns {WhatsAppApiError} Structured WhatsApp API error
   * @private
   */
  private handleError(error: Error): WhatsAppApiError {
    if (!axios.isAxiosError(error)) {
      logger.error({ error }, 'Unexpected error in WhatsApp API client');
      return new WhatsAppApiError('Unexpected error while sending WhatsApp message', 500);
    }

    // Network error (no response from server)
    if (!error.response) {
      const message = error.code === 'ETIMEDOUT' ? 'Request timeout' : 'Network error';
      logger.error(
        {
          code: error.code,
          message: error.message,
        },
        'WhatsApp API network error'
      );
      return new WhatsAppApiError(message, 500);
    }

    // Extract error details from response
    const statusCode = error.response.status;
    const errorData = error.response.data as WhatsAppApiErrorResponse | undefined;

    if (errorData?.error) {
      logger.error(
        {
          statusCode,
          whatsappCode: errorData.error.code,
          whatsappMessage: errorData.error.message,
          traceId: errorData.error.fbtrace_id,
        },
        'WhatsApp API error response'
      );

      return new WhatsAppApiError(
        errorData.error.message,
        statusCode,
        errorData.error.code,
        errorData.error.fbtrace_id
      );
    }

    // Generic error response
    logger.error(
      {
        statusCode,
        responseData: error.response.data as unknown,
      },
      'WhatsApp API error without structured error data'
    );

    return new WhatsAppApiError(`WhatsApp API error: ${statusCode}`, statusCode);
  }

  /**
   * Utility function to sleep for a given duration.
   *
   * @param {number} ms - Duration in milliseconds
   * @returns {Promise<void>}
   * @private
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Singleton WhatsApp Cloud API client instance.
 * Used throughout the application for sending messages.
 */
export const whatsappCloudApiClient = new WhatsAppCloudApiClient();
