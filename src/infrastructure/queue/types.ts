/**
 * Queue infrastructure types and job data interfaces.
 *
 * This module defines all queue names and job payload interfaces used
 * throughout the application. Each queue type has dedicated job interfaces
 * and configuration constants for type safety.
 */

/**
 * Queue name constants for all application queues.
 * Used to maintain consistency across queue and worker registration.
 */
export const QUEUE_NAMES = {
  WHATSAPP_MESSAGES: 'whatsapp-messages',
  INTENT_CLASSIFICATION: 'intent-classification',
  NOTIFICATIONS: 'notifications',
  ESCALATIONS: 'escalations',
} as const;

/**
 * Type for queue names derived from the QUEUE_NAMES constant.
 */
export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

/**
 * Job data for WhatsApp message processing queue.
 *
 * Published when a new WhatsApp message is received via webhook.
 * Workers process this to trigger intent classification and response generation.
 */
export interface WhatsAppMessageJob {
  /** Unique message identifier from WhatsApp */
  messageId: string;
  /** Sender's phone number in E.164 format (e.g., "5511999999999") */
  from: string;
  /** Message text content */
  text: string;
  /** ISO 8601 timestamp when message was received */
  timestamp: string;
  /** Phone number ID that received the message */
  phoneNumberId: string;
  /** Correlation ID from the webhook request for tracing */
  correlationId: string;
}

/**
 * Job data for intent classification queue.
 *
 * Published after receiving a WhatsApp message to classify user intent
 * using OpenAI API before executing business logic.
 */
export interface IntentClassificationJob {
  /** Message ID from the original WhatsApp message */
  messageId: string;
  /** Patient's phone number in E.164 format */
  phone: string;
  /** Message text to classify */
  messageText: string;
  /** Patient ID if already registered, null for new patients */
  patientId: string | null;
  /** Correlation ID for request tracing */
  correlationId: string;
}

/**
 * Job data for notification scheduling queue.
 *
 * Published to schedule appointment reminders, confirmations,
 * or other notification types to patients.
 */
export interface NotificationJob {
  /** Type of notification to send */
  type: 'reminder' | 'confirmation' | 'cancellation' | 'doctor_alert';
  /** Appointment ID this notification relates to */
  appointmentId: string;
  /** Patient ID to receive the notification */
  patientId: string;
  /** Patient's phone number in E.164 format */
  phone: string;
  /** Scheduled time to send the notification (ISO 8601) */
  scheduledAt: string;
  /** Additional metadata for the notification template */
  metadata: {
    patientName?: string;
    appointmentDate?: string;
    appointmentTime?: string;
    doctorName?: string;
    reason?: string;
  };
  /** Correlation ID for request tracing */
  correlationId: string;
}

/**
 * Job data for escalation queue.
 *
 * Published when a message cannot be automatically processed and requires
 * human intervention (low confidence intent, complex cases, errors).
 */
export interface EscalationJob {
  /** Patient ID if known, null for new contacts */
  patientId: string | null;
  /** Patient's phone number in E.164 format */
  phone: string;
  /** Original message text that triggered escalation */
  message: string;
  /** Reason for escalation */
  reason: 'low_confidence' | 'error' | 'complex_case' | 'patient_request';
  /** Confidence score if from intent classification (0-1) */
  confidence?: number;
  /** Error details if escalation was due to an error */
  error?: string;
  /** Message ID from the original WhatsApp message */
  messageId: string;
  /** Correlation ID for request tracing */
  correlationId: string;
}

/**
 * Union type of all job data types.
 * Useful for generic queue operations.
 */
export type JobData =
  | WhatsAppMessageJob
  | IntentClassificationJob
  | NotificationJob
  | EscalationJob;

/**
 * Queue configuration options per queue type.
 * Defines retry policies, timeouts, and concurrency settings.
 */
export const QUEUE_CONFIGS = {
  [QUEUE_NAMES.WHATSAPP_MESSAGES]: {
    concurrency: 5,
    attempts: 3,
    backoffDelay: 2000,
    timeout: 30000, // 30 seconds
  },
  [QUEUE_NAMES.INTENT_CLASSIFICATION]: {
    concurrency: 3,
    attempts: 3,
    backoffDelay: 2000,
    timeout: 60000, // 60 seconds (OpenAI API call)
  },
  [QUEUE_NAMES.NOTIFICATIONS]: {
    concurrency: 10,
    attempts: 5,
    backoffDelay: 5000,
    timeout: 30000, // 30 seconds
  },
  [QUEUE_NAMES.ESCALATIONS]: {
    concurrency: 2,
    attempts: 2,
    backoffDelay: 1000,
    timeout: 15000, // 15 seconds
  },
} as const;
