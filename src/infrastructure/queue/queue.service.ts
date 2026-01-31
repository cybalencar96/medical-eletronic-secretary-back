import { logger } from '../config/logger';
import { queues } from './queues';
import { WhatsAppMessageJob, QUEUE_NAMES } from './types';

/**
 * BullMQ Queue Service for WhatsApp message processing.
 *
 * This service provides a high-level API for publishing jobs to queues.
 * It wraps the underlying BullMQ queue infrastructure for ease of use.
 *
 * @deprecated This service is maintained for backward compatibility.
 * New code should use the queue instances from './queues' directly.
 *
 * @example
 * ```typescript
 * import { queueService } from './infrastructure/queue/queue.service';
 *
 * await queueService.publishMessage({
 *   messageId: '123',
 *   from: '5511999999999',
 *   text: 'Hello',
 *   timestamp: new Date().toISOString(),
 *   phoneNumberId: 'phone_id',
 *   correlationId: 'req-123'
 * });
 * ```
 */
export class QueueService {
  /**
   * Creates a new QueueService instance.
   * Uses the shared queue infrastructure from './queues'.
   */
  constructor() {
    logger.info('QueueService initialized (using shared queue infrastructure)');
  }

  /**
   * Publishes a WhatsApp message job to the queue for asynchronous processing.
   *
   * @param {WhatsAppMessageJob} jobData - Message data to process
   * @returns {Promise<void>}
   * @throws {Error} If queue publishing fails
   *
   * @example
   * ```typescript
   * await queueService.publishMessage({
   *   messageId: 'wamid.123',
   *   from: '5511999999999',
   *   text: 'Quero marcar uma consulta',
   *   timestamp: '2024-01-15T10:30:00Z',
   *   phoneNumberId: '123456789',
   *   correlationId: 'req-abc-123'
   * });
   * ```
   */
  async publishMessage(jobData: WhatsAppMessageJob): Promise<void> {
    try {
      await queues.whatsappMessages.add('process-message', jobData, {
        jobId: jobData.messageId, // Use message ID as job ID to prevent duplicates
      });

      logger.info(
        {
          messageId: jobData.messageId,
          from: jobData.from,
          correlationId: jobData.correlationId,
        },
        'Message published to queue'
      );
    } catch (error) {
      logger.error(
        {
          error,
          messageId: jobData.messageId,
          correlationId: jobData.correlationId,
        },
        'Failed to publish message to queue'
      );
      throw error;
    }
  }

  /**
   * Gracefully closes the queue connection.
   * Should be called during application shutdown.
   *
   * @deprecated Use closeQueues() from './queues' instead.
   * @returns {Promise<void>}
   */
  async close(): Promise<void> {
    await queues.whatsappMessages.close();
    logger.info({ queue: QUEUE_NAMES.WHATSAPP_MESSAGES }, 'Queue connection closed');
  }

  /**
   * Gets the underlying BullMQ queue instance.
   * Useful for advanced queue operations or testing.
   *
   * @deprecated Access queues directly from './queues' instead.
   * @returns {Queue<WhatsAppMessageJob>}
   */
  getQueue() {
    return queues.whatsappMessages;
  }
}

/**
 * Singleton queue service instance.
 * Used throughout the application for message publishing.
 */
export const queueService = new QueueService();
