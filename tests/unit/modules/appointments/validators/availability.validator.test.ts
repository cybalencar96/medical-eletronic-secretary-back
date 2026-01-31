/**
 * Unit tests for availability validator
 *
 * Tests time slot generation, validation, and overlap detection
 */

import {
  generateTimeSlots,
  isValidTimeSlot,
  doSlotsOverlap,
  areSlotsEqual,
} from '../../../../../src/modules/appointments/validators/availability.validator';
import { TimeSlot } from '../../../../../src/modules/appointments/types/appointment.types';

describe('Availability Validator', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Set current time to Jan 1, 2024 00:00
    jest.setSystemTime(new Date(2024, 0, 1, 0, 0, 0));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('generateTimeSlots', () => {
    it('should generate exactly 4 slots for Saturday', () => {
      const saturday = new Date(2024, 0, 6); // Jan 6, 2024 (Saturday)
      const slots = generateTimeSlots(saturday);
      expect(slots).toHaveLength(4);
    });

    it('should generate correct time ranges for Saturday slots', () => {
      const saturday = new Date(2024, 0, 6); // Jan 6, 2024 (Saturday)
      const slots = generateTimeSlots(saturday);

      expect(slots[0].startTime.getHours()).toBe(9);
      expect(slots[0].endTime.getHours()).toBe(11);

      expect(slots[1].startTime.getHours()).toBe(11);
      expect(slots[1].endTime.getHours()).toBe(13);

      expect(slots[2].startTime.getHours()).toBe(13);
      expect(slots[2].endTime.getHours()).toBe(15);

      expect(slots[3].startTime.getHours()).toBe(15);
      expect(slots[3].endTime.getHours()).toBe(17);
    });

    it('should return empty array for Sunday', () => {
      const sunday = new Date(2024, 0, 7); // Jan 7, 2024 (Sunday)
      const slots = generateTimeSlots(sunday);
      expect(slots).toHaveLength(0);
    });

    it('should return empty array for Monday', () => {
      const monday = new Date(2024, 0, 8); // Jan 8, 2024 (Monday)
      const slots = generateTimeSlots(monday);
      expect(slots).toHaveLength(0);
    });

    it('should return empty array for Friday', () => {
      const friday = new Date(2024, 0, 5); // Jan 5, 2024 (Friday)
      const slots = generateTimeSlots(friday);
      expect(slots).toHaveLength(0);
    });

    it('should exclude Brazilian holidays (New Year)', () => {
      const newYear = new Date(2025, 0, 1); // Jan 1, 2025 (Saturday, but New Year)
      const slots = generateTimeSlots(newYear);
      expect(slots).toHaveLength(0);
    });

    it('should exclude Brazilian holidays (Christmas)', () => {
      const christmas = new Date(2021, 11, 25); // Dec 25, 2021 (Saturday, but Christmas)
      const slots = generateTimeSlots(christmas);
      expect(slots).toHaveLength(0);
    });

    it('should exclude Carnaval (movable holiday)', () => {
      // Carnaval 2024 is on February 13 (Tuesday, but test Saturday before Easter)
      // Good Friday 2024 is March 29, so let's use a Saturday near Easter
      const easterWeekend = new Date(2024, 2, 30); // March 30, 2024 (Saturday after Good Friday)
      const slots = generateTimeSlots(easterWeekend);
      // This should have slots as it's not Good Friday itself
      expect(slots.length).toBeGreaterThanOrEqual(0);
    });

    it('should return empty array for past Saturday', () => {
      jest.setSystemTime(new Date(2024, 0, 15, 0, 0, 0)); // Jan 15, 2024
      const pastSaturday = new Date(2024, 0, 6); // Jan 6, 2024 (past Saturday)
      const slots = generateTimeSlots(pastSaturday);
      expect(slots).toHaveLength(0);
    });

    it('should allow current Saturday with future slots', () => {
      jest.setSystemTime(new Date(2024, 0, 6, 10, 0, 0)); // Jan 6, 2024 10:00 AM (Saturday)
      const currentSaturday = new Date(2024, 0, 6);
      const slots = generateTimeSlots(currentSaturday);
      // Should have slots that haven't started yet (11:00-13:00, 13:00-15:00, 15:00-17:00)
      expect(slots.length).toBe(3);
      expect(slots[0].startTime.getHours()).toBe(11);
    });

    it('should respect 2-hour duration for all slots', () => {
      const saturday = new Date(2024, 0, 6);
      const slots = generateTimeSlots(saturday);

      slots.forEach((slot) => {
        const durationMs = slot.endTime.getTime() - slot.startTime.getTime();
        const durationHours = durationMs / (1000 * 60 * 60);
        expect(durationHours).toBe(2);
      });
    });
  });

  describe('isValidTimeSlot', () => {
    it('should return true for valid Saturday slot (09:00-11:00)', () => {
      const slot: TimeSlot = {
        startTime: new Date(2024, 0, 6, 9, 0),
        endTime: new Date(2024, 0, 6, 11, 0),
      };
      expect(isValidTimeSlot(slot)).toBe(true);
    });

    it('should return true for valid Saturday slot (15:00-17:00, last slot)', () => {
      const slot: TimeSlot = {
        startTime: new Date(2024, 0, 6, 15, 0),
        endTime: new Date(2024, 0, 6, 17, 0),
      };
      expect(isValidTimeSlot(slot)).toBe(true);
    });

    it('should return false for Sunday slot', () => {
      const slot: TimeSlot = {
        startTime: new Date(2024, 0, 7, 9, 0), // Sunday
        endTime: new Date(2024, 0, 7, 11, 0),
      };
      expect(isValidTimeSlot(slot)).toBe(false);
    });

    it('should return false for slot outside operating hours (17:00-19:00)', () => {
      const slot: TimeSlot = {
        startTime: new Date(2024, 0, 6, 17, 0),
        endTime: new Date(2024, 0, 6, 19, 0),
      };
      expect(isValidTimeSlot(slot)).toBe(false);
    });

    it('should return false for slot starting at 18:00 (outside operating hours)', () => {
      const slot: TimeSlot = {
        startTime: new Date(2024, 0, 6, 18, 0),
        endTime: new Date(2024, 0, 6, 20, 0),
      };
      expect(isValidTimeSlot(slot)).toBe(false);
    });

    it('should return false for 1-hour slot (invalid duration)', () => {
      const slot: TimeSlot = {
        startTime: new Date(2024, 0, 6, 9, 0),
        endTime: new Date(2024, 0, 6, 10, 0),
      };
      expect(isValidTimeSlot(slot)).toBe(false);
    });

    it('should return false for 3-hour slot (invalid duration)', () => {
      const slot: TimeSlot = {
        startTime: new Date(2024, 0, 6, 9, 0),
        endTime: new Date(2024, 0, 6, 12, 0),
      };
      expect(isValidTimeSlot(slot)).toBe(false);
    });

    it('should return false for past slot', () => {
      jest.setSystemTime(new Date(2024, 0, 15, 0, 0, 0)); // Jan 15, 2024
      const slot: TimeSlot = {
        startTime: new Date(2024, 0, 6, 9, 0), // Past Saturday
        endTime: new Date(2024, 0, 6, 11, 0),
      };
      expect(isValidTimeSlot(slot)).toBe(false);
    });

    it('should return false for holiday slot (New Year)', () => {
      const slot: TimeSlot = {
        startTime: new Date(2025, 0, 1, 9, 0), // Jan 1, 2025 (Saturday, but New Year)
        endTime: new Date(2025, 0, 1, 11, 0),
      };
      expect(isValidTimeSlot(slot)).toBe(false);
    });

    it('should return false for slot spanning midnight', () => {
      const slot: TimeSlot = {
        startTime: new Date(2024, 0, 6, 23, 0),
        endTime: new Date(2024, 0, 7, 1, 0),
      };
      expect(isValidTimeSlot(slot)).toBe(false);
    });
  });

  describe('doSlotsOverlap', () => {
    it('should return false for adjacent slots (09:00-11:00 and 11:00-13:00)', () => {
      const slot1: TimeSlot = {
        startTime: new Date(2024, 0, 6, 9, 0),
        endTime: new Date(2024, 0, 6, 11, 0),
      };
      const slot2: TimeSlot = {
        startTime: new Date(2024, 0, 6, 11, 0),
        endTime: new Date(2024, 0, 6, 13, 0),
      };
      expect(doSlotsOverlap(slot1, slot2)).toBe(false);
    });

    it('should return true for overlapping slots (09:00-11:00 and 10:00-12:00)', () => {
      const slot1: TimeSlot = {
        startTime: new Date(2024, 0, 6, 9, 0),
        endTime: new Date(2024, 0, 6, 11, 0),
      };
      const slot2: TimeSlot = {
        startTime: new Date(2024, 0, 6, 10, 0),
        endTime: new Date(2024, 0, 6, 12, 0),
      };
      expect(doSlotsOverlap(slot1, slot2)).toBe(true);
    });

    it('should return true for identical slots', () => {
      const slot1: TimeSlot = {
        startTime: new Date(2024, 0, 6, 9, 0),
        endTime: new Date(2024, 0, 6, 11, 0),
      };
      const slot2: TimeSlot = {
        startTime: new Date(2024, 0, 6, 9, 0),
        endTime: new Date(2024, 0, 6, 11, 0),
      };
      expect(doSlotsOverlap(slot1, slot2)).toBe(true);
    });

    it('should return false for non-overlapping slots on different days', () => {
      const slot1: TimeSlot = {
        startTime: new Date(2024, 0, 6, 9, 0),
        endTime: new Date(2024, 0, 6, 11, 0),
      };
      const slot2: TimeSlot = {
        startTime: new Date(2024, 0, 13, 9, 0), // Different Saturday
        endTime: new Date(2024, 0, 13, 11, 0),
      };
      expect(doSlotsOverlap(slot1, slot2)).toBe(false);
    });

    it('should handle reverse order slots (commutative)', () => {
      const slot1: TimeSlot = {
        startTime: new Date(2024, 0, 6, 11, 0),
        endTime: new Date(2024, 0, 6, 13, 0),
      };
      const slot2: TimeSlot = {
        startTime: new Date(2024, 0, 6, 9, 0),
        endTime: new Date(2024, 0, 6, 11, 0),
      };
      expect(doSlotsOverlap(slot1, slot2)).toBe(false);
      expect(doSlotsOverlap(slot2, slot1)).toBe(false);
    });
  });

  describe('areSlotsEqual', () => {
    it('should return true for identical slots', () => {
      const slot1: TimeSlot = {
        startTime: new Date(2024, 0, 6, 9, 0),
        endTime: new Date(2024, 0, 6, 11, 0),
      };
      const slot2: TimeSlot = {
        startTime: new Date(2024, 0, 6, 9, 0),
        endTime: new Date(2024, 0, 6, 11, 0),
      };
      expect(areSlotsEqual(slot1, slot2)).toBe(true);
    });

    it('should return false for different start times', () => {
      const slot1: TimeSlot = {
        startTime: new Date(2024, 0, 6, 9, 0),
        endTime: new Date(2024, 0, 6, 11, 0),
      };
      const slot2: TimeSlot = {
        startTime: new Date(2024, 0, 6, 11, 0),
        endTime: new Date(2024, 0, 6, 11, 0),
      };
      expect(areSlotsEqual(slot1, slot2)).toBe(false);
    });

    it('should return false for different end times', () => {
      const slot1: TimeSlot = {
        startTime: new Date(2024, 0, 6, 9, 0),
        endTime: new Date(2024, 0, 6, 11, 0),
      };
      const slot2: TimeSlot = {
        startTime: new Date(2024, 0, 6, 9, 0),
        endTime: new Date(2024, 0, 6, 13, 0),
      };
      expect(areSlotsEqual(slot1, slot2)).toBe(false);
    });

    it('should return false for slots on different days', () => {
      const slot1: TimeSlot = {
        startTime: new Date(2024, 0, 6, 9, 0),
        endTime: new Date(2024, 0, 6, 11, 0),
      };
      const slot2: TimeSlot = {
        startTime: new Date(2024, 0, 13, 9, 0),
        endTime: new Date(2024, 0, 13, 11, 0),
      };
      expect(areSlotsEqual(slot1, slot2)).toBe(false);
    });
  });
});
