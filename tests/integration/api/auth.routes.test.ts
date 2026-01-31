/**
 * Integration tests for authentication API routes
 */

import request from 'supertest';
import { app } from '../../../src/app';
import jwt from 'jsonwebtoken';
import { UserRole } from '../../../src/shared/types/auth.types';

// Mock environment config
jest.mock('../../../src/infrastructure/config/env', () => ({
  env: {
    JWT_SECRET: 'test-secret-key',
    JWT_EXPIRES_IN: '24h',
    NODE_ENV: 'test',
    PORT: 3000,
  },
}));

// Mock hardcoded users
jest.mock('../../../src/modules/auth/constants', () => ({
  HARDCODED_USERS: [
    {
      userId: 'test-doctor-id',
      username: 'doctor',
      password: '$2b$10$zTbNZbnSXCqNEx7baGLRo.ucTklnLxLQJi77/OE83hsLw.CiLO2xC', // doctor123
      role: 'doctor',
    },
    {
      userId: 'test-secretary-id',
      username: 'secretary',
      password: '$2b$10$YkYyVeWMCD5wIWqodrh9mOXJ2CW8teGL6UamRUitMxu3JF1kTfp0y', // secretary123
      role: 'secretary',
    },
  ],
}));

describe('Auth API Integration Tests', () => {
  describe('POST /api/auth/login', () => {
    it('should login with valid doctor credentials and return JWT token', async () => {
      const credentials = {
        username: 'doctor',
        password: 'doctor123',
      };

      const response = await request(app).post('/api/auth/login').send(credentials).expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.token).toBeDefined();
      expect(typeof response.body.data.token).toBe('string');
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.userId).toBe('test-doctor-id');
      expect(response.body.data.user.username).toBe('doctor');
      expect(response.body.data.user.role).toBe(UserRole.DOCTOR);
      expect(response.body.data.user.password).toBeUndefined(); // Password should not be returned
    });

    it('should login with valid secretary credentials and return JWT token', async () => {
      const credentials = {
        username: 'secretary',
        password: 'secretary123',
      };

      const response = await request(app).post('/api/auth/login').send(credentials).expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.token).toBeDefined();
      expect(typeof response.body.data.token).toBe('string');
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.userId).toBe('test-secretary-id');
      expect(response.body.data.user.username).toBe('secretary');
      expect(response.body.data.user.role).toBe(UserRole.SECRETARY);
    });

    it('should return 401 for invalid username', async () => {
      const credentials = {
        username: 'nonexistent',
        password: 'password123',
      };

      const response = await request(app).post('/api/auth/login').send(credentials).expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid credentials');
    });

    it('should return 401 for invalid password', async () => {
      const credentials = {
        username: 'doctor',
        password: 'wrongpassword',
      };

      const response = await request(app).post('/api/auth/login').send(credentials).expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid credentials');
    });

    it('should return 400 for missing username field', async () => {
      const credentials = {
        password: 'doctor123',
      };

      const response = await request(app).post('/api/auth/login').send(credentials).expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 for missing password field', async () => {
      const credentials = {
        username: 'doctor',
      };

      const response = await request(app).post('/api/auth/login').send(credentials).expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 for empty username', async () => {
      const credentials = {
        username: '',
        password: 'doctor123',
      };

      const response = await request(app).post('/api/auth/login').send(credentials).expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 for empty password', async () => {
      const credentials = {
        username: 'doctor',
        password: '',
      };

      const response = await request(app).post('/api/auth/login').send(credentials).expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return valid JWT token that can be decoded', async () => {
      const credentials = {
        username: 'doctor',
        password: 'doctor123',
      };

      const response = await request(app).post('/api/auth/login').send(credentials).expect(200);

      const token = response.body.data.token;
      const decoded = jwt.verify(token, 'test-secret-key') as any;

      expect(decoded.userId).toBe('test-doctor-id');
      expect(decoded.username).toBe('doctor');
      expect(decoded.role).toBe(UserRole.DOCTOR);
      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
    });

    it('should generate different tokens for multiple logins', async () => {
      const credentials = {
        username: 'doctor',
        password: 'doctor123',
      };

      const response1 = await request(app).post('/api/auth/login').send(credentials).expect(200);

      // Wait 1ms to ensure different iat
      await new Promise((resolve) => setTimeout(resolve, 1));

      const response2 = await request(app).post('/api/auth/login').send(credentials).expect(200);

      expect(response1.body.data.token).not.toBe(response2.body.data.token);
    });

    it('should be accessible without authentication', async () => {
      const credentials = {
        username: 'doctor',
        password: 'doctor123',
      };

      // Should not require Authorization header
      const response = await request(app).post('/api/auth/login').send(credentials).expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Protected route access with JWT token', () => {
    it('should access protected endpoint with valid token from login', async () => {
      // Login to get token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'doctor',
          password: 'doctor123',
        })
        .expect(200);

      const token = loginResponse.body.data.token;

      // Access protected endpoint (appointments is already protected)
      const response = await request(app)
        .get('/api/appointments')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should reject access to protected endpoint without token', async () => {
      const response = await request(app).get('/api/appointments').expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Missing authorization header');
    });

    it('should reject access to protected endpoint with invalid token', async () => {
      const invalidToken = 'invalid-token-string';

      const response = await request(app)
        .get('/api/appointments')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should reject access to protected endpoint with expired token', async () => {
      // Create expired token
      const expiredToken = jwt.sign(
        { userId: 'test-doctor-id', username: 'doctor', role: UserRole.DOCTOR },
        'test-secret-key',
        {
          expiresIn: '-1s',
        }
      );

      const response = await request(app)
        .get('/api/appointments')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('expired');
    });

    it('should attach user context to request from token', async () => {
      // Login to get token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'secretary',
          password: 'secretary123',
        })
        .expect(200);

      const token = loginResponse.body.data.token;

      // Decode token to verify user context
      const decoded = jwt.verify(token, 'test-secret-key') as any;

      expect(decoded.userId).toBe('test-secretary-id');
      expect(decoded.username).toBe('secretary');
      expect(decoded.role).toBe(UserRole.SECRETARY);
    });
  });

  describe('Token expiration', () => {
    it('should include expiration claim in generated token', async () => {
      const credentials = {
        username: 'doctor',
        password: 'doctor123',
      };

      const response = await request(app).post('/api/auth/login').send(credentials).expect(200);

      const token = response.body.data.token;
      const decoded = jwt.verify(token, 'test-secret-key') as any;

      expect(decoded.exp).toBeDefined();
      expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));

      // Token should expire after 24 hours
      const expiresIn = decoded.exp - decoded.iat;
      expect(expiresIn).toBe(24 * 60 * 60); // 24 hours in seconds
    });
  });
});
