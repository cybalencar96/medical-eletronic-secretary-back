import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { AppError } from '../../shared/errors/AppError';

/**
 * Validation target type
 */
type ValidationTarget = 'body' | 'query' | 'params';

/**
 * Creates a validation middleware that applies a Zod schema to request data
 *
 * @param schema - Zod schema to validate against
 * @param target - Request property to validate ('body', 'query', or 'params')
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * router.get(
 *   '/appointments',
 *   validate(getAppointmentsQuerySchema, 'query'),
 *   appointmentsController.list
 * );
 * ```
 */
export const validate = (schema: AnyZodObject, target: ValidationTarget = 'body') => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate and transform the request data
      const validated = await schema.parseAsync(req[target]);

      // Replace the request data with validated and transformed data
      req[target] = validated;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Format Zod validation errors into readable messages
        const errorMessages = error.errors.map((err) => {
          const path = err.path.join('.');
          return `${path}: ${err.message}`;
        });

        next(new AppError(`Validation failed: ${errorMessages.join(', ')}`, 400));
      } else {
        next(error);
      }
    }
  };
};
