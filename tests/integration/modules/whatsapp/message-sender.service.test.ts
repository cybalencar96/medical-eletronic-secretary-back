import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { MessageSenderService } from '../../../../src/modules/whatsapp/services/message-sender.service';
import { WhatsAppCloudApiClient } from '../../../../src/modules/whatsapp/clients/whatsapp-cloud-api.client';
import { whatsappConfig } from '../../../../src/modules/whatsapp/config/whatsapp.config';

describe('MessageSenderService Integration Tests', () => {
  let mockAxios: MockAdapter;
  let service: MessageSenderService;
  let client: WhatsAppCloudApiClient;

  const baseUrl = `${whatsappConfig.apiBaseUrl}/${whatsappConfig.apiVersion}`;

  beforeAll(() => {
    // Create mock adapter for axios
    mockAxios = new MockAdapter(axios, { delayResponse: 0 });
  });

  beforeEach(() => {
    // Reset mock adapter
    mockAxios.reset();

    // Create real client with mocked axios
    const axiosInstance = axios.create({
      baseURL: baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${whatsappConfig.accessToken}`,
      },
    });

    client = new WhatsAppCloudApiClient(axiosInstance);
    service = new MessageSenderService(client);
  });

  afterAll(() => {
    // Restore axios
    mockAxios.restore();
  });

  describe('end-to-end message sending', () => {
    it('should send message successfully and return message ID', async () => {
      const mockResponse = {
        messaging_product: 'whatsapp',
        messages: [{ id: 'wamid.integration123' }],
        contacts: [{ input: '+5511999999999', wa_id: '5511999999999' }],
      };

      mockAxios.onPost(`/${whatsappConfig.phoneId}/messages`).reply(200, mockResponse);

      const result = await service.sendTextMessage('11999999999', 'Integration test message');

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('wamid.integration123');
      expect(result.isMock).toBe(false);
    });

    it('should format phone number correctly in request', async () => {
      const mockResponse = {
        messaging_product: 'whatsapp',
        messages: [{ id: 'wamid.phone-format' }],
        contacts: [{ input: '+5521987654321', wa_id: '5521987654321' }],
      };

      mockAxios.onPost(`/${whatsappConfig.phoneId}/messages`).reply((config) => {
        const requestData = JSON.parse(config.data);
        expect(requestData.to).toBe('+5521987654321');
        expect(requestData.messaging_product).toBe('whatsapp');
        expect(requestData.type).toBe('text');
        expect(requestData.text.body).toBe('Test message');
        return [200, mockResponse];
      });

      const result = await service.sendTextMessage('(21) 98765-4321', 'Test message');

      expect(result.success).toBe(true);
    });
  });

  describe('rate limiting and retry', () => {
    it('should retry on 429 rate limit and succeed', async () => {
      const errorResponse = {
        error: {
          message: 'Rate limit exceeded',
          type: 'OAuthException',
          code: 4,
          fbtrace_id: 'trace-rate-limit',
        },
      };

      const successResponse = {
        messaging_product: 'whatsapp',
        messages: [{ id: 'wamid.retry-success' }],
        contacts: [{ input: '+5511999999999', wa_id: '5511999999999' }],
      };

      let attempt = 0;
      mockAxios.onPost(`/${whatsappConfig.phoneId}/messages`).reply(() => {
        attempt++;
        if (attempt <= 2) {
          return [429, errorResponse];
        }
        return [200, successResponse];
      });

      const result = await service.sendTextMessage('11999999999', 'Test retry');

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('wamid.retry-success');
      expect(attempt).toBe(3); // Failed twice, succeeded on third
    });

    it('should fail after max retry attempts on persistent 429', async () => {
      const errorResponse = {
        error: {
          message: 'Rate limit exceeded',
          type: 'OAuthException',
          code: 4,
          fbtrace_id: 'trace-persistent',
        },
      };

      mockAxios.onPost(`/${whatsappConfig.phoneId}/messages`).reply(429, errorResponse);

      const result = await service.sendTextMessage('11999999999', 'Test max retries');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Rate limit exceeded');
      expect(result.errorCode).toBe(429);
    });
  });

  describe('error handling', () => {
    it('should handle 400 bad request without retry', async () => {
      const errorResponse = {
        error: {
          message: 'Invalid phone number format',
          type: 'ApiException',
          code: 100,
          fbtrace_id: 'trace-bad-request',
        },
      };

      let requestCount = 0;
      mockAxios.onPost(`/${whatsappConfig.phoneId}/messages`).reply(() => {
        requestCount++;
        return [400, errorResponse];
      });

      const result = await service.sendTextMessage('11999999999', 'Test 400 error');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid phone number format');
      expect(result.errorCode).toBe(400);
      expect(requestCount).toBe(1); // No retries on 400
    });

    it('should handle 401 unauthorized without retry', async () => {
      const errorResponse = {
        error: {
          message: 'Invalid access token',
          type: 'OAuthException',
          code: 190,
          fbtrace_id: 'trace-unauthorized',
        },
      };

      let requestCount = 0;
      mockAxios.onPost(`/${whatsappConfig.phoneId}/messages`).reply(() => {
        requestCount++;
        return [401, errorResponse];
      });

      const result = await service.sendTextMessage('11999999999', 'Test 401 error');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid access token');
      expect(result.errorCode).toBe(401);
      expect(requestCount).toBe(1); // No retries on 401
    });

    it('should retry on 500 server error and succeed', async () => {
      const errorResponse = {
        error: {
          message: 'Internal server error',
          type: 'ApiException',
          code: 1,
          fbtrace_id: 'trace-500',
        },
      };

      const successResponse = {
        messaging_product: 'whatsapp',
        messages: [{ id: 'wamid.500-recovery' }],
        contacts: [{ input: '+5511999999999', wa_id: '5511999999999' }],
      };

      let attempt = 0;
      mockAxios.onPost(`/${whatsappConfig.phoneId}/messages`).reply(() => {
        attempt++;
        if (attempt === 1) {
          return [500, errorResponse];
        }
        return [200, successResponse];
      });

      const result = await service.sendTextMessage('11999999999', 'Test 500 recovery');

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('wamid.500-recovery');
      expect(attempt).toBe(2);
    });

    it('should handle network timeout and retry', async () => {
      const successResponse = {
        messaging_product: 'whatsapp',
        messages: [{ id: 'wamid.timeout-recovery' }],
        contacts: [{ input: '+5511999999999', wa_id: '5511999999999' }],
      };

      let attempt = 0;
      mockAxios.onPost(`/${whatsappConfig.phoneId}/messages`).reply(() => {
        attempt++;
        if (attempt === 1) {
          return [500, {}, { 'x-request-id': 'timeout-test' }]; // Simulate timeout
        }
        return [200, successResponse];
      });

      const result = await service.sendTextMessage('11999999999', 'Test timeout');

      expect(result.success).toBe(true);
      expect(attempt).toBe(2);
    });
  });

  describe('validation integration', () => {
    it('should reject invalid phone number before API call', async () => {
      // Mock should not be called
      mockAxios.onPost(`/${whatsappConfig.phoneId}/messages`).reply(200, {
        messaging_product: 'whatsapp',
        messages: [{ id: 'should-not-reach' }],
        contacts: [{ input: '+invalid', wa_id: 'invalid' }],
      });

      await expect(service.sendTextMessage('invalid', 'Test')).rejects.toThrow();

      // Verify no API call was made
      expect(mockAxios.history.post.length).toBe(0);
    });

    it('should reject empty message before API call', async () => {
      // Mock should not be called
      mockAxios.onPost(`/${whatsappConfig.phoneId}/messages`).reply(200, {
        messaging_product: 'whatsapp',
        messages: [{ id: 'should-not-reach' }],
        contacts: [{ input: '+5511999999999', wa_id: '5511999999999' }],
      });

      await expect(service.sendTextMessage('11999999999', '')).rejects.toThrow();

      // Verify no API call was made
      expect(mockAxios.history.post.length).toBe(0);
    });

    it('should reject message exceeding max length before API call', async () => {
      const longMessage = 'a'.repeat(4097);

      await expect(service.sendTextMessage('11999999999', longMessage)).rejects.toThrow();

      // Verify no API call was made
      expect(mockAxios.history.post.length).toBe(0);
    });
  });

  describe('special message content', () => {
    it('should handle message with emojis', async () => {
      const mockResponse = {
        messaging_product: 'whatsapp',
        messages: [{ id: 'wamid.emoji' }],
        contacts: [{ input: '+5511999999999', wa_id: '5511999999999' }],
      };

      mockAxios.onPost(`/${whatsappConfig.phoneId}/messages`).reply((config) => {
        const requestData = JSON.parse(config.data);
        expect(requestData.text.body).toBe('Hello 👋 World 🌍');
        return [200, mockResponse];
      });

      const result = await service.sendTextMessage('11999999999', 'Hello 👋 World 🌍');

      expect(result.success).toBe(true);
    });

    it('should handle message with newlines', async () => {
      const mockResponse = {
        messaging_product: 'whatsapp',
        messages: [{ id: 'wamid.newline' }],
        contacts: [{ input: '+5511999999999', wa_id: '5511999999999' }],
      };

      const multilineMessage = 'Line 1\nLine 2\nLine 3';

      mockAxios.onPost(`/${whatsappConfig.phoneId}/messages`).reply((config) => {
        const requestData = JSON.parse(config.data);
        expect(requestData.text.body).toBe(multilineMessage);
        return [200, mockResponse];
      });

      const result = await service.sendTextMessage('11999999999', multilineMessage);

      expect(result.success).toBe(true);
    });

    it('should handle message with special characters', async () => {
      const mockResponse = {
        messaging_product: 'whatsapp',
        messages: [{ id: 'wamid.special' }],
        contacts: [{ input: '+5511999999999', wa_id: '5511999999999' }],
      };

      const specialMessage = 'Test @mention #hashtag $price & more!';

      mockAxios.onPost(`/${whatsappConfig.phoneId}/messages`).reply((config) => {
        const requestData = JSON.parse(config.data);
        expect(requestData.text.body).toBe(specialMessage);
        return [200, mockResponse];
      });

      const result = await service.sendTextMessage('11999999999', specialMessage);

      expect(result.success).toBe(true);
    });
  });
});
