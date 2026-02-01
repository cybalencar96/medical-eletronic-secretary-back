/**
 * Integration tests for appointments API routes
 */

import request from 'supertest';
import { app } from '../../../src/app';
import jwt from 'jsonwebtoken';
import { AppointmentStatus } from '../../../src/modules/appointments/types/appointment.types';
import { createTransactionContext, TransactionContext, getTestDb } from '../../utils/transaction-context';

// Mock JWT secret
jest.mock('../../../src/infrastructure/config/env', () => ({
  env: {
    JWT_SECRET: 'test-secret-key',
    NODE_ENV: 'test',
    PORT: 3000,
  },
}));

describe('Appointments API Integration Tests', () => {
  let authToken: string;
  let testAppointmentId: string;
  let testPatientId: string;
  let txContext: TransactionContext;

  beforeAll(() => {
    // Generate valid JWT token for tests
    authToken = jwt.sign({ userId: 'test-user', username: 'testuser' }, 'test-secret-key');
  });

  beforeEach(async () => {
    txContext = createTransactionContext();
    await txContext.setup();

    // Create test patient
    const [patient] = await getTestDb()('patients')
      .insert({
        phone: '+5511999999999',
        cpf: '12345678901',
        name: 'Test Patient',
        consent_given_at: new Date(),
      })
      .returning('*');

    testPatientId = patient.id;

    // Create test appointment
    const [appointment] = await getTestDb()('appointments')
      .insert({
        patient_id: testPatientId,
        scheduled_at: new Date('2024-12-28T09:00:00Z'),
        status: AppointmentStatus.SCHEDULED,
      })
      .returning('*');

    testAppointmentId = appointment.id;
  });

  afterEach(async () => {
    await txContext.teardown();
  });

  describe('GET /api/appointments', () => {
    it('should return appointments with valid authentication', async () => {
      const response = await request(app)
        .get('/api/appointments')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app).get('/api/appointments').expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Missing authorization header');
    });

    it('should filter appointments by date range', async () => {
      const response = await request(app)
        .get('/api/appointments')
        .query({
          startDate: '2024-12-01',
          endDate: '2024-12-31',
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should accept Brazilian date format', async () => {
      const response = await request(app)
        .get('/api/appointments')
        .query({
          startDate: '01/12/2024',
          endDate: '31/12/2024',
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should filter by status', async () => {
      const response = await request(app)
        .get('/api/appointments')
        .query({
          status: 'scheduled',
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should apply pagination', async () => {
      const response = await request(app)
        .get('/api/appointments')
        .query({
          limit: 10,
          offset: 0,
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should return 400 for invalid date format', async () => {
      const response = await request(app)
        .get('/api/appointments')
        .query({
          startDate: 'invalid-date',
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Validation failed');
    });

    it('should return 400 for limit exceeding maximum', async () => {
      const response = await request(app)
        .get('/api/appointments')
        .query({
          limit: 150,
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PATCH /api/appointments/:id', () => {
    it('should update appointment status with valid authentication', async () => {
      const response = await request(app)
        .patch(`/api/appointments/${testAppointmentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: AppointmentStatus.CONFIRMED })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe(AppointmentStatus.CONFIRMED);
    });

    it('should create audit log entry on status update', async () => {
      await request(app)
        .patch(`/api/appointments/${testAppointmentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: AppointmentStatus.CONFIRMED })
        .expect(200);

      const auditLogs = await getTestDb()('audit_logs')
        .where({ patient_id: testPatientId })
        .where({ action: 'status_update' });

      expect(auditLogs.length).toBeGreaterThan(0);
    });

    it('should return 404 for non-existent appointment', async () => {
      const nonexistentId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await request(app)
        .patch(`/api/appointments/${nonexistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: AppointmentStatus.CONFIRMED })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });

    it('should return 400 for invalid UUID', async () => {
      const response = await request(app)
        .patch('/api/appointments/invalid-uuid')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: AppointmentStatus.CONFIRMED })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Validation failed');
    });

    it('should return 400 for invalid status', async () => {
      const response = await request(app)
        .patch(`/api/appointments/${testAppointmentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'invalid-status' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .patch(`/api/appointments/${testAppointmentId}`)
        .send({ status: AppointmentStatus.CONFIRMED })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});
