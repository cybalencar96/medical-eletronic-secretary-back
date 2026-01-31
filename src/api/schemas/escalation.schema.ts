import { z } from 'zod';
import { uuidSchema, limitSchema, offsetSchema } from './appointment.schema';

/**
 * Zod schema for boolean query parameter
 *
 * Accepts: 'true', 'false', '1', '0', or boolean
 */
export const booleanQuerySchema = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((val) => {
    if (typeof val === 'boolean') return val;
    return val === 'true' || val === '1';
  })
  .optional();

/**
 * Zod schema for GET /api/escalations query parameters
 *
 * Validates:
 * - resolved: Optional boolean filter for resolved status
 * - limit: Optional pagination limit (default 50, max 100)
 * - offset: Optional pagination offset (default 0)
 */
export const getEscalationsQuerySchema = z.object({
  resolved: booleanQuerySchema,
  limit: limitSchema,
  offset: offsetSchema,
});

/**
 * Zod schema for POST /api/escalations/:id/resolve path parameters
 */
export const resolveEscalationParamsSchema = z.object({
  id: uuidSchema,
});

/**
 * Zod schema for POST /api/escalations/:id/resolve request body
 *
 * Validates:
 * - resolution_notes: Non-empty string with minimum 10 characters
 * - resolved_by: Non-empty string identifying the resolver
 */
export const resolveEscalationBodySchema = z.object({
  resolution_notes: z
    .string()
    .min(10, { message: 'Resolution notes must be at least 10 characters' })
    .max(1000, { message: 'Resolution notes cannot exceed 1000 characters' }),
  resolved_by: z.string().min(1, { message: 'Resolved by identifier is required' }),
});

/**
 * Type inference from Zod schemas
 */
export type GetEscalationsQuery = z.infer<typeof getEscalationsQuerySchema>;
export type ResolveEscalationParams = z.infer<typeof resolveEscalationParamsSchema>;
export type ResolveEscalationBody = z.infer<typeof resolveEscalationBodySchema>;
