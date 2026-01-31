/**
 * Integration tests for Bull Board queue monitoring UI routes
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
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
  },
}));

// Mock Bull Board to avoid actual Redis connection
jest.mock('@bull-board/api', () => ({
  createBullBoard: jest.fn(() => ({
    addQueue: jest.fn(),
    removeQueue: jest.fn(),
    setQueues: jest.fn(),
    replaceQueues: jest.fn(),
  })),
}));

jest.mock('@bull-board/api/bullMQAdapter', () => ({
  BullMQAdapter: jest.fn().mockImplementation((queue) => ({
    queue,
    setFormatter: jest.fn(),
  })),
}));

jest.mock('@bull-board/express', () => {
  const mockRouter: {
    use: jest.Mock;
    get: jest.Mock;
    _handlers?: Record<string, unknown>;
  } = {
    use: jest.fn(),
    get: jest.fn((path: string, handler: unknown): typeof mockRouter => {
      // Simulate Bull Board UI route
      if (path === '/') {
        mockRouter._handlers = mockRouter._handlers || {};
        mockRouter._handlers['/'] = handler;
      }
      return mockRouter;
    }),
  };

  return {
    ExpressAdapter: jest.fn().mockImplementation(() => ({
      setBasePath: jest.fn(),
      getRouter: jest.fn(() => mockRouter),
    })),
  };
});

// Mock BullMQ queues
jest.mock('../../../src/infrastructure/queue/queues', () => ({
  queues: {
    whatsappMessages: {
      name: 'whatsapp-messages',
      add: jest.fn(),
      getJobs: jest.fn().mockResolvedValue([]),
      getJobCounts: jest.fn().mockResolvedValue({
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
      }),
      close: jest.fn(),
    },
    intentClassification: {
      name: 'intent-classification',
      add: jest.fn(),
      getJobs: jest.fn().mockResolvedValue([]),
      getJobCounts: jest.fn().mockResolvedValue({
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
      }),
      close: jest.fn(),
    },
    notifications: {
      name: 'notifications',
      add: jest.fn(),
      getJobs: jest.fn().mockResolvedValue([]),
      getJobCounts: jest.fn().mockResolvedValue({
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
      }),
      close: jest.fn(),
    },
    escalations: {
      name: 'escalations',
      add: jest.fn(),
      getJobs: jest.fn().mockResolvedValue([]),
      getJobCounts: jest.fn().mockResolvedValue({
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
      }),
      close: jest.fn(),
    },
  },
  closeQueues: jest.fn(),
}));

describe('Bull Board Routes Integration Tests', () => {
  let validDoctorToken: string;
  let validSecretaryToken: string;
  let expiredToken: string;
  let invalidToken: string;

  beforeAll(() => {
    const JWT_SECRET = 'test-secret-key';

    // Generate valid tokens for doctor and secretary
    validDoctorToken = jwt.sign(
      {
        userId: 'doctor-id',
        username: 'doctor',
        role: UserRole.DOCTOR,
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    validSecretaryToken = jwt.sign(
      {
        userId: 'secretary-id',
        username: 'secretary',
        role: UserRole.SECRETARY,
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Generate expired token (expired 1 hour ago)
    expiredToken = jwt.sign(
      {
        userId: 'doctor-id',
        username: 'doctor',
        role: UserRole.DOCTOR,
      },
      JWT_SECRET,
      { expiresIn: '-1h' }
    );

    // Invalid token (signed with wrong secret)
    invalidToken = jwt.sign(
      {
        userId: 'doctor-id',
        username: 'doctor',
        role: UserRole.DOCTOR,
      },
      'wrong-secret',
      { expiresIn: '1h' }
    );
  });

  describe('GET /admin/queues - Authentication', () => {
    it('should return 401 when no authorization header is provided', async () => {
      const response = await request(app).get('/admin/queues').expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Missing authorization header');
    });

    it('should return 401 when authorization header is malformed', async () => {
      const response = await request(app)
        .get('/admin/queues')
        .set('Authorization', 'InvalidFormat token123')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid authorization header format');
    });

    it('should return 401 when token is missing after Bearer keyword', async () => {
      const response = await request(app)
        .get('/admin/queues')
        .set('Authorization', 'Bearer ')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should return 403 when token is expired', async () => {
      const response = await request(app)
        .get('/admin/queues')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Token has expired');
    });

    it('should return 403 when token is invalid', async () => {
      const response = await request(app)
        .get('/admin/queues')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid or malformed token');
    });

    it('should return 403 when token is malformed', async () => {
      const response = await request(app)
        .get('/admin/queues')
        .set('Authorization', 'Bearer not-a-valid-jwt-token')
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid or malformed token');
    });
  });

  describe('GET /admin/queues - Authorized Access', () => {
    it('should allow access with valid doctor token', async () => {
      const response = await request(app)
        .get('/admin/queues')
        .set('Authorization', `Bearer ${validDoctorToken}`)
        .expect(200);

      // Bull Board returns HTML UI
      expect(response.type).toMatch(/html|text/);
    });

    it('should allow access with valid secretary token', async () => {
      const response = await request(app)
        .get('/admin/queues')
        .set('Authorization', `Bearer ${validSecretaryToken}`)
        .expect(200);

      // Bull Board returns HTML UI
      expect(response.type).toMatch(/html|text/);
    });
  });

  describe('GET /admin/queues - Role-Based Access', () => {
    it('should allow doctor role to access Bull Board', async () => {
      const response = await request(app)
        .get('/admin/queues')
        .set('Authorization', `Bearer ${validDoctorToken}`);

      expect(response.status).toBe(200);
    });

    it('should allow secretary role to access Bull Board', async () => {
      const response = await request(app)
        .get('/admin/queues')
        .set('Authorization', `Bearer ${validSecretaryToken}`);

      expect(response.status).toBe(200);
    });
  });

  describe('GET /admin/queues - Static Assets', () => {
    it('should serve Bull Board static assets with valid token', async () => {
      // Bull Board typically serves static assets under the base path
      const response = await request(app)
        .get('/admin/queues/static/style.css')
        .set('Authorization', `Bearer ${validDoctorToken}`);

      // Should either return 200 (asset found) or 404 (asset not mocked)
      // Both are acceptable since we're testing auth, not Bull Board internals
      expect([200, 404]).toContain(response.status);
    });

    it('should block static assets without authentication', async () => {
      const response = await request(app)
        .get('/admin/queues/static/style.css')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Missing authorization header');
    });
  });
});
