import { Queue } from 'bullmq';
import { initializeQueues, closeQueues, queues } from '../../../../src/infrastructure/queue/queues';
import { QUEUE_NAMES } from '../../../../src/infrastructure/queue/types';

// Mock BullMQ
jest.mock('bullmq');

describe('Queue Infrastructure', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initializeQueues', () => {
    it('should create queue instances for all queue types', () => {
      const queueInstances = initializeQueues();

      expect(queueInstances.whatsappMessages).toBeInstanceOf(Queue);
      expect(queueInstances.intentClassification).toBeInstanceOf(Queue);
      expect(queueInstances.notifications).toBeInstanceOf(Queue);
      expect(queueInstances.escalations).toBeInstanceOf(Queue);
    });

    it('should initialize queues with correct names', () => {
      const MockedQueue = Queue as jest.MockedClass<typeof Queue>;
      MockedQueue.mockClear();

      initializeQueues();

      expect(MockedQueue).toHaveBeenCalledWith(
        QUEUE_NAMES.WHATSAPP_MESSAGES,
        expect.any(Object)
      );
      expect(MockedQueue).toHaveBeenCalledWith(
        QUEUE_NAMES.INTENT_CLASSIFICATION,
        expect.any(Object)
      );
      expect(MockedQueue).toHaveBeenCalledWith(QUEUE_NAMES.NOTIFICATIONS, expect.any(Object));
      expect(MockedQueue).toHaveBeenCalledWith(QUEUE_NAMES.ESCALATIONS, expect.any(Object));
    });

    it('should configure queues with retry and backoff settings', () => {
      const MockedQueue = Queue as jest.MockedClass<typeof Queue>;
      MockedQueue.mockClear();

      initializeQueues();

      const queueConfig = MockedQueue.mock.calls[0][1]!;
      expect(queueConfig).toHaveProperty('connection');
      expect(queueConfig).toHaveProperty('defaultJobOptions');
      expect(queueConfig.defaultJobOptions).toHaveProperty('attempts', 3);
      expect(queueConfig.defaultJobOptions).toHaveProperty('backoff', {
        type: 'exponential',
        delay: 2000,
      });
    });

    it('should configure job retention policies', () => {
      const MockedQueue = Queue as jest.MockedClass<typeof Queue>;
      MockedQueue.mockClear();

      initializeQueues();

      const queueConfig = MockedQueue.mock.calls[0][1]!;
      expect(queueConfig.defaultJobOptions).toHaveProperty('removeOnComplete', {
        age: 3600,
        count: 1000,
      });
      expect(queueConfig.defaultJobOptions).toHaveProperty('removeOnFail', {
        age: 86400,
      });
    });
  });

  describe('closeQueues', () => {
    it('should close all queue connections', async () => {
      const mockClose = jest.fn().mockResolvedValue(undefined);

      queues.whatsappMessages.close = mockClose;
      queues.intentClassification.close = mockClose;
      queues.notifications.close = mockClose;
      queues.escalations.close = mockClose;

      await closeQueues();

      expect(mockClose).toHaveBeenCalledTimes(4);
    });

    it('should handle errors during queue closure', async () => {
      const mockCloseSuccess = jest.fn().mockResolvedValue(undefined);
      const mockCloseError = jest.fn().mockRejectedValue(new Error('Close failed'));

      queues.whatsappMessages.close = mockCloseSuccess;
      queues.intentClassification.close = mockCloseError;
      queues.notifications.close = mockCloseSuccess;
      queues.escalations.close = mockCloseSuccess;

      // Should not throw, Promise.all will collect rejections
      await expect(closeQueues()).rejects.toThrow('Close failed');
    });
  });

  describe('Singleton queues', () => {
    it('should export singleton queue instances', () => {
      expect(queues).toBeDefined();
      expect(queues.whatsappMessages).toBeDefined();
      expect(queues.intentClassification).toBeDefined();
      expect(queues.notifications).toBeDefined();
      expect(queues.escalations).toBeDefined();
    });

    it('should be the same instance across imports', () => {
      const queues1 = require('../../../../src/infrastructure/queue/queues').queues;
      const queues2 = require('../../../../src/infrastructure/queue/queues').queues;

      expect(queues1).toBe(queues2);
    });
  });
});
