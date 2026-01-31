import { z } from 'zod';

/**
 * Zod schema for POST /api/auth/login request body
 *
 * Validates:
 * - username: Required non-empty string
 * - password: Required non-empty string
 */
export const loginBodySchema = z.object({
  username: z.string().min(1, { message: 'Username is required' }),
  password: z.string().min(1, { message: 'Password is required' }),
});

/**
 * Type inference from Zod schema
 */
export type LoginBody = z.infer<typeof loginBodySchema>;
