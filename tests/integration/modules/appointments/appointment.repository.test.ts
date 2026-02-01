/**
 * Integration tests for AppointmentRepository
 *
 * Tests data access layer with real PostgreSQL database
 */

import { AppointmentRepository } from '../../../../src/modules/appointments/appointment.repository';
import { AppointmentStatus } from '../../../../src/modules/appointments/types/appointment.types';
import { createTransactionContext, TransactionContext, getTestDb } from '../../../utils/transaction-context';

describe('AppointmentRepository Integration Tests', () => {
  let repository: AppointmentRepository;
  let txContext: TransactionContext;
  let testPatientId: string;

  beforeEach(async () => {
    txContext = createTransactionContext();
    await txContext.setup();
    repository = new AppointmentRepository(getTestDb());

    // Create test patient for foreign key constraint
    const [patient] = await getTestDb()('patients')
      .insert({
        name: 'Test Patient',
        cpf: '12345678900',
        phone: '+5511999999999',
        consent_given_at: new Date(),
      })
      .returning('id');

    testPatientId = patient.id;
  });

  afterEach(async () => {
    await txContext.teardown();
  });

  describe('create', () => {
    it('should create appointment with generated UUID and timestamps', async () => {
      const scheduledAt = new Date(2024, 0, 6, 9, 0); // Saturday 09:00
      const appointment = await repository.create({
        patientId: testPatientId,
        scheduledAt,
      });

      expect(appointment.id).toBeDefined();
      expect(typeof appointment.id).toBe('string');
      expect(appointment.patientId).toBe(testPatientId);
      expect(appointment.scheduledAt).toEqual(scheduledAt);
      expect(appointment.status).toBe(AppointmentStatus.SCHEDULED);
      expect(appointment.createdAt).toBeInstanceOf(Date);
      expect(appointment.updatedAt).toBeInstanceOf(Date);
    });

    it('should persist appointment to database', async () => {
      const scheduledAt = new Date(2024, 0, 6, 9, 0);
      const appointment = await repository.create({
        patientId: testPatientId,
        scheduledAt,
      });

      const dbRow = await getTestDb()('appointments').where({ id: appointment.id }).first();

      expect(dbRow).toBeDefined();
      expect(dbRow.patient_id).toBe(testPatientId);
      expect(new Date(dbRow.scheduled_at)).toEqual(scheduledAt);
    });

    it('should set default status to scheduled', async () => {
      const scheduledAt = new Date(2024, 0, 6, 9, 0);
      const appointment = await repository.create({
        patientId: testPatientId,
        scheduledAt,
      });

      expect(appointment.status).toBe(AppointmentStatus.SCHEDULED);
    });
  });

  describe('findById', () => {
    it('should return appointment when found', async () => {
      const scheduledAt = new Date(2024, 0, 6, 9, 0);
      const created = await repository.create({
        patientId: testPatientId,
        scheduledAt,
      });

      const found = await repository.findById(created.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
      expect(found?.patientId).toBe(testPatientId);
      expect(found?.scheduledAt).toEqual(scheduledAt);
    });

    it('should return null when appointment not found', async () => {
      const found = await repository.findById('00000000-0000-0000-0000-000000000000');

      expect(found).toBeNull();
    });
  });

  describe('findByPatientId', () => {
    it('should return all appointments for patient', async () => {
      const scheduledAt1 = new Date(2024, 0, 6, 9, 0);
      const scheduledAt2 = new Date(2024, 0, 13, 11, 0);

      await repository.create({ patientId: testPatientId, scheduledAt: scheduledAt1 });
      await repository.create({ patientId: testPatientId, scheduledAt: scheduledAt2 });

      const appointments = await repository.findByPatientId(testPatientId);

      expect(appointments).toHaveLength(2);
      expect(appointments[0].patientId).toBe(testPatientId);
      expect(appointments[1].patientId).toBe(testPatientId);
    });

    it('should return appointments ordered by scheduled_at DESC', async () => {
      const scheduledAt1 = new Date(2024, 0, 6, 9, 0);
      const scheduledAt2 = new Date(2024, 0, 13, 11, 0);

      await repository.create({ patientId: testPatientId, scheduledAt: scheduledAt1 });
      await repository.create({ patientId: testPatientId, scheduledAt: scheduledAt2 });

      const appointments = await repository.findByPatientId(testPatientId);

      expect(appointments[0].scheduledAt.getTime()).toBeGreaterThan(
        appointments[1].scheduledAt.getTime(),
      );
    });

    it('should return empty array when no appointments found', async () => {
      const appointments = await repository.findByPatientId('00000000-0000-0000-0000-000000000001');

      expect(appointments).toEqual([]);
    });
  });

  describe('findBySlot', () => {
    it('should return appointment in the slot', async () => {
      const scheduledAt = new Date(2024, 0, 6, 9, 0);
      await repository.create({ patientId: testPatientId, scheduledAt });

      const slot = {
        startTime: new Date(2024, 0, 6, 9, 0),
        endTime: new Date(2024, 0, 6, 11, 0),
      };

      const found = await repository.findBySlot(slot);

      expect(found).toBeDefined();
      expect(found?.scheduledAt).toEqual(scheduledAt);
    });

    it('should return null if slot is available', async () => {
      const slot = {
        startTime: new Date(2024, 0, 6, 9, 0),
        endTime: new Date(2024, 0, 6, 11, 0),
      };

      const found = await repository.findBySlot(slot);

      expect(found).toBeNull();
    });

    it('should exclude cancelled appointments from slot check', async () => {
      const scheduledAt = new Date(2024, 0, 6, 9, 0);
      const created = await repository.create({ patientId: testPatientId, scheduledAt });

      // Cancel the appointment
      await repository.update(created.id, { status: AppointmentStatus.CANCELLED });

      const slot = {
        startTime: new Date(2024, 0, 6, 9, 0),
        endTime: new Date(2024, 0, 6, 11, 0),
      };

      const found = await repository.findBySlot(slot);

      expect(found).toBeNull(); // Cancelled appointments don't block the slot
    });

    it('should not return appointment in different slot', async () => {
      const scheduledAt = new Date(2024, 0, 6, 9, 0);
      await repository.create({ patientId: testPatientId, scheduledAt });

      const differentSlot = {
        startTime: new Date(2024, 0, 6, 11, 0),
        endTime: new Date(2024, 0, 6, 13, 0),
      };

      const found = await repository.findBySlot(differentSlot);

      expect(found).toBeNull();
    });
  });

  describe('findByDate', () => {
    it('should return all appointments on the date', async () => {
      const date = new Date(2024, 0, 6);
      const scheduledAt1 = new Date(2024, 0, 6, 9, 0);
      const scheduledAt2 = new Date(2024, 0, 6, 11, 0);
      const scheduledAt3 = new Date(2024, 0, 13, 9, 0); // Different date

      await repository.create({ patientId: testPatientId, scheduledAt: scheduledAt1 });
      await repository.create({ patientId: testPatientId, scheduledAt: scheduledAt2 });
      await repository.create({ patientId: testPatientId, scheduledAt: scheduledAt3 });

      const appointments = await repository.findByDate(date);

      expect(appointments).toHaveLength(2);
      expect(appointments.every((apt) => apt.scheduledAt.getDate() === 6)).toBe(true);
    });

    it('should return empty array if no appointments on date', async () => {
      const date = new Date(2024, 0, 6);
      const appointments = await repository.findByDate(date);

      expect(appointments).toEqual([]);
    });

    it('should exclude cancelled appointments', async () => {
      const date = new Date(2024, 0, 6);
      const scheduledAt1 = new Date(2024, 0, 6, 9, 0);
      const scheduledAt2 = new Date(2024, 0, 6, 11, 0);

      const created1 = await repository.create({ patientId: testPatientId, scheduledAt: scheduledAt1 });
      await repository.create({ patientId: testPatientId, scheduledAt: scheduledAt2 });

      // Cancel first appointment
      await repository.update(created1.id, { status: AppointmentStatus.CANCELLED });

      const appointments = await repository.findByDate(date);

      expect(appointments).toHaveLength(1);
      expect(appointments[0].status).not.toBe(AppointmentStatus.CANCELLED);
    });

    it('should return appointments ordered by scheduled_at ASC', async () => {
      const date = new Date(2024, 0, 6);
      const scheduledAt1 = new Date(2024, 0, 6, 11, 0);
      const scheduledAt2 = new Date(2024, 0, 6, 9, 0);

      await repository.create({ patientId: testPatientId, scheduledAt: scheduledAt1 });
      await repository.create({ patientId: testPatientId, scheduledAt: scheduledAt2 });

      const appointments = await repository.findByDate(date);

      expect(appointments[0].scheduledAt.getTime()).toBeLessThan(
        appointments[1].scheduledAt.getTime(),
      );
    });
  });

  describe('update', () => {
    it('should update appointment scheduled_at', async () => {
      const scheduledAt = new Date(2024, 0, 6, 9, 0);
      const created = await repository.create({ patientId: testPatientId, scheduledAt });

      const newScheduledAt = new Date(2024, 0, 6, 11, 0);
      const updated = await repository.update(created.id, { scheduledAt: newScheduledAt });

      expect(updated.scheduledAt).toEqual(newScheduledAt);
      expect(updated.id).toBe(created.id);
    });

    it('should update appointment status', async () => {
      const scheduledAt = new Date(2024, 0, 6, 9, 0);
      const created = await repository.create({ patientId: testPatientId, scheduledAt });

      const updated = await repository.update(created.id, {
        status: AppointmentStatus.CONFIRMED,
      });

      expect(updated.status).toBe(AppointmentStatus.CONFIRMED);
    });

    it('should update updated_at timestamp', async () => {
      const scheduledAt = new Date(2024, 0, 6, 9, 0);
      const created = await repository.create({ patientId: testPatientId, scheduledAt });

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      const updated = await repository.update(created.id, {
        status: AppointmentStatus.CONFIRMED,
      });

      expect(updated.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());
    });

    it('should throw error if appointment not found', async () => {
      await expect(
        repository.update('00000000-0000-0000-0000-000000000000', { status: AppointmentStatus.CONFIRMED }),
      ).rejects.toThrow();
    });
  });

  describe('delete', () => {
    it('should soft delete appointment by setting status to cancelled', async () => {
      const scheduledAt = new Date(2024, 0, 6, 9, 0);
      const created = await repository.create({ patientId: testPatientId, scheduledAt });

      await repository.delete(created.id);

      const found = await repository.findById(created.id);
      expect(found?.status).toBe(AppointmentStatus.CANCELLED);
    });

    it('should not physically delete appointment from database', async () => {
      const scheduledAt = new Date(2024, 0, 6, 9, 0);
      const created = await repository.create({ patientId: testPatientId, scheduledAt });

      await repository.delete(created.id);

      const dbRow = await getTestDb()('appointments').where({ id: created.id }).first();
      expect(dbRow).toBeDefined();
    });
  });

  describe('database constraints', () => {
    it('should enforce foreign key constraint for patient_id', async () => {
      const scheduledAt = new Date(2024, 0, 6, 9, 0);

      await expect(
        repository.create({ patientId: '00000000-0000-0000-0000-000000000001', scheduledAt }),
      ).rejects.toThrow();
    });

    it('should use UUID for appointment ID', async () => {
      const scheduledAt = new Date(2024, 0, 6, 9, 0);
      const created = await repository.create({ patientId: testPatientId, scheduledAt });

      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(created.id).toMatch(uuidRegex);
    });
  });
});
