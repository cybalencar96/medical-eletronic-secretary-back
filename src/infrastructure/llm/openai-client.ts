import OpenAI from 'openai';
import { logger } from '../config/logger';
import { llmConfig } from '../config/llm-config';
import { LLMError, LLM_ERROR_TYPES } from '../../shared/errors/LLMError';

/**
 * Interface for OpenAI client.
 * Defines contract for making chat completion requests.
 */
export interface IOpenAIClient {
  /**
   * Creates a chat completion request with structured JSON output.
   * @param {object} params - Chat completion parameters
   * @returns {Promise<T>} Parsed JSON response
   * @throws {LLMError} If request fails
   */
  createChatCompletion<T>(params: ChatCompletionParams): Promise<T>;
}

/**
 * Chat completion parameters
 */
export interface ChatCompletionParams {
  /** Array of chat messages */
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  /** Optional correlation ID for request tracking */
  correlationId?: string;
}

/**
 * OpenAI client wrapper.
 *
 * This client handles:
 * - OpenAI API authentication and configuration
 * - Structured JSON output mode for deterministic parsing
 * - Request/response logging with correlation IDs
 * - Error handling with custom LLMError types
 * - Automatic retry logic with exponential backoff (via OpenAI SDK)
 * - Request ID tracking for debugging
 *
 * @example
 * ```typescript
 * const client = new OpenAIClient();
 * const result = await client.createChatCompletion<ClassifiedIntent>({
 *   messages: [
 *     { role: 'system', content: 'You are an intent classifier...' },
 *     { role: 'user', content: 'Quero marcar uma consulta' }
 *   ],
 *   correlationId: 'req-123'
 * });
 * console.log('Intent:', result.intent);
 * ```
 */
export class OpenAIClient implements IOpenAIClient {
  private readonly client: OpenAI;

  /**
   * Creates a new OpenAIClient instance.
   *
   * @param {OpenAI} [openaiInstance] - Optional OpenAI instance for testing
   */
  constructor(openaiInstance?: OpenAI) {
    this.client = openaiInstance || this.createOpenAIClient();
  }

  /**
   * Creates and configures the OpenAI client.
   *
   * @returns {OpenAI} Configured OpenAI client instance
   * @private
   */
  private createOpenAIClient(): OpenAI {
    return new OpenAI({
      apiKey: llmConfig.apiKey,
      maxRetries: llmConfig.retry.maxAttempts,
      timeout: llmConfig.timeout.requestTimeout,
    });
  }

  /**
   * Creates a chat completion request with structured JSON output.
   *
   * Implements automatic retry logic with exponential backoff for:
   * - HTTP 429 (rate limit exceeded)
   * - HTTP 500+ (server errors)
   * - Network errors (timeout, connection refused)
   *
   * Does NOT retry on:
   * - HTTP 400 (bad request - client error)
   * - HTTP 401 (unauthorized - invalid API key)
   *
   * @param {ChatCompletionParams} params - Chat completion parameters
   * @returns {Promise<T>} Parsed JSON response
   * @throws {LLMError} If request fails after all retry attempts
   */
  async createChatCompletion<T>(params: ChatCompletionParams): Promise<T> {
    const startTime = Date.now();

    logger.debug(
      {
        correlationId: params.correlationId,
        model: llmConfig.model,
        messageCount: params.messages.length,
      },
      'Creating OpenAI chat completion request',
    );

    try {
      const completion = await this.client.chat.completions.create({
        model: llmConfig.model,
        messages: params.messages,
        temperature: llmConfig.classification.temperature,
        max_tokens: llmConfig.classification.maxTokens,
        response_format: { type: 'json_object' },
      });

      const latency = Date.now() - startTime;
      const content = completion.choices[0]?.message?.content;

      if (!content) {
        throw new LLMError(
          'OpenAI API returned empty response content',
          LLM_ERROR_TYPES.INVALID_RESPONSE,
          500,
          {
            requestId: completion._request_id,
            model: llmConfig.model,
          },
        );
      }

      const parsedResponse = JSON.parse(content) as T;

      logger.info(
        {
          correlationId: params.correlationId,
          requestId: completion._request_id,
          model: completion.model,
          latency,
          promptTokens: completion.usage?.prompt_tokens,
          completionTokens: completion.usage?.completion_tokens,
          totalTokens: completion.usage?.total_tokens,
        },
        'OpenAI chat completion successful',
      );

      return parsedResponse;
    } catch (error) {
      const latency = Date.now() - startTime;
      throw this.handleError(error, params.correlationId, latency);
    }
  }

  /**
   * Converts OpenAI SDK error to LLMError.
   *
   * @param {unknown} error - Error object
   * @param {string} [correlationId] - Correlation ID for tracking
   * @param {number} [latency] - Request latency in milliseconds
   * @returns {LLMError} Structured LLM error
   * @private
   */
  private handleError(error: unknown, correlationId?: string, latency?: number): LLMError {
    // Handle OpenAI SDK authentication errors
    if (error instanceof OpenAI.AuthenticationError) {
      logger.error(
        {
          correlationId,
          statusCode: error.status,
          requestId: error.request_id,
          latency,
        },
        'OpenAI authentication error',
      );
      return new LLMError(
        'OpenAI API authentication failed - check API key',
        LLM_ERROR_TYPES.AUTHENTICATION_FAILED,
        401,
        {
          requestId: error.request_id,
          model: llmConfig.model,
        },
      );
    }

    // Handle OpenAI SDK rate limit errors
    if (error instanceof OpenAI.RateLimitError) {
      logger.warn(
        {
          correlationId,
          statusCode: error.status,
          requestId: error.request_id,
          latency,
        },
        'OpenAI rate limit exceeded',
      );
      return new LLMError(
        'OpenAI API rate limit exceeded',
        LLM_ERROR_TYPES.RATE_LIMIT_EXCEEDED,
        429,
        {
          requestId: error.request_id,
          model: llmConfig.model,
        },
      );
    }

    // Handle OpenAI SDK bad request errors
    if (error instanceof OpenAI.BadRequestError) {
      logger.error(
        {
          correlationId,
          statusCode: error.status,
          requestId: error.request_id,
          errorMessage: error.message,
          latency,
        },
        'OpenAI bad request error',
      );
      return new LLMError(
        `OpenAI API bad request: ${error.message}`,
        LLM_ERROR_TYPES.INVALID_RESPONSE,
        400,
        {
          requestId: error.request_id,
          model: llmConfig.model,
        },
      );
    }

    // Handle OpenAI SDK API errors (500+)
    if (error instanceof OpenAI.InternalServerError || error instanceof OpenAI.APIError) {
      logger.error(
        {
          correlationId,
          statusCode: error instanceof OpenAI.APIError ? error.status : 500,
          requestId: error instanceof OpenAI.APIError ? error.request_id : undefined,
          errorMessage: error.message,
          latency,
        },
        'OpenAI API server error',
      );
      return new LLMError(
        `OpenAI API error: ${error.message}`,
        LLM_ERROR_TYPES.API_ERROR,
        error instanceof OpenAI.APIError && error.status ? error.status : 500,
        {
          requestId: error instanceof OpenAI.APIError ? error.request_id : undefined,
          model: llmConfig.model,
        },
      );
    }

    // Handle timeout errors
    if (error instanceof OpenAI.APIConnectionTimeoutError) {
      logger.error(
        {
          correlationId,
          latency,
        },
        'OpenAI API request timeout',
      );
      return new LLMError(
        'OpenAI API request timeout',
        LLM_ERROR_TYPES.TIMEOUT,
        504,
        {
          model: llmConfig.model,
        },
      );
    }

    // Handle connection errors
    if (error instanceof OpenAI.APIConnectionError) {
      logger.error(
        {
          correlationId,
          errorMessage: error.message,
          latency,
        },
        'OpenAI API connection error',
      );
      return new LLMError(
        'OpenAI API connection error',
        LLM_ERROR_TYPES.NETWORK_ERROR,
        500,
        {
          model: llmConfig.model,
        },
      );
    }

    // Handle JSON parsing errors
    if (error instanceof SyntaxError && error.message.includes('JSON')) {
      logger.error(
        {
          correlationId,
          errorMessage: error.message,
          latency,
        },
        'Failed to parse OpenAI JSON response',
      );
      return new LLMError(
        'Failed to parse OpenAI JSON response',
        LLM_ERROR_TYPES.INVALID_RESPONSE,
        500,
        {
          model: llmConfig.model,
        },
      );
    }

    // Handle unexpected errors
    logger.error(
      {
        correlationId,
        error: error instanceof Error ? error.message : String(error),
        latency,
      },
      'Unexpected error in OpenAI client',
    );

    return new LLMError(
      error instanceof Error ? error.message : 'Unknown OpenAI error',
      LLM_ERROR_TYPES.UNKNOWN,
      500,
      {
        model: llmConfig.model,
      },
    );
  }
}

/**
 * Singleton OpenAI client instance.
 * Used throughout the application for LLM requests.
 */
export const openaiClient = new OpenAIClient();
