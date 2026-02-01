import { z } from 'zod';

/**
 * Intent types for patient message classification
 * - book: Patient wants to schedule a new appointment
 * - reschedule: Patient wants to change an existing appointment
 * - cancel: Patient wants to cancel an appointment
 * - confirm: Patient is confirming an appointment (response to reminder)
 * - query: Patient is asking for information (availability, hours, etc.)
 * - escalate: Message is ambiguous or out of scope, requires human intervention
 */
export type IntentType = 'book' | 'reschedule' | 'cancel' | 'confirm' | 'query' | 'escalate';

/**
 * Extracted entities from patient message
 */
export interface ExtractedEntities {
  /** Extracted date in ISO format (YYYY-MM-DD) */
  date?: string;
  /** Extracted time in HH:MM format */
  time?: string;
  /** Cancellation or rescheduling reason */
  reason?: string;
}

/**
 * Result of intent classification from OpenAI
 */
export interface ClassifiedIntent {
  /** Classified intent type */
  intent: IntentType;
  /** Confidence score between 0 and 1 */
  confidence: number;
  /** Extracted entities from the message */
  entities: ExtractedEntities;
}

/**
 * Zod schema for extracted entities validation
 */
export const extractedEntitiesSchema = z.object({
  date: z.string().optional(),
  // Accept any string for time - normalization will convert coloquial formats
  time: z.string().optional(),
  reason: z.string().optional(),
});

/**
 * Zod schema for classified intent validation
 * Used to validate OpenAI API responses before processing
 */
export const classifiedIntentSchema = z.object({
  intent: z.enum(['book', 'reschedule', 'cancel', 'confirm', 'query', 'escalate']),
  confidence: z.number().min(0).max(1),
  entities: extractedEntitiesSchema,
});

/**
 * Constants for intent classification
 */
export const INTENT_CONSTANTS = {
  /** Confidence threshold - scores below this trigger automatic escalation */
  CONFIDENCE_THRESHOLD: 0.7,
  /** Maximum message length for classification (OpenAI token limit consideration) */
  MAX_MESSAGE_LENGTH: 4000,
} as const;
