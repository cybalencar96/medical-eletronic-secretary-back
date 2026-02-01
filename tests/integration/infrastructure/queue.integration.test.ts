import { Worker, Job, Queue } from 'bullmq';
import {
  WhatsAppMessageJob,
  IntentClassificationJob,
  NotificationJob,
} from '../../../src/infrastructure/queue/types';
import { createTestRedisConnection, TestRedisConnection } from '../../utils/redis-connection';

/**
 * Integration tests for queue infrastructure.
 *
 * These tests verify end-to-end queue and worker behavior with a real Redis instance.
 * They test job processing, retry mechanisms, and graceful shutdown.
 *
 * Note: These tests require Redis to be running (via Docker Compose).
 */
describe('Queue Infrastructure Integration', () => {
  let testWorkers: Worker[] = [];
  let testRedis: TestRedisConnection;
  let testQueues: {
    whatsappMessages: Queue<WhatsAppMessageJob>;
    intentClassification: Queue<IntentClassificationJob>;
    notifications: Queue<NotificationJob>;
  };

  beforeEach(async () => {
    // Create isolated Redis connection for this test
    testRedis = createTestRedisConnection('queue-test:');
    await testRedis.client.connect();

    // Create isolated queue instances with the test Redis connection
    testQueues = {
      whatsappMessages: new Queue<WhatsAppMessageJob>('whatsapp-messages', {
        connection: testRedis.client,
      }),
      intentClassification: new Queue<IntentClassificationJob>('intent-classification', {
        connection: testRedis.client,
      }),
      notifications: new Queue<NotificationJob>('notifications', {
        connection: testRedis.client,
      }),
    };
  });

  afterEach(async () => {
    // Clean up workers
    if (testWorkers.length > 0) {
      for (const worker of testWorkers) {
        await worker.close();
      }
      testWorkers = [];
    }

    // Clean up queues
    await Promise.all([
      testQueues.whatsappMessages.drain(),
      testQueues.intentClassification.drain(),
      testQueues.notifications.drain(),
    ]);

    await Promise.all([
      testQueues.whatsappMessages.close(),
      testQueues.intentClassification.close(),
      testQueues.notifications.close(),
    ]);

    // Clean up Redis connection
    await testRedis.cleanup();
    await testRedis.close();
  });

  describe('End-to-end job processing', () => {
    it('should process WhatsApp message job successfully', async () => {
      const processedJobs: Job<WhatsAppMessageJob>[] = [];

      const processor = async (job: Job<WhatsAppMessageJob>) => {
        processedJobs.push(job);
      };

      const worker = new Worker<WhatsAppMessageJob>('whatsapp-messages', processor, {
        connection: testRedis.client,
        concurrency: 5,
        autorun: true,
      });

      testWorkers = [worker];

      const jobData: WhatsAppMessageJob = {
        messageId: 'test-msg-123',
        from: '5511999999999',
        text: 'Test message',
        timestamp: new Date().toISOString(),
        phoneNumberId: 'phone-123',
        correlationId: 'req-123',
      };

      await testQueues.whatsappMessages.add('process-message', jobData, {
        jobId: jobData.messageId,
      });

      // Wait for job to be processed
      await new Promise((resolve) => setTimeout(resolve, 2000));

      expect(processedJobs).toHaveLength(1);
      expect(processedJobs[0].data).toMatchObject(jobData);
    }, 10000);

    it('should process multiple jobs concurrently', async () => {
      const processedJobs: string[] = [];
      const processingTimes: number[] = [];

      const processor = async (job: Job<WhatsAppMessageJob>) => {
        const start = Date.now();
        // Simulate processing delay
        await new Promise((resolve) => setTimeout(resolve, 500));
        processedJobs.push(job.data.messageId);
        processingTimes.push(Date.now() - start);
      };

      const worker = new Worker<WhatsAppMessageJob>('whatsapp-messages', processor, {
        connection: testRedis.client,
        concurrency: 5,
        autorun: true,
      });

      testWorkers = [worker];

      // Add 5 jobs (concurrency is 5 for WhatsApp queue)
      const jobPromises = Array.from({ length: 5 }, (_, i) =>
        testQueues.whatsappMessages.add('process-message', {
          messageId: `msg-${i}`,
          from: '5511999999999',
          text: `Message ${i}`,
          timestamp: new Date().toISOString(),
          phoneNumberId: 'phone-123',
          correlationId: `req-${i}`,
        } as WhatsAppMessageJob)
      );

      await Promise.all(jobPromises);

      // Wait for all jobs to be processed
      await new Promise((resolve) => setTimeout(resolve, 3000));

      expect(processedJobs).toHaveLength(5);
    }, 10000);
  });

  describe('Job retry mechanism', () => {
    it('should retry failed jobs with exponential backoff', async () => {
      let attemptCount = 0;

      const failingProcessor = async (_job: Job<WhatsAppMessageJob>) => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error(`Attempt ${attemptCount} failed`);
        }
        // Succeed on 3rd attempt
      };

      const worker = new Worker<WhatsAppMessageJob>('whatsapp-messages', failingProcessor, {
        connection: testRedis.client,
        concurrency: 5,
        autorun: true,
      });

      testWorkers = [worker];

      const jobData: WhatsAppMessageJob = {
        messageId: 'retry-test-123',
        from: '5511999999999',
        text: 'Retry test',
        timestamp: new Date().toISOString(),
        phoneNumberId: 'phone-123',
        correlationId: 'req-retry',
      };

      await testQueues.whatsappMessages.add('process-message', jobData, {
        jobId: jobData.messageId,
      });

      // Wait for retries to complete
      await new Promise((resolve) => setTimeout(resolve, 8000));

      expect(attemptCount).toBe(3);
    }, 15000);

    it('should move to failed queue after max attempts', async () => {
      const failingProcessor = async (_job: Job<WhatsAppMessageJob>) => {
        throw new Error('Always fails');
      };

      const worker = new Worker<WhatsAppMessageJob>('whatsapp-messages', failingProcessor, {
        connection: testRedis.client,
        concurrency: 5,
        autorun: true,
      });

      testWorkers = [worker];

      const jobData: WhatsAppMessageJob = {
        messageId: 'fail-test-123',
        from: '5511999999999',
        text: 'Fail test',
        timestamp: new Date().toISOString(),
        phoneNumberId: 'phone-123',
        correlationId: 'req-fail',
      };

      const job = await testQueues.whatsappMessages.add('process-message', jobData, {
        jobId: jobData.messageId,
      });

      // Wait for all retry attempts
      await new Promise((resolve) => setTimeout(resolve, 10000));

      const failedJobs = await testQueues.whatsappMessages.getFailed();
      const failedJob = failedJobs.find((j) => j.id === job.id);

      expect(failedJob).toBeDefined();
      expect(failedJob?.attemptsMade).toBe(3);
    }, 15000);
  });

  describe('Graceful shutdown', () => {
    it('should complete active jobs during shutdown', async () => {
      const completedJobs: string[] = [];

      const slowProcessor = async (job: Job<NotificationJob>) => {
        // Simulate slow processing
        await new Promise((resolve) => setTimeout(resolve, 2000));
        completedJobs.push(job.data.appointmentId);
      };

      const worker = new Worker<NotificationJob>('notifications', slowProcessor, {
        connection: testRedis.client,
        concurrency: 1,
        autorun: true,
      });

      testWorkers = [worker];

      // Add jobs
      await testQueues.notifications.add('send-notification', {
        type: 'reminder',
        appointmentId: 'appt-1',
        patientId: 'patient-1',
        phone: '5511999999999',
        scheduledAt: new Date().toISOString(),
        metadata: {},
        correlationId: 'req-shutdown',
      } as NotificationJob);

      // Wait a bit for processing to start
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Initiate shutdown (should wait for active job)
      for (const worker of testWorkers) {
        await worker.close();
      }
      testWorkers = [];

      expect(completedJobs).toHaveLength(1);
      expect(completedJobs[0]).toBe('appt-1');
    }, 35000);
  });

  describe('Queue isolation', () => {
    it('should process different queue types independently', async () => {
      const whatsappJobs: string[] = [];
      const intentJobs: string[] = [];

      const whatsappProcessor = async (job: Job<WhatsAppMessageJob>) => {
        whatsappJobs.push(job.data.messageId);
      };

      const intentProcessor = async (job: Job<IntentClassificationJob>) => {
        intentJobs.push(job.data.messageId);
      };

      const whatsappWorker = new Worker<WhatsAppMessageJob>(
        'whatsapp-messages',
        whatsappProcessor,
        {
          connection: testRedis.client,
          concurrency: 5,
          autorun: true,
        }
      );

      const intentWorker = new Worker<IntentClassificationJob>(
        'intent-classification',
        intentProcessor,
        {
          connection: testRedis.client,
          concurrency: 3,
          autorun: true,
        }
      );

      testWorkers = [whatsappWorker, intentWorker];

      // Add jobs to different queues
      await testQueues.whatsappMessages.add('process-message', {
        messageId: 'wa-1',
        from: '5511999999999',
        text: 'WhatsApp message',
        timestamp: new Date().toISOString(),
        phoneNumberId: 'phone-123',
        correlationId: 'req-wa',
      } as WhatsAppMessageJob);

      await testQueues.intentClassification.add('classify', {
        messageId: 'intent-1',
        phone: '5511999999999',
        messageText: 'Intent message',
        patientId: 'patient-1',
        correlationId: 'req-intent',
      } as IntentClassificationJob);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 2000));

      expect(whatsappJobs).toHaveLength(1);
      expect(intentJobs).toHaveLength(1);
      expect(whatsappJobs[0]).toBe('wa-1');
      expect(intentJobs[0]).toBe('intent-1');
    }, 10000);
  });

  describe('Job deduplication', () => {
    it('should prevent duplicate jobs with same jobId', async () => {
      const processedJobs: string[] = [];

      const processor = async (job: Job<WhatsAppMessageJob>) => {
        processedJobs.push(job.data.messageId);
      };

      const worker = new Worker<WhatsAppMessageJob>('whatsapp-messages', processor, {
        connection: testRedis.client,
        concurrency: 5,
        autorun: true,
      });

      testWorkers = [worker];

      const jobData: WhatsAppMessageJob = {
        messageId: 'dedup-test-123',
        from: '5511999999999',
        text: 'Duplicate test',
        timestamp: new Date().toISOString(),
        phoneNumberId: 'phone-123',
        correlationId: 'req-dedup',
      };

      // Add same job twice with same jobId
      await testQueues.whatsappMessages.add('process-message', jobData, {
        jobId: jobData.messageId,
      });

      await testQueues.whatsappMessages.add('process-message', jobData, {
        jobId: jobData.messageId,
      });

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Should only process once
      expect(processedJobs).toHaveLength(1);
    }, 10000);
  });
});
