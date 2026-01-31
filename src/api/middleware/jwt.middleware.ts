import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../infrastructure/config/env';
import { AppError } from '../../shared/errors/AppError';

/**
 * Extended Express Request interface with authenticated user information
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    username: string;
  };
}

/**
 * JWT payload structure
 */
interface JwtPayload {
  userId: string;
  username: string;
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
 * @throws {AppError} 401 if token is missing, invalid, or expired
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
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new AppError('Invalid or expired token', 401));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new AppError('Token has expired', 401));
    } else {
      next(error);
    }
  }
};
