/**
 * Date formatter utility tests
 */

import { formatBrazilianDate, formatBrazilianTime } from '../../../../../src/modules/notifications/utils/date-formatter';

describe('Date Formatter Utils', () => {
  describe('formatBrazilianDate', () => {
    it('should format Saturday date correctly in Brazilian Portuguese', () => {
      const date = new Date('2025-02-15T10:00:00');
      const formatted = formatBrazilianDate(date);
      expect(formatted).toMatch(/Sábado, 15\/02\/2025 às \d{2}:\d{2}/);
    });

    it('should format date with padded day and month', () => {
      const date = new Date('2025-01-05T09:30:00');
      const formatted = formatBrazilianDate(date);
      expect(formatted).toContain('05/01/2025');
    });

    it('should format time with padded hours and minutes', () => {
      const date = new Date('2025-02-15T09:05:00');
      const formatted = formatBrazilianDate(date);
      expect(formatted).toContain('09:05');
    });

    it('should include day name in Brazilian Portuguese', () => {
      const saturday = new Date('2025-02-15T10:00:00'); // Saturday
      expect(formatBrazilianDate(saturday)).toContain('Sábado');

      const sunday = new Date('2025-02-16T10:00:00'); // Sunday
      expect(formatBrazilianDate(sunday)).toContain('Domingo');

      const monday = new Date('2025-02-17T10:00:00'); // Monday
      expect(formatBrazilianDate(monday)).toContain('Segunda-feira');
    });
  });

  describe('formatBrazilianTime', () => {
    it('should format time correctly (HH:MM)', () => {
      const date = new Date('2025-02-15T10:30:00');
      const formatted = formatBrazilianTime(date);
      expect(formatted).toBe('10:30');
    });

    it('should pad hours and minutes with zeros', () => {
      const date = new Date('2025-02-15T09:05:00');
      const formatted = formatBrazilianTime(date);
      expect(formatted).toBe('09:05');
    });

    it('should handle afternoon times', () => {
      const date = new Date('2025-02-15T15:45:00');
      const formatted = formatBrazilianTime(date);
      expect(formatted).toBe('15:45');
    });
  });
});
