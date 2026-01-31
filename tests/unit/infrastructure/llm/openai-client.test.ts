import OpenAI from 'openai';
import { OpenAIClient } from '../../../../src/infrastructure/llm/openai-client';
import { LLMError, LLM_ERROR_TYPES } from '../../../../src/shared/errors/LLMError';

// Mock OpenAI SDK
jest.mock('openai');

describe('OpenAIClient', () => {
  let mockOpenAI: jest.Mocked<OpenAI>;
  let client: OpenAIClient;

  beforeEach(() => {
    mockOpenAI = {
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
    } as any;

    client = new OpenAIClient(mockOpenAI);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createChatCompletion', () => {
    it('should return parsed JSON response on success', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({ intent: 'book', confidence: 0.95, entities: {} }),
            },
          },
        ],
        model: 'gpt-4o-mini',
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
        },
        _request_id: 'req-123',
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse as any);

      const result = await client.createChatCompletion<any>({
        messages: [
          { role: 'system', content: 'Test system prompt' },
          { role: 'user', content: 'Test user message' },
        ],
        correlationId: 'corr-123',
      });

      expect(result).toEqual({ intent: 'book', confidence: 0.95, entities: {} });
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: expect.any(String),
        messages: [
          { role: 'system', content: 'Test system prompt' },
          { role: 'user', content: 'Test user message' },
        ],
        temperature: expect.any(Number),
        max_tokens: expect.any(Number),
        response_format: { type: 'json_object' },
      });
    });

    it('should throw LLMError when response content is empty', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: null,
            },
          },
        ],
        _request_id: 'req-123',
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse as any);

      await expect(
        client.createChatCompletion({
          messages: [{ role: 'user', content: 'Test' }],
        }),
      ).rejects.toThrow(LLMError);

      await expect(
        client.createChatCompletion({
          messages: [{ role: 'user', content: 'Test' }],
        }),
      ).rejects.toMatchObject({
        errorType: LLM_ERROR_TYPES.INVALID_RESPONSE,
        statusCode: 500,
      });
    });

    it('should throw LLMError on JSON parse error', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'invalid json',
            },
          },
        ],
        _request_id: 'req-123',
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse as any);

      await expect(
        client.createChatCompletion({
          messages: [{ role: 'user', content: 'Test' }],
        }),
      ).rejects.toThrow(LLMError);

      await expect(
        client.createChatCompletion({
          messages: [{ role: 'user', content: 'Test' }],
        }),
      ).rejects.toMatchObject({
        errorType: LLM_ERROR_TYPES.INVALID_RESPONSE,
      });
    });

    it('should handle AuthenticationError from OpenAI SDK', async () => {
      const authError = new OpenAI.AuthenticationError(
        401,
        {
          error: { message: 'Invalid API key', type: 'invalid_request_error' },
        } as any,
        'Authentication failed',
        {} as any,
      );
      (authError as any).request_id = 'req-123';

      mockOpenAI.chat.completions.create.mockRejectedValue(authError);

      await expect(
        client.createChatCompletion({
          messages: [{ role: 'user', content: 'Test' }],
        }),
      ).rejects.toThrow(LLMError);

      await expect(
        client.createChatCompletion({
          messages: [{ role: 'user', content: 'Test' }],
        }),
      ).rejects.toMatchObject({
        errorType: LLM_ERROR_TYPES.AUTHENTICATION_FAILED,
        statusCode: 401,
      });
    });

    it('should handle RateLimitError from OpenAI SDK', async () => {
      const rateLimitError = new OpenAI.RateLimitError(
        429,
        {
          error: { message: 'Rate limit exceeded', type: 'rate_limit_error' },
        } as any,
        'Rate limit exceeded',
        {} as any,
      );
      (rateLimitError as any).request_id = 'req-123';

      mockOpenAI.chat.completions.create.mockRejectedValue(rateLimitError);

      await expect(
        client.createChatCompletion({
          messages: [{ role: 'user', content: 'Test' }],
        }),
      ).rejects.toThrow(LLMError);

      await expect(
        client.createChatCompletion({
          messages: [{ role: 'user', content: 'Test' }],
        }),
      ).rejects.toMatchObject({
        errorType: LLM_ERROR_TYPES.RATE_LIMIT_EXCEEDED,
        statusCode: 429,
      });
    });

    it('should handle BadRequestError from OpenAI SDK', async () => {
      const badRequestError = new OpenAI.BadRequestError(
        400,
        {
          error: { message: 'Invalid request', type: 'invalid_request_error' },
        } as any,
        'Bad request',
        {} as any,
      );
      (badRequestError as any).request_id = 'req-123';

      mockOpenAI.chat.completions.create.mockRejectedValue(badRequestError);

      await expect(
        client.createChatCompletion({
          messages: [{ role: 'user', content: 'Test' }],
        }),
      ).rejects.toThrow(LLMError);

      await expect(
        client.createChatCompletion({
          messages: [{ role: 'user', content: 'Test' }],
        }),
      ).rejects.toMatchObject({
        errorType: LLM_ERROR_TYPES.INVALID_RESPONSE,
        statusCode: 400,
      });
    });

    it('should handle InternalServerError from OpenAI SDK', async () => {
      const serverError = new OpenAI.InternalServerError(
        500,
        {
          error: { message: 'Internal server error', type: 'server_error' },
        } as any,
        'Server error',
        {} as any,
      );

      mockOpenAI.chat.completions.create.mockRejectedValue(serverError);

      await expect(
        client.createChatCompletion({
          messages: [{ role: 'user', content: 'Test' }],
        }),
      ).rejects.toThrow(LLMError);

      await expect(
        client.createChatCompletion({
          messages: [{ role: 'user', content: 'Test' }],
        }),
      ).rejects.toMatchObject({
        errorType: LLM_ERROR_TYPES.API_ERROR,
        statusCode: 500,
      });
    });

    it('should handle APIConnectionTimeoutError from OpenAI SDK', async () => {
      const timeoutError = new OpenAI.APIConnectionTimeoutError({
        message: 'Request timeout',
      });

      mockOpenAI.chat.completions.create.mockRejectedValue(timeoutError);

      await expect(
        client.createChatCompletion({
          messages: [{ role: 'user', content: 'Test' }],
        }),
      ).rejects.toThrow(LLMError);

      await expect(
        client.createChatCompletion({
          messages: [{ role: 'user', content: 'Test' }],
        }),
      ).rejects.toMatchObject({
        errorType: LLM_ERROR_TYPES.TIMEOUT,
        statusCode: 504,
      });
    });

    it('should handle APIConnectionError from OpenAI SDK', async () => {
      const connectionError = new OpenAI.APIConnectionError({
        message: 'Connection error',
      });

      mockOpenAI.chat.completions.create.mockRejectedValue(connectionError);

      await expect(
        client.createChatCompletion({
          messages: [{ role: 'user', content: 'Test' }],
        }),
      ).rejects.toThrow(LLMError);

      await expect(
        client.createChatCompletion({
          messages: [{ role: 'user', content: 'Test' }],
        }),
      ).rejects.toMatchObject({
        errorType: LLM_ERROR_TYPES.NETWORK_ERROR,
        statusCode: 500,
      });
    });

    it('should handle generic errors', async () => {
      const genericError = new Error('Generic error');

      mockOpenAI.chat.completions.create.mockRejectedValue(genericError);

      await expect(
        client.createChatCompletion({
          messages: [{ role: 'user', content: 'Test' }],
        }),
      ).rejects.toThrow(LLMError);

      await expect(
        client.createChatCompletion({
          messages: [{ role: 'user', content: 'Test' }],
        }),
      ).rejects.toMatchObject({
        errorType: LLM_ERROR_TYPES.UNKNOWN,
        statusCode: 500,
      });
    });
  });
});
