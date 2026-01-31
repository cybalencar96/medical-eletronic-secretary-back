import { Request, Response, NextFunction } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { env } from '../../../infrastructure/config/env';
import { logger } from '../../../infrastructure/config/logger';
import { AppError } from '../../../shared/errors/AppError';

/**
 * Extended Express Request interface with raw body buffer.
 * The raw body is needed for HMAC signature verification.
 */
export interface RequestWithRawBody extends Request {
  /** Raw request body as Buffer for signature verification */
  rawBody?: Buffer;
}

/**
 * Validates the X-Hub-Signature-256 header from WhatsApp Cloud API webhook requests.
 *
 * This middleware implements Meta's webhook signature validation protocol using HMAC-SHA256.
 * It uses constant-time comparison (crypto.timingSafeEqual) to prevent timing attacks.
 *
 * Security measures:
 * - Requires WHATSAPP_WEBHOOK_SECRET environment variable in production
 * - Uses timing-safe comparison to prevent timing attacks
 * - Validates signature format before comparison
 * - Supports mock mode for development (WHATSAPP_MOCK=true)
 *
 * @param {RequestWithRawBody} req - Express request with raw body buffer
 * @param {Response} res - Express response
 * @param {NextFunction} next - Express next function
 *
 * @throws {AppError} 401 if signature is invalid or missing
 * @throws {AppError} 500 if webhook secret is not configured (production only)
 *
 * @example
 * ```typescript
 * router.post('/webhook/whatsapp',
 *   express.json({ verify: captureRawBody }),
 *   validateWebhookSignature,
 *   webhookHandler
 * );
 * ```
 *
 * @see https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests
 */
export const validateWebhookSignature = (
  req: RequestWithRawBody,
  _res: Response,
  next: NextFunction
): void => {
  try {
    // Check if mock mode is enabled (for development without Meta Business account)
    const isMockMode = process.env.WHATSAPP_MOCK === 'true';
    if (isMockMode) {
      logger.warn(
        {
          correlationId: req.id,
          path: req.path,
        },
        'WhatsApp mock mode is active - signature validation bypassed'
      );
      return next();
    }

    // Get webhook secret from environment
    const webhookSecret = env.WHATSAPP_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new AppError('WhatsApp webhook secret is not configured', 500, false);
    }

    // Get signature from header
    const signatureHeader = req.headers['x-hub-signature-256'];
    if (!signatureHeader) {
      logger.warn(
        {
          correlationId: req.id,
          headers: req.headers,
        },
        'Missing X-Hub-Signature-256 header'
      );
      throw new AppError('Missing signature header', 401);
    }

    // Ensure signature is a string (not string array)
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;

    // Validate signature format: should be "sha256=<hex_string>"
    if (!signature.startsWith('sha256=')) {
      logger.warn(
        {
          correlationId: req.id,
          signatureFormat: signature.substring(0, 20),
        },
        'Invalid signature format'
      );
      throw new AppError('Invalid signature format', 401);
    }

    // Extract hex-encoded signature (remove 'sha256=' prefix)
    const providedSignature = signature.substring(7);

    // Get raw body for signature computation
    const rawBody = req.rawBody;
    if (!rawBody) {
      logger.error(
        {
          correlationId: req.id,
        },
        'Raw body not available for signature validation'
      );
      throw new AppError('Unable to validate signature - raw body missing', 500, false);
    }

    // Compute HMAC-SHA256 signature
    const expectedSignature = createHmac('sha256', webhookSecret).update(rawBody).digest('hex');

    // Convert both signatures to buffers for constant-time comparison
    const providedBuffer = Buffer.from(providedSignature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    // Check if signatures have the same length
    if (providedBuffer.length !== expectedBuffer.length) {
      logger.warn(
        {
          correlationId: req.id,
          providedLength: providedBuffer.length,
          expectedLength: expectedBuffer.length,
        },
        'Signature length mismatch'
      );
      throw new AppError('Invalid signature', 401);
    }

    // Use constant-time comparison to prevent timing attacks
    const isValid = timingSafeEqual(providedBuffer, expectedBuffer);

    if (!isValid) {
      logger.warn(
        {
          correlationId: req.id,
          from: req.ip,
        },
        'Invalid webhook signature - potential unauthorized access attempt'
      );
      throw new AppError('Invalid signature', 401);
    }

    // Signature is valid, proceed to next middleware
    logger.debug(
      {
        correlationId: req.id,
      },
      'Webhook signature validated successfully'
    );
    next();
  } catch (error) {
    // Pass AppError instances to error handler
    if (error instanceof AppError) {
      next(error);
    } else {
      // Wrap unexpected errors
      logger.error(
        {
          error,
          correlationId: req.id,
        },
        'Unexpected error during signature validation'
      );
      next(new AppError('Signature validation failed', 500, false));
    }
  }
};

/**
 * Express middleware function to capture raw request body.
 * This function is used with express.json({ verify: captureRawBody }) to
 * store the raw body buffer before JSON parsing.
 *
 * The raw body is required for HMAC signature verification because the
 * signature is computed over the exact bytes received, not the parsed JSON.
 *
 * @param {RequestWithRawBody} req - Express request object
 * @param {Response} _res - Express response object (unused)
 * @param {Buffer} buf - Raw request body buffer
 *
 * @example
 * ```typescript
 * app.use(express.json({ verify: captureRawBody }));
 * ```
 */
export const captureRawBody = (req: RequestWithRawBody, _res: Response, buf: Buffer): void => {
  req.rawBody = buf;
};
