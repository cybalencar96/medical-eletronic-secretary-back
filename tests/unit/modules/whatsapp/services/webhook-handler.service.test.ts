import { WebhookHandlerService } from '../../../../../src/modules/whatsapp/services/webhook-handler.service';
import { queueService } from '../../../../../src/infrastructure/queue/queue.service';
import { WhatsAppWebhookPayload } from '../../../../../src/modules/whatsapp/types/webhook-payload.interface';
import { WhatsAppMessageJob } from '../../../../../src/modules/whatsapp/types/message-job.interface';
import { AppError } from '../../../../../src/shared/errors/AppError';

// Mock dependencies
jest.mock('../../../../../src/infrastructure/config/logger');
jest.mock('../../../../../src/infrastructure/queue/queues', () => ({
  queues: {
    whatsappMessages: { add: jest.fn(), close: jest.fn() },
    intentClassification: { add: jest.fn(), close: jest.fn() },
    notifications: { add: jest.fn(), close: jest.fn() },
    escalations: { add: jest.fn(), close: jest.fn() },
  },
  closeQueues: jest.fn(),
}));
jest.mock('../../../../../src/infrastructure/queue/queue.service');

describe('WebhookHandlerService', () => {
  let service: WebhookHandlerService;
  let mockPublishMessage: jest.SpyInstance;

  const CORRELATION_ID = 'test-correlation-id';
  const PHONE_NUMBER_ID = '123456789';

  beforeEach(() => {
    service = new WebhookHandlerService();
    mockPublishMessage = jest.spyOn(queueService, 'publishMessage').mockResolvedValue();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processWebhook', () => {
    describe('successful message processing', () => {
      it('should extract and publish text message to queue', async () => {
        const payload: WhatsAppWebhookPayload = {
          object: 'whatsapp_business_account',
          entry: [{
            id: 'entry-123',
            changes: [{
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  phone_number_id: PHONE_NUMBER_ID,
                  display_phone_number: '5511999999999',
                },
                messages: [{
                  id: 'wamid.123',
                  from: '5511888888888',
                  timestamp: '1705318200',
                  type: 'text',
                  text: { body: 'Quero marcar uma consulta' },
                }],
              },
            }],
          }],
        };

        await service.processWebhook(payload, CORRELATION_ID);

        expect(mockPublishMessage).toHaveBeenCalledTimes(1);
        expect(mockPublishMessage).toHaveBeenCalledWith({
          messageId: 'wamid.123',
          from: '5511888888888',
          text: 'Quero marcar uma consulta',
          timestamp: new Date(1705318200 * 1000).toISOString(),
          phoneNumberId: PHONE_NUMBER_ID,
          correlationId: CORRELATION_ID,
        } as WhatsAppMessageJob);
      });

      it('should process multiple messages in single webhook', async () => {
        const payload: WhatsAppWebhookPayload = {
          object: 'whatsapp_business_account',
          entry: [{
            id: 'entry-123',
            changes: [{
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  phone_number_id: PHONE_NUMBER_ID,
                  display_phone_number: '5511999999999',
                },
                messages: [
                  {
                    id: 'wamid.1',
                    from: '5511111111111',
                    timestamp: '1705318200',
                    type: 'text',
                    text: { body: 'First message' },
                  },
                  {
                    id: 'wamid.2',
                    from: '5511222222222',
                    timestamp: '1705318300',
                    type: 'text',
                    text: { body: 'Second message' },
                  },
                ],
              },
            }],
          }],
        };

        await service.processWebhook(payload, CORRELATION_ID);

        expect(mockPublishMessage).toHaveBeenCalledTimes(2);
      });

      it('should process multiple entries in webhook', async () => {
        const payload: WhatsAppWebhookPayload = {
          object: 'whatsapp_business_account',
          entry: [
            {
              id: 'entry-1',
              changes: [{
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    phone_number_id: PHONE_NUMBER_ID,
                    display_phone_number: '5511999999999',
                  },
                  messages: [{
                    id: 'wamid.1',
                    from: '5511111111111',
                    timestamp: '1705318200',
                    type: 'text',
                    text: { body: 'Entry 1 message' },
                  }],
                },
              }],
            },
            {
              id: 'entry-2',
              changes: [{
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    phone_number_id: PHONE_NUMBER_ID,
                    display_phone_number: '5511999999999',
                  },
                  messages: [{
                    id: 'wamid.2',
                    from: '5511222222222',
                    timestamp: '1705318300',
                    type: 'text',
                    text: { body: 'Entry 2 message' },
                  }],
                },
              }],
            },
          ],
        };

        await service.processWebhook(payload, CORRELATION_ID);

        expect(mockPublishMessage).toHaveBeenCalledTimes(2);
      });

      it('should correctly convert Unix timestamp to ISO 8601', async () => {
        const unixTimestamp = '1705318200';
        const expectedISOTimestamp = new Date(1705318200 * 1000).toISOString();

        const payload: WhatsAppWebhookPayload = {
          object: 'whatsapp_business_account',
          entry: [{
            id: 'entry-123',
            changes: [{
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  phone_number_id: PHONE_NUMBER_ID,
                  display_phone_number: '5511999999999',
                },
                messages: [{
                  id: 'wamid.123',
                  from: '5511888888888',
                  timestamp: unixTimestamp,
                  type: 'text',
                  text: { body: 'Test message' },
                }],
              },
            }],
          }],
        };

        await service.processWebhook(payload, CORRELATION_ID);

        expect(mockPublishMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            timestamp: expectedISOTimestamp,
          })
        );
      });
    });

    describe('edge case handling', () => {
      it('should handle empty entry array gracefully', async () => {
        const payload: WhatsAppWebhookPayload = {
          object: 'whatsapp_business_account',
          entry: [],
        };

        await service.processWebhook(payload, CORRELATION_ID);

        expect(mockPublishMessage).not.toHaveBeenCalled();
      });

      it('should handle missing entry array gracefully', async () => {
        const payload = {
          object: 'whatsapp_business_account',
        } as WhatsAppWebhookPayload;

        await service.processWebhook(payload, CORRELATION_ID);

        expect(mockPublishMessage).not.toHaveBeenCalled();
      });

      it('should handle entry with no changes', async () => {
        const payload: WhatsAppWebhookPayload = {
          object: 'whatsapp_business_account',
          entry: [{
            id: 'entry-123',
            changes: [],
          }],
        };

        await service.processWebhook(payload, CORRELATION_ID);

        expect(mockPublishMessage).not.toHaveBeenCalled();
      });

      it('should skip non-message field changes', async () => {
        const payload: WhatsAppWebhookPayload = {
          object: 'whatsapp_business_account',
          entry: [{
            id: 'entry-123',
            changes: [{
              field: 'message_template_status_update',
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  phone_number_id: PHONE_NUMBER_ID,
                  display_phone_number: '5511999999999',
                },
              },
            }],
          }],
        };

        await service.processWebhook(payload, CORRELATION_ID);

        expect(mockPublishMessage).not.toHaveBeenCalled();
      });

      it('should skip status updates (not implemented yet)', async () => {
        const payload: WhatsAppWebhookPayload = {
          object: 'whatsapp_business_account',
          entry: [{
            id: 'entry-123',
            changes: [{
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  phone_number_id: PHONE_NUMBER_ID,
                  display_phone_number: '5511999999999',
                },
                statuses: [{
                  id: 'wamid.123',
                  status: 'delivered',
                  timestamp: '1705318200',
                  recipient_id: '5511888888888',
                }],
              },
            }],
          }],
        };

        await service.processWebhook(payload, CORRELATION_ID);

        expect(mockPublishMessage).not.toHaveBeenCalled();
      });

      it('should skip non-text messages (image, video, etc.)', async () => {
        const payload: WhatsAppWebhookPayload = {
          object: 'whatsapp_business_account',
          entry: [{
            id: 'entry-123',
            changes: [{
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  phone_number_id: PHONE_NUMBER_ID,
                  display_phone_number: '5511999999999',
                },
                messages: [
                  {
                    id: 'wamid.image',
                    from: '5511888888888',
                    timestamp: '1705318200',
                    type: 'image',
                  },
                  {
                    id: 'wamid.video',
                    from: '5511888888888',
                    timestamp: '1705318300',
                    type: 'video',
                  },
                ],
              },
            }],
          }],
        };

        await service.processWebhook(payload, CORRELATION_ID);

        expect(mockPublishMessage).not.toHaveBeenCalled();
      });

      it('should throw AppError for text message with missing body', async () => {
        const payload: WhatsAppWebhookPayload = {
          object: 'whatsapp_business_account',
          entry: [{
            id: 'entry-123',
            changes: [{
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  phone_number_id: PHONE_NUMBER_ID,
                  display_phone_number: '5511999999999',
                },
                messages: [{
                  id: 'wamid.123',
                  from: '5511888888888',
                  timestamp: '1705318200',
                  type: 'text',
                  text: undefined,
                }],
              },
            }],
          }],
        };

        await expect(service.processWebhook(payload, CORRELATION_ID)).rejects.toThrow(AppError);
        await expect(service.processWebhook(payload, CORRELATION_ID)).rejects.toThrow('Invalid message structure');
      });
    });

    describe('error handling', () => {
      it('should throw AppError when queue publishing fails', async () => {
        mockPublishMessage.mockRejectedValueOnce(new Error('Queue error'));

        const payload: WhatsAppWebhookPayload = {
          object: 'whatsapp_business_account',
          entry: [{
            id: 'entry-123',
            changes: [{
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  phone_number_id: PHONE_NUMBER_ID,
                  display_phone_number: '5511999999999',
                },
                messages: [{
                  id: 'wamid.123',
                  from: '5511888888888',
                  timestamp: '1705318200',
                  type: 'text',
                  text: { body: 'Test message' },
                }],
              },
            }],
          }],
        };

        // Call once and test both conditions on the same promise
        try {
          await service.processWebhook(payload, CORRELATION_ID);
          fail('Should have thrown an error');
        } catch (error) {
          expect(error).toBeInstanceOf(AppError);
          expect((error as AppError).message).toContain('Failed to queue message');
        }
      });

      it('should include correlation ID in error when queue fails', async () => {
        mockPublishMessage.mockRejectedValueOnce(new Error('Queue error'));

        const payload: WhatsAppWebhookPayload = {
          object: 'whatsapp_business_account',
          entry: [{
            id: 'entry-123',
            changes: [{
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  phone_number_id: PHONE_NUMBER_ID,
                  display_phone_number: '5511999999999',
                },
                messages: [{
                  id: 'wamid.123',
                  from: '5511888888888',
                  timestamp: '1705318200',
                  type: 'text',
                  text: { body: 'Test message' },
                }],
              },
            }],
          }],
        };

        try {
          await service.processWebhook(payload, CORRELATION_ID);
          fail('Should have thrown an error');
        } catch (error) {
          expect(error).toBeInstanceOf(AppError);
          expect((error as AppError).statusCode).toBe(500);
        }
      });
    });

    describe('real-world payload scenarios', () => {
      it('should handle complete WhatsApp text message payload', async () => {
        const realPayload: WhatsAppWebhookPayload = {
          object: 'whatsapp_business_account',
          entry: [{
            id: '123456789',
            changes: [{
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '15551234567',
                  phone_number_id: '987654321',
                },
                contacts: [{
                  profile: {
                    name: 'John Doe',
                  },
                  wa_id: '5511888888888',
                }],
                messages: [{
                  from: '5511888888888',
                  id: 'wamid.HBgLNTUxMTk5OTk5OTk5OQACABEYEjEyM0FCQzQ1Njo3ODlERUY=',
                  timestamp: '1705318200',
                  text: {
                    body: 'Olá, gostaria de agendar uma consulta',
                  },
                  type: 'text',
                }],
              },
              field: 'messages',
            }],
          }],
        };

        await service.processWebhook(realPayload, CORRELATION_ID);

        expect(mockPublishMessage).toHaveBeenCalledTimes(1);
        expect(mockPublishMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            messageId: 'wamid.HBgLNTUxMTk5OTk5OTk5OQACABEYEjEyM0FCQzQ1Njo3ODlERUY=',
            from: '5511888888888',
            text: 'Olá, gostaria de agendar uma consulta',
          })
        );
      });
    });
  });
});
