import { Router } from 'express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { queues } from './queues';
import { logger } from '../config/logger';

/**
 * Bull Board server adapter for Express.js integration.
 *
 * Provides a web-based UI for monitoring BullMQ queues at /admin/queues.
 * Displays real-time metrics including queue depth, processing time, error rates,
 * and supports job inspection, retry, and removal operations.
 */
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

/**
 * Creates Bull Board dashboard with all application queue instances.
 *
 * Monitored queues:
 * - whatsapp-messages: WhatsApp message processing
 * - intent-classification: AI-powered intent recognition
 * - notifications: Appointment reminders and notifications
 * - escalations: Manual intervention requests
 */
createBullBoard({
  queues: [
    new BullMQAdapter(queues.whatsappMessages),
    new BullMQAdapter(queues.intentClassification),
    new BullMQAdapter(queues.notifications),
    new BullMQAdapter(queues.escalations),
  ],
  serverAdapter,
  options: {
    uiConfig: {
      boardTitle: 'Medical Secretary Queue Dashboard',
      miscLinks: [
        { text: 'API Documentation', url: '/api/docs' },
        { text: 'Health Check', url: '/health' },
      ],
    },
  },
});

logger.info(
  {
    basePath: '/admin/queues',
    queueCount: 4,
    queues: ['whatsapp-messages', 'intent-classification', 'notifications', 'escalations'],
  },
  'Bull Board initialized'
);

/**
 * Express router for Bull Board UI.
 *
 * Mount this router at /admin/queues with authentication middleware:
 * ```typescript
 * app.use('/admin/queues', authenticateJWT, bullBoardRouter);
 * ```
 */
export const bullBoardRouter = serverAdapter.getRouter() as Router;
