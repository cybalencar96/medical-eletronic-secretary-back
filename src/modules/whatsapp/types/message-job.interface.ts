/**
 * BullMQ job payload interfaces for WhatsApp message processing queue.
 * These types define the structure of jobs published to the 'whatsapp-messages' queue.
 */

/**
 * Job data for WhatsApp message processing.
 * This structure is published to the BullMQ queue for asynchronous processing by workers.
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
 * Queue configuration constants.
 */
export const WHATSAPP_QUEUE_NAME = 'whatsapp-messages';
