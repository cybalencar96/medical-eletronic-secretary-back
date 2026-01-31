import { Client } from 'pg';
import knex, { Knex } from 'knex';
import knexConfig from '../../knexfile';

/**
 * Check if Docker services (PostgreSQL) are available
 */
async function areDockerServicesAvailable(): Promise<boolean> {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: 'postgres',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  try {
    await client.connect();
    await client.end();
    return true;
  } catch {
    return false;
  }
}

describe('Database Schema Integration Tests', () => {
  let db: Knex;
  let servicesAvailable: boolean;

  beforeAll(async () => {
    servicesAvailable = await areDockerServicesAvailable();

    if (!servicesAvailable) {
      console.warn('PostgreSQL is not available. Skipping integration tests.');
      return;
    }

    // Use test database configuration
    const testConfig = {
      ...knexConfig.development,
      connection: {
        ...(knexConfig.development.connection as Knex.PgConnectionConfig),
        database: 'medical_secretary_test',
      },
    };
    db = knex(testConfig);

    // Ensure clean state and run migrations
    await db.migrate.rollback(undefined, true);
    await db.migrate.latest();
  });

  afterAll(async () => {
    if (servicesAvailable && db) {
      await db.migrate.rollback(undefined, true);
      await db.destroy();
    }
  });

  beforeEach(async () => {
    if (!servicesAvailable) return;

    // Clean up test data before each test
    await db('notifications_sent').del();
    await db('escalations').del();
    await db('audit_logs').del();
    await db('appointments').del();
    await db('patients').del();
  });

  describe('Patients Table Constraints', () => {
    it('should enforce unique constraint on phone number', async () => {
      if (!servicesAvailable) return;

      const patient = {
        phone: '+5511999999999',
        name: 'John Doe',
      };

      await db('patients').insert(patient);

      // Attempt to insert duplicate phone
      await expect(db('patients').insert(patient)).rejects.toThrow();
    });

    it('should auto-generate UUID for patient ID', async () => {
      if (!servicesAvailable) return;

      const [patient] = await db('patients')
        .insert({
          phone: '+5511999999999',
          name: 'John Doe',
        })
        .returning('*');

      expect(patient.id).toBeDefined();
      expect(patient.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });

    it('should auto-populate created_at timestamp', async () => {
      if (!servicesAvailable) return;

      const [patient] = await db('patients')
        .insert({
          phone: '+5511999999999',
          name: 'John Doe',
        })
        .returning('*');

      expect(patient.created_at).toBeDefined();
      expect(new Date(patient.created_at).getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should allow nullable consent_given_at', async () => {
      if (!servicesAvailable) return;

      const [patient] = await db('patients')
        .insert({
          phone: '+5511999999999',
          name: 'John Doe',
        })
        .returning('*');

      expect(patient.consent_given_at).toBeNull();
    });
  });

  describe('Appointments Table Constraints', () => {
    let patientId: string;

    beforeEach(async () => {
      if (!servicesAvailable) return;

      const [patient] = await db('patients')
        .insert({
          phone: '+5511999999999',
          name: 'John Doe',
        })
        .returning('*');
      patientId = patient.id;
    });

    it('should enforce foreign key constraint on patient_id', async () => {
      if (!servicesAvailable) return;

      const appointment = {
        patient_id: '00000000-0000-0000-0000-000000000000', // Non-existent patient
        scheduled_at: new Date(),
      };

      await expect(db('appointments').insert(appointment)).rejects.toThrow();
    });

    it('should cascade delete appointments when patient is deleted', async () => {
      if (!servicesAvailable) return;

      const [appointment] = await db('appointments')
        .insert({
          patient_id: patientId,
          scheduled_at: new Date(),
        })
        .returning('*');

      expect(appointment).toBeDefined();

      await db('patients').where({ id: patientId }).del();

      const appointments = await db('appointments').where({ patient_id: patientId });
      expect(appointments).toHaveLength(0);
    });

    it('should default status to scheduled', async () => {
      if (!servicesAvailable) return;

      const [appointment] = await db('appointments')
        .insert({
          patient_id: patientId,
          scheduled_at: new Date(),
        })
        .returning('*');

      expect(appointment.status).toBe('scheduled');
    });

    it('should accept valid status enum values', async () => {
      if (!servicesAvailable) return;

      const validStatuses = ['scheduled', 'confirmed', 'cancelled', 'completed', 'no_show'];

      for (const status of validStatuses) {
        const [appointment] = await db('appointments')
          .insert({
            patient_id: patientId,
            scheduled_at: new Date(),
            status,
          })
          .returning('*');

        expect(appointment.status).toBe(status);
      }
    });

    it('should auto-populate created_at and updated_at timestamps', async () => {
      if (!servicesAvailable) return;

      const [appointment] = await db('appointments')
        .insert({
          patient_id: patientId,
          scheduled_at: new Date(),
        })
        .returning('*');

      expect(appointment.created_at).toBeDefined();
      expect(appointment.updated_at).toBeDefined();
      expect(new Date(appointment.created_at).getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('Audit Logs Table Constraints', () => {
    let patientId: string;

    beforeEach(async () => {
      if (!servicesAvailable) return;

      const [patient] = await db('patients')
        .insert({
          phone: '+5511999999999',
          name: 'John Doe',
        })
        .returning('*');
      patientId = patient.id;
    });

    it('should enforce foreign key constraint on patient_id', async () => {
      if (!servicesAvailable) return;

      const auditLog = {
        patient_id: '00000000-0000-0000-0000-000000000000',
        action: 'patient_created',
        payload: { test: 'data' },
      };

      await expect(db('audit_logs').insert(auditLog)).rejects.toThrow();
    });

    it('should accept JSONB payload data', async () => {
      if (!servicesAvailable) return;

      const payload = {
        action: 'appointment_booked',
        timestamp: new Date().toISOString(),
        metadata: {
          source: 'whatsapp',
          phone: '+5511999999999',
        },
      };

      const [auditLog] = await db('audit_logs')
        .insert({
          patient_id: patientId,
          action: 'appointment_booked',
          payload: JSON.stringify(payload),
        })
        .returning('*');

      expect(auditLog.payload).toBeDefined();
      const parsedPayload = JSON.parse(auditLog.payload);
      expect(parsedPayload).toEqual(payload);
    });

    it('should cascade delete audit logs when patient is deleted', async () => {
      if (!servicesAvailable) return;

      await db('audit_logs').insert({
        patient_id: patientId,
        action: 'patient_created',
      });

      await db('patients').where({ id: patientId }).del();

      const auditLogs = await db('audit_logs').where({ patient_id: patientId });
      expect(auditLogs).toHaveLength(0);
    });
  });

  describe('Escalations Table Constraints', () => {
    let patientId: string;

    beforeEach(async () => {
      if (!servicesAvailable) return;

      const [patient] = await db('patients')
        .insert({
          phone: '+5511999999999',
          name: 'John Doe',
        })
        .returning('*');
      patientId = patient.id;
    });

    it('should enforce foreign key constraint on patient_id', async () => {
      if (!servicesAvailable) return;

      const escalation = {
        patient_id: '00000000-0000-0000-0000-000000000000',
        message: 'Test escalation',
        reason: 'low_confidence',
      };

      await expect(db('escalations').insert(escalation)).rejects.toThrow();
    });

    it('should allow nullable resolved_at and resolved_by', async () => {
      if (!servicesAvailable) return;

      const [escalation] = await db('escalations')
        .insert({
          patient_id: patientId,
          message: 'Test escalation',
          reason: 'low_confidence',
        })
        .returning('*');

      expect(escalation.resolved_at).toBeNull();
      expect(escalation.resolved_by).toBeNull();
    });

    it('should cascade delete escalations when patient is deleted', async () => {
      if (!servicesAvailable) return;

      await db('escalations').insert({
        patient_id: patientId,
        message: 'Test escalation',
        reason: 'low_confidence',
      });

      await db('patients').where({ id: patientId }).del();

      const escalations = await db('escalations').where({ patient_id: patientId });
      expect(escalations).toHaveLength(0);
    });
  });

  describe('Notifications Sent Table Constraints', () => {
    let patientId: string;
    let appointmentId: string;

    beforeEach(async () => {
      if (!servicesAvailable) return;

      const [patient] = await db('patients')
        .insert({
          phone: '+5511999999999',
          name: 'John Doe',
        })
        .returning('*');
      patientId = patient.id;

      const [appointment] = await db('appointments')
        .insert({
          patient_id: patientId,
          scheduled_at: new Date(),
        })
        .returning('*');
      appointmentId = appointment.id;
    });

    it('should enforce foreign key constraint on appointment_id', async () => {
      if (!servicesAvailable) return;

      const notification = {
        appointment_id: '00000000-0000-0000-0000-000000000000',
        type: 'reminder_48h',
      };

      await expect(db('notifications_sent').insert(notification)).rejects.toThrow();
    });

    it('should enforce unique constraint on appointment_id and type combination', async () => {
      if (!servicesAvailable) return;

      const notification = {
        appointment_id: appointmentId,
        type: 'reminder_48h',
      };

      await db('notifications_sent').insert(notification);

      // Attempt to insert duplicate
      await expect(db('notifications_sent').insert(notification)).rejects.toThrow();
    });

    it('should allow multiple notifications of different types for same appointment', async () => {
      if (!servicesAvailable) return;

      await db('notifications_sent').insert({
        appointment_id: appointmentId,
        type: 'reminder_48h',
      });

      await db('notifications_sent').insert({
        appointment_id: appointmentId,
        type: 'reminder_72h',
      });

      const notifications = await db('notifications_sent').where({
        appointment_id: appointmentId,
      });
      expect(notifications).toHaveLength(2);
    });

    it('should cascade delete notifications when appointment is deleted', async () => {
      if (!servicesAvailable) return;

      await db('notifications_sent').insert({
        appointment_id: appointmentId,
        type: 'reminder_48h',
      });

      await db('appointments').where({ id: appointmentId }).del();

      const notifications = await db('notifications_sent').where({
        appointment_id: appointmentId,
      });
      expect(notifications).toHaveLength(0);
    });

    it('should auto-populate sent_at timestamp', async () => {
      if (!servicesAvailable) return;

      const [notification] = await db('notifications_sent')
        .insert({
          appointment_id: appointmentId,
          type: 'reminder_48h',
        })
        .returning('*');

      expect(notification.sent_at).toBeDefined();
      expect(new Date(notification.sent_at).getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('Edge Cases', () => {
    it('should handle large JSONB payloads in audit_logs', async () => {
      if (!servicesAvailable) return;

      const [patient] = await db('patients')
        .insert({
          phone: '+5511999999999',
          name: 'John Doe',
        })
        .returning('*');

      const largePayload = {
        messages: Array(100)
          .fill(null)
          .map((_, i) => ({
            id: i,
            content: `Message ${i}`,
            timestamp: new Date().toISOString(),
          })),
      };

      const [auditLog] = await db('audit_logs')
        .insert({
          patient_id: patient.id,
          action: 'conversation_log',
          payload: JSON.stringify(largePayload),
        })
        .returning('*');

      expect(auditLog.payload).toBeDefined();
      const parsedPayload = JSON.parse(auditLog.payload);
      expect(parsedPayload.messages).toHaveLength(100);
    });

    it('should prevent orphaned appointments when patient deletion fails', async () => {
      if (!servicesAvailable) return;

      const [patient] = await db('patients')
        .insert({
          phone: '+5511999999999',
          name: 'John Doe',
        })
        .returning('*');

      await db('appointments').insert({
        patient_id: patient.id,
        scheduled_at: new Date(),
      });

      // Delete patient (should cascade delete appointment)
      await db('patients').where({ id: patient.id }).del();

      const appointments = await db('appointments').where({ patient_id: patient.id });
      expect(appointments).toHaveLength(0);
    });
  });
});
