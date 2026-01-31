import { shutdown } from '../../../../src/infrastructure/queue';
import { closeQueues } from '../../../../src/infrastructure/queue/queues';
import { closeWorkers } from '../../../../src/infrastructure/queue/workers';

// Mock the queues and workers modules
jest.mock('../../../../src/infrastructure/queue/queues', () => ({
  closeQueues: jest.fn(),
}));

jest.mock('../../../../src/infrastructure/queue/workers', () => ({
  closeWorkers: jest.fn(),
}));

describe('Queue Infrastructure Index', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('shutdown', () => {
    it('should close workers first, then queues', async () => {
      const mockCloseWorkers = closeWorkers as jest.MockedFunction<typeof closeWorkers>;
      const mockCloseQueues = closeQueues as jest.MockedFunction<typeof closeQueues>;

      mockCloseWorkers.mockResolvedValue(undefined);
      mockCloseQueues.mockResolvedValue(undefined);

      await shutdown();

      expect(mockCloseWorkers).toHaveBeenCalledWith(30000);
      expect(mockCloseQueues).toHaveBeenCalled();

      // Verify order: workers closed before queues
      const closeWorkersOrder = mockCloseWorkers.mock.invocationCallOrder[0];
      const closeQueuesOrder = mockCloseQueues.mock.invocationCallOrder[0];
      expect(closeWorkersOrder).toBeLessThan(closeQueuesOrder);
    });

    it('should use custom timeout when provided', async () => {
      const mockCloseWorkers = closeWorkers as jest.MockedFunction<typeof closeWorkers>;
      const mockCloseQueues = closeQueues as jest.MockedFunction<typeof closeQueues>;

      mockCloseWorkers.mockResolvedValue(undefined);
      mockCloseQueues.mockResolvedValue(undefined);

      await shutdown(60000);

      expect(mockCloseWorkers).toHaveBeenCalledWith(60000);
    });

    it('should throw error if shutdown fails', async () => {
      const mockCloseWorkers = closeWorkers as jest.MockedFunction<typeof closeWorkers>;

      const error = new Error('Shutdown failed');
      mockCloseWorkers.mockRejectedValue(error);

      await expect(shutdown()).rejects.toThrow('Shutdown failed');
    });

    it('should handle errors during queue closure', async () => {
      const mockCloseWorkers = closeWorkers as jest.MockedFunction<typeof closeWorkers>;
      const mockCloseQueues = closeQueues as jest.MockedFunction<typeof closeQueues>;

      mockCloseWorkers.mockResolvedValue(undefined);
      const error = new Error('Queue close failed');
      mockCloseQueues.mockRejectedValue(error);

      await expect(shutdown()).rejects.toThrow('Queue close failed');
    });
  });
});
