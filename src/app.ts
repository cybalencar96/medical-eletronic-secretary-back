import express, { Request, Response } from 'express';
import pinoHttp from 'pino-http';
import { randomUUID } from 'crypto';
import { logger } from './infrastructure/config/logger';
import { errorHandler } from './api/middleware/errorHandler';
import { webhookRouter } from './modules/whatsapp/routes/webhook.routes';

/**
 * Express application factory.
 *
 * Creates and configures the Express application with:
 * - Request logging with Pino and correlation IDs
 * - Body parsing middleware (JSON and URL-encoded)
 * - CORS support (to be configured in future tasks)
 * - Health check and root endpoints
 * - Centralized error handling
 *
 * Middleware pipeline order:
 * 1. Request logging (pino-http)
 * 2. Body parsing (express.json, express.urlencoded)
 * 3. CORS (future task)
 * 4. Routes (application endpoints)
 * 5. Error handling (centralized error middleware)
 */
const createApp = () => {
  const app = express();

  // Request logging middleware with correlation IDs
  app.use(
    pinoHttp({
      logger,
      // Generate a unique request ID for correlation tracking
      genReqId: (req) => {
        // Use existing request ID if available (from proxy/load balancer)
        const existingId = req.headers['x-request-id'];
        if (typeof existingId === 'string') {
          return existingId;
        }
        // Generate new UUID for this request
        return randomUUID();
      },
      // Customize request log
      customProps: (req) => ({
        correlationId: req.id,
      }),
    })
  );

  // Body parsing middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // CORS middleware will be added in future tasks when needed
  // app.use(cors({ ... }));

  // Health check endpoint for Docker health checks and load balancers
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
    });
  });

  // Root endpoint
  app.get('/', (_req: Request, res: Response) => {
    res.status(200).json({
      message: 'WhatsApp Medical Electronic Secretary API',
      version: '1.0.0',
    });
  });

  // WhatsApp webhook routes
  app.use('/webhook', webhookRouter);

  // API routes will be added in future tasks
  // app.use('/api', apiRoutes);

  // Centralized error handling middleware (must be last)
  app.use(errorHandler);

  return app;
};

export const app = createApp();
