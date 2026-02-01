import request from 'supertest';
import { createHmac } from 'crypto';
import { app } from '../../../../src/app';
import { queueService } from '../../../../src/infrastructure/queue/queue.service';
import { WhatsAppWebhookPayload } from '../../../../src/modules/whatsapp/types/webhook-payload.interface';

// Mock queue service
jest.mock('../../../../src/infrastructure/queue/queue.service');

describe('WhatsApp Webhook Routes Integration', () => {
  const WEBHOOK_SECRET = 'test-webhook-secret';
  const VERIFY_TOKEN = 'test-verify-token';

  beforeAll(() => {
    // Set environment variables for testing
    process.env.WHATSAPP_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.WHATSAPP_VERIFY_TOKEN = VERIFY_TOKEN;
    process.env.WHATSAPP_MOCK = 'false'; // Ensure mock mode is off for real testing
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (queueService.publishMessage as jest.Mock).mockResolvedValue(undefined);
  });

  describe('GET /webhook/whatsapp - Verification', () => {
    it('should return challenge for valid verification request', async () => {
      const challenge = 'test-challenge-123';
      const response = await request(app)
        .get('/webhook/whatsapp')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': VERIFY_TOKEN,
          'hub.challenge': challenge,
        });

      expect(response.status).toBe(200);
      expect(response.text).toBe(challenge);
    });

    it('should return 403 for invalid verify token', async () => {
      const response = await request(app)
        .get('/webhook/whatsapp')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'wrong-token',
          'hub.challenge': 'test-challenge',
        });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 403 for invalid mode', async () => {
      const response = await request(app)
        .get('/webhook/whatsapp')
        .query({
          'hub.mode': 'unsubscribe',
          'hub.verify_token': VERIFY_TOKEN,
          'hub.challenge': 'test-challenge',
        });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for missing parameters', async () => {
      const response = await request(app)
        .get('/webhook/whatsapp')
        .query({
          'hub.mode': 'subscribe',
          // Missing verify_token and challenge
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for missing challenge', async () => {
      const response = await request(app)
        .get('/webhook/whatsapp')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': VERIFY_TOKEN,
          // Missing challenge
        });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /webhook/whatsapp - Message Reception', () => {
    const createValidPayload = (): WhatsAppWebhookPayload => ({
      object: 'whatsapp_business_account',
      entry: [{
        id: '123456789',
        changes: [{
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              phone_number_id: '987654321',
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
    });

    const generateSignature = (body: string): string => {
      const hmac = createHmac('sha256', WEBHOOK_SECRET);
      hmac.update(body);
      return `sha256=${hmac.digest('hex')}`;
    };

    it('should accept valid webhook with correct signature', async () => {
      const payload = createValidPayload();
      const body = JSON.stringify(payload);
      const signature = generateSignature(body);

      const response = await request(app)
        .post('/webhook/whatsapp')
        .set('X-Hub-Signature-256', signature)
        .set('Content-Type', 'application/json')
        .send(body);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
      expect(queueService.publishMessage).toHaveBeenCalledTimes(1);
    });

    it('should publish message to queue with correct data', async () => {
      const payload = createValidPayload();
      const body = JSON.stringify(payload);
      const signature = generateSignature(body);

      await request(app)
        .post('/webhook/whatsapp')
        .set('X-Hub-Signature-256', signature)
        .set('Content-Type', 'application/json')
        .send(body);

      expect(queueService.publishMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: 'wamid.123',
          from: '5511888888888',
          text: 'Quero marcar uma consulta',
          phoneNumberId: '987654321',
        })
      );
    });

    it('should reject webhook with invalid signature', async () => {
      const payload = createValidPayload();
      const body = JSON.stringify(payload);
      const invalidSignature = 'sha256=invalid_signature';

      const response = await request(app)
        .post('/webhook/whatsapp')
        .set('X-Hub-Signature-256', invalidSignature)
        .set('Content-Type', 'application/json')
        .send(body);

      expect(response.status).toBe(401);
      expect(queueService.publishMessage).not.toHaveBeenCalled();
    });

    it('should reject webhook with missing signature', async () => {
      const payload = createValidPayload();

      const response = await request(app)
        .post('/webhook/whatsapp')
        .set('Content-Type', 'application/json')
        .send(payload);

      expect(response.status).toBe(401);
      expect(queueService.publishMessage).not.toHaveBeenCalled();
    });

    it('should reject malformed JSON payload', async () => {
      const malformedBody = '{ invalid json }';
      const signature = generateSignature(malformedBody);

      const response = await request(app)
        .post('/webhook/whatsapp')
        .set('X-Hub-Signature-256', signature)
        .set('Content-Type', 'application/json')
        .send(malformedBody);

      // Express JSON parser throws SyntaxError for malformed JSON,
      // which is handled as a 500 Internal Server Error
      expect(response.status).toBe(500);
      expect(queueService.publishMessage).not.toHaveBeenCalled();
    });

    it('should reject empty body', async () => {
      const emptyBody = '';
      const signature = generateSignature(emptyBody);

      const response = await request(app)
        .post('/webhook/whatsapp')
        .set('X-Hub-Signature-256', signature)
        .set('Content-Type', 'application/json')
        .send(emptyBody);

      expect(response.status).toBe(400);
    });

    it('should handle payload with missing required fields', async () => {
      const invalidPayload = { object: 'whatsapp_business_account' };
      const body = JSON.stringify(invalidPayload);
      const signature = generateSignature(body);

      const response = await request(app)
        .post('/webhook/whatsapp')
        .set('X-Hub-Signature-256', signature)
        .set('Content-Type', 'application/json')
        .send(body);

      expect(response.status).toBe(200); // Service handles gracefully
      expect(queueService.publishMessage).not.toHaveBeenCalled();
    });

    it('should handle multiple messages in single webhook', async () => {
      const payload: WhatsAppWebhookPayload = {
        object: 'whatsapp_business_account',
        entry: [{
          id: '123456789',
          changes: [{
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                phone_number_id: '987654321',
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

      const body = JSON.stringify(payload);
      const signature = generateSignature(body);

      const response = await request(app)
        .post('/webhook/whatsapp')
        .set('X-Hub-Signature-256', signature)
        .set('Content-Type', 'application/json')
        .send(body);

      expect(response.status).toBe(200);
      expect(queueService.publishMessage).toHaveBeenCalledTimes(2);
    });

    it('should skip non-text messages', async () => {
      const payload: WhatsAppWebhookPayload = {
        object: 'whatsapp_business_account',
        entry: [{
          id: '123456789',
          changes: [{
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                phone_number_id: '987654321',
                display_phone_number: '5511999999999',
              },
              messages: [
                {
                  id: 'wamid.image',
                  from: '5511888888888',
                  timestamp: '1705318200',
                  type: 'image',
                },
              ],
            },
          }],
        }],
      };

      const body = JSON.stringify(payload);
      const signature = generateSignature(body);

      const response = await request(app)
        .post('/webhook/whatsapp')
        .set('X-Hub-Signature-256', signature)
        .set('Content-Type', 'application/json')
        .send(body);

      expect(response.status).toBe(200);
      expect(queueService.publishMessage).not.toHaveBeenCalled();
    });

    it('should return 500 if queue publishing fails', async () => {
      (queueService.publishMessage as jest.Mock).mockRejectedValueOnce(
        new Error('Queue connection failed')
      );

      const payload = createValidPayload();
      const body = JSON.stringify(payload);
      const signature = generateSignature(body);

      const response = await request(app)
        .post('/webhook/whatsapp')
        .set('X-Hub-Signature-256', signature)
        .set('Content-Type', 'application/json')
        .send(body);

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /webhook/whatsapp - Mock Mode', () => {
    beforeAll(() => {
      process.env.WHATSAPP_MOCK = 'true';
    });

    afterAll(() => {
      process.env.WHATSAPP_MOCK = 'false';
    });

    it('should bypass signature validation in mock mode', async () => {
      const payload: WhatsAppWebhookPayload = {
        object: 'whatsapp_business_account',
        entry: [{
          id: '123456789',
          changes: [{
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                phone_number_id: '987654321',
                display_phone_number: '5511999999999',
              },
              messages: [{
                id: 'wamid.mock',
                from: '5511888888888',
                timestamp: '1705318200',
                type: 'text',
                text: { body: 'Mock message' },
              }],
            },
          }],
        }],
      };

      // Send without signature header
      const response = await request(app)
        .post('/webhook/whatsapp')
        .set('Content-Type', 'application/json')
        .send(payload);

      expect(response.status).toBe(200);
      expect(queueService.publishMessage).toHaveBeenCalledTimes(1);
    });

    it('should still process messages correctly in mock mode', async () => {
      const payload: WhatsAppWebhookPayload = {
        object: 'whatsapp_business_account',
        entry: [{
          id: '123456789',
          changes: [{
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                phone_number_id: '987654321',
                display_phone_number: '5511999999999',
              },
              messages: [{
                id: 'wamid.mock',
                from: '5511888888888',
                timestamp: '1705318200',
                type: 'text',
                text: { body: 'Mock test message' },
              }],
            },
          }],
        }],
      };

      await request(app)
        .post('/webhook/whatsapp')
        .set('Content-Type', 'application/json')
        .send(payload);

      expect(queueService.publishMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: 'wamid.mock',
          text: 'Mock test message',
        })
      );
    });
  });

  describe('Real-world WhatsApp payload scenarios', () => {
    it('should handle complete WhatsApp Cloud API payload', async () => {
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
                  body: 'Olá, gostaria de agendar uma consulta para amanhã',
                },
                type: 'text',
              }],
            },
            field: 'messages',
          }],
        }],
      };

      const body = JSON.stringify(realPayload);
      const signature = createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');

      const response = await request(app)
        .post('/webhook/whatsapp')
        .set('X-Hub-Signature-256', `sha256=${signature}`)
        .set('Content-Type', 'application/json')
        .send(body);

      expect(response.status).toBe(200);
      expect(queueService.publishMessage).toHaveBeenCalledTimes(1);
      expect(queueService.publishMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: 'wamid.HBgLNTUxMTk5OTk5OTk5OQACABEYEjEyM0FCQzQ1Njo3ODlERUY=',
          from: '5511888888888',
          text: 'Olá, gostaria de agendar uma consulta para amanhã',
        })
      );
    });
  });
});
