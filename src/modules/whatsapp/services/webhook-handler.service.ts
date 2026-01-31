import { logger } from '../../../infrastructure/config/logger';
import { queueService } from '../../../infrastructure/queue/queue.service';
import { AppError } from '../../../shared/errors/AppError';
import { WhatsAppWebhookPayload, WhatsAppMessage } from '../types/webhook-payload.interface';
import { WhatsAppMessageJob } from '../types/message-job.interface';

/**
 * Interface for webhook handler service.
 * Defines contract for processing WhatsApp webhook payloads.
 */
export interface IWebhookHandlerService {
  /**
   * Processes incoming WhatsApp webhook payload.
   * @param {WhatsAppWebhookPayload} payload - Webhook payload from WhatsApp Cloud API
   * @param {string} correlationId - Request correlation ID for tracing
   * @returns {Promise<void>}
   */
  processWebhook(payload: WhatsAppWebhookPayload, correlationId: string): Promise<void>;
}

/**
 * Service for handling WhatsApp webhook payloads.
 *
 * This service is responsible for:
 * - Parsing the nested WhatsApp Cloud API webhook payload structure
 * - Extracting message data (text, sender, timestamp, etc.)
 * - Publishing extracted messages to BullMQ for asynchronous processing
 * - Handling edge cases (empty messages, status updates, non-text messages)
 *
 * The WhatsApp Cloud API sends webhook payloads with a nested structure:
 * payload.entry[].changes[].value.messages[]
 *
 * @example
 * ```typescript
 * const service = new WebhookHandlerService();
 * await service.processWebhook(webhookPayload, 'req-123');
 * ```
 */
export class WebhookHandlerService implements IWebhookHandlerService {
  /**
   * Processes incoming WhatsApp webhook payload.
   *
   * Extracts messages from the nested payload structure and publishes them
   * to the BullMQ queue for asynchronous processing. Handles various message
   * types but currently only processes text messages.
   *
   * @param {WhatsAppWebhookPayload} payload - Webhook payload from WhatsApp Cloud API
   * @param {string} correlationId - Request correlation ID for tracing
   * @returns {Promise<void>}
   * @throws {AppError} If payload structure is invalid or queue publishing fails
   *
   * @example
   * ```typescript
   * await webhookHandler.processWebhook({
   *   object: 'whatsapp_business_account',
   *   entry: [{
   *     id: '123',
   *     changes: [{
   *       field: 'messages',
   *       value: {
   *         messaging_product: 'whatsapp',
   *         metadata: { phone_number_id: '456', display_phone_number: '5511999999999' },
   *         messages: [{
   *           id: 'wamid.123',
   *           from: '5511888888888',
   *           timestamp: '1705318200',
   *           type: 'text',
   *           text: { body: 'Hello' }
   *         }]
   *       }
   *     }]
   *   }]
   * }, 'req-abc-123');
   * ```
   */
  async processWebhook(payload: WhatsAppWebhookPayload, correlationId: string): Promise<void> {
    logger.info(
      {
        correlationId,
        object: payload.object,
        entryCount: payload.entry?.length || 0,
      },
      'Processing WhatsApp webhook payload'
    );

    // Validate payload structure
    if (!payload.entry || payload.entry.length === 0) {
      logger.warn(
        {
          correlationId,
          payload,
        },
        'Webhook payload has no entries'
      );
      return; // Not an error - some webhooks may be status updates only
    }

    // Process each entry in the webhook payload
    for (const entry of payload.entry) {
      if (!entry.changes || entry.changes.length === 0) {
        logger.debug(
          {
            correlationId,
            entryId: entry.id,
          },
          'Entry has no changes'
        );
        continue;
      }

      // Process each change in the entry
      for (const change of entry.changes) {
        // Only process message-related changes
        if (change.field !== 'messages') {
          logger.debug(
            {
              correlationId,
              field: change.field,
            },
            'Skipping non-message change'
          );
          continue;
        }

        const value = change.value;

        // Process status updates (delivery receipts, read receipts)
        if (value.statuses && value.statuses.length > 0) {
          logger.debug(
            {
              correlationId,
              statusCount: value.statuses.length,
            },
            'Received message status updates - skipping (not implemented yet)'
          );
        }

        // Process incoming messages
        if (!value.messages || value.messages.length === 0) {
          continue;
        }

        const phoneNumberId = value.metadata.phone_number_id;

        // Extract and publish each message
        for (const message of value.messages) {
          await this.processMessage(message, phoneNumberId, correlationId);
        }
      }
    }
  }

  /**
   * Processes a single WhatsApp message and publishes it to the queue.
   *
   * Currently only processes text messages. Other message types (image, video, etc.)
   * are logged and skipped for future implementation.
   *
   * @param {WhatsAppMessage} message - Individual message from webhook payload
   * @param {string} phoneNumberId - Phone number ID that received the message
   * @param {string} correlationId - Request correlation ID for tracing
   * @returns {Promise<void>}
   * @throws {AppError} If message structure is invalid or queue publishing fails
   */
  private async processMessage(
    message: WhatsAppMessage,
    phoneNumberId: string,
    correlationId: string
  ): Promise<void> {
    logger.debug(
      {
        correlationId,
        messageId: message.id,
        type: message.type,
        from: message.from,
      },
      'Processing individual message'
    );

    // Currently only handle text messages
    if (message.type !== 'text') {
      logger.info(
        {
          correlationId,
          messageId: message.id,
          type: message.type,
        },
        'Skipping non-text message (not implemented yet)'
      );
      return;
    }

    // Validate text message structure
    if (!message.text || !message.text.body) {
      logger.warn(
        {
          correlationId,
          messageId: message.id,
        },
        'Text message has no body'
      );
      throw new AppError('Invalid message structure - missing text body', 400);
    }

    // Convert Unix timestamp to ISO 8601
    const timestamp = new Date(parseInt(message.timestamp) * 1000).toISOString();

    // Create queue job
    const job: WhatsAppMessageJob = {
      messageId: message.id,
      from: message.from,
      text: message.text.body,
      timestamp,
      phoneNumberId,
      correlationId,
    };

    // Publish to queue
    try {
      await queueService.publishMessage(job);

      logger.info(
        {
          correlationId,
          messageId: message.id,
          from: message.from,
          textPreview: message.text.body.substring(0, 50),
        },
        'Message published to queue successfully'
      );
    } catch (error) {
      logger.error(
        {
          error,
          correlationId,
          messageId: message.id,
        },
        'Failed to publish message to queue'
      );
      throw new AppError('Failed to queue message for processing', 500, false);
    }
  }
}

/**
 * Singleton webhook handler service instance.
 * Used throughout the application for webhook processing.
 */
export const webhookHandlerService = new WebhookHandlerService();
