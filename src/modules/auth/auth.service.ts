import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { env } from '../../infrastructure/config/env';
import { AppError } from '../../shared/errors/AppError';
import { JWTPayload, LoginRequest, User } from '../../shared/types/auth.types';
import { HARDCODED_USERS } from './constants';

/**
 * Authentication service handling JWT token generation and credential validation
 */
export class AuthService {
  /**
   * Validates user credentials against hardcoded user list
   *
   * @param credentials - Login credentials (username and password)
   * @returns Promise<User> - Authenticated user object
   * @throws {AppError} 401 if credentials are invalid
   */
  async validateCredentials(credentials: LoginRequest): Promise<User> {
    // Find user by username
    const user = HARDCODED_USERS.find((u) => u.username === credentials.username);

    // Generic error message to prevent username enumeration
    const invalidCredentialsError = new AppError('Invalid credentials', 401);

    if (!user) {
      throw invalidCredentialsError;
    }

    // Verify password using bcrypt
    const isPasswordValid = await bcrypt.compare(credentials.password, user.password);

    if (!isPasswordValid) {
      throw invalidCredentialsError;
    }

    return user;
  }

  /**
   * Generates JWT token for authenticated user
   *
   * @param user - Authenticated user object
   * @returns string - Signed JWT token
   * @throws {AppError} 500 if JWT_SECRET is not configured
   */
  generateToken(user: User): string {
    if (!env.JWT_SECRET) {
      throw new AppError('JWT_SECRET not configured', 500, false);
    }

    const payload: JWTPayload = {
      userId: user.userId,
      username: user.username,
      role: user.role,
    };

    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: (env.JWT_EXPIRES_IN || '24h') as SignOptions['expiresIn'],
    });
  }

  /**
   * Authenticates user and generates JWT token
   *
   * @param credentials - Login credentials (username and password)
   * @returns Promise<{ token: string; user: User }> - Token and user data
   * @throws {AppError} 401 if credentials are invalid
   */
  async login(credentials: LoginRequest): Promise<{ token: string; user: User }> {
    const user = await this.validateCredentials(credentials);
    const token = this.generateToken(user);

    return {
      token,
      user,
    };
  }
}
