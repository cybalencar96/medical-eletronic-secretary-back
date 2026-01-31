/**
 * Unit tests for date validator
 *
 * Tests Brazilian holiday detection, Saturday validation, and date utilities
 */

import {
  isBrazilianHoliday,
  isSaturday,
  isPastDate,
  isWithinHours,
  normalizeDate,
  isSameDay,
} from '../../../../src/shared/validators/date.validator';

describe('Date Validator', () => {
  describe('isBrazilianHoliday', () => {
    it('should return true for New Year (Jan 1)', () => {
      const newYear = new Date(2024, 0, 1); // Jan 1, 2024
      expect(isBrazilianHoliday(newYear)).toBe(true);
    });

    it('should return true for Christmas (Dec 25)', () => {
      const christmas = new Date(2024, 11, 25); // Dec 25, 2024
      expect(isBrazilianHoliday(christmas)).toBe(true);
    });

    it('should return true for Carnaval (movable holiday)', () => {
      // Carnaval 2024 is on February 13
      const carnaval2024 = new Date(2024, 1, 13);
      expect(isBrazilianHoliday(carnaval2024)).toBe(true);
    });

    it('should return true for Good Friday (movable holiday)', () => {
      // Good Friday 2024 is on March 29
      const goodFriday2024 = new Date(2024, 2, 29);
      expect(isBrazilianHoliday(goodFriday2024)).toBe(true);
    });

    it('should return false for regular Saturday', () => {
      const regularSaturday = new Date(2024, 0, 6); // Jan 6, 2024 (Saturday, not a holiday)
      expect(isBrazilianHoliday(regularSaturday)).toBe(false);
    });

    it('should return false for regular weekday', () => {
      const regularDay = new Date(2024, 0, 15); // Jan 15, 2024 (Monday)
      expect(isBrazilianHoliday(regularDay)).toBe(false);
    });

    it('should handle holidays in different years', () => {
      const newYear2025 = new Date(2025, 0, 1);
      const christmas2025 = new Date(2025, 11, 25);
      expect(isBrazilianHoliday(newYear2025)).toBe(true);
      expect(isBrazilianHoliday(christmas2025)).toBe(true);
    });
  });

  describe('isSaturday', () => {
    it('should return true for Saturday', () => {
      const saturday = new Date(2024, 0, 6); // Jan 6, 2024 (Saturday)
      expect(isSaturday(saturday)).toBe(true);
    });

    it('should return false for Sunday', () => {
      const sunday = new Date(2024, 0, 7); // Jan 7, 2024 (Sunday)
      expect(isSaturday(sunday)).toBe(false);
    });

    it('should return false for Monday', () => {
      const monday = new Date(2024, 0, 8); // Jan 8, 2024 (Monday)
      expect(isSaturday(monday)).toBe(false);
    });

    it('should return false for Friday', () => {
      const friday = new Date(2024, 0, 5); // Jan 5, 2024 (Friday)
      expect(isSaturday(friday)).toBe(false);
    });

    it('should handle different months and years', () => {
      const saturdayMarch = new Date(2024, 2, 2); // Mar 2, 2024 (Saturday)
      const saturdayDecember = new Date(2025, 11, 6); // Dec 6, 2025 (Saturday)
      expect(isSaturday(saturdayMarch)).toBe(true);
      expect(isSaturday(saturdayDecember)).toBe(true);
    });
  });

  describe('isPastDate', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return true for date in the past', () => {
      jest.setSystemTime(new Date(2024, 0, 15, 12, 0)); // Jan 15, 2024 12:00
      const pastDate = new Date(2024, 0, 1, 0, 0); // Jan 1, 2024 00:00
      expect(isPastDate(pastDate)).toBe(true);
    });

    it('should return false for date in the future', () => {
      jest.setSystemTime(new Date(2024, 0, 15, 12, 0)); // Jan 15, 2024 12:00
      const futureDate = new Date(2024, 0, 20, 0, 0); // Jan 20, 2024 00:00
      expect(isPastDate(futureDate)).toBe(false);
    });

    it('should return true for date earlier today', () => {
      jest.setSystemTime(new Date(2024, 0, 15, 12, 0)); // Jan 15, 2024 12:00
      const earlierToday = new Date(2024, 0, 15, 9, 0); // Jan 15, 2024 09:00
      expect(isPastDate(earlierToday)).toBe(true);
    });

    it('should return false for date later today', () => {
      jest.setSystemTime(new Date(2024, 0, 15, 12, 0)); // Jan 15, 2024 12:00
      const laterToday = new Date(2024, 0, 15, 15, 0); // Jan 15, 2024 15:00
      expect(isPastDate(laterToday)).toBe(false);
    });
  });

  describe('isWithinHours', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return true if date is within specified hours', () => {
      jest.setSystemTime(new Date(2024, 0, 15, 9, 0)); // Jan 15, 2024 09:00
      const dateWithin12Hours = new Date(2024, 0, 15, 20, 0); // Jan 15, 2024 20:00 (11 hours away)
      expect(isWithinHours(dateWithin12Hours, 12)).toBe(true);
    });

    it('should return false if date is beyond specified hours', () => {
      jest.setSystemTime(new Date(2024, 0, 15, 9, 0)); // Jan 15, 2024 09:00
      const dateBeyond12Hours = new Date(2024, 0, 16, 0, 0); // Jan 16, 2024 00:00 (15 hours away)
      expect(isWithinHours(dateBeyond12Hours, 12)).toBe(false);
    });

    it('should return true for date exactly at boundary', () => {
      jest.setSystemTime(new Date(2024, 0, 15, 9, 0)); // Jan 15, 2024 09:00
      const dateAtBoundary = new Date(2024, 0, 15, 21, 0); // Jan 15, 2024 21:00 (12 hours away)
      expect(isWithinHours(dateAtBoundary, 12)).toBe(true); // Boundary is inclusive
    });

    it('should handle 24-hour window', () => {
      jest.setSystemTime(new Date(2024, 0, 15, 9, 0)); // Jan 15, 2024 09:00
      const dateWithin24Hours = new Date(2024, 0, 16, 8, 0); // Jan 16, 2024 08:00 (23 hours away)
      const dateBeyond24Hours = new Date(2024, 0, 16, 10, 0); // Jan 16, 2024 10:00 (25 hours away)
      expect(isWithinHours(dateWithin24Hours, 24)).toBe(true);
      expect(isWithinHours(dateBeyond24Hours, 24)).toBe(false);
    });
  });

  describe('normalizeDate', () => {
    it('should set time to 00:00:00', () => {
      const date = new Date(2024, 0, 15, 14, 30, 45, 123);
      const normalized = normalizeDate(date);
      expect(normalized.getHours()).toBe(0);
      expect(normalized.getMinutes()).toBe(0);
      expect(normalized.getSeconds()).toBe(0);
      expect(normalized.getMilliseconds()).toBe(0);
    });

    it('should preserve date components', () => {
      const date = new Date(2024, 0, 15, 14, 30);
      const normalized = normalizeDate(date);
      expect(normalized.getFullYear()).toBe(2024);
      expect(normalized.getMonth()).toBe(0);
      expect(normalized.getDate()).toBe(15);
    });

    it('should not modify original date', () => {
      const original = new Date(2024, 0, 15, 14, 30);
      const originalTime = original.getTime();
      normalizeDate(original);
      expect(original.getTime()).toBe(originalTime);
    });
  });

  describe('isSameDay', () => {
    it('should return true for same day at different times', () => {
      const date1 = new Date(2024, 0, 15, 9, 0);
      const date2 = new Date(2024, 0, 15, 15, 0);
      expect(isSameDay(date1, date2)).toBe(true);
    });

    it('should return false for different days', () => {
      const date1 = new Date(2024, 0, 15, 9, 0);
      const date2 = new Date(2024, 0, 16, 9, 0);
      expect(isSameDay(date1, date2)).toBe(false);
    });

    it('should return false for different months', () => {
      const date1 = new Date(2024, 0, 15, 9, 0);
      const date2 = new Date(2024, 1, 15, 9, 0);
      expect(isSameDay(date1, date2)).toBe(false);
    });

    it('should return false for different years', () => {
      const date1 = new Date(2024, 0, 15, 9, 0);
      const date2 = new Date(2025, 0, 15, 9, 0);
      expect(isSameDay(date1, date2)).toBe(false);
    });

    it('should handle midnight edge case', () => {
      const date1 = new Date(2024, 0, 15, 23, 59, 59);
      const date2 = new Date(2024, 0, 15, 0, 0, 0);
      expect(isSameDay(date1, date2)).toBe(true);
    });
  });
});
