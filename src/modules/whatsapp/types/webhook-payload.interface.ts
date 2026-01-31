/**
 * WhatsApp Cloud API webhook payload interfaces.
 * These types model the nested structure of incoming webhook events from Meta's WhatsApp Cloud API.
 *
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples
 */

/**
 * Text message content from WhatsApp webhook.
 */
export interface WhatsAppTextMessage {
  body: string;
}

/**
 * Individual WhatsApp message from webhook payload.
 * Contains message ID, sender information, timestamp, and message content.
 */
export interface WhatsAppMessage {
  /** Unique message identifier from WhatsApp */
  id: string;
  /** Sender's phone number in E.164 format (e.g., "5511999999999") */
  from: string;
  /** Unix timestamp when message was sent */
  timestamp: string;
  /** Message type (text, image, video, etc.) */
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'contacts';
  /** Text message content (present when type is 'text') */
  text?: WhatsAppTextMessage;
}

/**
 * Value object containing message array from webhook change event.
 */
export interface WhatsAppValue {
  /** Sending WhatsApp Business Account phone number metadata */
  messaging_product: 'whatsapp';
  /** Metadata about the WhatsApp Business Account */
  metadata: {
    /** Phone number ID that received the message */
    phone_number_id: string;
    /** Display phone number */
    display_phone_number: string;
  };
  /** Array of contact information */
  contacts?: Array<{
    profile: {
      name: string;
    };
    wa_id: string;
  }>;
  /** Array of incoming messages */
  messages?: WhatsAppMessage[];
  /** Array of message status updates */
  statuses?: Array<{
    id: string;
    status: 'sent' | 'delivered' | 'read' | 'failed';
    timestamp: string;
    recipient_id: string;
  }>;
}

/**
 * Change event from WhatsApp webhook.
 * Represents a single change notification (message, status update, etc.).
 */
export interface WhatsAppChange {
  /** Value object containing the actual webhook data */
  value: WhatsAppValue;
  /** Type of change notification */
  field: 'messages' | 'message_template_status_update';
}

/**
 * Entry in the webhook payload.
 * Contains array of changes for a specific WhatsApp Business Account.
 */
export interface WhatsAppEntry {
  /** WhatsApp Business Account ID */
  id: string;
  /** Array of change events */
  changes: WhatsAppChange[];
}

/**
 * Root webhook payload from WhatsApp Cloud API.
 * This is the top-level structure received in POST /webhook/whatsapp requests.
 */
export interface WhatsAppWebhookPayload {
  /** Always 'whatsapp_business_account' for WhatsApp webhooks */
  object: 'whatsapp_business_account';
  /** Array of entries, typically contains one entry */
  entry: WhatsAppEntry[];
}

/**
 * Verification query parameters for GET /webhook/whatsapp.
 * Sent by Meta during webhook setup to verify the endpoint.
 */
export interface WebhookVerificationParams {
  /** Always 'subscribe' during verification */
  'hub.mode': string;
  /** Verification token configured in Meta App Dashboard */
  'hub.verify_token': string;
  /** Random string to echo back in response */
  'hub.challenge': string;
}
