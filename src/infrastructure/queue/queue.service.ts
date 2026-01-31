import { Queue } from 'bullmq';
import { env } from '../config/env';
import { logger } from '../config/logger';
import {
  WhatsAppMessageJob,
  WHATSAPP_QUEUE_NAME,
} from '../../modules/whatsapp/types/message-job.interface';

/**
 * BullMQ Queue Service for WhatsApp message processing.
 *
 * This service manages the BullMQ queue infrastructure for asynchronous
 * message processing. It provides methods to publish jobs to the queue
 * and handles Redis connection configuration.
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
  private whatsappQueue: Queue<WhatsAppMessageJob>;

  /**
   * Creates a new QueueService instance.
   * Initializes the BullMQ queue with Redis connection settings from environment.
   */
  constructor() {
    // Configure Redis connection from environment variables
    const redisConfig = {
      host: env.REDIS_HOST || 'localhost',
      port: env.REDIS_PORT || 6379,
      password: env.REDIS_PASSWORD,
    };

    // Initialize WhatsApp messages queue
    this.whatsappQueue = new Queue<WhatsAppMessageJob>(WHATSAPP_QUEUE_NAME, {
      connection: redisConfig,
      defaultJobOptions: {
        attempts: 3, // Retry failed jobs up to 3 times
        backoff: {
          type: 'exponential',
          delay: 2000, // Start with 2 second delay, doubles each retry
        },
        removeOnComplete: {
          age: 24 * 3600, // Keep completed jobs for 24 hours
          count: 1000, // Keep last 1000 completed jobs
        },
        removeOnFail: {
          age: 7 * 24 * 3600, // Keep failed jobs for 7 days
        },
      },
    });

    logger.info(
      {
        queue: WHATSAPP_QUEUE_NAME,
        redis: { host: redisConfig.host, port: redisConfig.port },
      },
      'WhatsApp queue initialized'
    );
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
      await this.whatsappQueue.add('process-message', jobData, {
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
   * @returns {Promise<void>}
   */
  async close(): Promise<void> {
    await this.whatsappQueue.close();
    logger.info({ queue: WHATSAPP_QUEUE_NAME }, 'Queue connection closed');
  }

  /**
   * Gets the underlying BullMQ queue instance.
   * Useful for advanced queue operations or testing.
   *
   * @returns {Queue<WhatsAppMessageJob>}
   */
  getQueue(): Queue<WhatsAppMessageJob> {
    return this.whatsappQueue;
  }
}

/**
 * Singleton queue service instance.
 * Used throughout the application for message publishing.
 */
export const queueService = new QueueService();
