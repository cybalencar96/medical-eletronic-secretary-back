/**
 * Unit tests for appointment Zod validation schemas
 */

import {
  getAppointmentsQuerySchema,
  updateAppointmentParamsSchema,
  updateAppointmentBodySchema,
  dateSchema,
  uuidSchema,
  appointmentStatusSchema,
} from '../../../../src/api/schemas/appointment.schema';
import { AppointmentStatus } from '../../../../src/modules/appointments/types/appointment.types';

describe('Appointment Schemas', () => {
  describe('dateSchema', () => {
    it('should accept valid ISO 8601 date', () => {
      const result = dateSchema.parse('2024-12-31');
      expect(result).toBe('2024-12-31');
    });

    it('should accept valid Brazilian date format DD/MM/YYYY', () => {
      const result = dateSchema.parse('31/12/2024');
      expect(result).toBe('2024-12-31'); // Transformed to ISO 8601
    });

    it('should reject invalid date format', () => {
      expect(() => dateSchema.parse('12-31-2024')).toThrow();
    });

    it('should reject invalid date values', () => {
      expect(() => dateSchema.parse('2024-13-01')).toThrow();
      expect(() => dateSchema.parse('32/12/2024')).toThrow();
    });
  });

  describe('uuidSchema', () => {
    it('should accept valid UUID v4', () => {
      const validUuid = '550e8400-e29b-41d4-a716-446655440000';
      const result = uuidSchema.parse(validUuid);
      expect(result).toBe(validUuid);
    });

    it('should reject invalid UUID format', () => {
      expect(() => uuidSchema.parse('not-a-uuid')).toThrow();
      expect(() => uuidSchema.parse('12345')).toThrow();
    });
  });

  describe('appointmentStatusSchema', () => {
    it('should accept valid appointment status', () => {
      const result = appointmentStatusSchema.parse('scheduled');
      expect(result).toBe(AppointmentStatus.SCHEDULED);
    });

    it('should accept all valid status values', () => {
      expect(appointmentStatusSchema.parse('scheduled')).toBe('scheduled');
      expect(appointmentStatusSchema.parse('confirmed')).toBe('confirmed');
      expect(appointmentStatusSchema.parse('cancelled')).toBe('cancelled');
      expect(appointmentStatusSchema.parse('completed')).toBe('completed');
      expect(appointmentStatusSchema.parse('no-show')).toBe('no-show');
    });

    it('should reject invalid status value', () => {
      expect(() => appointmentStatusSchema.parse('invalid-status')).toThrow();
    });
  });

  describe('getAppointmentsQuerySchema', () => {
    it('should accept valid query with all parameters', () => {
      const query = {
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        status: 'scheduled',
        limit: '10',
        offset: '0',
      };

      const result = getAppointmentsQuerySchema.parse(query);

      expect(result.startDate).toBe('2024-01-01');
      expect(result.endDate).toBe('2024-12-31');
      expect(result.status).toBe('scheduled');
      expect(result.limit).toBe(10);
      expect(result.offset).toBe(0);
    });

    it('should apply defaults for limit and offset', () => {
      const query = {};
      const result = getAppointmentsQuerySchema.parse(query);

      expect(result.limit).toBe(50);
      expect(result.offset).toBe(0);
    });

    it('should accept Brazilian date format in query', () => {
      const query = {
        startDate: '01/01/2024',
        endDate: '31/12/2024',
      };

      const result = getAppointmentsQuerySchema.parse(query);

      expect(result.startDate).toBe('2024-01-01');
      expect(result.endDate).toBe('2024-12-31');
    });

    it('should enforce limit maximum of 100', () => {
      const query = { limit: '150' };
      expect(() => getAppointmentsQuerySchema.parse(query)).toThrow();
    });

    it('should enforce limit minimum of 1', () => {
      const query = { limit: '0' };
      expect(() => getAppointmentsQuerySchema.parse(query)).toThrow();
    });

    it('should enforce offset minimum of 0', () => {
      const query = { offset: '-1' };
      expect(() => getAppointmentsQuerySchema.parse(query)).toThrow();
    });

    it('should reject invalid status in query', () => {
      const query = { status: 'invalid-status' };
      expect(() => getAppointmentsQuerySchema.parse(query)).toThrow();
    });
  });

  describe('updateAppointmentParamsSchema', () => {
    it('should accept valid UUID in params', () => {
      const params = { id: '550e8400-e29b-41d4-a716-446655440000' };
      const result = updateAppointmentParamsSchema.parse(params);
      expect(result.id).toBe(params.id);
    });

    it('should reject invalid UUID in params', () => {
      const params = { id: 'not-a-uuid' };
      expect(() => updateAppointmentParamsSchema.parse(params)).toThrow();
    });
  });

  describe('updateAppointmentBodySchema', () => {
    it('should accept valid status in body', () => {
      const body = { status: 'confirmed' };
      const result = updateAppointmentBodySchema.parse(body);
      expect(result.status).toBe('confirmed');
    });

    it('should reject invalid status in body', () => {
      const body = { status: 'invalid-status' };
      expect(() => updateAppointmentBodySchema.parse(body)).toThrow();
    });

    it('should reject empty body', () => {
      expect(() => updateAppointmentBodySchema.parse({})).toThrow();
    });
  });
});
