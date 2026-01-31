/**
 * BullMQ job payload interfaces for WhatsApp message processing queue.
 * These types define the structure of jobs published to the 'whatsapp-messages' queue.
 *
 * @deprecated This file is maintained for backward compatibility.
 * New code should import from '../../../infrastructure/queue/types' instead.
 */

import {
  WhatsAppMessageJob as WhatsAppMessageJobType,
  QUEUE_NAMES,
} from '../../../infrastructure/queue/types';

/**
 * Job data for WhatsApp message processing.
 * This structure is published to the BullMQ queue for asynchronous processing by workers.
 */
export type WhatsAppMessageJob = WhatsAppMessageJobType;

/**
 * Queue configuration constants.
 */
export const WHATSAPP_QUEUE_NAME = QUEUE_NAMES.WHATSAPP_MESSAGES;
