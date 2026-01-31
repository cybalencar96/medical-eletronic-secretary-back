import { logger } from '../config/logger';
import { llmConfig } from '../config/llm-config';
import {
  ClassifiedIntent,
  classifiedIntentSchema,
  INTENT_CONSTANTS,
} from '../../shared/types/classified-intent';
import { LLMError, LLM_ERROR_TYPES } from '../../shared/errors/LLMError';
import { IOpenAIClient, openaiClient } from './openai-client';
import { SYSTEM_PROMPT, createUserPrompt } from './prompt-templates';
import { normalizeEntities } from './entity-extractor';

/**
 * Interface for Intent Classifier service.
 * Defines contract for classifying patient intents from messages.
 */
export interface IIntentClassifier {
  /**
   * Classifies patient intent from WhatsApp message.
   * @param {string} message - Patient's WhatsApp message
   * @param {string} [correlationId] - Correlation ID for request tracking
   * @returns {Promise<ClassifiedIntent>} Classified intent with confidence and entities
   * @throws {LLMError} If classification fails
   */
  classify(message: string, correlationId?: string): Promise<ClassifiedIntent>;
}

/**
 * Intent Classifier service.
 *
 * This service handles:
 * - Message validation and sanitization
 * - OpenAI chat completion requests with Portuguese prompts
 * - Zod schema validation of LLM responses
 * - Entity normalization (dates, times)
 * - Confidence threshold enforcement
 * - Automatic escalation for low confidence or invalid messages
 * - Structured logging with correlation IDs
 *
 * @example
 * ```typescript
 * const classifier = new IntentClassifier();
 * const result = await classifier.classify(
 *   'Quero marcar uma consulta para sábado às 9h',
 *   'req-123'
 * );
 * console.log('Intent:', result.intent);
 * console.log('Confidence:', result.confidence);
 * ```
 */
export class IntentClassifier implements IIntentClassifier {
  /**
   * Creates a new IntentClassifier instance.
   *
   * @param {IOpenAIClient} [openaiClientInstance] - Optional OpenAI client for testing
   */
  constructor(private readonly openaiClientInstance: IOpenAIClient = openaiClient) {}

  /**
   * Classifies patient intent from WhatsApp message.
   *
   * Process:
   * 1. Validates message (not empty, within length limits)
   * 2. Creates chat completion request with Portuguese prompts
   * 3. Validates LLM response against Zod schema
   * 4. Normalizes extracted entities (dates, times)
   * 5. Enforces confidence threshold (0.7) - escalates below threshold
   * 6. Returns ClassifiedIntent with normalized entities
   *
   * @param {string} message - Patient's WhatsApp message
   * @param {string} [correlationId] - Correlation ID for request tracking
   * @returns {Promise<ClassifiedIntent>} Classified intent with confidence and entities
   * @throws {LLMError} If classification fails
   */
  async classify(message: string, correlationId?: string): Promise<ClassifiedIntent> {
    logger.debug(
      {
        correlationId,
        messageLength: message?.length,
      },
      'Starting intent classification',
    );

    // Validate message
    this.validateMessage(message);

    try {
      // Create chat completion request
      const rawResult = await this.openaiClientInstance.createChatCompletion<ClassifiedIntent>({
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: createUserPrompt(message),
          },
        ],
        correlationId,
      });

      // Validate response against Zod schema
      const validationResult = classifiedIntentSchema.safeParse(rawResult);

      if (!validationResult.success) {
        logger.error(
          {
            correlationId,
            validationErrors: validationResult.error.issues,
            rawResult,
          },
          'LLM response failed Zod validation',
        );

        throw new LLMError(
          'Invalid LLM response structure',
          LLM_ERROR_TYPES.VALIDATION_FAILED,
          500,
          {
            model: llmConfig.model,
          },
        );
      }

      const validated = validationResult.data;

      // Normalize entities (dates, times)
      const normalizedEntities = normalizeEntities(validated.entities);

      const result: ClassifiedIntent = {
        intent: validated.intent,
        confidence: validated.confidence,
        entities: normalizedEntities,
      };

      // Enforce confidence threshold
      if (result.confidence < INTENT_CONSTANTS.CONFIDENCE_THRESHOLD) {
        logger.warn(
          {
            correlationId,
            intent: result.intent,
            confidence: result.confidence,
            threshold: INTENT_CONSTANTS.CONFIDENCE_THRESHOLD,
          },
          'Intent confidence below threshold - triggering escalation',
        );

        // Override intent to escalate
        result.intent = 'escalate';
      }

      logger.info(
        {
          correlationId,
          intent: result.intent,
          confidence: result.confidence,
          hasDate: !!result.entities.date,
          hasTime: !!result.entities.time,
          hasReason: !!result.entities.reason,
        },
        'Intent classification successful',
      );

      return result;
    } catch (error) {
      // If error is already LLMError, rethrow it
      if (error instanceof LLMError) {
        throw error;
      }

      // Wrap unexpected errors
      logger.error(
        {
          correlationId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Unexpected error during intent classification',
      );

      throw new LLMError(
        'Intent classification failed',
        LLM_ERROR_TYPES.UNKNOWN,
        500,
        {
          model: llmConfig.model,
        },
      );
    }
  }

  /**
   * Validates message before classification.
   *
   * @param {string} message - Patient's message
   * @throws {LLMError} If message is invalid
   * @private
   */
  private validateMessage(message: string): void {
    // Check if message is null or undefined
    if (message == null) {
      throw new LLMError(
        'Message cannot be null or undefined',
        LLM_ERROR_TYPES.VALIDATION_FAILED,
        400,
      );
    }

    // Check if message is empty
    const trimmed = message.trim();
    if (trimmed === '') {
      throw new LLMError('Message cannot be empty', LLM_ERROR_TYPES.VALIDATION_FAILED, 400);
    }

    // Check if message exceeds maximum length
    if (trimmed.length > INTENT_CONSTANTS.MAX_MESSAGE_LENGTH) {
      throw new LLMError(
        `Message exceeds maximum length of ${INTENT_CONSTANTS.MAX_MESSAGE_LENGTH} characters`,
        LLM_ERROR_TYPES.VALIDATION_FAILED,
        400,
      );
    }
  }
}

/**
 * Singleton Intent Classifier instance.
 * Used throughout the application for intent classification.
 */
export const intentClassifier = new IntentClassifier();
