import {
  QUEUE_NAMES,
  QUEUE_CONFIGS,
  WhatsAppMessageJob,
  IntentClassificationJob,
  NotificationJob,
  EscalationJob,
} from '../../../../src/infrastructure/queue/types';

describe('Queue Types', () => {
  describe('QUEUE_NAMES', () => {
    it('should define all required queue names', () => {
      expect(QUEUE_NAMES.WHATSAPP_MESSAGES).toBe('whatsapp-messages');
      expect(QUEUE_NAMES.INTENT_CLASSIFICATION).toBe('intent-classification');
      expect(QUEUE_NAMES.NOTIFICATIONS).toBe('notifications');
      expect(QUEUE_NAMES.ESCALATIONS).toBe('escalations');
    });

    it('should have exactly 4 queue names', () => {
      expect(Object.keys(QUEUE_NAMES)).toHaveLength(4);
    });
  });

  describe('QUEUE_CONFIGS', () => {
    it('should have configuration for all queues', () => {
      expect(QUEUE_CONFIGS[QUEUE_NAMES.WHATSAPP_MESSAGES]).toBeDefined();
      expect(QUEUE_CONFIGS[QUEUE_NAMES.INTENT_CLASSIFICATION]).toBeDefined();
      expect(QUEUE_CONFIGS[QUEUE_NAMES.NOTIFICATIONS]).toBeDefined();
      expect(QUEUE_CONFIGS[QUEUE_NAMES.ESCALATIONS]).toBeDefined();
    });

    it('should have valid retry configuration for message processing', () => {
      const config = QUEUE_CONFIGS[QUEUE_NAMES.WHATSAPP_MESSAGES];
      expect(config.concurrency).toBe(5);
      expect(config.attempts).toBe(3);
      expect(config.backoffDelay).toBe(2000);
      expect(config.timeout).toBe(30000);
    });

    it('should have higher timeout for intent classification (OpenAI)', () => {
      const config = QUEUE_CONFIGS[QUEUE_NAMES.INTENT_CLASSIFICATION];
      expect(config.timeout).toBe(60000); // 60 seconds for API calls
      expect(config.concurrency).toBe(3);
    });

    it('should have higher concurrency for notifications', () => {
      const config = QUEUE_CONFIGS[QUEUE_NAMES.NOTIFICATIONS];
      expect(config.concurrency).toBe(10);
      expect(config.attempts).toBe(5); // More retries for notifications
    });

    it('should have lower concurrency for escalations', () => {
      const config = QUEUE_CONFIGS[QUEUE_NAMES.ESCALATIONS];
      expect(config.concurrency).toBe(2);
      expect(config.timeout).toBe(15000);
    });
  });

  describe('Job Data Interfaces', () => {
    it('should validate WhatsAppMessageJob structure', () => {
      const job: WhatsAppMessageJob = {
        messageId: 'wamid.123',
        from: '5511999999999',
        text: 'Test message',
        timestamp: new Date().toISOString(),
        phoneNumberId: 'phone_123',
        correlationId: 'req-123',
      };

      expect(job.messageId).toBeDefined();
      expect(job.from).toBeDefined();
      expect(job.text).toBeDefined();
      expect(job.timestamp).toBeDefined();
      expect(job.phoneNumberId).toBeDefined();
      expect(job.correlationId).toBeDefined();
    });

    it('should validate IntentClassificationJob structure', () => {
      const job: IntentClassificationJob = {
        messageId: 'wamid.123',
        phone: '5511999999999',
        messageText: 'Quero marcar uma consulta',
        patientId: 'patient-123',
        correlationId: 'req-123',
      };

      expect(job.messageId).toBeDefined();
      expect(job.phone).toBeDefined();
      expect(job.messageText).toBeDefined();
      expect(job.correlationId).toBeDefined();
    });

    it('should validate NotificationJob structure', () => {
      const job: NotificationJob = {
        type: 'reminder',
        appointmentId: 'appt-123',
        patientId: 'patient-123',
        phone: '5511999999999',
        scheduledAt: new Date().toISOString(),
        metadata: {
          patientName: 'João Silva',
          appointmentDate: '2024-02-10',
          appointmentTime: '14:00',
        },
        correlationId: 'req-123',
      };

      expect(job.type).toBe('reminder');
      expect(job.appointmentId).toBeDefined();
      expect(job.metadata).toBeDefined();
    });

    it('should validate EscalationJob structure', () => {
      const job: EscalationJob = {
        patientId: 'patient-123',
        phone: '5511999999999',
        message: 'Complex query',
        reason: 'low_confidence',
        confidence: 0.5,
        messageId: 'wamid.123',
        correlationId: 'req-123',
      };

      expect(job.reason).toBe('low_confidence');
      expect(job.confidence).toBe(0.5);
      expect(job.messageId).toBeDefined();
    });

    it('should allow null patientId in EscalationJob for new contacts', () => {
      const job: EscalationJob = {
        patientId: null,
        phone: '5511999999999',
        message: 'New contact message',
        reason: 'complex_case',
        messageId: 'wamid.456',
        correlationId: 'req-456',
      };

      expect(job.patientId).toBeNull();
    });
  });
});
