import {
  normalizeDate,
  normalizeTime,
  normalizeEntities,
  getNextSaturday,
  isSaturday,
  isWithinBusinessHours,
  isValidAppointmentSlot,
} from '../../../../src/infrastructure/llm/entity-extractor';

describe('Entity Extractor', () => {
  describe('normalizeDate', () => {
    it('should pass through ISO format dates (YYYY-MM-DD)', () => {
      expect(normalizeDate('2025-02-15')).toBe('2025-02-15');
      expect(normalizeDate('2025-12-31')).toBe('2025-12-31');
    });

    it('should convert Brazilian format (DD/MM/YYYY) to ISO format', () => {
      expect(normalizeDate('15/02/2025')).toBe('2025-02-15');
      expect(normalizeDate('01/01/2025')).toBe('2025-01-01');
      expect(normalizeDate('31/12/2025')).toBe('2025-12-31');
    });

    it('should handle single-digit days and months in Brazilian format', () => {
      expect(normalizeDate('5/2/2025')).toBe('2025-02-05');
      expect(normalizeDate('1/1/2025')).toBe('2025-01-01');
    });

    it('should handle relative date expressions', () => {
      const nextSat = getNextSaturday();
      expect(normalizeDate('próximo sábado')).toBe(nextSat);
      expect(normalizeDate('proximo sabado')).toBe(nextSat);
      expect(normalizeDate('sábado que vem')).toBe(nextSat);
      expect(normalizeDate('sabado que vem')).toBe(nextSat);
      expect(normalizeDate('sábado')).toBe(nextSat);
      expect(normalizeDate('sabado')).toBe(nextSat);
    });

    it('should return undefined for invalid date formats', () => {
      expect(normalizeDate('invalid-date')).toBeUndefined();
      expect(normalizeDate('15-02-2025')).toBeUndefined();
      expect(normalizeDate('2025/02/15')).toBeUndefined();
    });

    it('should return undefined for empty or null inputs', () => {
      expect(normalizeDate('')).toBeUndefined();
      expect(normalizeDate('   ')).toBeUndefined();
    });
  });

  describe('normalizeTime', () => {
    it('should pass through HH:MM format times', () => {
      expect(normalizeTime('09:00')).toBe('09:00');
      expect(normalizeTime('15:30')).toBe('15:30');
      expect(normalizeTime('23:59')).toBe('23:59');
    });

    it('should pad single-digit hours in H:MM format', () => {
      expect(normalizeTime('9:00')).toBe('09:00');
      expect(normalizeTime('1:30')).toBe('01:30');
    });

    it('should handle "meio-dia" / "meio dia" expressions', () => {
      expect(normalizeTime('meio-dia')).toBe('12:00');
      expect(normalizeTime('meio dia')).toBe('12:00');
      expect(normalizeTime('MEIO DIA')).toBe('12:00');
    });

    it('should convert "X da manhã" to HH:00 format', () => {
      expect(normalizeTime('9 da manhã')).toBe('09:00');
      expect(normalizeTime('10 da manha')).toBe('10:00');
      expect(normalizeTime('7 da manhã')).toBe('07:00');
    });

    it('should convert "X da tarde" to afternoon time (add 12 hours)', () => {
      expect(normalizeTime('1 da tarde')).toBe('13:00');
      expect(normalizeTime('2 da tarde')).toBe('14:00');
      expect(normalizeTime('3 da tarde')).toBe('15:00');
      expect(normalizeTime('5 da tarde')).toBe('17:00');
    });

    it('should convert "X da noite" to evening time (add 12 hours)', () => {
      expect(normalizeTime('7 da noite')).toBe('19:00');
      expect(normalizeTime('8 da noite')).toBe('20:00');
      expect(normalizeTime('9 da noite')).toBe('21:00');
    });

    it('should return undefined for invalid time formats', () => {
      expect(normalizeTime('invalid-time')).toBeUndefined();
      expect(normalizeTime('25:00')).toBeUndefined();
      expect(normalizeTime('12:70')).toBeUndefined();
    });

    it('should return undefined for empty or null inputs', () => {
      expect(normalizeTime('')).toBeUndefined();
      expect(normalizeTime('   ')).toBeUndefined();
    });
  });

  describe('normalizeEntities', () => {
    it('should normalize date and time entities', () => {
      const entities = {
        date: '15/02/2025',
        time: '9 da manhã',
        reason: 'Test reason',
      };

      const normalized = normalizeEntities(entities);

      expect(normalized.date).toBe('2025-02-15');
      expect(normalized.time).toBe('09:00');
      expect(normalized.reason).toBe('Test reason');
    });

    it('should handle entities with undefined values', () => {
      const entities = {
        date: undefined,
        time: undefined,
        reason: 'Test reason',
      };

      const normalized = normalizeEntities(entities);

      expect(normalized.date).toBeUndefined();
      expect(normalized.time).toBeUndefined();
      expect(normalized.reason).toBe('Test reason');
    });

    it('should handle empty entities object', () => {
      const entities = {};

      const normalized = normalizeEntities(entities);

      expect(normalized.date).toBeUndefined();
      expect(normalized.time).toBeUndefined();
      expect(normalized.reason).toBeUndefined();
    });
  });

  describe('getNextSaturday', () => {
    it('should return a date string in ISO format', () => {
      const result = getNextSaturday();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should return a Saturday', () => {
      const result = getNextSaturday();
      const date = new Date(result + 'T00:00:00');
      expect(date.getDay()).toBe(6); // 6 = Saturday
    });

    it('should return a future date', () => {
      const result = getNextSaturday();
      const date = new Date(result + 'T00:00:00');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      expect(date.getTime()).toBeGreaterThanOrEqual(today.getTime());
    });
  });

  describe('isSaturday', () => {
    it('should return true for Saturday dates', () => {
      // February 15, 2025 is a Saturday
      expect(isSaturday('2025-02-15')).toBe(true);
      // February 22, 2025 is a Saturday
      expect(isSaturday('2025-02-22')).toBe(true);
    });

    it('should return false for non-Saturday dates', () => {
      // February 16, 2025 is a Sunday
      expect(isSaturday('2025-02-16')).toBe(false);
      // February 17, 2025 is a Monday
      expect(isSaturday('2025-02-17')).toBe(false);
    });

    it('should return false for invalid date formats', () => {
      expect(isSaturday('15/02/2025')).toBe(false);
      expect(isSaturday('invalid-date')).toBe(false);
      expect(isSaturday('')).toBe(false);
    });
  });

  describe('isWithinBusinessHours', () => {
    it('should return true for times within business hours (09:00-18:00)', () => {
      expect(isWithinBusinessHours('09:00')).toBe(true);
      expect(isWithinBusinessHours('12:00')).toBe(true);
      expect(isWithinBusinessHours('15:30')).toBe(true);
      expect(isWithinBusinessHours('18:00')).toBe(true);
    });

    it('should return false for times before business hours', () => {
      expect(isWithinBusinessHours('08:59')).toBe(false);
      expect(isWithinBusinessHours('06:00')).toBe(false);
      expect(isWithinBusinessHours('00:00')).toBe(false);
    });

    it('should return false for times after business hours', () => {
      expect(isWithinBusinessHours('18:01')).toBe(false);
      expect(isWithinBusinessHours('19:00')).toBe(false);
      expect(isWithinBusinessHours('23:59')).toBe(false);
    });

    it('should return false for invalid time formats', () => {
      expect(isWithinBusinessHours('invalid-time')).toBe(false);
      expect(isWithinBusinessHours('')).toBe(false);
      expect(isWithinBusinessHours('25:00')).toBe(false);
    });
  });

  describe('isValidAppointmentSlot', () => {
    it('should return true for valid appointment slots', () => {
      expect(isValidAppointmentSlot('09:00')).toBe(true);
      expect(isValidAppointmentSlot('11:00')).toBe(true);
      expect(isValidAppointmentSlot('13:00')).toBe(true);
      expect(isValidAppointmentSlot('15:00')).toBe(true);
      expect(isValidAppointmentSlot('17:00')).toBe(true);
    });

    it('should return false for invalid appointment slots', () => {
      expect(isValidAppointmentSlot('10:00')).toBe(false);
      expect(isValidAppointmentSlot('12:00')).toBe(false);
      expect(isValidAppointmentSlot('14:00')).toBe(false);
      expect(isValidAppointmentSlot('16:00')).toBe(false);
      expect(isValidAppointmentSlot('18:00')).toBe(false);
    });

    it('should return false for times outside business hours', () => {
      expect(isValidAppointmentSlot('08:00')).toBe(false);
      expect(isValidAppointmentSlot('19:00')).toBe(false);
    });
  });
});
