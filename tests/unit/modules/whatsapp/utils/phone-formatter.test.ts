import { formatPhoneToE164, isValidBrazilianMobile } from '../../../../../src/modules/whatsapp/utils/phone-formatter';
import { AppError } from '../../../../../src/shared/errors/AppError';

describe('phone-formatter', () => {
  describe('formatPhoneToE164', () => {
    describe('valid phone numbers', () => {
      it('should format 11-digit number without country code to E.164', () => {
        const result = formatPhoneToE164('11999999999');
        expect(result).toBe('+5511999999999');
      });

      it('should format 13-digit number with country code to E.164', () => {
        const result = formatPhoneToE164('5511999999999');
        expect(result).toBe('+5511999999999');
      });

      it('should format phone number with + prefix to E.164', () => {
        const result = formatPhoneToE164('+5511999999999');
        expect(result).toBe('+5511999999999');
      });

      it('should format phone number with parentheses and hyphen', () => {
        const result = formatPhoneToE164('(11) 99999-9999');
        expect(result).toBe('+5511999999999');
      });

      it('should format phone number with spaces', () => {
        const result = formatPhoneToE164('11 99999 9999');
        expect(result).toBe('+5511999999999');
      });

      it('should format phone number with multiple special characters', () => {
        const result = formatPhoneToE164('+55 (11) 99999-9999');
        expect(result).toBe('+5511999999999');
      });

      it('should handle different Brazilian area codes', () => {
        expect(formatPhoneToE164('21987654321')).toBe('+5521987654321'); // Rio de Janeiro
        expect(formatPhoneToE164('85912345678')).toBe('+5585912345678'); // Ceará
        expect(formatPhoneToE164('47998765432')).toBe('+5547998765432'); // Santa Catarina
      });
    });

    describe('invalid phone numbers', () => {
      it('should throw error for empty string', () => {
        expect(() => formatPhoneToE164('')).toThrow(AppError);
        expect(() => formatPhoneToE164('')).toThrow('Phone number is required');
      });

      it('should throw error for null', () => {
        expect(() => formatPhoneToE164(null as any)).toThrow(AppError);
        expect(() => formatPhoneToE164(null as any)).toThrow('Phone number is required');
      });

      it('should throw error for undefined', () => {
        expect(() => formatPhoneToE164(undefined as any)).toThrow(AppError);
        expect(() => formatPhoneToE164(undefined as any)).toThrow('Phone number is required');
      });

      it('should throw error for non-string input', () => {
        expect(() => formatPhoneToE164(123 as any)).toThrow(AppError);
        expect(() => formatPhoneToE164(123 as any)).toThrow('Phone number is required');
      });

      it('should throw error for too short phone number', () => {
        expect(() => formatPhoneToE164('1199999999')).toThrow(AppError);
        expect(() => formatPhoneToE164('1199999999')).toThrow('Invalid phone number length');
      });

      it('should throw error for too long phone number', () => {
        expect(() => formatPhoneToE164('551199999999999')).toThrow(AppError);
        expect(() => formatPhoneToE164('551199999999999')).toThrow('Invalid phone number length');
      });

      it('should throw error for invalid area code', () => {
        expect(() => formatPhoneToE164('00999999999')).toThrow(AppError);
        expect(() => formatPhoneToE164('00999999999')).toThrow('Invalid Brazilian area code');
      });

      it('should throw error for landline number (not starting with 9)', () => {
        expect(() => formatPhoneToE164('11888888888')).toThrow(AppError);
        expect(() => formatPhoneToE164('11888888888')).toThrow(
          'Invalid Brazilian mobile number format - must start with 9 and have 9 digits'
        );
      });

      it('should throw error for mobile number with wrong length', () => {
        expect(() => formatPhoneToE164('1199999999')).toThrow(AppError);
        expect(() => formatPhoneToE164('1199999999')).toThrow('Invalid phone number length');
      });

      it('should throw error for phone with invalid country code', () => {
        expect(() => formatPhoneToE164('5411999999999')).toThrow(AppError);
        expect(() => formatPhoneToE164('5411999999999')).toThrow('Invalid phone number length');
      });
    });

    describe('edge cases', () => {
      it('should handle phone number with dots', () => {
        const result = formatPhoneToE164('11.99999.9999');
        expect(result).toBe('+5511999999999');
      });

      it('should handle phone number with only spaces', () => {
        expect(() => formatPhoneToE164('   ')).toThrow(AppError);
      });

      it('should handle phone number with mixed special characters', () => {
        const result = formatPhoneToE164('+55-(11)-99999.9999');
        expect(result).toBe('+5511999999999');
      });
    });
  });

  describe('isValidBrazilianMobile', () => {
    it('should return true for valid phone numbers', () => {
      expect(isValidBrazilianMobile('11999999999')).toBe(true);
      expect(isValidBrazilianMobile('5511999999999')).toBe(true);
      expect(isValidBrazilianMobile('+5511999999999')).toBe(true);
      expect(isValidBrazilianMobile('(11) 99999-9999')).toBe(true);
    });

    it('should return false for invalid phone numbers', () => {
      expect(isValidBrazilianMobile('')).toBe(false);
      expect(isValidBrazilianMobile('1199999999')).toBe(false);
      expect(isValidBrazilianMobile('11888888888')).toBe(false);
      expect(isValidBrazilianMobile('00999999999')).toBe(false);
      expect(isValidBrazilianMobile('invalid')).toBe(false);
    });

    it('should return false for null or undefined', () => {
      expect(isValidBrazilianMobile(null as any)).toBe(false);
      expect(isValidBrazilianMobile(undefined as any)).toBe(false);
    });
  });
});
