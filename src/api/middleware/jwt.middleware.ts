import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../infrastructure/config/env';
import { AppError } from '../../shared/errors/AppError';
import { UserRole } from '../../shared/types/auth.types';

/**
 * Extended Express Request interface with authenticated user information
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    username: string;
    role: UserRole;
  };
}

/**
 * JWT payload structure
 */
interface JwtPayload {
  userId: string;
  username: string;
  role: UserRole;
}

/**
 * JWT authentication middleware
 *
 * Validates JWT tokens from the Authorization header and attaches
 * user information to the request object for downstream handlers.
 *
 * Token format: "Bearer <token>"
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 * @throws {AppError} 401 if authorization header is missing or malformed
 * @throws {AppError} 403 if token is invalid, expired, or malformed
 */
export const authenticateJWT = (req: Request, _res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new AppError('Missing authorization header', 401);
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new AppError('Invalid authorization header format. Expected: Bearer <token>', 401);
    }

    const token = parts[1];

    if (!env.JWT_SECRET) {
      throw new AppError('JWT_SECRET not configured', 500, false);
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    // Attach user information to request object for downstream handlers
    (req as AuthenticatedRequest).user = {
      userId: decoded.userId,
      username: decoded.username,
      role: decoded.role,
    };

    next();
  } catch (error) {
    // Check TokenExpiredError first since it extends JsonWebTokenError
    if (error instanceof jwt.TokenExpiredError) {
      next(new AppError('Token has expired', 403));
    } else if (error instanceof jwt.JsonWebTokenError) {
      next(new AppError('Invalid or malformed token', 403));
    } else {
      next(error);
    }
  }
};
