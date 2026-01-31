import { env } from '../../../infrastructure/config/env';
import { AppError } from '../../../shared/errors/AppError';

/**
 * WhatsApp configuration interface.
 * Defines all configuration options for WhatsApp Cloud API integration.
 */
export interface WhatsAppConfig {
  /**
   * WhatsApp Phone Number ID from Meta Business Suite
   */
  phoneId: string;

  /**
   * WhatsApp Access Token for authentication
   */
  accessToken: string;

  /**
   * WhatsApp Cloud API base URL
   */
  apiBaseUrl: string;

  /**
   * WhatsApp Cloud API version
   */
  apiVersion: string;

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
   * Message validation configuration
   */
  validation: {
    /**
     * Maximum message length in characters
     */
    maxMessageLength: number;

    /**
     * Minimum message length in characters
     */
    minMessageLength: number;
  };
}

/**
 * Loads and validates WhatsApp configuration from environment variables.
 *
 * In production mode (WHATSAPP_MOCK=false), validates that required credentials
 * are present. In mock mode, allows missing credentials for development.
 *
 * @returns {WhatsAppConfig} Validated WhatsApp configuration
 * @throws {AppError} If required environment variables are missing in production mode
 */
const loadWhatsAppConfig = (): WhatsAppConfig => {
  const isMockMode = env.WHATSAPP_MOCK === true;

  // In production mode, validate required credentials
  if (!isMockMode) {
    if (!env.WHATSAPP_PHONE_ID) {
      throw new AppError(
        'WHATSAPP_PHONE_ID environment variable is required when WHATSAPP_MOCK=false',
        500,
        false
      );
    }

    if (!env.WHATSAPP_ACCESS_TOKEN) {
      throw new AppError(
        'WHATSAPP_ACCESS_TOKEN environment variable is required when WHATSAPP_MOCK=false',
        500,
        false
      );
    }
  }

  return {
    phoneId: env.WHATSAPP_PHONE_ID || 'mock-phone-id',
    accessToken: env.WHATSAPP_ACCESS_TOKEN || 'mock-access-token',
    apiBaseUrl: 'https://graph.facebook.com',
    apiVersion: 'v18.0',
    isMockMode,
    retry: {
      maxAttempts: 3,
      initialDelay: 1000, // 1 second
      multiplier: 2, // Exponential backoff: 1s, 2s, 4s
    },
    validation: {
      maxMessageLength: 4096, // WhatsApp Cloud API limit
      minMessageLength: 1,
    },
  };
};

/**
 * Singleton WhatsApp configuration instance.
 * Loaded once at application startup to ensure consistency.
 */
export const whatsappConfig = loadWhatsAppConfig();
