/**
 * Integration tests for escalations API routes
 */

import request from 'supertest';
import { app } from '../../../src/app';
import jwt from 'jsonwebtoken';
import db from '../../../src/infrastructure/database/connection';
import { createTransactionContext, TransactionContext } from '../../utils/transaction-context';

// Mock JWT secret
jest.mock('../../../src/infrastructure/config/env', () => ({
  env: {
    JWT_SECRET: 'test-secret-key',
    NODE_ENV: 'test',
    PORT: 3000,
  },
}));

describe('Escalations API Integration Tests', () => {
  let authToken: string;
  let testEscalationId: string;
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
    const [patient] = await db('patients')
      .insert({
        phone: '+5511999999999',
        cpf: '12345678901',
        name: 'Test Patient',
        consent_given_at: new Date(),
      })
      .returning('*');

    testPatientId = patient.id;

    // Create test escalation
    const [escalation] = await db('escalations')
      .insert({
        patient_id: testPatientId,
        message: 'Test message requiring escalation',
        reason: 'Low confidence in intent classification',
      })
      .returning('*');

    testEscalationId = escalation.id;
  });

  afterEach(async () => {
    await txContext.teardown();
  });

  describe('GET /api/escalations', () => {
    it('should return escalations with patient context', async () => {
      const response = await request(app)
        .get('/api/escalations')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);

      if (response.body.data.length > 0) {
        expect(response.body.data[0]).toHaveProperty('patientName');
        expect(response.body.data[0]).toHaveProperty('patientPhone');
      }
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app).get('/api/escalations').expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Missing authorization header');
    });

    it('should filter by resolved status (pending)', async () => {
      const response = await request(app)
        .get('/api/escalations')
        .query({ resolved: 'false' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should filter by resolved status (resolved)', async () => {
      const response = await request(app)
        .get('/api/escalations')
        .query({ resolved: 'true' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should apply pagination', async () => {
      const response = await request(app)
        .get('/api/escalations')
        .query({
          limit: 10,
          offset: 0,
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should return 400 for invalid pagination parameters', async () => {
      const response = await request(app)
        .get('/api/escalations')
        .query({ limit: -1 })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/escalations/:id/resolve', () => {
    it('should resolve escalation with valid data', async () => {
      const response = await request(app)
        .post(`/api/escalations/${testEscalationId}/resolve`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          resolution_notes: 'Contacted patient and resolved the issue via phone call',
          resolved_by: 'dr.smith',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.resolvedBy).toBe('dr.smith');
      expect(response.body.data.resolvedAt).toBeDefined();
    });

    it('should update database with resolved_at and resolved_by', async () => {
      await request(app)
        .post(`/api/escalations/${testEscalationId}/resolve`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          resolution_notes: 'Resolved the escalation',
          resolved_by: 'dr.jones',
        })
        .expect(200);

      const escalation = await db('escalations').where({ id: testEscalationId }).first();

      expect(escalation.resolved_by).toBe('dr.jones');
      expect(escalation.resolved_at).toBeDefined();
    });

    it('should return 404 for non-existent escalation', async () => {
      const nonexistentId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await request(app)
        .post(`/api/escalations/${nonexistentId}/resolve`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          resolution_notes: 'Resolved the escalation',
          resolved_by: 'dr.smith',
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });

    it('should return 409 for already resolved escalation', async () => {
      // Resolve once
      await request(app)
        .post(`/api/escalations/${testEscalationId}/resolve`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          resolution_notes: 'First resolution',
          resolved_by: 'dr.smith',
        })
        .expect(200);

      // Try to resolve again
      const response = await request(app)
        .post(`/api/escalations/${testEscalationId}/resolve`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          resolution_notes: 'Second resolution attempt',
          resolved_by: 'dr.jones',
        })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('already resolved');
    });

    it('should return 400 for invalid UUID', async () => {
      const response = await request(app)
        .post('/api/escalations/invalid-uuid/resolve')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          resolution_notes: 'Resolved the escalation',
          resolved_by: 'dr.smith',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Validation failed');
    });

    it('should return 400 for resolution notes shorter than 10 characters', async () => {
      const response = await request(app)
        .post(`/api/escalations/${testEscalationId}/resolve`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          resolution_notes: 'Short',
          resolved_by: 'dr.smith',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Validation failed');
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post(`/api/escalations/${testEscalationId}/resolve`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post(`/api/escalations/${testEscalationId}/resolve`)
        .send({
          resolution_notes: 'Resolved the escalation',
          resolved_by: 'dr.smith',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});
