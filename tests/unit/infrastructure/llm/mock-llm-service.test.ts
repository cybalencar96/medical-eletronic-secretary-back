import { MockLLMService } from '../../../../src/infrastructure/llm/mock-llm-service';
import { getNextSaturday } from '../../../../src/infrastructure/llm/entity-extractor';

describe('MockLLMService', () => {
  let mockService: MockLLMService;

  beforeEach(() => {
    mockService = new MockLLMService();
  });

  describe('classify - book intent', () => {
    it('should classify messages with "marcar" as book intent', async () => {
      const result = await mockService.classify('Quero marcar uma consulta');

      expect(result.intent).toBe('book');
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.entities.date).toBe(getNextSaturday());
      expect(result.entities.time).toBe('09:00');
    });

    it('should classify messages with "agendar" as book intent', async () => {
      const result = await mockService.classify('Preciso agendar uma consulta');

      expect(result.intent).toBe('book');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should classify messages with "quero consulta" as book intent', async () => {
      const result = await mockService.classify('Eu quero uma consulta');

      expect(result.intent).toBe('book');
      expect(result.confidence).toBeGreaterThan(0.7);
    });
  });

  describe('classify - reschedule intent', () => {
    it('should classify messages with "remarcar" as reschedule intent', async () => {
      const result = await mockService.classify('Preciso remarcar minha consulta');

      expect(result.intent).toBe('reschedule');
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.entities.date).toBe(getNextSaturday());
      expect(result.entities.reason).toBe('Mock reschedule reason');
    });

    it('should classify messages with "mudar" as reschedule intent', async () => {
      const result = await mockService.classify('Quero mudar minha consulta');

      expect(result.intent).toBe('reschedule');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should classify messages with "trocar" as reschedule intent', async () => {
      const result = await mockService.classify('Posso trocar o horário?');

      expect(result.intent).toBe('reschedule');
      expect(result.confidence).toBeGreaterThan(0.7);
    });
  });

  describe('classify - cancel intent', () => {
    it('should classify messages with "cancelar" as cancel intent', async () => {
      const result = await mockService.classify('Gostaria de cancelar minha consulta');

      expect(result.intent).toBe('cancel');
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.entities.reason).toBe('Mock cancellation reason');
    });

    it('should classify messages with "desmarcar" as cancel intent', async () => {
      const result = await mockService.classify('Preciso desmarcar');

      expect(result.intent).toBe('cancel');
      expect(result.confidence).toBeGreaterThan(0.7);
    });
  });

  describe('classify - confirm intent', () => {
    it('should classify messages with "confirmo" as confirm intent', async () => {
      const result = await mockService.classify('Sim, confirmo minha consulta');

      expect(result.intent).toBe('confirm');
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.entities).toEqual({});
    });

    it('should classify messages with "confirmar" as confirm intent', async () => {
      const result = await mockService.classify('Vou confirmar');

      expect(result.intent).toBe('confirm');
      expect(result.confidence).toBeGreaterThan(0.7);
    });
  });

  describe('classify - query intent', () => {
    it('should classify messages with "disponível" as query intent', async () => {
      const result = await mockService.classify('Quais horários estão disponíveis?');

      expect(result.intent).toBe('query');
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.entities).toEqual({});
    });

    it('should classify messages with "horário" as query intent', async () => {
      const result = await mockService.classify('Qual o horário de funcionamento?');

      expect(result.intent).toBe('query');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should classify messages with "onde" as query intent', async () => {
      const result = await mockService.classify('Onde fica a clínica?');

      expect(result.intent).toBe('query');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should classify messages with "quais" as query intent', async () => {
      const result = await mockService.classify('Quais são os horários?');

      expect(result.intent).toBe('query');
      expect(result.confidence).toBeGreaterThan(0.7);
    });
  });

  describe('classify - escalate intent', () => {
    it('should classify ambiguous messages as escalate intent', async () => {
      const result = await mockService.classify('Oi tudo bem?');

      expect(result.intent).toBe('escalate');
      expect(result.confidence).toBeLessThan(0.7);
      expect(result.entities).toEqual({});
    });

    it('should classify out-of-context messages as escalate intent', async () => {
      const result = await mockService.classify('Hello world');

      expect(result.intent).toBe('escalate');
      expect(result.confidence).toBeLessThan(0.7);
    });

    it('should classify generic greetings as escalate intent', async () => {
      const result = await mockService.classify('Olá');

      expect(result.intent).toBe('escalate');
      expect(result.confidence).toBeLessThan(0.7);
    });
  });

  describe('case insensitivity', () => {
    it('should handle uppercase messages', async () => {
      const result = await mockService.classify('QUERO MARCAR UMA CONSULTA');

      expect(result.intent).toBe('book');
    });

    it('should handle mixed case messages', async () => {
      const result = await mockService.classify('QuErO mArCaR');

      expect(result.intent).toBe('book');
    });
  });

  describe('correlation ID', () => {
    it('should accept correlation ID parameter', async () => {
      const result = await mockService.classify('Quero marcar', 'test-correlation-id');

      expect(result.intent).toBe('book');
      expect(result.confidence).toBeGreaterThan(0.7);
    });
  });
});
