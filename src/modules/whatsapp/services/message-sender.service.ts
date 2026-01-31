import { logger } from '../../../infrastructure/config/logger';
import { AppError } from '../../../shared/errors/AppError';
import { WhatsAppApiError } from '../../../shared/errors/WhatsAppApiError';
import { whatsappConfig } from '../config/whatsapp.config';
import {
  IWhatsAppCloudApiClient,
  whatsappCloudApiClient,
} from '../clients/whatsapp-cloud-api.client';
import { formatPhoneToE164 } from '../utils/phone-formatter';
import { SendMessageRequest, SendMessageResult } from '../types/send-message.interface';

/**
 * Interface for message sender service.
 * Defines contract for sending WhatsApp messages.
 */
export interface IMessageSenderService {
  /**
   * Sends a text message to a recipient via WhatsApp.
   * @param {string} phoneNumber - Recipient phone number (various formats accepted)
   * @param {string} message - Message text content
   * @returns {Promise<SendMessageResult>} Send result with message ID on success
   * @throws {AppError} If validation fails or message cannot be sent
   */
  sendTextMessage(phoneNumber: string, message: string): Promise<SendMessageResult>;
}

/**
 * WhatsApp message sender service.
 *
 * This service provides the main interface for sending WhatsApp messages
 * throughout the application. It handles:
 * - Message content validation (length limits, non-empty)
 * - Phone number formatting to E.164 standard
 * - Mock mode for development (logs messages without API calls)
 * - Integration with WhatsApp Cloud API client
 * - Error handling and structured result formatting
 *
 * @example
 * ```typescript
 * const sender = new MessageSenderService();
 *
 * // Send message in production mode
 * const result = await sender.sendTextMessage(
 *   '11999999999',
 *   'Your appointment is confirmed for tomorrow at 10:00 AM'
 * );
 *
 * if (result.success) {
 *   console.log('Message sent with ID:', result.messageId);
 * } else {
 *   console.error('Failed to send message:', result.error);
 * }
 * ```
 */
export class MessageSenderService implements IMessageSenderService {
  /**
   * Creates a new MessageSenderService instance.
   *
   * @param {IWhatsAppCloudApiClient} [apiClient] - WhatsApp Cloud API client (injectable for testing)
   */
  constructor(private readonly apiClient: IWhatsAppCloudApiClient = whatsappCloudApiClient) {}

  /**
   * Sends a text message to a recipient via WhatsApp.
   *
   * In production mode (WHATSAPP_MOCK=false):
   * - Formats phone number to E.164
   * - Validates message content
   * - Sends via WhatsApp Cloud API
   * - Returns message ID on success
   *
   * In mock mode (WHATSAPP_MOCK=true):
   * - Formats phone number to E.164
   * - Validates message content
   * - Logs message details without API call
   * - Returns mock success result
   *
   * @param {string} phoneNumber - Recipient phone number (accepts various formats)
   * @param {string} message - Message text content
   * @returns {Promise<SendMessageResult>} Send result with message ID on success
   * @throws {AppError} If validation fails
   *
   * @example
   * ```typescript
   * // Production mode
   * const result = await messageSender.sendTextMessage(
   *   '+5511999999999',
   *   'Hello from WhatsApp!'
   * );
   *
   * // Mock mode (WHATSAPP_MOCK=true)
   * const mockResult = await messageSender.sendTextMessage(
   *   '11999999999',
   *   'Test message'
   * );
   * // Logs: "MOCK: Sending WhatsApp message to +5511999999999: Test message"
   * ```
   */
  async sendTextMessage(phoneNumber: string, message: string): Promise<SendMessageResult> {
    // Validate message content
    this.validateMessage(message);

    // Format phone number to E.164
    let formattedPhone: string;
    try {
      formattedPhone = formatPhoneToE164(phoneNumber);
    } catch (error) {
      logger.warn(
        {
          phoneNumber,
          error: error instanceof Error ? error.message : String(error),
        },
        'Invalid phone number format'
      );
      throw error;
    }

    // Mock mode - log message without API call
    if (whatsappConfig.isMockMode) {
      logger.info(
        {
          to: formattedPhone,
          messagePreview: message.substring(0, 100),
          messageLength: message.length,
        },
        'MOCK: Sending WhatsApp message (no API call)'
      );

      return {
        success: true,
        messageId: `mock-${Date.now()}`,
        isMock: true,
      };
    }

    // Production mode - send via WhatsApp Cloud API
    try {
      const request: SendMessageRequest = {
        messaging_product: 'whatsapp',
        to: formattedPhone,
        type: 'text',
        text: {
          body: message,
        },
      };

      const response = await this.apiClient.sendMessage(request);

      logger.info(
        {
          to: formattedPhone,
          messageId: response.messages[0].id,
          messagePreview: message.substring(0, 100),
        },
        'WhatsApp message sent successfully'
      );

      return {
        success: true,
        messageId: response.messages[0].id,
        isMock: false,
      };
    } catch (error) {
      logger.error(
        {
          to: formattedPhone,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to send WhatsApp message'
      );

      // Return structured error result
      if (error instanceof WhatsAppApiError) {
        return {
          success: false,
          error: error.message,
          errorCode: error.statusCode,
          isMock: false,
        };
      }

      if (error instanceof AppError) {
        return {
          success: false,
          error: error.message,
          errorCode: error.statusCode,
          isMock: false,
        };
      }

      return {
        success: false,
        error: 'Unknown error while sending WhatsApp message',
        errorCode: 500,
        isMock: false,
      };
    }
  }

  /**
   * Validates message content.
   *
   * Checks:
   * - Message is not empty or whitespace-only
   * - Message length is within limits (1-4096 characters)
   *
   * @param {string} message - Message content to validate
   * @throws {AppError} If validation fails
   * @private
   */
  private validateMessage(message: string): void {
    if (typeof message !== 'string' || message === null || message === undefined) {
      throw new AppError('Message content is required', 400);
    }

    const trimmedMessage = message.trim();

    if (trimmedMessage.length < whatsappConfig.validation.minMessageLength) {
      throw new AppError('Message cannot be empty', 400);
    }

    if (trimmedMessage.length > whatsappConfig.validation.maxMessageLength) {
      throw new AppError(
        `Message exceeds maximum length of ${whatsappConfig.validation.maxMessageLength} characters`,
        400
      );
    }
  }
}

/**
 * Singleton message sender service instance.
 * Used throughout the application for sending WhatsApp messages.
 */
export const messageSenderService = new MessageSenderService();
