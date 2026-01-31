import { z } from 'zod';
import { AppointmentStatus } from '../../modules/appointments/types/appointment.types';

/**
 * Zod schema for appointment status enum validation
 */
export const appointmentStatusSchema = z.enum([
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.CANCELLED,
  AppointmentStatus.COMPLETED,
  AppointmentStatus.NO_SHOW,
]);

/**
 * Zod schema for UUID v4 validation
 */
export const uuidSchema = z.string().uuid({
  message: 'Invalid UUID format',
});

/**
 * Zod schema for ISO 8601 or Brazilian DD/MM/YYYY date format
 *
 * Validates and transforms dates to ISO 8601 format
 */
export const dateSchema = z
  .string()
  .refine(
    (val) => {
      // Check ISO 8601 format (YYYY-MM-DD)
      if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
        const date = new Date(val);
        return !isNaN(date.getTime());
      }
      // Check Brazilian format (DD/MM/YYYY)
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) {
        const [day, month, year] = val.split('/').map(Number);
        const date = new Date(year, month - 1, day);
        return (
          !isNaN(date.getTime()) &&
          date.getDate() === day &&
          date.getMonth() === month - 1 &&
          date.getFullYear() === year
        );
      }
      return false;
    },
    {
      message: 'Invalid date format. Expected ISO 8601 (YYYY-MM-DD) or Brazilian (DD/MM/YYYY)',
    }
  )
  .transform((val) => {
    // Transform Brazilian format to ISO 8601
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) {
      const [day, month, year] = val.split('/');
      return `${year}-${month}-${day}`;
    }
    return val;
  });

/**
 * Zod schema for pagination limit parameter
 *
 * Default: 50, Max: 100
 */
export const limitSchema = z.coerce
  .number()
  .int()
  .min(1, { message: 'Limit must be at least 1' })
  .max(100, { message: 'Limit cannot exceed 100' })
  .default(50);

/**
 * Zod schema for pagination offset parameter
 *
 * Default: 0
 */
export const offsetSchema = z.coerce
  .number()
  .int()
  .min(0, { message: 'Offset must be non-negative' })
  .default(0);

/**
 * Zod schema for GET /api/appointments query parameters
 *
 * Validates:
 * - startDate: Optional ISO 8601 or Brazilian date format
 * - endDate: Optional ISO 8601 or Brazilian date format
 * - status: Optional appointment status enum
 * - limit: Optional pagination limit (default 50, max 100)
 * - offset: Optional pagination offset (default 0)
 */
export const getAppointmentsQuerySchema = z.object({
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  status: appointmentStatusSchema.optional(),
  limit: limitSchema,
  offset: offsetSchema,
});

/**
 * Zod schema for PATCH /api/appointments/:id path parameters
 */
export const updateAppointmentParamsSchema = z.object({
  id: uuidSchema,
});

/**
 * Zod schema for PATCH /api/appointments/:id request body
 *
 * Validates status update to valid appointment status enum
 */
export const updateAppointmentBodySchema = z.object({
  status: appointmentStatusSchema,
});

/**
 * Type inference from Zod schemas
 */
export type GetAppointmentsQuery = z.infer<typeof getAppointmentsQuerySchema>;
export type UpdateAppointmentParams = z.infer<typeof updateAppointmentParamsSchema>;
export type UpdateAppointmentBody = z.infer<typeof updateAppointmentBodySchema>;
