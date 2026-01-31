/**
 * Escalations API routes
 *
 * REST API endpoints for escalation management:
 * - GET /api/escalations - List escalations with patient context
 * - POST /api/escalations/:id/resolve - Resolve an escalation
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticateJWT } from '../middleware/jwt.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  getEscalationsQuerySchema,
  resolveEscalationParamsSchema,
  resolveEscalationBodySchema,
  GetEscalationsQuery,
  ResolveEscalationParams,
  ResolveEscalationBody,
} from '../schemas/escalation.schema';
import escalationService from '../../modules/escalations/escalation.service';
import { sendSuccess } from '../utils/response-formatter';
import { logger } from '../../infrastructure/config/logger';

const router = Router();

/**
 * GET /api/escalations
 *
 * List escalations with patient context (name, phone)
 *
 * Query parameters:
 * - resolved: Optional boolean filter for resolved status
 * - limit: Pagination limit (default 50, max 100)
 * - offset: Pagination offset (default 0)
 *
 * Returns: { success: true, data: EscalationWithPatient[] }
 */
router.get(
  '/',
  authenticateJWT,
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  validate(getEscalationsQuerySchema, 'query'),
  (req: Request, res: Response, next: NextFunction): void => {
    void (async (): Promise<void> => {
      try {
        const query = req.query as unknown as GetEscalationsQuery;

        logger.info({ query }, 'GET /api/escalations');

        const escalations = await escalationService.list({
          resolved: query.resolved,
          limit: query.limit,
          offset: query.offset,
        });

        logger.info({ count: escalations.length }, 'Escalations retrieved successfully');

        sendSuccess(res, escalations);
      } catch (error) {
        next(error);
      }
    })();
  }
);

/**
 * POST /api/escalations/:id/resolve
 *
 * Resolve an escalation with resolution notes
 *
 * Path parameters:
 * - id: Escalation UUID
 *
 * Request body:
 * - resolution_notes: Resolution notes (minimum 10 characters)
 * - resolved_by: Username or identifier of the resolver
 *
 * Returns: { success: true, data: Escalation }
 */
router.post(
  '/:id/resolve',
  authenticateJWT,
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  validate(resolveEscalationParamsSchema, 'params'),
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  validate(resolveEscalationBodySchema, 'body'),
  (req: Request, res: Response, next: NextFunction): void => {
    void (async (): Promise<void> => {
      try {
        const params = req.params as unknown as ResolveEscalationParams;
        const body = req.body as ResolveEscalationBody;

        logger.info(
          { escalationId: params.id, resolvedBy: body.resolved_by },
          'POST /api/escalations/:id/resolve'
        );

        const resolved = await escalationService.resolve(params.id, {
          resolvedBy: body.resolved_by,
          resolutionNotes: body.resolution_notes,
        });

        logger.info({ escalationId: params.id }, 'Escalation resolved successfully');

        sendSuccess(res, resolved);
      } catch (error) {
        next(error);
      }
    })();
  }
);

export default router;
