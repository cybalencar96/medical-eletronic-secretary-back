/**
 * LLM Infrastructure Module
 *
 * This module provides intent classification services for patient WhatsApp messages.
 * It automatically switches between real OpenAI API and mock service based on configuration.
 */

import { llmConfig } from '../config/llm-config';
import { intentClassifier, IIntentClassifier } from './intent-classifier';
import { mockLLMService } from './mock-llm-service';

/**
 * Gets the appropriate intent classifier based on configuration.
 *
 * - If LLM_MOCK_MODE=true: Returns mock service for development
 * - If LLM_MOCK_MODE=false: Returns real OpenAI service
 *
 * @returns {IIntentClassifier} Intent classifier instance
 */
export const getIntentClassifier = (): IIntentClassifier => {
  if (llmConfig.isMockMode) {
    return mockLLMService;
  }
  return intentClassifier;
};

// Export types and utilities
export * from './intent-classifier';
export * from './mock-llm-service';
export * from './openai-client';
export * from './entity-extractor';
export * from './prompt-templates';
export { llmConfig } from '../config/llm-config';
