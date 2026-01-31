/**
 * WhatsApp Cloud API send message request payload interface.
 * Defines the structure for sending text messages via WhatsApp Cloud API.
 *
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
 */
export interface SendMessageRequest {
  /**
   * Messaging product - must always be "whatsapp"
   */
  messaging_product: 'whatsapp';

  /**
   * Recipient phone number in E.164 format (e.g., +5511999999999)
   */
  to: string;

  /**
   * Message type - currently only "text" is supported
   */
  type: 'text';

  /**
   * Text message content
   */
  text: {
    /**
     * Message body - the actual text content to send
     */
    body: string;
  };
}

/**
 * WhatsApp Cloud API send message response interface.
 * Defines the structure of successful response from WhatsApp Cloud API.
 *
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
 */
export interface SendMessageResponse {
  /**
   * Messaging product - always "whatsapp"
   */
  messaging_product: string;

  /**
   * Array of message objects with WhatsApp message ID
   */
  messages: Array<{
    /**
     * WhatsApp message ID for tracking (e.g., "wamid.HBgNNTU1MTk4...")
     */
    id: string;
  }>;

  /**
   * Array of contact objects with input phone number
   */
  contacts: Array<{
    /**
     * Phone number input used in the request
     */
    input: string;

    /**
     * WhatsApp ID of the contact
     */
    wa_id: string;
  }>;
}

/**
 * WhatsApp Cloud API error response interface.
 * Defines the structure of error responses from WhatsApp Cloud API.
 *
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes
 */
export interface WhatsAppApiErrorResponse {
  /**
   * Error object containing details about the failure
   */
  error: {
    /**
     * Error message describing what went wrong
     */
    message: string;

    /**
     * Error type (e.g., "OAuthException", "ApiException")
     */
    type: string;

    /**
     * WhatsApp error code for categorization
     */
    code: number;

    /**
     * WhatsApp error sub-code for more specific error identification
     */
    error_subcode?: number;

    /**
     * Facebook trace ID for debugging
     */
    fbtrace_id: string;
  };
}

/**
 * Send message result interface.
 * Unified result object returned by the message sender service.
 */
export interface SendMessageResult {
  /**
   * Indicates if the message was sent successfully
   */
  success: boolean;

  /**
   * WhatsApp message ID on success, undefined on failure
   */
  messageId?: string;

  /**
   * Error message on failure, undefined on success
   */
  error?: string;

  /**
   * Error code on failure for categorization (400, 401, 429, 500)
   */
  errorCode?: number;

  /**
   * Indicates if this was a mock send (development mode)
   */
  isMock?: boolean;
}
