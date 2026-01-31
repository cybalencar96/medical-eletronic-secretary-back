/**
 * BullMQ queue infrastructure module.
 *
 * This module provides the complete queue infrastructure for the application,
 * including queue instances, worker registration, and graceful shutdown handling.
 *
 * @example
 * ```typescript
 * // Publishing jobs to queues
 * import { queues } from '@/infrastructure/queue';
 *
 * await queues.whatsappMessages.add('process-message', jobData);
 *
 * // Registering workers
 * import { registerWorkers } from '@/infrastructure/queue';
 *
 * registerWorkers({
 *   whatsappMessages: async (job) => {
 *     // Process job
 *   }
 * });
 *
 * // Graceful shutdown
 * import { shutdown } from '@/infrastructure/queue';
 *
 * process.on('SIGTERM', async () => {
 *   await shutdown();
 * });
 * ```
 */

export * from './types';
export * from './connection';
export * from './queues';
export * from './workers';
export * from './board';

import { closeQueues } from './queues';
import { closeWorkers } from './workers';
import { logger } from '../config/logger';

/**
 * Performs graceful shutdown of all queue infrastructure.
 * Closes workers first (to stop accepting new jobs), then closes queues.
 *
 * @param timeoutMs - Maximum time to wait for shutdown (default: 30000ms)
 * @returns Promise that resolves when shutdown is complete
 *
 * @example
 * ```typescript
 * process.on('SIGTERM', async () => {
 *   await shutdown();
 *   process.exit(0);
 * });
 * ```
 */
export async function shutdown(timeoutMs: number = 30000): Promise<void> {
  logger.info('Starting graceful shutdown of queue infrastructure...');

  try {
    // Close workers first to stop processing new jobs
    await closeWorkers(timeoutMs);

    // Then close queue connections
    await closeQueues();

    logger.info('Queue infrastructure shutdown completed successfully');
  } catch (error) {
    logger.error(
      {
        error,
      },
      'Error during queue infrastructure shutdown'
    );
    throw error;
  }
}
