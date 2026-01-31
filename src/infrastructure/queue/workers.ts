import { Worker, Job } from 'bullmq';
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
 * Type for job processor functions.
 * Each processor receives a BullMQ job and processes it asynchronously.
 */
export type JobProcessor<T> = (job: Job<T>) => Promise<void>;

/**
 * Worker processor functions for all queue types.
 * These functions are called when jobs are dequeued for processing.
 */
export interface WorkerProcessors {
  whatsappMessages?: JobProcessor<WhatsAppMessageJob>;
  intentClassification?: JobProcessor<IntentClassificationJob>;
  notifications?: JobProcessor<NotificationJob>;
  escalations?: JobProcessor<EscalationJob>;
}

/**
 * Active worker instances.
 * Stored to enable graceful shutdown.
 */
let workers: Worker[] = [];

/**
 * Default no-op processor that logs unimplemented job types.
 * Used as a placeholder when no processor is registered for a queue.
 *
 * @param job - BullMQ job to process
 */
function defaultProcessor<T>(job: Job<T>): Promise<void> {
  logger.warn(
    {
      queue: job.queueName,
      jobId: job.id,
      jobData: job.data,
    },
    'No processor registered for queue - job will be marked as complete without processing'
  );
  return Promise.resolve();
}

/**
 * Creates a BullMQ worker with error handling and logging.
 *
 * @param queueName - Name of the queue to process
 * @param processor - Job processor function
 * @returns Configured BullMQ worker instance
 *
 * @example
 * ```typescript
 * const worker = createWorker(
 *   QUEUE_NAMES.WHATSAPP_MESSAGES,
 *   async (job) => {
 *     logger.info({ jobId: job.id }, 'Processing message');
 *     // Process job...
 *   }
 * );
 * ```
 */
function createWorker<T>(queueName: string, processor: JobProcessor<T>): Worker<T> {
  const config = QUEUE_CONFIGS[queueName as keyof typeof QUEUE_CONFIGS];

  const worker = new Worker<T>(
    queueName,
    async (job: Job<T>) => {
      const startTime = Date.now();

      try {
        logger.info(
          {
            queue: queueName,
            jobId: job.id,
            attemptsMade: job.attemptsMade,
          },
          'Processing job'
        );

        await processor(job);

        const duration = Date.now() - startTime;
        logger.info(
          {
            queue: queueName,
            jobId: job.id,
            durationMs: duration,
          },
          'Job completed successfully'
        );
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(
          {
            error,
            queue: queueName,
            jobId: job.id,
            attemptsMade: job.attemptsMade,
            durationMs: duration,
          },
          'Job processing failed'
        );
        throw error;
      }
    },
    {
      connection: redisConnection,
      concurrency: config.concurrency,
      limiter: {
        max: config.concurrency * 2, // Allow some burst capacity
        duration: 1000, // Per second
      },
    }
  );

  // Worker event handlers
  worker.on('completed', (job: Job<T>) => {
    logger.debug(
      {
        queue: queueName,
        jobId: job.id,
      },
      'Worker completed job'
    );
  });

  worker.on('failed', (job: Job<T> | undefined, error: Error) => {
    logger.error(
      {
        error,
        queue: queueName,
        jobId: job?.id,
        attemptsMade: job?.attemptsMade,
      },
      'Worker failed to process job'
    );
  });

  worker.on('error', (error: Error) => {
    logger.error(
      {
        error,
        queue: queueName,
      },
      'Worker error occurred'
    );
  });

  logger.info(
    {
      queue: queueName,
      concurrency: config.concurrency,
    },
    'Worker initialized'
  );

  return worker;
}

/**
 * Registers workers for all queues with their processor functions.
 *
 * @param processors - Object containing processor functions for each queue
 * @returns Array of active worker instances
 *
 * @example
 * ```typescript
 * const workers = registerWorkers({
 *   whatsappMessages: async (job) => {
 *     // Process WhatsApp message
 *   },
 *   intentClassification: async (job) => {
 *     // Classify intent using OpenAI
 *   },
 *   notifications: async (job) => {
 *     // Send notification
 *   },
 *   escalations: async (job) => {
 *     // Handle escalation
 *   },
 * });
 * ```
 */
export function registerWorkers(processors: WorkerProcessors): Worker[] {
  logger.info('Registering queue workers...');

  workers = [
    createWorker<WhatsAppMessageJob>(
      QUEUE_NAMES.WHATSAPP_MESSAGES,
      processors.whatsappMessages || defaultProcessor
    ),
    createWorker<IntentClassificationJob>(
      QUEUE_NAMES.INTENT_CLASSIFICATION,
      processors.intentClassification || defaultProcessor
    ),
    createWorker<NotificationJob>(
      QUEUE_NAMES.NOTIFICATIONS,
      processors.notifications || defaultProcessor
    ),
    createWorker<EscalationJob>(
      QUEUE_NAMES.ESCALATIONS,
      processors.escalations || defaultProcessor
    ),
  ];

  logger.info({ workerCount: workers.length }, 'All workers registered successfully');

  return workers;
}

/**
 * Gracefully closes all workers and waits for active jobs to complete.
 * Should be called during application shutdown.
 *
 * @param timeoutMs - Maximum time to wait for jobs to complete (default: 30000ms)
 * @returns Promise that resolves when all workers are closed
 *
 * @example
 * ```typescript
 * process.on('SIGTERM', async () => {
 *   await closeWorkers();
 *   process.exit(0);
 * });
 * ```
 */
export async function closeWorkers(timeoutMs: number = 30000): Promise<void> {
  if (workers.length === 0) {
    logger.info('No workers to close');
    return;
  }

  logger.info(
    {
      workerCount: workers.length,
      timeoutMs,
    },
    'Closing workers gracefully...'
  );

  try {
    // Close all workers with timeout
    await Promise.race([
      Promise.all(workers.map((worker) => worker.close())),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Worker shutdown timeout')), timeoutMs)
      ),
    ]);

    logger.info('All workers closed successfully');
    workers = [];
  } catch (error) {
    logger.error(
      {
        error,
        workerCount: workers.length,
      },
      'Error closing workers - forcing shutdown'
    );

    // Force close if graceful shutdown fails
    await Promise.all(workers.map((worker) => worker.close()));
    workers = [];
  }
}

/**
 * Gets the currently active workers.
 * Useful for testing and monitoring.
 *
 * @returns Array of active worker instances
 */
export function getActiveWorkers(): Worker[] {
  return workers;
}
