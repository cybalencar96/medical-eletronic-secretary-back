import { createTransactionContext, TransactionContext, getTestDb } from '../utils/transaction-context';

describe('Database Schema Integration Tests', () => {
  let txContext: TransactionContext;

  beforeEach(async () => {
    txContext = createTransactionContext();
    await txContext.setup();
  });

  afterEach(async () => {
    await txContext.teardown();
  });

  describe('Patients Table Constraints', () => {
    it('should enforce unique constraint on phone number', async () => {
        const patient = {
        phone: '+5511999999999',
        name: 'John Doe',
      };

      await getTestDb()('patients').insert(patient);

      // Attempt to insert duplicate phone
      await expect(getTestDb()('patients').insert(patient)).rejects.toThrow();
    });

    it('should auto-generate UUID for patient ID', async () => {
        const [patient] = await getTestDb()('patients')
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
        const [patient] = await getTestDb()('patients')
        .insert({
          phone: '+5511999999999',
          name: 'John Doe',
        })
        .returning('*');

      expect(patient.created_at).toBeDefined();
      expect(new Date(patient.created_at).getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should allow nullable consent_given_at', async () => {
        const [patient] = await getTestDb()('patients')
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
        const [patient] = await getTestDb()('patients')
        .insert({
          phone: '+5511999999999',
          name: 'John Doe',
        })
        .returning('*');
      patientId = patient.id;
    });

    it('should enforce foreign key constraint on patient_id', async () => {
        const appointment = {
        patient_id: '00000000-0000-0000-0000-000000000000', // Non-existent patient
        scheduled_at: new Date(),
      };

      await expect(getTestDb()('appointments').insert(appointment)).rejects.toThrow();
    });

    it('should cascade delete appointments when patient is deleted', async () => {
        const [appointment] = await getTestDb()('appointments')
        .insert({
          patient_id: patientId,
          scheduled_at: new Date(),
        })
        .returning('*');

      expect(appointment).toBeDefined();

      await getTestDb()('patients').where({ id: patientId }).del();

      const appointments = await getTestDb()('appointments').where({ patient_id: patientId });
      expect(appointments).toHaveLength(0);
    });

    it('should default status to scheduled', async () => {
        const [appointment] = await getTestDb()('appointments')
        .insert({
          patient_id: patientId,
          scheduled_at: new Date(),
        })
        .returning('*');

      expect(appointment.status).toBe('scheduled');
    });

    it('should accept valid status enum values', async () => {
        const validStatuses = ['scheduled', 'confirmed', 'cancelled', 'completed', 'no_show'];

      for (const status of validStatuses) {
        const [appointment] = await getTestDb()('appointments')
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
        const [appointment] = await getTestDb()('appointments')
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
        const [patient] = await getTestDb()('patients')
        .insert({
          phone: '+5511999999999',
          name: 'John Doe',
        })
        .returning('*');
      patientId = patient.id;
    });

    it('should enforce foreign key constraint on patient_id', async () => {
        const auditLog = {
        patient_id: '00000000-0000-0000-0000-000000000000',
        action: 'patient_created',
        payload: { test: 'data' },
      };

      await expect(getTestDb()('audit_logs').insert(auditLog)).rejects.toThrow();
    });

    it('should accept JSONB payload data', async () => {
        const payload = {
        action: 'appointment_booked',
        timestamp: new Date().toISOString(),
        metadata: {
          source: 'whatsapp',
          phone: '+5511999999999',
        },
      };

      const [auditLog] = await getTestDb()('audit_logs')
        .insert({
          patient_id: patientId,
          action: 'appointment_booked',
          payload,  // Knex handles JSONB serialization automatically
        })
        .returning('*');

      expect(auditLog.payload).toBeDefined();
      // Knex/PostgreSQL returns JSONB as parsed object
      expect(auditLog.payload).toEqual(payload);
    });

    it('should cascade delete audit logs when patient is deleted', async () => {
        await getTestDb()('audit_logs').insert({
        patient_id: patientId,
        action: 'patient_created',
      });

      await getTestDb()('patients').where({ id: patientId }).del();

      const auditLogs = await getTestDb()('audit_logs').where({ patient_id: patientId });
      expect(auditLogs).toHaveLength(0);
    });
  });

  describe('Escalations Table Constraints', () => {
    let patientId: string;

    beforeEach(async () => {
        const [patient] = await getTestDb()('patients')
        .insert({
          phone: '+5511999999999',
          name: 'John Doe',
        })
        .returning('*');
      patientId = patient.id;
    });

    it('should enforce foreign key constraint on patient_id', async () => {
        const escalation = {
        patient_id: '00000000-0000-0000-0000-000000000000',
        message: 'Test escalation',
        reason: 'low_confidence',
      };

      await expect(getTestDb()('escalations').insert(escalation)).rejects.toThrow();
    });

    it('should allow nullable resolved_at and resolved_by', async () => {
        const [escalation] = await getTestDb()('escalations')
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
        await getTestDb()('escalations').insert({
        patient_id: patientId,
        message: 'Test escalation',
        reason: 'low_confidence',
      });

      await getTestDb()('patients').where({ id: patientId }).del();

      const escalations = await getTestDb()('escalations').where({ patient_id: patientId });
      expect(escalations).toHaveLength(0);
    });
  });

  describe('Notifications Sent Table Constraints', () => {
    let patientId: string;
    let appointmentId: string;

    beforeEach(async () => {
        const [patient] = await getTestDb()('patients')
        .insert({
          phone: '+5511999999999',
          name: 'John Doe',
        })
        .returning('*');
      patientId = patient.id;

      const [appointment] = await getTestDb()('appointments')
        .insert({
          patient_id: patientId,
          scheduled_at: new Date(),
        })
        .returning('*');
      appointmentId = appointment.id;
    });

    it('should enforce foreign key constraint on appointment_id', async () => {
        const notification = {
        appointment_id: '00000000-0000-0000-0000-000000000000',
        type: 'reminder_48h',
      };

      await expect(getTestDb()('notifications_sent').insert(notification)).rejects.toThrow();
    });

    it('should enforce unique constraint on appointment_id and type combination', async () => {
        const notification = {
        appointment_id: appointmentId,
        type: 'reminder_48h',
      };

      await getTestDb()('notifications_sent').insert(notification);

      // Attempt to insert duplicate
      await expect(getTestDb()('notifications_sent').insert(notification)).rejects.toThrow();
    });

    it('should allow multiple notifications of different types for same appointment', async () => {
        await getTestDb()('notifications_sent').insert({
        appointment_id: appointmentId,
        type: 'reminder_48h',
      });

      await getTestDb()('notifications_sent').insert({
        appointment_id: appointmentId,
        type: 'reminder_72h',
      });

      const notifications = await getTestDb()('notifications_sent').where({
        appointment_id: appointmentId,
      });
      expect(notifications).toHaveLength(2);
    });

    it('should cascade delete notifications when appointment is deleted', async () => {
        await getTestDb()('notifications_sent').insert({
        appointment_id: appointmentId,
        type: 'reminder_48h',
      });

      await getTestDb()('appointments').where({ id: appointmentId }).del();

      const notifications = await getTestDb()('notifications_sent').where({
        appointment_id: appointmentId,
      });
      expect(notifications).toHaveLength(0);
    });

    it('should auto-populate sent_at timestamp', async () => {
        const [notification] = await getTestDb()('notifications_sent')
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
        const [patient] = await getTestDb()('patients')
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

      const [auditLog] = await getTestDb()('audit_logs')
        .insert({
          patient_id: patient.id,
          action: 'conversation_log',
          payload: largePayload,  // Knex handles JSONB serialization automatically
        })
        .returning('*');

      expect(auditLog.payload).toBeDefined();
      // Knex/PostgreSQL returns JSONB as parsed object
      expect(auditLog.payload.messages).toHaveLength(100);
    });

    it('should prevent orphaned appointments when patient deletion fails', async () => {
        const [patient] = await getTestDb()('patients')
        .insert({
          phone: '+5511999999999',
          name: 'John Doe',
        })
        .returning('*');

      await getTestDb()('appointments').insert({
        patient_id: patient.id,
        scheduled_at: new Date(),
      });

      // Delete patient (should cascade delete appointment)
      await getTestDb()('patients').where({ id: patient.id }).del();

      const appointments = await getTestDb()('appointments').where({ patient_id: patient.id });
      expect(appointments).toHaveLength(0);
    });
  });
});
