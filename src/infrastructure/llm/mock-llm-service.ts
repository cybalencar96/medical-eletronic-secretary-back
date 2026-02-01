import { logger } from '../config/logger';
import { ClassifiedIntent } from '../../shared/types/classified-intent';
import { IIntentClassifier } from './intent-classifier';
import { getNextSaturday } from './entity-extractor';

/**
 * Mock LLM service for development and testing without OpenAI API.
 *
 * This service provides deterministic intent classification based on keyword matching,
 * enabling development without API keys and consistent test results.
 *
 * Keyword patterns:
 * - "marcar", "agendar", "consulta" → book intent
 * - "remarcar", "mudar", "trocar" → reschedule intent
 * - "cancelar", "desmarcar" → cancel intent
 * - "confirmo", "confirmar" → confirm intent
 * - "disponível", "horário", "onde" → query intent
 * - Everything else → escalate intent
 *
 * @example
 * ```typescript
 * const mockService = new MockLLMService();
 * const result = await mockService.classify('Quero marcar uma consulta');
 * console.log(result.intent); // 'book'
 * ```
 */
export class MockLLMService implements IIntentClassifier {
  /**
   * Classifies patient intent using keyword matching.
   * Returns deterministic results for testing and development.
   *
   * @param {string} message - Patient's WhatsApp message
   * @param {string} [correlationId] - Correlation ID for request tracking
   * @returns {Promise<ClassifiedIntent>} Classified intent with mock entities
   */
  async classify(message: string, correlationId?: string): Promise<ClassifiedIntent> {
    logger.debug(
      {
        correlationId,
        messageLength: message?.length,
        isMockMode: true,
      },
      'Using mock LLM service for intent classification'
    );

    const lowerMessage = message.toLowerCase();

    // Reschedule intent patterns (check before book to avoid "remarcar" matching "marcar")
    if (
      lowerMessage.includes('remarcar') ||
      lowerMessage.includes('mudar') ||
      lowerMessage.includes('trocar')
    ) {
      logger.info(
        {
          correlationId,
          intent: 'reschedule',
          isMockMode: true,
        },
        'Mock LLM classified as reschedule intent'
      );

      return {
        intent: 'reschedule',
        confidence: 0.9,
        entities: {
          date: getNextSaturday(),
          reason: 'Mock reschedule reason',
        },
      };
    }

    // Cancel intent patterns (check before book to avoid "desmarcar" matching "marcar")
    if (lowerMessage.includes('cancelar') || lowerMessage.includes('desmarcar')) {
      logger.info(
        {
          correlationId,
          intent: 'cancel',
          isMockMode: true,
        },
        'Mock LLM classified as cancel intent'
      );

      return {
        intent: 'cancel',
        confidence: 0.92,
        entities: {
          reason: 'Mock cancellation reason',
        },
      };
    }

    // Book intent patterns
    if (
      lowerMessage.includes('marcar') ||
      lowerMessage.includes('agendar') ||
      (lowerMessage.includes('quero') && lowerMessage.includes('consulta'))
    ) {
      logger.info(
        {
          correlationId,
          intent: 'book',
          isMockMode: true,
        },
        'Mock LLM classified as book intent'
      );

      return {
        intent: 'book',
        confidence: 0.95,
        entities: {
          date: getNextSaturday(),
          time: '09:00',
        },
      };
    }

    // Confirm intent patterns
    if (lowerMessage.includes('confirmo') || lowerMessage.includes('confirmar')) {
      logger.info(
        {
          correlationId,
          intent: 'confirm',
          isMockMode: true,
        },
        'Mock LLM classified as confirm intent'
      );

      return {
        intent: 'confirm',
        confidence: 0.98,
        entities: {},
      };
    }

    // Query intent patterns
    if (
      lowerMessage.includes('disponível') ||
      lowerMessage.includes('disponivel') ||
      lowerMessage.includes('horário') ||
      lowerMessage.includes('horario') ||
      lowerMessage.includes('onde') ||
      lowerMessage.includes('quais')
    ) {
      logger.info(
        {
          correlationId,
          intent: 'query',
          isMockMode: true,
        },
        'Mock LLM classified as query intent'
      );

      return {
        intent: 'query',
        confidence: 0.88,
        entities: {},
      };
    }

    // Default to escalate for ambiguous messages
    logger.info(
      {
        correlationId,
        intent: 'escalate',
        isMockMode: true,
      },
      'Mock LLM classified as escalate intent (default)'
    );

    return {
      intent: 'escalate',
      confidence: 0.3,
      entities: {},
    };
  }
}

/**
 * Singleton mock LLM service instance.
 * Used in development when LLM_MOCK_MODE=true.
 */
export const mockLLMService = new MockLLMService();
