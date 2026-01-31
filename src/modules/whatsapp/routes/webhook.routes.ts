import { Router, Request, Response, NextFunction } from 'express';
import express from 'express';
import { env } from '../../../infrastructure/config/env';
import { logger } from '../../../infrastructure/config/logger';
import { AppError } from '../../../shared/errors/AppError';
import {
  validateWebhookSignature,
  captureRawBody,
  RequestWithRawBody,
} from '../middleware/signature-validation.middleware';
import { webhookHandlerService } from '../services/webhook-handler.service';
import { WhatsAppWebhookPayload } from '../types/webhook-payload.interface';

/**
 * Express router for WhatsApp webhook endpoints.
 *
 * Provides two endpoints:
 * - GET /webhook/whatsapp: Meta webhook verification challenge
 * - POST /webhook/whatsapp: Incoming message webhook with signature validation
 *
 * The POST endpoint uses special middleware configuration to capture the raw
 * request body before JSON parsing, which is required for HMAC signature validation.
 */
export const webhookRouter = Router();

/**
 * GET /webhook/whatsapp
 *
 * Webhook verification endpoint for Meta's WhatsApp Cloud API setup.
 *
 * When configuring the webhook in Meta App Dashboard, Meta sends a GET request
 * with query parameters to verify that you own the endpoint. This handler:
 * 1. Verifies hub.mode is 'subscribe'
 * 2. Verifies hub.verify_token matches WHATSAPP_VERIFY_TOKEN
 * 3. Returns hub.challenge as plain text response
 *
 * @query {string} hub.mode - Should be 'subscribe'
 * @query {string} hub.verify_token - Should match WHATSAPP_VERIFY_TOKEN env var
 * @query {string} hub.challenge - Random string to echo back
 *
 * @returns {string} 200 - Returns hub.challenge value
 * @returns {Error} 403 - If verify_token is invalid or missing
 *
 * @see https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests
 */
webhookRouter.get('/whatsapp', (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info(
      {
        correlationId: req.id,
        query: req.query,
      },
      'Received webhook verification request'
    );

    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    // Validate required parameters
    if (!mode || !token || !challenge) {
      logger.warn(
        {
          correlationId: req.id,
          hasMode: !!mode,
          hasToken: !!token,
          hasChallenge: !!challenge,
        },
        'Missing required verification parameters'
      );
      throw new AppError('Missing required verification parameters', 400);
    }

    // Verify mode is 'subscribe'
    if (mode !== 'subscribe') {
      logger.warn(
        {
          correlationId: req.id,
          mode,
        },
        'Invalid verification mode'
      );
      throw new AppError('Invalid verification mode', 403);
    }

    // Verify token matches configured value
    const verifyToken = env.WHATSAPP_VERIFY_TOKEN;
    if (!verifyToken) {
      logger.error(
        {
          correlationId: req.id,
        },
        'WHATSAPP_VERIFY_TOKEN not configured'
      );
      throw new AppError('Webhook verification token not configured', 500, false);
    }

    if (token !== verifyToken) {
      logger.warn(
        {
          correlationId: req.id,
          from: req.ip,
        },
        'Invalid verify token - potential unauthorized verification attempt'
      );
      throw new AppError('Invalid verify token', 403);
    }

    // Verification successful - return challenge
    logger.info(
      {
        correlationId: req.id,
      },
      'Webhook verification successful'
    );

    res.status(200).send(challenge);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /webhook/whatsapp
 *
 * Webhook endpoint for receiving WhatsApp messages.
 *
 * This endpoint:
 * 1. Validates X-Hub-Signature-256 header using HMAC-SHA256 (constant-time comparison)
 * 2. Parses the WhatsApp Cloud API webhook payload
 * 3. Extracts message data and publishes to BullMQ queue
 * 4. Returns 200 OK immediately (non-blocking response)
 *
 * The endpoint uses a custom JSON parser configuration to capture the raw
 * request body (needed for signature validation) before parsing JSON.
 *
 * @body {WhatsAppWebhookPayload} - Webhook payload from WhatsApp Cloud API
 * @header {string} X-Hub-Signature-256 - HMAC-SHA256 signature (format: "sha256=<hex>")
 *
 * @returns {object} 200 - { success: true } after message is queued
 * @returns {Error} 401 - If signature is invalid or missing
 * @returns {Error} 400 - If payload is malformed
 * @returns {Error} 500 - If queue publishing fails
 *
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples
 */
webhookRouter.post(
  '/whatsapp',
  // Use custom JSON parser to capture raw body for signature validation
  express.json({ verify: captureRawBody }),
  // Validate webhook signature
  validateWebhookSignature,
  // Handle webhook payload
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  async (req: RequestWithRawBody, res: Response, next: NextFunction) => {
    try {
      logger.info(
        {
          correlationId: req.id,
          from: req.ip,
        },
        'Received webhook message'
      );

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const payload = req.body as WhatsAppWebhookPayload;

      // Validate payload structure
      if (!payload || !payload.object) {
        logger.warn(
          {
            correlationId: req.id,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            body: req.body,
          },
          'Invalid webhook payload structure'
        );
        throw new AppError('Invalid webhook payload', 400);
      }

      // Process webhook asynchronously
      await webhookHandlerService.processWebhook(payload, req.id as string);

      // Return success immediately (non-blocking)
      res.status(200).json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);
