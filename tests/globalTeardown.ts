import { closeDatabase } from '../src/infrastructure/database/connection';
import { closeQueues } from '../src/infrastructure/queue/queues';

export default async function globalTeardown(): Promise<void> {
  console.warn('\n=== Jest Global Teardown ===');

  try {
    await closeQueues();
    console.warn('Queue connections closed');
  } catch (e) {
    // Ignore - queues may not have been initialized
  }

  try {
    await closeDatabase();
    console.warn('Database connection closed');
  } catch (e) {
    // Ignore - db may not have been initialized
  }

  console.warn('=== Global Teardown Complete ===\n');
}
