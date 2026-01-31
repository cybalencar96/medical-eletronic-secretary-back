import { MessageSenderService } from '../../../../../src/modules/whatsapp/services/message-sender.service';
import { IWhatsAppCloudApiClient } from '../../../../../src/modules/whatsapp/clients/whatsapp-cloud-api.client';
import { SendMessageResponse } from '../../../../../src/modules/whatsapp/types/send-message.interface';
import { WhatsAppApiError } from '../../../../../src/shared/errors/WhatsAppApiError';
import { AppError } from '../../../../../src/shared/errors/AppError';

// Mock whatsappConfig before importing
jest.mock('../../../../../src/modules/whatsapp/config/whatsapp.config', () => ({
  whatsappConfig: {
    isMockMode: false,
    validation: {
      minMessageLength: 1,
      maxMessageLength: 4096,
    },
  },
}));

describe('MessageSenderService', () => {
  let service: MessageSenderService;
  let mockApiClient: jest.Mocked<IWhatsAppCloudApiClient>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock API client
    mockApiClient = {
      sendMessage: jest.fn(),
    };

    // Create service with mocked client
    service = new MessageSenderService(mockApiClient);
  });

  describe('sendTextMessage', () => {
    describe('validation', () => {
      it('should throw error for empty message', async () => {
        await expect(service.sendTextMessage('11999999999', '')).rejects.toThrow(AppError);
        await expect(service.sendTextMessage('11999999999', '')).rejects.toThrow(
          'Message cannot be empty'
        );
      });

      it('should throw error for whitespace-only message', async () => {
        await expect(service.sendTextMessage('11999999999', '   ')).rejects.toThrow(AppError);
        await expect(service.sendTextMessage('11999999999', '   ')).rejects.toThrow(
          'Message cannot be empty'
        );
      });

      it('should throw error for null message', async () => {
        await expect(service.sendTextMessage('11999999999', null as any)).rejects.toThrow(
          AppError
        );
        await expect(service.sendTextMessage('11999999999', null as any)).rejects.toThrow(
          'Message content is required'
        );
      });

      it('should throw error for undefined message', async () => {
        await expect(service.sendTextMessage('11999999999', undefined as any)).rejects.toThrow(
          AppError
        );
        await expect(service.sendTextMessage('11999999999', undefined as any)).rejects.toThrow(
          'Message content is required'
        );
      });

      it('should throw error for non-string message', async () => {
        await expect(service.sendTextMessage('11999999999', 123 as any)).rejects.toThrow(AppError);
        await expect(service.sendTextMessage('11999999999', 123 as any)).rejects.toThrow(
          'Message content is required'
        );
      });

      it('should throw error for message exceeding max length', async () => {
        const longMessage = 'a'.repeat(4097);
        await expect(service.sendTextMessage('11999999999', longMessage)).rejects.toThrow(AppError);
        await expect(service.sendTextMessage('11999999999', longMessage)).rejects.toThrow(
          'Message exceeds maximum length of 4096 characters'
        );
      });

      it('should accept message at max length limit', async () => {
        const maxMessage = 'a'.repeat(4096);
        const mockResponse: SendMessageResponse = {
          messaging_product: 'whatsapp',
          messages: [{ id: 'wamid.123' }],
          contacts: [{ input: '+5511999999999', wa_id: '5511999999999' }],
        };
        mockApiClient.sendMessage.mockResolvedValue(mockResponse);

        const result = await service.sendTextMessage('11999999999', maxMessage);

        expect(result.success).toBe(true);
        expect(mockApiClient.sendMessage).toHaveBeenCalled();
      });

      it('should throw error for invalid phone number', async () => {
        await expect(service.sendTextMessage('invalid', 'Hello')).rejects.toThrow(AppError);
      });
    });

    describe('production mode', () => {
      it('should send message via API client with formatted phone number', async () => {
        const mockResponse: SendMessageResponse = {
          messaging_product: 'whatsapp',
          messages: [{ id: 'wamid.123ABC' }],
          contacts: [{ input: '+5511999999999', wa_id: '5511999999999' }],
        };
        mockApiClient.sendMessage.mockResolvedValue(mockResponse);

        const result = await service.sendTextMessage('11999999999', 'Hello World');

        expect(result).toEqual({
          success: true,
          messageId: 'wamid.123ABC',
          isMock: false,
        });

        expect(mockApiClient.sendMessage).toHaveBeenCalledWith({
          messaging_product: 'whatsapp',
          to: '+5511999999999',
          type: 'text',
          text: { body: 'Hello World' },
        });
      });

      it('should format various phone number formats correctly', async () => {
        const mockResponse: SendMessageResponse = {
          messaging_product: 'whatsapp',
          messages: [{ id: 'wamid.456' }],
          contacts: [{ input: '+5521987654321', wa_id: '5521987654321' }],
        };
        mockApiClient.sendMessage.mockResolvedValue(mockResponse);

        await service.sendTextMessage('(21) 98765-4321', 'Test message');

        expect(mockApiClient.sendMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            to: '+5521987654321',
          })
        );
      });

      it('should return error result on WhatsAppApiError', async () => {
        const apiError = new WhatsAppApiError('Invalid phone number', 400, 100, 'trace123');
        mockApiClient.sendMessage.mockRejectedValue(apiError);

        const result = await service.sendTextMessage('11999999999', 'Hello');

        expect(result).toEqual({
          success: false,
          error: 'Invalid phone number',
          errorCode: 400,
          isMock: false,
        });
      });

      it('should return error result on AppError', async () => {
        const appError = new AppError('Service unavailable', 503);
        mockApiClient.sendMessage.mockRejectedValue(appError);

        const result = await service.sendTextMessage('11999999999', 'Hello');

        expect(result).toEqual({
          success: false,
          error: 'Service unavailable',
          errorCode: 503,
          isMock: false,
        });
      });

      it('should return generic error result on unknown error', async () => {
        mockApiClient.sendMessage.mockRejectedValue(new Error('Unknown error'));

        const result = await service.sendTextMessage('11999999999', 'Hello');

        expect(result).toEqual({
          success: false,
          error: 'Unknown error while sending WhatsApp message',
          errorCode: 500,
          isMock: false,
        });
      });
    });

    describe('mock mode', () => {
      beforeEach(() => {
        // Override mock to enable mock mode
        jest.mock('../../../../../src/modules/whatsapp/config/whatsapp.config', () => ({
          whatsappConfig: {
            isMockMode: true,
            validation: {
              minMessageLength: 1,
              maxMessageLength: 4096,
            },
          },
        }));

        // Need to re-import with updated mock
        const { whatsappConfig } = require('../../../../../src/modules/whatsapp/config/whatsapp.config');
        whatsappConfig.isMockMode = true;
      });

      afterEach(() => {
        // Reset mock mode
        const { whatsappConfig } = require('../../../../../src/modules/whatsapp/config/whatsapp.config');
        whatsappConfig.isMockMode = false;
      });

      it('should return mock success without calling API client', async () => {
        const { whatsappConfig } = require('../../../../../src/modules/whatsapp/config/whatsapp.config');
        whatsappConfig.isMockMode = true;

        const result = await service.sendTextMessage('11999999999', 'Mock message');

        expect(result.success).toBe(true);
        expect(result.isMock).toBe(true);
        expect(result.messageId).toMatch(/^mock-\d+$/);
        expect(mockApiClient.sendMessage).not.toHaveBeenCalled();
      });

      it('should validate message and phone in mock mode', async () => {
        const { whatsappConfig } = require('../../../../../src/modules/whatsapp/config/whatsapp.config');
        whatsappConfig.isMockMode = true;

        await expect(service.sendTextMessage('invalid', 'Hello')).rejects.toThrow(AppError);
        await expect(service.sendTextMessage('11999999999', '')).rejects.toThrow(AppError);
      });
    });

    describe('edge cases', () => {
      it('should handle message with leading/trailing whitespace', async () => {
        const mockResponse: SendMessageResponse = {
          messaging_product: 'whatsapp',
          messages: [{ id: 'wamid.789' }],
          contacts: [{ input: '+5511999999999', wa_id: '5511999999999' }],
        };
        mockApiClient.sendMessage.mockResolvedValue(mockResponse);

        const result = await service.sendTextMessage('11999999999', '  Hello World  ');

        expect(result.success).toBe(true);
        expect(mockApiClient.sendMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            text: { body: '  Hello World  ' },
          })
        );
      });

      it('should handle message with special characters', async () => {
        const mockResponse: SendMessageResponse = {
          messaging_product: 'whatsapp',
          messages: [{ id: 'wamid.special' }],
          contacts: [{ input: '+5511999999999', wa_id: '5511999999999' }],
        };
        mockApiClient.sendMessage.mockResolvedValue(mockResponse);

        const specialMessage = 'Hello! 🎉 @user #hashtag';
        const result = await service.sendTextMessage('11999999999', specialMessage);

        expect(result.success).toBe(true);
        expect(mockApiClient.sendMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            text: { body: specialMessage },
          })
        );
      });

      it('should handle message with newlines', async () => {
        const mockResponse: SendMessageResponse = {
          messaging_product: 'whatsapp',
          messages: [{ id: 'wamid.newline' }],
          contacts: [{ input: '+5511999999999', wa_id: '5511999999999' }],
        };
        mockApiClient.sendMessage.mockResolvedValue(mockResponse);

        const multilineMessage = 'Line 1\nLine 2\nLine 3';
        const result = await service.sendTextMessage('11999999999', multilineMessage);

        expect(result.success).toBe(true);
        expect(mockApiClient.sendMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            text: { body: multilineMessage },
          })
        );
      });
    });
  });
});
