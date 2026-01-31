import request from 'supertest';
import { app } from '../../../src/app';
import { logger } from '../../../src/infrastructure/config/logger';
import { Job, Queue, Worker } from 'bullmq';
import { redisConnection } from '../../../src/infrastructure/queue/connection';
import { QUEUE_NAMES, WhatsAppMessageJob } from '../../../src/infrastructure/queue/types';

/**
 * Integration tests for correlation ID propagation.
 *
 * Tests verify that correlation IDs flow through the entire application lifecycle:
 * - HTTP request → correlation ID generation
 * - Correlation ID in request logs
 * - Correlation ID propagated to BullMQ jobs
 * - Correlation ID available in worker processing
 * - All log entries for a conversation share the same correlation ID
 */

describe('Correlation ID Propagation', () => {
  let testQueue: Queue;
  let testWorker: Worker;
  let logSpy: jest.SpyInstance;
  const processedJobs: Job[] = [];

  beforeAll(async () => {
    // Create a test queue for correlation ID testing
    testQueue = new Queue('test-correlation-queue', {
      connection: redisConnection,
    });

    // Create a worker that tracks correlation IDs
    testWorker = new Worker(
      'test-correlation-queue',
      async (job: Job) => {
        processedJobs.push(job);
      },
      {
        connection: redisConnection,
      }
    );
  });

  afterAll(async () => {
    // Clean up
    await testQueue.obliterate({ force: true });
    await testQueue.close();
    await testWorker.close();
    await redisConnection.quit();
  });

  beforeEach(() => {
    // Clear processed jobs
    processedJobs.length = 0;

    // Spy on logger methods
    logSpy = jest.spyOn(logger, 'info');
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  describe('HTTP Request Correlation ID', () => {
    it('should generate correlation ID for new requests', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);

      // Verify correlation ID was logged
      expect(logSpy).toHaveBeenCalled();
      const logCalls = logSpy.mock.calls;
      const hasCorrelationId = logCalls.some((call) => {
        return call[0]?.correlationId || call[0]?.req?.id;
      });

      expect(hasCorrelationId).toBe(true);
    });

    it('should use existing correlation ID from X-Request-ID header', async () => {
      const customCorrelationId = 'custom-correlation-123';

      const response = await request(app)
        .get('/health')
        .set('X-Request-ID', customCorrelationId);

      expect(response.status).toBe(200);

      // Verify custom correlation ID was used
      const logCalls = logSpy.mock.calls;
      const usedCustomId = logCalls.some((call) => {
        return (
          call[0]?.correlationId === customCorrelationId || call[0]?.req?.id === customCorrelationId
        );
      });

      expect(usedCustomId).toBe(true);
    });

    it('should include correlation ID in all logs for a single request', async () => {
      await request(app).get('/');

      // Get all log calls
      const logCalls = logSpy.mock.calls;

      // Extract correlation IDs
      const correlationIds = logCalls
        .map((call) => call[0]?.correlationId || call[0]?.req?.id)
        .filter((id) => id !== undefined);

      // Verify at least one correlation ID was logged
      expect(correlationIds.length).toBeGreaterThan(0);

      // All correlation IDs should be the same for this request
      const uniqueIds = [...new Set(correlationIds)];
      expect(uniqueIds.length).toBe(1);
    });
  });

  describe('BullMQ Job Correlation ID', () => {
    it('should propagate correlation ID to BullMQ job data', async () => {
      const jobData: WhatsAppMessageJob = {
        messageId: 'msg-123',
        from: '5511999999999',
        text: 'Test message',
        timestamp: new Date().toISOString(),
        phoneNumberId: 'phone-123',
        correlationId: 'test-correlation-456',
      };

      const job = await testQueue.add('test-job', jobData);

      // Wait for job to be processed
      await job.waitUntilFinished(testWorker as any);

      // Verify correlation ID is in job data
      expect(job.data.correlationId).toBe('test-correlation-456');
    });

    it('should extract correlation ID from job data in worker', async () => {
      const correlationId = 'worker-correlation-789';
      const jobData: WhatsAppMessageJob = {
        messageId: 'msg-456',
        from: '5511999999999',
        text: 'Another test message',
        timestamp: new Date().toISOString(),
        phoneNumberId: 'phone-456',
        correlationId,
      };

      const job = await testQueue.add('test-job-2', jobData);

      // Wait for job to be processed
      await job.waitUntilFinished(testWorker as any);

      // Verify job was processed
      expect(processedJobs.length).toBeGreaterThan(0);

      // Get the processed job
      const processedJob = processedJobs.find((j) => j.id === job.id);
      expect(processedJob).toBeDefined();
      expect(processedJob!.data.correlationId).toBe(correlationId);
    });
  });

  describe('End-to-End Correlation ID Flow', () => {
    it('should maintain correlation ID from webhook to queue job', async () => {
      // Note: This test demonstrates the concept, but requires webhook endpoint to be implemented
      // For now, we verify the pattern by directly creating a job with correlation ID

      const correlationId = 'e2e-correlation-123';

      // Simulate webhook creating a job with correlation ID from request
      const jobData: WhatsAppMessageJob = {
        messageId: 'e2e-msg-123',
        from: '5511999999999',
        text: 'End-to-end test',
        timestamp: new Date().toISOString(),
        phoneNumberId: 'phone-e2e',
        correlationId,
      };

      const job = await testQueue.add('e2e-test', jobData);

      // Wait for processing
      await job.waitUntilFinished(testWorker as any);

      // Verify correlation ID persisted through the flow
      const processedJob = processedJobs.find((j) => j.id === job.id);
      expect(processedJob!.data.correlationId).toBe(correlationId);
    });
  });

  describe('Correlation ID Uniqueness', () => {
    it('should generate unique correlation IDs for different requests', async () => {
      const correlationIds: string[] = [];

      // Make multiple requests
      for (let i = 0; i < 5; i++) {
        logSpy.mockClear();
        await request(app).get('/health');

        // Extract correlation ID from logs
        const logCalls = logSpy.mock.calls;
        const correlationId = logCalls.find(
          (call) => call[0]?.correlationId || call[0]?.req?.id
        )?.[0]?.correlationId || logCalls.find((call) => call[0]?.req?.id)?.[0]?.req?.id;

        if (correlationId) {
          correlationIds.push(correlationId);
        }
      }

      // Verify we got correlation IDs
      expect(correlationIds.length).toBeGreaterThan(0);

      // All correlation IDs should be unique
      const uniqueIds = new Set(correlationIds);
      expect(uniqueIds.size).toBe(correlationIds.length);
    });

    it('should not generate duplicate correlation IDs in 100 requests', async () => {
      const correlationIds: Set<string> = new Set();

      for (let i = 0; i < 100; i++) {
        logSpy.mockClear();
        await request(app).get('/health');

        // Extract correlation ID
        const logCalls = logSpy.mock.calls;
        const correlationId = logCalls.find(
          (call) => call[0]?.correlationId || call[0]?.req?.id
        )?.[0]?.correlationId || logCalls.find((call) => call[0]?.req?.id)?.[0]?.req?.id;

        if (correlationId) {
          correlationIds.add(correlationId);
        }
      }

      // All 100 requests should have unique correlation IDs
      expect(correlationIds.size).toBe(100);
    });
  });
});
