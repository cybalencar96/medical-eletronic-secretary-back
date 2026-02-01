import { Knex } from 'knex';
import db from '../../src/infrastructure/database/connection';

/**
 * Transaction context interface for test isolation
 * Wraps database operations in a transaction that can be rolled back
 */
export interface TransactionContext {
  /**
   * Knex transaction instance
   * Use this transaction in place of the global db connection during tests
   */
  trx: Knex.Transaction;

  /**
   * Setup method that creates the transaction
   * Should be called in beforeEach or at the start of each test
   */
  setup(): Promise<void>;

  /**
   * Teardown method that rolls back the transaction
   * Should be called in afterEach or at the end of each test
   * Ensures all database changes are rolled back automatically
   */
  teardown(): Promise<void>;
}

/**
 * Active transaction reference for the current test
 * Used by getTestDb() to return either the transaction or the global db
 */
let activeTransaction: Knex.Transaction | null = null;

/**
 * Gets the current database connection for tests
 * Returns the active transaction if one exists, otherwise returns the global db
 *
 * @returns Knex instance (transaction or global connection)
 */
export function getTestDb(): Knex | Knex.Transaction {
  return activeTransaction || db;
}

/**
 * Creates a transaction context for test isolation
 * Enables automatic rollback of database changes after each test
 *
 * @param database - Knex instance to create transaction from (defaults to global db)
 * @returns TransactionContext object with setup and teardown methods
 *
 * @example
 * ```typescript
 * describe('Repository tests', () => {
 *   let txContext: TransactionContext;
 *
 *   beforeEach(async () => {
 *     txContext = createTransactionContext();
 *     await txContext.setup();
 *   });
 *
 *   afterEach(async () => {
 *     await txContext.teardown();
 *   });
 *
 *   it('should create appointment', async () => {
 *     const repository = new AppointmentRepository(getTestDb());
 *     const appointment = await repository.create({ ... });
 *     // Appointment will be rolled back automatically
 *   });
 * });
 * ```
 */
export function createTransactionContext(database: Knex = db): TransactionContext {
  let transaction: Knex.Transaction | null = null;

  return {
    get trx(): Knex.Transaction {
      if (!transaction) {
        throw new Error('Transaction not initialized. Call setup() before accessing trx property.');
      }
      return transaction;
    },

    async setup(): Promise<void> {
      // Create a new transaction
      transaction = await database.transaction();
      // Set as the active transaction for getTestDb()
      activeTransaction = transaction;
    },

    async teardown(): Promise<void> {
      try {
        // Rollback the transaction if it exists and is not completed
        if (transaction && !transaction.isCompleted()) {
          await transaction.rollback();
        }
      } catch (error) {
        // Ignore rollback errors (transaction may already be complete)
        // eslint-disable-next-line no-console
        console.warn('Transaction rollback warning:', error);
      } finally {
        // Clear the active transaction
        activeTransaction = null;
        transaction = null;
      }
    },
  };
}

// Legacy exports for backwards compatibility
export function replaceGlobalConnection(_trx: Knex.Transaction): void {
  // No-op for backwards compatibility
  // Use getTestDb() instead
}

export function restoreGlobalConnection(): void {
  // No-op for backwards compatibility
}
