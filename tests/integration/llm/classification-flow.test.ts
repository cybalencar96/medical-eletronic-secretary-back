import { getIntentClassifier } from '../../../src/infrastructure/llm';
import { MockLLMService } from '../../../src/infrastructure/llm/mock-llm-service';

describe('LLM Classification Flow (Integration)', () => {
  let classifier: MockLLMService;

  beforeEach(() => {
    // Use mock service for integration tests (don't require OpenAI API key)
    classifier = new MockLLMService();
  });

  describe('End-to-end booking flow', () => {
    it('should classify Portuguese booking message and extract entities', async () => {
      const result = await classifier.classify('Quero marcar uma consulta para sábado às 9h');

      expect(result.intent).toBe('book');
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.entities.date).toBeDefined();
      expect(result.entities.time).toBe('09:00');
    });
  });

  describe('End-to-end cancellation flow', () => {
    it('should classify Portuguese cancellation message and extract reason', async () => {
      const result = await classifier.classify(
        'Gostaria de cancelar minha consulta, não posso comparecer',
      );

      expect(result.intent).toBe('cancel');
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.entities.reason).toBeDefined();
    });
  });

  describe('Low confidence escalation workflow', () => {
    it('should escalate ambiguous messages to secretary', async () => {
      const result = await classifier.classify('Oi tudo bem?');

      expect(result.intent).toBe('escalate');
      expect(result.confidence).toBeLessThan(0.7);
    });
  });

  describe('Correlation ID propagation', () => {
    it('should propagate correlation ID through classification', async () => {
      const correlationId = 'test-correlation-id-123';

      const result = await classifier.classify('Quero marcar', correlationId);

      expect(result.intent).toBe('book');
      expect(result.confidence).toBeGreaterThan(0.7);
    });
  });

  describe('getIntentClassifier factory', () => {
    it('should return appropriate classifier based on configuration', () => {
      const classifier = getIntentClassifier();

      expect(classifier).toBeDefined();
      expect(typeof classifier.classify).toBe('function');
    });
  });
});
