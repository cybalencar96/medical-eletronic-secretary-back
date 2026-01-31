/**
 * CPF Validator Unit Tests
 *
 * Tests for CPF validation utility covering valid/invalid CPFs,
 * formatted/unformatted input, and edge cases
 */

import { isValidCpf, normalizeCpf } from '../../../../src/shared/validators/cpf.validator';

describe('CPF Validator', () => {
  describe('normalizeCpf', () => {
    it('should remove formatting from CPF with dots and dash', () => {
      expect(normalizeCpf('123.456.789-00')).toBe('12345678900');
    });

    it('should keep unformatted CPF unchanged', () => {
      expect(normalizeCpf('12345678900')).toBe('12345678900');
    });

    it('should remove all non-numeric characters', () => {
      expect(normalizeCpf('123abc456def789-00')).toBe('12345678900');
    });

    it('should handle empty string', () => {
      expect(normalizeCpf('')).toBe('');
    });
  });

  describe('isValidCpf', () => {
    describe('valid CPFs', () => {
      it('should validate correct CPF with formatting', () => {
        expect(isValidCpf('123.456.789-09')).toBe(true);
      });

      it('should validate correct CPF without formatting', () => {
        expect(isValidCpf('12345678909')).toBe(true);
      });

      it('should validate another correct CPF', () => {
        expect(isValidCpf('111.444.777-35')).toBe(true);
      });
    });

    describe('invalid CPFs - incorrect checksum', () => {
      it('should reject CPF with incorrect first checksum digit', () => {
        expect(isValidCpf('123.456.789-00')).toBe(false);
      });

      it('should reject CPF with incorrect second checksum digit', () => {
        expect(isValidCpf('123.456.789-08')).toBe(false);
      });

      it('should reject CPF with both incorrect checksum digits', () => {
        expect(isValidCpf('123.456.789-99')).toBe(false);
      });
    });

    describe('invalid CPFs - known invalid patterns', () => {
      it('should reject CPF with all zeros', () => {
        expect(isValidCpf('000.000.000-00')).toBe(false);
      });

      it('should reject CPF with all ones', () => {
        expect(isValidCpf('111.111.111-11')).toBe(false);
      });

      it('should reject CPF with all twos', () => {
        expect(isValidCpf('222.222.222-22')).toBe(false);
      });

      it('should reject CPF with all threes', () => {
        expect(isValidCpf('333.333.333-33')).toBe(false);
      });

      it('should reject CPF with all fours', () => {
        expect(isValidCpf('444.444.444-44')).toBe(false);
      });

      it('should reject CPF with all fives', () => {
        expect(isValidCpf('555.555.555-55')).toBe(false);
      });

      it('should reject CPF with all sixes', () => {
        expect(isValidCpf('666.666.666-66')).toBe(false);
      });

      it('should reject CPF with all sevens', () => {
        expect(isValidCpf('777.777.777-77')).toBe(false);
      });

      it('should reject CPF with all eights', () => {
        expect(isValidCpf('888.888.888-88')).toBe(false);
      });

      it('should reject CPF with all nines', () => {
        expect(isValidCpf('999.999.999-99')).toBe(false);
      });

      it('should reject unformatted CPF with all same digits', () => {
        expect(isValidCpf('11111111111')).toBe(false);
      });
    });

    describe('invalid CPFs - incorrect length', () => {
      it('should reject CPF with less than 11 digits', () => {
        expect(isValidCpf('123.456.789')).toBe(false);
      });

      it('should reject CPF with more than 11 digits', () => {
        expect(isValidCpf('123.456.789-001')).toBe(false);
      });

      it('should reject empty CPF', () => {
        expect(isValidCpf('')).toBe(false);
      });

      it('should reject CPF with only 10 digits', () => {
        expect(isValidCpf('1234567890')).toBe(false);
      });
    });

    describe('invalid CPFs - edge cases', () => {
      it('should reject null CPF', () => {
        expect(isValidCpf(null)).toBe(false);
      });

      it('should reject undefined CPF', () => {
        expect(isValidCpf(undefined)).toBe(false);
      });

      it('should reject CPF with only letters', () => {
        expect(isValidCpf('abcdefghijk')).toBe(false);
      });

      it('should reject CPF with mixed letters and numbers but invalid length after normalization', () => {
        expect(isValidCpf('abc123def456')).toBe(false);
      });

      it('should reject CPF with special characters only', () => {
        expect(isValidCpf('...--..--.--')).toBe(false);
      });
    });

    describe('CPF normalization in validation', () => {
      it('should accept valid CPF with extra spaces', () => {
        expect(isValidCpf(' 123.456.789-09 ')).toBe(true);
      });

      it('should accept valid CPF with inconsistent formatting', () => {
        expect(isValidCpf('123 456 789 09')).toBe(true);
      });

      it('should accept valid CPF with mixed formatting characters', () => {
        expect(isValidCpf('123/456/789-09')).toBe(true);
      });
    });
  });
});
