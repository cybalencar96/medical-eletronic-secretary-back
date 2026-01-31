import { Queue } from 'bullmq';
import { redisConnection } from './connection';
import { logger } from '../config/logger';
import {
  QUEUE_NAMES,
  QUEUE_CONFIGS,
  WhatsAppMessageJob,
  IntentClassificationJob,
  NotificationJob,
  EscalationJob,
} from './types';

/**
 * Type-safe queue instances for all application queues.
 * Each queue is typed with its specific job data interface.
 */
export interface Queues {
  whatsappMessages: Queue<WhatsAppMessageJob>;
  intentClassification: Queue<IntentClassificationJob>;
  notifications: Queue<NotificationJob>;
  escalations: Queue<EscalationJob>;
}

/**
 * Creates a new BullMQ queue with standardized configuration.
 *
 * @param queueName - Name of the queue to create
 * @returns Configured BullMQ queue instance
 *
 * @example
 * ```typescript
 * const messageQueue = createQueue<WhatsAppMessageJob>(QUEUE_NAMES.WHATSAPP_MESSAGES);
 * ```
 */
function createQueue<T>(queueName: string): Queue<T> {
  const config = QUEUE_CONFIGS[queueName as keyof typeof QUEUE_CONFIGS];

  const queue = new Queue<T>(queueName, {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: config.attempts,
      backoff: {
        type: 'exponential',
        delay: config.backoffDelay,
      },
      removeOnComplete: {
        age: 3600, // 1 hour in seconds
        count: 1000, // Keep last 1000 completed jobs
      },
      removeOnFail: {
        age: 86400, // 24 hours in seconds
      },
    },
  });

  logger.info(
    {
      queue: queueName,
      config: {
        attempts: config.attempts,
        backoffDelay: config.backoffDelay,
        timeout: config.timeout,
      },
    },
    'Queue initialized'
  );

  return queue;
}

/**
 * Initializes and returns all application queues.
 *
 * @returns Object containing all typed queue instances
 *
 * @example
 * ```typescript
 * const queues = initializeQueues();
 * await queues.whatsappMessages.add('process-message', jobData);
 * ```
 */
export function initializeQueues(): Queues {
  return {
    whatsappMessages: createQueue<WhatsAppMessageJob>(QUEUE_NAMES.WHATSAPP_MESSAGES),
    intentClassification: createQueue<IntentClassificationJob>(QUEUE_NAMES.INTENT_CLASSIFICATION),
    notifications: createQueue<NotificationJob>(QUEUE_NAMES.NOTIFICATIONS),
    escalations: createQueue<EscalationJob>(QUEUE_NAMES.ESCALATIONS),
  };
}

/**
 * Singleton queue instances for use throughout the application.
 */
export const queues = initializeQueues();

/**
 * Gracefully closes all queue connections.
 * Should be called during application shutdown.
 *
 * @returns Promise that resolves when all queues are closed
 *
 * @example
 * ```typescript
 * process.on('SIGTERM', async () => {
 *   await closeQueues();
 *   process.exit(0);
 * });
 * ```
 */
export async function closeQueues(): Promise<void> {
  logger.info('Closing all queue connections...');

  await Promise.all([
    queues.whatsappMessages.close(),
    queues.intentClassification.close(),
    queues.notifications.close(),
    queues.escalations.close(),
  ]);

  logger.info('All queue connections closed successfully');
}
