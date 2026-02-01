import { IntentClassifier } from '../../../../src/infrastructure/llm/intent-classifier';
import { IOpenAIClient } from '../../../../src/infrastructure/llm/openai-client';
import { ClassifiedIntent } from '../../../../src/shared/types/classified-intent';
import { LLMError, LLM_ERROR_TYPES } from '../../../../src/shared/errors/LLMError';

// Mock OpenAI client
class MockOpenAIClient implements IOpenAIClient {
  public mockResponse: ClassifiedIntent | null = null;
  public mockError: Error | null = null;

  async createChatCompletion<T>(): Promise<T> {
    if (this.mockError) {
      throw this.mockError;
    }
    if (!this.mockResponse) {
      throw new Error('Mock response not set');
    }
    return this.mockResponse as unknown as T;
  }

  setMockResponse(response: ClassifiedIntent): void {
    this.mockResponse = response;
    this.mockError = null;
  }

  setMockError(error: Error): void {
    this.mockError = error;
    this.mockResponse = null;
  }
}

describe('IntentClassifier', () => {
  let mockClient: MockOpenAIClient;
  let classifier: IntentClassifier;

  beforeEach(() => {
    mockClient = new MockOpenAIClient();
    classifier = new IntentClassifier(mockClient);
  });

  describe('classify', () => {
    it('should classify "book" intent with entities', async () => {
      mockClient.setMockResponse({
        intent: 'book',
        confidence: 0.95,
        entities: {
          date: '2025-02-15',
          time: '09:00',
        },
      });

      const result = await classifier.classify('Quero marcar uma consulta para sábado às 9h');

      expect(result.intent).toBe('book');
      expect(result.confidence).toBe(0.95);
      expect(result.entities.date).toBe('2025-02-15');
      expect(result.entities.time).toBe('09:00');
    });

    it('should classify "reschedule" intent with date entity', async () => {
      mockClient.setMockResponse({
        intent: 'reschedule',
        confidence: 0.85,
        entities: {
          date: '15/02/2025',
        },
      });

      const result = await classifier.classify('Preciso remarcar minha consulta do dia 15');

      expect(result.intent).toBe('reschedule');
      expect(result.confidence).toBe(0.85);
      expect(result.entities.date).toBe('2025-02-15'); // Normalized from DD/MM/YYYY
    });

    it('should classify "cancel" intent with reason entity', async () => {
      mockClient.setMockResponse({
        intent: 'cancel',
        confidence: 0.90,
        entities: {
          reason: 'Não posso comparecer',
        },
      });

      const result = await classifier.classify('Gostaria de cancelar minha consulta');

      expect(result.intent).toBe('cancel');
      expect(result.confidence).toBe(0.90);
      expect(result.entities.reason).toBe('Não posso comparecer');
    });

    it('should classify "confirm" intent', async () => {
      mockClient.setMockResponse({
        intent: 'confirm',
        confidence: 0.95,
        entities: {},
      });

      const result = await classifier.classify('Sim, confirmo minha consulta');

      expect(result.intent).toBe('confirm');
      expect(result.confidence).toBe(0.95);
    });

    it('should classify "query" intent', async () => {
      mockClient.setMockResponse({
        intent: 'query',
        confidence: 0.90,
        entities: {},
      });

      const result = await classifier.classify('Quais horários estão disponíveis?');

      expect(result.intent).toBe('query');
      expect(result.confidence).toBe(0.90);
    });

    it('should classify ambiguous message as "escalate" intent', async () => {
      mockClient.setMockResponse({
        intent: 'escalate',
        confidence: 0.20,
        entities: {},
      });

      const result = await classifier.classify('Oi tudo bem?');

      expect(result.intent).toBe('escalate');
      expect(result.confidence).toBe(0.20);
    });

    it('should trigger escalation when confidence is below threshold (0.7)', async () => {
      mockClient.setMockResponse({
        intent: 'book',
        confidence: 0.65, // Below 0.7 threshold
        entities: {},
      });

      const result = await classifier.classify('Some ambiguous message');

      expect(result.intent).toBe('escalate'); // Overridden to escalate
      expect(result.confidence).toBe(0.65);
    });

    it('should not trigger escalation when confidence is at threshold (0.7)', async () => {
      mockClient.setMockResponse({
        intent: 'book',
        confidence: 0.70,
        entities: {},
      });

      const result = await classifier.classify('Clear booking message');

      expect(result.intent).toBe('book'); // Not overridden
      expect(result.confidence).toBe(0.70);
    });

    it('should normalize time entities in coloquial format', async () => {
      mockClient.setMockResponse({
        intent: 'book',
        confidence: 0.95,
        entities: {
          time: '9 da manhã',
        },
      });

      const result = await classifier.classify('Quero marcar para 9 da manhã');

      expect(result.entities.time).toBe('09:00');
    });

    it('should normalize date entities in Brazilian format', async () => {
      mockClient.setMockResponse({
        intent: 'book',
        confidence: 0.95,
        entities: {
          date: '15/02/2025',
        },
      });

      const result = await classifier.classify('Quero marcar para 15/02/2025');

      expect(result.entities.date).toBe('2025-02-15');
    });

    it('should throw LLMError when message is null', async () => {
      await expect(classifier.classify(null as unknown as string)).rejects.toThrow(LLMError);
      await expect(classifier.classify(null as unknown as string)).rejects.toMatchObject({
        errorType: LLM_ERROR_TYPES.VALIDATION_FAILED,
        statusCode: 400,
      });
    });

    it('should throw LLMError when message is undefined', async () => {
      await expect(classifier.classify(undefined as unknown as string)).rejects.toThrow(LLMError);
      await expect(classifier.classify(undefined as unknown as string)).rejects.toMatchObject({
        errorType: LLM_ERROR_TYPES.VALIDATION_FAILED,
        statusCode: 400,
      });
    });

    it('should throw LLMError when message is empty', async () => {
      await expect(classifier.classify('')).rejects.toThrow(LLMError);
      await expect(classifier.classify('   ')).rejects.toThrow(LLMError);
    });

    it('should throw LLMError when message exceeds maximum length', async () => {
      const longMessage = 'a'.repeat(4001); // MAX_MESSAGE_LENGTH = 4000
      await expect(classifier.classify(longMessage)).rejects.toThrow(LLMError);
      await expect(classifier.classify(longMessage)).rejects.toMatchObject({
        errorType: LLM_ERROR_TYPES.VALIDATION_FAILED,
        statusCode: 400,
      });
    });

    it('should throw LLMError when OpenAI response fails Zod validation', async () => {
      mockClient.setMockResponse({
        intent: 'invalid_intent' as any,
        confidence: 0.95,
        entities: {},
      });

      await expect(classifier.classify('Test message')).rejects.toThrow(LLMError);
      await expect(classifier.classify('Test message')).rejects.toMatchObject({
        errorType: LLM_ERROR_TYPES.VALIDATION_FAILED,
      });
    });

    it('should throw LLMError when OpenAI response has invalid confidence', async () => {
      mockClient.setMockResponse({
        intent: 'book',
        confidence: 1.5, // Invalid: > 1.0
        entities: {},
      });

      await expect(classifier.classify('Test message')).rejects.toThrow(LLMError);
    });

    it('should normalize invalid time format to undefined', async () => {
      mockClient.setMockResponse({
        intent: 'book',
        confidence: 0.95,
        entities: {
          time: '25:00', // Invalid hour - normalizeTime returns undefined
        },
      });

      const result = await classifier.classify('Test message');
      expect(result.entities.time).toBeUndefined();
    });

    it('should rethrow LLMError from OpenAI client', async () => {
      const llmError = new LLMError(
        'OpenAI API error',
        LLM_ERROR_TYPES.API_ERROR,
        500,
      );
      mockClient.setMockError(llmError);

      await expect(classifier.classify('Test message')).rejects.toThrow(llmError);
    });

    it('should wrap unexpected errors as LLMError', async () => {
      const unexpectedError = new Error('Unexpected error');
      mockClient.setMockError(unexpectedError);

      await expect(classifier.classify('Test message')).rejects.toThrow(LLMError);
      await expect(classifier.classify('Test message')).rejects.toMatchObject({
        errorType: LLM_ERROR_TYPES.UNKNOWN,
      });
    });
  });
});
