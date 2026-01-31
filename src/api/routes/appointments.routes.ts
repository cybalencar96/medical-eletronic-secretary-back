/**
 * Appointments API routes
 *
 * REST API endpoints for appointment management:
 * - GET /api/appointments - List appointments with filtering and pagination
 * - PATCH /api/appointments/:id - Update appointment status
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/jwt.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  getAppointmentsQuerySchema,
  updateAppointmentParamsSchema,
  updateAppointmentBodySchema,
  GetAppointmentsQuery,
  UpdateAppointmentParams,
  UpdateAppointmentBody,
} from '../schemas/appointment.schema';
import appointmentRepository from '../../modules/appointments/appointment.repository';
import { sendSuccess } from '../utils/response-formatter';
import { AppError } from '../../shared/errors/AppError';
import { logger } from '../../infrastructure/config/logger';
import { Knex } from 'knex';
import db from '../../infrastructure/database/connection';

const router = Router();

/**
 * Database row type for appointments table
 */
interface AppointmentRow {
  id: string;
  patient_id: string;
  scheduled_at: Date;
  status: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Create audit log entry for appointment status update
 *
 * Implements LGPD compliance by tracking all appointment modifications
 *
 * @param appointmentId - UUID of appointment
 * @param patientId - UUID of patient
 * @param oldStatus - Previous status
 * @param newStatus - New status
 * @param updatedBy - User who made the update
 * @param database - Knex database instance
 */
async function createAuditLog(
  appointmentId: string,
  patientId: string,
  oldStatus: string,
  newStatus: string,
  updatedBy: string,
  database: Knex = db
): Promise<void> {
  await database('audit_logs').insert({
    patient_id: patientId,
    action: 'status_update',
    payload: JSON.stringify({
      appointment_id: appointmentId,
      old_status: oldStatus,
      new_status: newStatus,
      updated_by: updatedBy,
      timestamp: new Date().toISOString(),
    }),
  });

  logger.info(
    { appointmentId, patientId, oldStatus, newStatus, updatedBy },
    'Audit log created for status update'
  );
}

/**
 * GET /api/appointments
 *
 * List appointments with optional filtering and pagination
 *
 * Query parameters:
 * - startDate: Optional start date (ISO 8601 or DD/MM/YYYY)
 * - endDate: Optional end date (ISO 8601 or DD/MM/YYYY)
 * - status: Optional status filter
 * - limit: Pagination limit (default 50, max 100)
 * - offset: Pagination offset (default 0)
 *
 * Returns: { success: true, data: Appointment[] }
 */
router.get(
  '/',
  authenticateJWT,
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  validate(getAppointmentsQuerySchema, 'query'),
  (req: Request, res: Response, next: NextFunction): void => {
    void (async (): Promise<void> => {
      try {
        const query = req.query as unknown as GetAppointmentsQuery;

        logger.info({ query }, 'GET /api/appointments');

        let dbQuery = db('appointments')
          .select('*')
          .orderBy('scheduled_at', 'desc')
          .limit(query.limit)
          .offset(query.offset);

        // Apply date range filter
        if (query.startDate) {
          dbQuery = dbQuery.where('scheduled_at', '>=', new Date(query.startDate));
        }
        if (query.endDate) {
          const endDate = new Date(query.endDate);
          endDate.setHours(23, 59, 59, 999);
          dbQuery = dbQuery.where('scheduled_at', '<=', endDate);
        }

        // Apply status filter
        if (query.status) {
          dbQuery = dbQuery.where('status', query.status);
        }

        const rows = (await dbQuery) as AppointmentRow[];

        // Map database rows to entities
        const appointments = rows.map((row) => ({
          id: row.id,
          patientId: row.patient_id,
          scheduledAt: new Date(row.scheduled_at),
          status: row.status,
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at),
        }));

        logger.info({ count: appointments.length }, 'Appointments retrieved successfully');

        sendSuccess(res, appointments);
      } catch (error) {
        next(error);
      }
    })();
  }
);

/**
 * PATCH /api/appointments/:id
 *
 * Update appointment status
 *
 * Path parameters:
 * - id: Appointment UUID
 *
 * Request body:
 * - status: New status (scheduled, confirmed, cancelled, completed, no-show)
 *
 * Returns: { success: true, data: Appointment }
 *
 * Creates audit log entry for LGPD compliance
 */
router.patch(
  '/:id',
  authenticateJWT,
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  validate(updateAppointmentParamsSchema, 'params'),
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  validate(updateAppointmentBodySchema, 'body'),
  (req: Request, res: Response, next: NextFunction): void => {
    void (async (): Promise<void> => {
      try {
        const params = req.params as unknown as UpdateAppointmentParams;
        const body = req.body as UpdateAppointmentBody;
        const user = (req as AuthenticatedRequest).user;

        logger.info(
          { appointmentId: params.id, status: body.status },
          'PATCH /api/appointments/:id'
        );

        // Find existing appointment
        const existing = await appointmentRepository.findById(params.id);
        if (!existing) {
          throw new AppError('Appointment not found', 404);
        }

        const oldStatus = existing.status;

        // Update appointment status
        const updated = await appointmentRepository.update(params.id, { status: body.status });

        // Create audit log for LGPD compliance
        await createAuditLog(
          params.id,
          existing.patientId,
          oldStatus,
          body.status,
          user?.username || 'unknown',
          db
        );

        logger.info(
          { appointmentId: params.id, oldStatus, newStatus: body.status },
          'Appointment status updated successfully'
        );

        sendSuccess(res, updated);
      } catch (error) {
        next(error);
      }
    })();
  }
);

export default router;
