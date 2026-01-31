import { Worker, Job } from 'bullmq';
import {
  registerWorkers,
  closeWorkers,
  getActiveWorkers,
  JobProcessor,
} from '../../../../src/infrastructure/queue/workers';
import { QUEUE_NAMES, WhatsAppMessageJob } from '../../../../src/infrastructure/queue/types';

// Mock BullMQ
jest.mock('bullmq');

describe('Queue Workers', () => {
  const mockProcessor: JobProcessor<WhatsAppMessageJob> = jest
    .fn()
    .mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await closeWorkers();
  });

  describe('registerWorkers', () => {
    it('should create workers for all queue types', () => {
      const workers = registerWorkers({
        whatsappMessages: mockProcessor,
      });

      expect(workers).toHaveLength(4);
      expect(Worker).toHaveBeenCalledTimes(4);
    });

    it('should register workers with correct queue names', () => {
      const MockedWorker = Worker as jest.MockedClass<typeof Worker>;
      MockedWorker.mockClear();

      registerWorkers({
        whatsappMessages: mockProcessor,
      });

      expect(MockedWorker).toHaveBeenCalledWith(
        QUEUE_NAMES.WHATSAPP_MESSAGES,
        expect.any(Function),
        expect.any(Object)
      );
      expect(MockedWorker).toHaveBeenCalledWith(
        QUEUE_NAMES.INTENT_CLASSIFICATION,
        expect.any(Function),
        expect.any(Object)
      );
      expect(MockedWorker).toHaveBeenCalledWith(
        QUEUE_NAMES.NOTIFICATIONS,
        expect.any(Function),
        expect.any(Object)
      );
      expect(MockedWorker).toHaveBeenCalledWith(
        QUEUE_NAMES.ESCALATIONS,
        expect.any(Function),
        expect.any(Object)
      );
    });

    it('should configure workers with concurrency limits', () => {
      const MockedWorker = Worker as jest.MockedClass<typeof Worker>;
      MockedWorker.mockClear();

      registerWorkers({
        whatsappMessages: mockProcessor,
      });

      // Check WhatsApp messages worker config (concurrency: 5)
      const whatsappWorkerConfig = MockedWorker.mock.calls.find(
        (call) => call[0] === QUEUE_NAMES.WHATSAPP_MESSAGES
      )![2];
      expect(whatsappWorkerConfig).toHaveProperty('concurrency', 5);

      // Check notifications worker config (concurrency: 10)
      const notificationsWorkerConfig = MockedWorker.mock.calls.find(
        (call) => call[0] === QUEUE_NAMES.NOTIFICATIONS
      )![2];
      expect(notificationsWorkerConfig).toHaveProperty('concurrency', 10);
    });

    it('should use default processor for queues without custom processor', () => {
      const workers = registerWorkers({
        whatsappMessages: mockProcessor,
        // No processor for other queues
      });

      expect(workers).toHaveLength(4);
      // All workers should be created even without custom processors
    });

    it('should configure workers with rate limiting', () => {
      const MockedWorker = Worker as jest.MockedClass<typeof Worker>;
      MockedWorker.mockClear();

      registerWorkers({
        whatsappMessages: mockProcessor,
      });

      const workerConfig = MockedWorker.mock.calls[0][2]!;
      expect(workerConfig).toHaveProperty('limiter');
      expect(workerConfig.limiter).toHaveProperty('duration', 1000);
    });
  });

  describe('Worker Job Processing', () => {
    it('should call processor function when job is processed', async () => {
      const mockJob = {
        id: 'job-123',
        data: {
          messageId: 'msg-123',
          from: '5511999999999',
          text: 'Test',
          timestamp: new Date().toISOString(),
          phoneNumberId: 'phone-123',
          correlationId: 'req-123',
        },
        attemptsMade: 1,
        queueName: QUEUE_NAMES.WHATSAPP_MESSAGES,
      } as Job<WhatsAppMessageJob>;

      const processor = jest.fn().mockResolvedValue(undefined);
      const MockedWorker = Worker as jest.MockedClass<typeof Worker>;

      registerWorkers({
        whatsappMessages: processor,
      });

      // Get the processor function passed to Worker constructor
      const workerProcessorFn = MockedWorker.mock.calls[0][1] as (
        job: Job<WhatsAppMessageJob>
      ) => Promise<void>;

      // Call it with mock job
      await workerProcessorFn(mockJob);

      expect(processor).toHaveBeenCalledWith(mockJob);
    });

    it('should handle processor errors and rethrow', async () => {
      const error = new Error('Processing failed');
      const failingProcessor = jest.fn().mockRejectedValue(error);

      const mockJob = {
        id: 'job-456',
        data: {} as WhatsAppMessageJob,
        attemptsMade: 1,
        queueName: QUEUE_NAMES.WHATSAPP_MESSAGES,
      } as Job<WhatsAppMessageJob>;

      const MockedWorker = Worker as jest.MockedClass<typeof Worker>;
      MockedWorker.mockClear();

      registerWorkers({
        whatsappMessages: failingProcessor,
      });

      const workerProcessorFn = MockedWorker.mock.calls[0][1] as (
        job: Job<WhatsAppMessageJob>
      ) => Promise<void>;

      await expect(workerProcessorFn(mockJob)).rejects.toThrow('Processing failed');
    });
  });

  describe('closeWorkers', () => {
    it('should close all active workers', async () => {
      const mockClose = jest.fn().mockResolvedValue(undefined);
      const MockedWorker = Worker as jest.MockedClass<typeof Worker>;
      MockedWorker.prototype.close = mockClose;

      registerWorkers({
        whatsappMessages: mockProcessor,
      });

      await closeWorkers();

      expect(mockClose).toHaveBeenCalledTimes(4);
    });

    it('should clear active workers array after closing', async () => {
      const mockClose = jest.fn().mockResolvedValue(undefined);
      const MockedWorker = Worker as jest.MockedClass<typeof Worker>;
      MockedWorker.prototype.close = mockClose;

      registerWorkers({
        whatsappMessages: mockProcessor,
      });

      expect(getActiveWorkers()).toHaveLength(4);

      await closeWorkers();

      expect(getActiveWorkers()).toHaveLength(0);
    });

    it('should handle no workers gracefully', async () => {
      await closeWorkers(); // No workers registered

      // Should not throw
      expect(getActiveWorkers()).toHaveLength(0);
    });
  });

  describe('getActiveWorkers', () => {
    it('should return empty array initially', () => {
      expect(getActiveWorkers()).toHaveLength(0);
    });

    it('should return active workers after registration', () => {
      registerWorkers({
        whatsappMessages: mockProcessor,
      });

      const workers = getActiveWorkers();
      expect(workers).toHaveLength(4);
    });
  });

  describe('Worker Event Handlers', () => {
    it('should register event handlers on workers', () => {
      const MockedWorker = Worker as jest.MockedClass<typeof Worker>;
      const mockOn = jest.fn();
      MockedWorker.prototype.on = mockOn;

      registerWorkers({
        whatsappMessages: mockProcessor,
      });

      // Each worker should register 'completed', 'failed', 'error' handlers
      expect(mockOn).toHaveBeenCalledWith('completed', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('failed', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });
});
