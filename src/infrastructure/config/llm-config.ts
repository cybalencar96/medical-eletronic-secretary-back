import { env } from './env';
import { AppError } from '../../shared/errors/AppError';

/**
 * LLM configuration interface.
 * Defines all configuration options for OpenAI API integration.
 */
export interface LLMConfig {
  /**
   * OpenAI API key for authentication
   */
  apiKey: string;

  /**
   * OpenAI model to use for intent classification
   * Default: gpt-4o-mini for cost efficiency
   */
  model: string;

  /**
   * Mock mode flag - bypasses real API calls for development
   */
  isMockMode: boolean;

  /**
   * Retry configuration for API calls
   */
  retry: {
    /**
     * Maximum number of retry attempts
     */
    maxAttempts: number;

    /**
     * Initial delay in milliseconds before first retry
     */
    initialDelay: number;

    /**
     * Exponential backoff multiplier
     */
    multiplier: number;
  };

  /**
   * Classification configuration
   */
  classification: {
    /**
     * Confidence threshold for intent classification
     * Scores below this trigger automatic escalation
     */
    confidenceThreshold: number;

    /**
     * Maximum message length for classification
     */
    maxMessageLength: number;

    /**
     * Temperature for OpenAI API (0.0 - 1.0)
     * Lower values = more deterministic responses
     */
    temperature: number;

    /**
     * Maximum tokens in OpenAI response
     */
    maxTokens: number;
  };

  /**
   * Timeout configuration
   */
  timeout: {
    /**
     * Request timeout in milliseconds
     */
    requestTimeout: number;
  };
}

/**
 * Loads and validates LLM configuration from environment variables.
 *
 * In production mode (LLM_MOCK_MODE=false), validates that required credentials
 * are present. In mock mode, allows missing credentials for development.
 *
 * @returns {LLMConfig} Validated LLM configuration
 * @throws {AppError} If required environment variables are missing in production mode
 */
const loadLLMConfig = (): LLMConfig => {
  const isMockMode = env.LLM_MOCK_MODE === true;

  // In production mode, validate required credentials
  if (!isMockMode && !env.OPENAI_API_KEY) {
    throw new AppError(
      'OPENAI_API_KEY environment variable is required when LLM_MOCK_MODE is not enabled',
      500,
      false
    );
  }

  return {
    apiKey: env.OPENAI_API_KEY || 'mock-api-key',
    model: env.OPENAI_MODEL || 'gpt-4o-mini',
    isMockMode,
    retry: {
      maxAttempts: 3,
      initialDelay: 1000, // 1 second
      multiplier: 2, // Exponential backoff: 1s, 2s, 4s
    },
    classification: {
      confidenceThreshold: 0.7,
      maxMessageLength: 4000,
      temperature: 0.3, // Low temperature for deterministic classification
      maxTokens: 500, // Sufficient for ClassifiedIntent JSON response
    },
    timeout: {
      requestTimeout: 30000, // 30 seconds
    },
  };
};

/**
 * Singleton LLM configuration instance.
 * Loaded once at application startup to ensure consistency.
 */
export const llmConfig = loadLLMConfig();
