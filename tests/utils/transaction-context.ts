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
   * Setup method that replaces the global database connection with the transaction
   * Should be called in beforeEach or at the start of each test
   */
  setup(): Promise<void>;

  /**
   * Teardown method that rolls back the transaction and restores the global connection
   * Should be called in afterEach or at the end of each test
   * Ensures all database changes are rolled back automatically
   */
  teardown(): Promise<void>;
}

/**
 * Store the original global connection for restoration
 * This allows us to swap the connection during tests
 */
let originalConnection: Knex | null = null;

/**
 * Replaces the global database connection with a transaction
 * This enables all code using the global 'db' import to use the transaction instead
 *
 * @param trx - Knex transaction to use as the global connection
 *
 * @internal
 */
export function replaceGlobalConnection(trx: Knex.Transaction): void {
  // Store the original connection if not already stored
  if (originalConnection === null) {
    originalConnection = db;
  }

  // Replace all query methods with transaction methods
  // This is a type-safe way to replace the connection
  Object.setPrototypeOf(db, Object.getPrototypeOf(trx));
  Object.assign(db, trx);
}

/**
 * Restores the original global database connection
 * Should be called after rolling back the transaction
 *
 * @internal
 */
export function restoreGlobalConnection(): void {
  if (originalConnection === null) {
    return;
  }

  // Restore the original connection
  Object.setPrototypeOf(db, Object.getPrototypeOf(originalConnection));
  Object.assign(db, originalConnection);

  // Clear the stored reference
  originalConnection = null;
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
 *     txContext = await createTransactionContext();
 *     await txContext.setup();
 *   });
 *
 *   afterEach(async () => {
 *     await txContext.teardown();
 *   });
 *
 *   it('should create appointment', async () => {
 *     const repository = new AppointmentRepository();
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

      // Replace the global connection with this transaction
      replaceGlobalConnection(transaction);
    },

    async teardown(): Promise<void> {
      try {
        // Restore the global connection first
        restoreGlobalConnection();

        // Rollback the transaction if it exists
        if (transaction) {
          await transaction.rollback();
          transaction = null;
        }
      } catch (error) {
        // Ensure transaction is cleared even if rollback fails
        transaction = null;
        // Re-throw to make test failures visible
        throw error;
      }
    },
  };
}
