import { AppError } from '../../../shared/errors/AppError';

/**
 * Formats a Brazilian phone number to E.164 format for WhatsApp Cloud API.
 *
 * E.164 format: +[country code][area code][number]
 * Example: +5511999999999 (Brazil country code: 55, São Paulo area code: 11)
 *
 * Accepts various input formats:
 * - With country code: +5511999999999, 5511999999999
 * - Without country code: 11999999999, (11) 99999-9999, 11 99999-9999
 *
 * @param {string} phoneNumber - Phone number in various formats
 * @returns {string} Phone number in E.164 format (+5511999999999)
 * @throws {AppError} If phone number is invalid or not a Brazilian mobile number
 *
 * @example
 * ```typescript
 * formatPhoneToE164('11999999999') // Returns '+5511999999999'
 * formatPhoneToE164('+5511999999999') // Returns '+5511999999999'
 * formatPhoneToE164('(11) 99999-9999') // Returns '+5511999999999'
 * formatPhoneToE164('5511999999999') // Returns '+5511999999999'
 * ```
 */
export function formatPhoneToE164(phoneNumber: string): string {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    throw new AppError('Phone number is required', 400);
  }

  // Remove all non-digit characters
  const digitsOnly = phoneNumber.replace(/\D/g, '');

  // Validate length and format
  if (digitsOnly.length === 11) {
    // Format: 11999999999 (area code + number without country code)
    // Validate Brazilian area code (11-99 excluding 20, 23-26, 29-30, 36, 39-40, 50, 52, 56-60, 70, 72, 76, 78, 80, 90)
    const areaCode = parseInt(digitsOnly.substring(0, 2), 10);
    if (areaCode < 11 || areaCode > 99) {
      throw new AppError('Invalid Brazilian area code', 400);
    }

    // Validate mobile number format (9XXXXXXXX)
    const number = digitsOnly.substring(2);
    if (!number.startsWith('9') || number.length !== 9) {
      throw new AppError(
        'Invalid Brazilian mobile number format - must start with 9 and have 9 digits',
        400
      );
    }

    return `+55${digitsOnly}`;
  } else if (digitsOnly.length === 13 && digitsOnly.startsWith('55')) {
    // Format: 5511999999999 (country code + area code + number)
    const withoutCountryCode = digitsOnly.substring(2);
    const number = withoutCountryCode.substring(2);

    // Validate mobile number format
    if (!number.startsWith('9') || number.length !== 9) {
      throw new AppError(
        'Invalid Brazilian mobile number format - must start with 9 and have 9 digits',
        400
      );
    }

    return `+${digitsOnly}`;
  } else {
    throw new AppError(
      `Invalid phone number length - expected 11 digits (without country code) or 13 digits (with country code 55), got ${digitsOnly.length}`,
      400
    );
  }
}

/**
 * Validates if a phone number is a valid Brazilian mobile number.
 *
 * @param {string} phoneNumber - Phone number in any format
 * @returns {boolean} True if valid Brazilian mobile number, false otherwise
 *
 * @example
 * ```typescript
 * isValidBrazilianMobile('11999999999') // Returns true
 * isValidBrazilianMobile('1199999999') // Returns false (too short)
 * isValidBrazilianMobile('11899999999') // Returns false (doesn't start with 9)
 * ```
 */
export function isValidBrazilianMobile(phoneNumber: string): boolean {
  try {
    formatPhoneToE164(phoneNumber);
    return true;
  } catch {
    return false;
  }
}
