import { AuthService } from '../../../../src/modules/auth/auth.service';
import { UserRole } from '../../../../src/shared/types/auth.types';
import { AppError } from '../../../../src/shared/errors/AppError';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

// Mock dependencies
jest.mock('../../../../src/infrastructure/config/env', () => ({
  env: {
    JWT_SECRET: 'test-secret-key',
    JWT_EXPIRES_IN: '24h',
  },
}));

jest.mock('../../../../src/modules/auth/constants', () => ({
  HARDCODED_USERS: [
    {
      userId: 'test-doctor-id',
      username: 'doctor',
      password: '$2b$10$zTbNZbnSXCqNEx7baGLRo.ucTklnLxLQJi77/OE83hsLw.CiLO2xC', // doctor123
      role: 'doctor', // Use string literal to avoid circular dependency
    },
    {
      userId: 'test-secretary-id',
      username: 'secretary',
      password: '$2b$10$YkYyVeWMCD5wIWqodrh9mOXJ2CW8teGL6UamRUitMxu3JF1kTfp0y', // secretary123
      role: 'secretary', // Use string literal to avoid circular dependency
    },
  ],
}));

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
  });

  describe('validateCredentials', () => {
    it('should validate doctor credentials and return user object', async () => {
      const credentials = { username: 'doctor', password: 'doctor123' };

      const user = await authService.validateCredentials(credentials);

      expect(user).toBeDefined();
      expect(user.userId).toBe('test-doctor-id');
      expect(user.username).toBe('doctor');
      expect(user.role).toBe(UserRole.DOCTOR);
    });

    it('should validate secretary credentials and return user object', async () => {
      const credentials = { username: 'secretary', password: 'secretary123' };

      const user = await authService.validateCredentials(credentials);

      expect(user).toBeDefined();
      expect(user.userId).toBe('test-secretary-id');
      expect(user.username).toBe('secretary');
      expect(user.role).toBe(UserRole.SECRETARY);
    });

    it('should throw 401 error for invalid username', async () => {
      const credentials = { username: 'nonexistent', password: 'password123' };

      await expect(authService.validateCredentials(credentials)).rejects.toThrow(AppError);
      await expect(authService.validateCredentials(credentials)).rejects.toThrow(
        'Invalid credentials'
      );

      try {
        await authService.validateCredentials(credentials);
      } catch (error) {
        expect((error as AppError).statusCode).toBe(401);
      }
    });

    it('should throw 401 error for invalid password', async () => {
      const credentials = { username: 'doctor', password: 'wrongpassword' };

      await expect(authService.validateCredentials(credentials)).rejects.toThrow(AppError);
      await expect(authService.validateCredentials(credentials)).rejects.toThrow(
        'Invalid credentials'
      );

      try {
        await authService.validateCredentials(credentials);
      } catch (error) {
        expect((error as AppError).statusCode).toBe(401);
      }
    });

    it('should throw 401 error for empty username', async () => {
      const credentials = { username: '', password: 'doctor123' };

      await expect(authService.validateCredentials(credentials)).rejects.toThrow(AppError);
      await expect(authService.validateCredentials(credentials)).rejects.toThrow(
        'Invalid credentials'
      );
    });

    it('should throw 401 error for empty password', async () => {
      const credentials = { username: 'doctor', password: '' };

      await expect(authService.validateCredentials(credentials)).rejects.toThrow(AppError);
      await expect(authService.validateCredentials(credentials)).rejects.toThrow(
        'Invalid credentials'
      );
    });

    it('should use bcrypt.compare for password verification', async () => {
      const bcryptCompareSpy = jest.spyOn(bcrypt, 'compare');
      const credentials = { username: 'doctor', password: 'doctor123' };

      await authService.validateCredentials(credentials);

      expect(bcryptCompareSpy).toHaveBeenCalledWith(
        'doctor123',
        '$2b$10$zTbNZbnSXCqNEx7baGLRo.ucTklnLxLQJi77/OE83hsLw.CiLO2xC'
      );

      bcryptCompareSpy.mockRestore();
    });
  });

  describe('generateToken', () => {
    it('should generate JWT token with correct payload for doctor', () => {
      const user = {
        userId: 'test-doctor-id',
        username: 'doctor',
        password: 'hashed',
        role: UserRole.DOCTOR,
      };

      const token = authService.generateToken(user);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const decoded = jwt.verify(token, 'test-secret-key') as any;
      expect(decoded.userId).toBe('test-doctor-id');
      expect(decoded.username).toBe('doctor');
      expect(decoded.role).toBe(UserRole.DOCTOR);
    });

    it('should generate JWT token with correct payload for secretary', () => {
      const user = {
        userId: 'test-secretary-id',
        username: 'secretary',
        password: 'hashed',
        role: UserRole.SECRETARY,
      };

      const token = authService.generateToken(user);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const decoded = jwt.verify(token, 'test-secret-key') as any;
      expect(decoded.userId).toBe('test-secretary-id');
      expect(decoded.username).toBe('secretary');
      expect(decoded.role).toBe(UserRole.SECRETARY);
    });

    it('should include expiration claim in generated token', () => {
      const user = {
        userId: 'test-doctor-id',
        username: 'doctor',
        password: 'hashed',
        role: UserRole.DOCTOR,
      };

      const token = authService.generateToken(user);
      const decoded = jwt.verify(token, 'test-secret-key') as any;

      expect(decoded.exp).toBeDefined();
      expect(typeof decoded.exp).toBe('number');
      expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });
  });

  describe('login', () => {
    it('should return token and user data for valid doctor credentials', async () => {
      const credentials = { username: 'doctor', password: 'doctor123' };

      const result = await authService.login(credentials);

      expect(result).toBeDefined();
      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe('string');
      expect(result.user.userId).toBe('test-doctor-id');
      expect(result.user.username).toBe('doctor');
      expect(result.user.role).toBe(UserRole.DOCTOR);
    });

    it('should return token and user data for valid secretary credentials', async () => {
      const credentials = { username: 'secretary', password: 'secretary123' };

      const result = await authService.login(credentials);

      expect(result).toBeDefined();
      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe('string');
      expect(result.user.userId).toBe('test-secretary-id');
      expect(result.user.username).toBe('secretary');
      expect(result.user.role).toBe(UserRole.SECRETARY);
    });

    it('should throw 401 error for invalid credentials', async () => {
      const credentials = { username: 'doctor', password: 'wrongpassword' };

      await expect(authService.login(credentials)).rejects.toThrow(AppError);
      await expect(authService.login(credentials)).rejects.toThrow('Invalid credentials');

      try {
        await authService.login(credentials);
      } catch (error) {
        expect((error as AppError).statusCode).toBe(401);
      }
    });

    it('should generate valid JWT token that can be verified', async () => {
      const credentials = { username: 'doctor', password: 'doctor123' };

      const result = await authService.login(credentials);

      // Verify token can be decoded
      const decoded = jwt.verify(result.token, 'test-secret-key') as any;
      expect(decoded.userId).toBe('test-doctor-id');
      expect(decoded.username).toBe('doctor');
      expect(decoded.role).toBe(UserRole.DOCTOR);
    });
  });
});
