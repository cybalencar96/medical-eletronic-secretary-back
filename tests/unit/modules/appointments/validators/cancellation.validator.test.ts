/**
 * Unit tests for cancellation validator
 *
 * Tests 12-hour cancellation window enforcement
 */

import {
  canCancelAppointment,
  getHoursUntilAppointment,
  getCancellationErrorMessage,
} from '../../../../../src/modules/appointments/validators/cancellation.validator';

describe('Cancellation Validator', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('canCancelAppointment', () => {
    it('should allow cancellation 24 hours before appointment', () => {
      jest.setSystemTime(new Date(2024, 0, 5, 9, 0)); // Jan 5, 2024 09:00
      const scheduledAt = new Date(2024, 0, 6, 9, 0); // Jan 6, 2024 09:00 (24 hours away)
      expect(canCancelAppointment(scheduledAt)).toBe(true);
    });

    it('should allow cancellation 13 hours before appointment', () => {
      jest.setSystemTime(new Date(2024, 0, 5, 20, 0)); // Jan 5, 2024 20:00
      const scheduledAt = new Date(2024, 0, 6, 9, 0); // Jan 6, 2024 09:00 (13 hours away)
      expect(canCancelAppointment(scheduledAt)).toBe(true);
    });

    it('should reject cancellation exactly at 12-hour boundary', () => {
      jest.setSystemTime(new Date(2024, 0, 5, 21, 0)); // Jan 5, 2024 21:00
      const scheduledAt = new Date(2024, 0, 6, 9, 0); // Jan 6, 2024 09:00 (12 hours away)
      expect(canCancelAppointment(scheduledAt)).toBe(false);
    });

    it('should reject cancellation 11 hours before appointment', () => {
      jest.setSystemTime(new Date(2024, 0, 5, 22, 0)); // Jan 5, 2024 22:00
      const scheduledAt = new Date(2024, 0, 6, 9, 0); // Jan 6, 2024 09:00 (11 hours away)
      expect(canCancelAppointment(scheduledAt)).toBe(false);
    });

    it('should reject cancellation 6 hours before appointment', () => {
      jest.setSystemTime(new Date(2024, 0, 6, 3, 0)); // Jan 6, 2024 03:00
      const scheduledAt = new Date(2024, 0, 6, 9, 0); // Jan 6, 2024 09:00 (6 hours away)
      expect(canCancelAppointment(scheduledAt)).toBe(false);
    });

    it('should reject cancellation 1 hour before appointment', () => {
      jest.setSystemTime(new Date(2024, 0, 6, 8, 0)); // Jan 6, 2024 08:00
      const scheduledAt = new Date(2024, 0, 6, 9, 0); // Jan 6, 2024 09:00 (1 hour away)
      expect(canCancelAppointment(scheduledAt)).toBe(false);
    });

    it('should reject cancellation for appointment in the past', () => {
      jest.setSystemTime(new Date(2024, 0, 6, 10, 0)); // Jan 6, 2024 10:00
      const scheduledAt = new Date(2024, 0, 6, 9, 0); // Jan 6, 2024 09:00 (1 hour in past)
      expect(canCancelAppointment(scheduledAt)).toBe(false);
    });

    it('should allow cancellation for appointment 48 hours away', () => {
      jest.setSystemTime(new Date(2024, 0, 4, 9, 0)); // Jan 4, 2024 09:00
      const scheduledAt = new Date(2024, 0, 6, 9, 0); // Jan 6, 2024 09:00 (48 hours away)
      expect(canCancelAppointment(scheduledAt)).toBe(true);
    });

    it('should allow cancellation for appointment one week away', () => {
      jest.setSystemTime(new Date(2024, 0, 1, 9, 0)); // Jan 1, 2024 09:00
      const scheduledAt = new Date(2024, 0, 8, 9, 0); // Jan 8, 2024 09:00 (one week away)
      expect(canCancelAppointment(scheduledAt)).toBe(true);
    });
  });

  describe('getHoursUntilAppointment', () => {
    it('should return 24 for appointment 24 hours away', () => {
      jest.setSystemTime(new Date(2024, 0, 5, 9, 0)); // Jan 5, 2024 09:00
      const scheduledAt = new Date(2024, 0, 6, 9, 0); // Jan 6, 2024 09:00
      expect(getHoursUntilAppointment(scheduledAt)).toBe(24);
    });

    it('should return 12 for appointment 12 hours away', () => {
      jest.setSystemTime(new Date(2024, 0, 5, 21, 0)); // Jan 5, 2024 21:00
      const scheduledAt = new Date(2024, 0, 6, 9, 0); // Jan 6, 2024 09:00
      expect(getHoursUntilAppointment(scheduledAt)).toBe(12);
    });

    it('should return 6 for appointment 6 hours away', () => {
      jest.setSystemTime(new Date(2024, 0, 6, 3, 0)); // Jan 6, 2024 03:00
      const scheduledAt = new Date(2024, 0, 6, 9, 0); // Jan 6, 2024 09:00
      expect(getHoursUntilAppointment(scheduledAt)).toBe(6);
    });

    it('should return negative for appointment in the past', () => {
      jest.setSystemTime(new Date(2024, 0, 6, 10, 0)); // Jan 6, 2024 10:00
      const scheduledAt = new Date(2024, 0, 6, 9, 0); // Jan 6, 2024 09:00
      expect(getHoursUntilAppointment(scheduledAt)).toBeLessThan(0);
    });

    it('should floor fractional hours', () => {
      jest.setSystemTime(new Date(2024, 0, 5, 21, 30)); // Jan 5, 2024 21:30
      const scheduledAt = new Date(2024, 0, 6, 9, 0); // Jan 6, 2024 09:00 (11.5 hours away)
      expect(getHoursUntilAppointment(scheduledAt)).toBe(11);
    });

    it('should handle minutes correctly', () => {
      jest.setSystemTime(new Date(2024, 0, 5, 20, 45)); // Jan 5, 2024 20:45
      const scheduledAt = new Date(2024, 0, 6, 9, 0); // Jan 6, 2024 09:00 (12h 15min away)
      expect(getHoursUntilAppointment(scheduledAt)).toBe(12);
    });
  });

  describe('getCancellationErrorMessage', () => {
    it('should return descriptive error message with hours until appointment', () => {
      jest.setSystemTime(new Date(2024, 0, 5, 22, 0)); // Jan 5, 2024 22:00
      const scheduledAt = new Date(2024, 0, 6, 9, 0); // Jan 6, 2024 09:00 (11 hours away)
      const message = getCancellationErrorMessage(scheduledAt);
      expect(message).toContain('Cannot cancel appointment within 12 hours');
      expect(message).toContain('11 hours');
    });

    it('should include cancellation window in message', () => {
      jest.setSystemTime(new Date(2024, 0, 6, 3, 0)); // Jan 6, 2024 03:00
      const scheduledAt = new Date(2024, 0, 6, 9, 0); // Jan 6, 2024 09:00 (6 hours away)
      const message = getCancellationErrorMessage(scheduledAt);
      expect(message).toContain('12 hours');
      expect(message).toContain('6 hours');
    });

    it('should handle edge case at boundary', () => {
      jest.setSystemTime(new Date(2024, 0, 5, 21, 0)); // Jan 5, 2024 21:00
      const scheduledAt = new Date(2024, 0, 6, 9, 0); // Jan 6, 2024 09:00 (12 hours away)
      const message = getCancellationErrorMessage(scheduledAt);
      expect(message).toContain('12 hours');
    });
  });
});
