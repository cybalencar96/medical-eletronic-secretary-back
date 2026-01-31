/**
 * CPF Validator
 *
 * Validates Brazilian CPF (Cadastro de Pessoas Físicas) numbers using checksum algorithm.
 * Supports both formatted (123.456.789-00) and unformatted (12345678900) input.
 */

const KNOWN_INVALID_CPFS = [
  '00000000000',
  '11111111111',
  '22222222222',
  '33333333333',
  '44444444444',
  '55555555555',
  '66666666666',
  '77777777777',
  '88888888888',
  '99999999999',
];

/**
 * Normalizes CPF by removing all non-numeric characters
 *
 * @param cpf - CPF string in any format
 * @returns Normalized CPF with only digits
 */
export function normalizeCpf(cpf: string): string {
  return cpf.replace(/\D/g, '');
}

/**
 * Calculates CPF checksum digit
 *
 * @param cpf - CPF digits (without checksum)
 * @param position - Position for checksum calculation (10 or 11)
 * @returns Calculated checksum digit
 */
function calculateChecksum(cpf: string, position: number): number {
  let sum = 0;
  for (let i = 0; i < position - 1; i++) {
    sum += parseInt(cpf[i]) * (position - i);
  }
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

/**
 * Validates CPF using checksum algorithm
 *
 * @param cpf - CPF string (formatted or unformatted)
 * @returns true if CPF is valid, false otherwise
 */
export function isValidCpf(cpf: string | null | undefined): boolean {
  // Handle null/undefined/empty input
  if (!cpf || typeof cpf !== 'string') {
    return false;
  }

  // Normalize CPF by removing formatting
  const normalized = normalizeCpf(cpf);

  // Check if CPF has exactly 11 digits
  if (normalized.length !== 11) {
    return false;
  }

  // Check if CPF contains only numeric characters
  if (!/^\d+$/.test(normalized)) {
    return false;
  }

  // Reject known invalid patterns (all same digits)
  if (KNOWN_INVALID_CPFS.includes(normalized)) {
    return false;
  }

  // Validate first checksum digit (position 10)
  const firstChecksum = calculateChecksum(normalized, 10);
  if (firstChecksum !== parseInt(normalized[9])) {
    return false;
  }

  // Validate second checksum digit (position 11)
  const secondChecksum = calculateChecksum(normalized, 11);
  if (secondChecksum !== parseInt(normalized[10])) {
    return false;
  }

  return true;
}
