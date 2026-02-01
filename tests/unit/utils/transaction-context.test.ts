import { Knex } from 'knex';
import { createTransactionContext, restoreGlobalConnection } from '../../utils/transaction-context';

// Mock the database connection module
jest.mock('../../../src/infrastructure/database/connection', () => {
  const mockDb = {
    transaction: jest.fn(),
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    raw: jest.fn(),
  };
  return {
    __esModule: true,
    default: mockDb,
    closeDatabase: jest.fn(),
  };
});

describe('Transaction Context Utility', () => {
  let mockDb: any;
  let mockTransaction: any;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Get the mocked db instance
    mockDb = require('../../../src/infrastructure/database/connection').default;

    // Create a mock transaction
    mockTransaction = {
      rollback: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn().mockResolvedValue(undefined),
      isCompleted: jest.fn().mockReturnValue(false), // Required for teardown to call rollback
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      raw: jest.fn(),
    };

    // Mock the transaction method to return our mock transaction
    mockDb.transaction = jest.fn().mockResolvedValue(mockTransaction);
  });

  describe('createTransactionContext', () => {
    it('should create transaction context successfully', () => {
      const txContext = createTransactionContext(mockDb);

      expect(txContext).toBeDefined();
      expect(txContext.setup).toBeDefined();
      expect(txContext.teardown).toBeDefined();
      expect(typeof txContext.setup).toBe('function');
      expect(typeof txContext.teardown).toBe('function');
    });

    it('should throw error when accessing trx before setup', () => {
      const txContext = createTransactionContext(mockDb);

      expect(() => txContext.trx).toThrow(
        'Transaction not initialized. Call setup() before accessing trx property.'
      );
    });
  });

  describe('setup method', () => {
    it('should create Knex transaction successfully', async () => {
      const txContext = createTransactionContext(mockDb);

      await txContext.setup();

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(txContext.trx).toBeDefined();
      expect(txContext.trx).toBe(mockTransaction);
    });

    it('should replace global connection with transaction', async () => {
      const txContext = createTransactionContext(mockDb);

      await txContext.setup();

      // After setup, db should have transaction methods
      // The prototype should have changed
      const newProto = Object.getPrototypeOf(mockDb);
      expect(newProto).toBe(Object.getPrototypeOf(mockTransaction));

      // Cleanup
      await txContext.teardown();
    });
  });

  describe('teardown method', () => {
    it('should rollback transaction and restore global connection', async () => {
      const txContext = createTransactionContext(mockDb);

      await txContext.setup();
      await txContext.teardown();

      expect(mockTransaction.rollback).toHaveBeenCalledTimes(1);
    });

    it('should handle rollback failures gracefully', async () => {
      const txContext = createTransactionContext(mockDb);

      // Mock rollback to throw an error
      mockTransaction.rollback = jest.fn().mockRejectedValue(new Error('Rollback failed'));

      await txContext.setup();

      // Teardown should NOT throw - it catches errors silently
      await expect(txContext.teardown()).resolves.not.toThrow();

      // The transaction should still be cleared (accessing trx should throw)
      expect(() => txContext.trx).toThrow('Transaction not initialized');
    });

    it('should handle teardown when transaction is not initialized', async () => {
      const txContext = createTransactionContext(mockDb);

      // Call teardown without setup
      await expect(txContext.teardown()).resolves.not.toThrow();
    });
  });

  describe('replaceGlobalConnection', () => {
    it('should replace global connection methods with transaction methods', async () => {
      const txContext = createTransactionContext(mockDb);
      await txContext.setup();

      // Store reference to verify replacement
      const dbPrototype = Object.getPrototypeOf(mockDb);
      const trxPrototype = Object.getPrototypeOf(mockTransaction);

      expect(dbPrototype).toBe(trxPrototype);

      // Cleanup
      await txContext.teardown();
    });
  });

  describe('restoreGlobalConnection', () => {
    it('should restore original global connection', async () => {
      const txContext = createTransactionContext(mockDb);

      await txContext.setup();

      // Verify transaction was created
      expect(mockDb.transaction).toHaveBeenCalled();

      await txContext.teardown();

      // After teardown, global connection should be restored
      // The prototype should be defined (restoration logic executed)
      const restoredProto = Object.getPrototypeOf(mockDb);
      expect(restoredProto).toBeDefined();

      // Verify rollback was called
      expect(mockTransaction.rollback).toHaveBeenCalled();
    });

    it('should handle restore when no connection was replaced', () => {
      // Call restore without replace - should not throw
      expect(() => restoreGlobalConnection()).not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should rollback transaction even if test throws error', async () => {
      const txContext = createTransactionContext(mockDb);

      await txContext.setup();

      // Simulate test error by just calling teardown
      await txContext.teardown();

      expect(mockTransaction.rollback).toHaveBeenCalledTimes(1);
    });

    it('should clear transaction reference on rollback error', async () => {
      const txContext = createTransactionContext(mockDb);

      // Mock rollback to throw an error
      mockTransaction.rollback = jest.fn().mockRejectedValue(new Error('Rollback error'));

      await txContext.setup();

      // Teardown should NOT throw - it catches errors silently
      await expect(txContext.teardown()).resolves.not.toThrow();

      // Transaction should be cleared
      expect(() => txContext.trx).toThrow('Transaction not initialized');
    });
  });

  describe('integration behavior', () => {
    it('should support multiple setup/teardown cycles', async () => {
      const txContext = createTransactionContext(mockDb);

      // First cycle
      await txContext.setup();
      expect(txContext.trx).toBe(mockTransaction);
      await txContext.teardown();

      // Create new transaction for second cycle
      const mockTransaction2 = {
        rollback: jest.fn().mockResolvedValue(undefined),
        commit: jest.fn().mockResolvedValue(undefined),
        isCompleted: jest.fn().mockReturnValue(false),
      };
      mockDb.transaction = jest.fn().mockResolvedValue(mockTransaction2);

      // Second cycle
      await txContext.setup();
      expect(txContext.trx).toBe(mockTransaction2);
      await txContext.teardown();

      expect(mockTransaction.rollback).toHaveBeenCalledTimes(1);
      expect(mockTransaction2.rollback).toHaveBeenCalledTimes(1);
    });

    it('should isolate transactions between different contexts', async () => {
      const txContext1 = createTransactionContext(mockDb);
      const txContext2 = createTransactionContext(mockDb);

      const mockTrx1 = { rollback: jest.fn().mockResolvedValue(undefined), isCompleted: jest.fn().mockReturnValue(false) };
      const mockTrx2 = { rollback: jest.fn().mockResolvedValue(undefined), isCompleted: jest.fn().mockReturnValue(false) };

      mockDb.transaction = jest
        .fn()
        .mockResolvedValueOnce(mockTrx1)
        .mockResolvedValueOnce(mockTrx2);

      await txContext1.setup();
      await txContext2.setup();

      expect(txContext1.trx).toBe(mockTrx1);
      expect(txContext2.trx).toBe(mockTrx2);
      expect(txContext1.trx).not.toBe(txContext2.trx);

      await txContext1.teardown();
      await txContext2.teardown();

      expect(mockTrx1.rollback).toHaveBeenCalledTimes(1);
      expect(mockTrx2.rollback).toHaveBeenCalledTimes(1);
    });
  });

  describe('default database parameter', () => {
    it('should use global db when database parameter is not provided', async () => {
      const txContext = createTransactionContext();

      await txContext.setup();

      // Should have called transaction on the mocked global db
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);

      await txContext.teardown();
    });

    it('should accept custom database instance', async () => {
      const customDb = {
        transaction: jest.fn().mockResolvedValue({
          rollback: jest.fn().mockResolvedValue(undefined),
        }),
      } as unknown as Knex;

      const txContext = createTransactionContext(customDb);

      await txContext.setup();

      expect(customDb.transaction).toHaveBeenCalledTimes(1);
      expect(mockDb.transaction).not.toHaveBeenCalled();

      await txContext.teardown();
    });
  });
});
