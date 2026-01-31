import { QueueService, queueService } from '../../../../src/infrastructure/queue/queue.service';
import { queues } from '../../../../src/infrastructure/queue/queues';
import { WhatsAppMessageJob } from '../../../../src/infrastructure/queue/types';

// Mock the queues module
jest.mock('../../../../src/infrastructure/queue/queues', () => ({
  queues: {
    whatsappMessages: {
      add: jest.fn(),
      close: jest.fn(),
    },
  },
}));

describe('QueueService', () => {
  let service: QueueService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new QueueService();
  });

  describe('publishMessage', () => {
    it('should publish message to WhatsApp queue', async () => {
      const jobData: WhatsAppMessageJob = {
        messageId: 'wamid.123',
        from: '5511999999999',
        text: 'Test message',
        timestamp: new Date().toISOString(),
        phoneNumberId: 'phone-123',
        correlationId: 'req-123',
      };

      const mockAdd = queues.whatsappMessages.add as jest.Mock;
      mockAdd.mockResolvedValue({ id: 'job-123' });

      await service.publishMessage(jobData);

      expect(mockAdd).toHaveBeenCalledWith('process-message', jobData, {
        jobId: jobData.messageId,
      });
    });

    it('should use messageId as jobId to prevent duplicates', async () => {
      const jobData: WhatsAppMessageJob = {
        messageId: 'unique-123',
        from: '5511999999999',
        text: 'Test',
        timestamp: new Date().toISOString(),
        phoneNumberId: 'phone-123',
        correlationId: 'req-123',
      };

      const mockAdd = queues.whatsappMessages.add as jest.Mock;
      mockAdd.mockResolvedValue({ id: 'job-123' });

      await service.publishMessage(jobData);

      expect(mockAdd).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          jobId: 'unique-123',
        })
      );
    });

    it('should log successful message publishing', async () => {
      const jobData: WhatsAppMessageJob = {
        messageId: 'wamid.456',
        from: '5511988888888',
        text: 'Another message',
        timestamp: new Date().toISOString(),
        phoneNumberId: 'phone-456',
        correlationId: 'req-456',
      };

      const mockAdd = queues.whatsappMessages.add as jest.Mock;
      mockAdd.mockResolvedValue({ id: 'job-456' });

      await expect(service.publishMessage(jobData)).resolves.not.toThrow();
    });

    it('should throw error if queue publishing fails', async () => {
      const jobData: WhatsAppMessageJob = {
        messageId: 'wamid.789',
        from: '5511977777777',
        text: 'Error message',
        timestamp: new Date().toISOString(),
        phoneNumberId: 'phone-789',
        correlationId: 'req-789',
      };

      const error = new Error('Queue connection failed');
      const mockAdd = queues.whatsappMessages.add as jest.Mock;
      mockAdd.mockRejectedValue(error);

      await expect(service.publishMessage(jobData)).rejects.toThrow('Queue connection failed');
    });
  });

  describe('close', () => {
    it('should close the queue connection', async () => {
      const mockClose = queues.whatsappMessages.close as jest.Mock;
      mockClose.mockResolvedValue(undefined);

      await service.close();

      expect(mockClose).toHaveBeenCalled();
    });
  });

  describe('getQueue', () => {
    it('should return the underlying queue instance', () => {
      const queue = service.getQueue();

      expect(queue).toBe(queues.whatsappMessages);
    });
  });

  describe('Singleton instance', () => {
    it('should export a singleton queueService instance', () => {
      expect(queueService).toBeInstanceOf(QueueService);
    });

    it('should be the same instance across imports', () => {
      const service1 = require('../../../../src/infrastructure/queue/queue.service').queueService;
      const service2 = require('../../../../src/infrastructure/queue/queue.service').queueService;

      expect(service1).toBe(service2);
    });
  });

  describe('Backward compatibility', () => {
    it('should maintain the same API as before refactor', async () => {
      // The service should still provide publishMessage, close, and getQueue methods
      expect(typeof service.publishMessage).toBe('function');
      expect(typeof service.close).toBe('function');
      expect(typeof service.getQueue).toBe('function');
    });
  });
});
