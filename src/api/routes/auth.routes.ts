/**
 * Authentication API routes
 *
 * REST API endpoints for authentication:
 * - POST /api/auth/login - Authenticate user and generate JWT token
 */

import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware/validation.middleware';
import { loginBodySchema, LoginBody } from '../schemas/auth.schema';
import { AuthService } from '../../modules/auth/auth.service';
import { logger } from '../../infrastructure/config/logger';

const router = Router();
const authService = new AuthService();

/**
 * POST /api/auth/login
 *
 * Authenticate user with credentials and generate JWT token
 *
 * Request body:
 * - username: User's username
 * - password: User's password
 *
 * Returns: { success: true, data: { token: string, user: { userId, username, role } } }
 *
 * @throws {AppError} 401 if credentials are invalid
 */
router.post(
  '/login',
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  validate(loginBodySchema, 'body'),
  (req: Request, res: Response, next: NextFunction): void => {
    void (async (): Promise<void> => {
      try {
        const credentials = req.body as LoginBody;

        logger.info({ username: credentials.username }, 'POST /api/auth/login');

        const { token, user } = await authService.login(credentials);

        logger.info(
          { username: user.username, role: user.role },
          'User authenticated successfully'
        );

        // Return token and user data (without password)
        res.status(200).json({
          success: true,
          data: {
            token,
            user: {
              userId: user.userId,
              username: user.username,
              role: user.role,
            },
          },
        });
      } catch (error) {
        next(error);
      }
    })();
  }
);

export default router;
