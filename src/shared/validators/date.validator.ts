/**
 * Date validation utilities
 *
 * Provides validators for:
 * - Brazilian national holidays
 * - Saturday validation
 * - Date comparisons
 */

/**
 * Brazilian national holidays (fixed dates)
 *
 * Carnaval and Easter (Sexta-feira Santa) are movable holidays
 * calculated based on Easter Sunday algorithm
 */
const FIXED_BRAZILIAN_HOLIDAYS = [
  { month: 1, day: 1 }, // Ano Novo (New Year)
  { month: 12, day: 25 }, // Natal (Christmas)
];

/**
 * Calculate Easter Sunday date for a given year
 *
 * Uses Anonymous Gregorian algorithm (Meeus/Jones/Butcher)
 * Returns Easter Sunday, used to calculate movable holidays
 *
 * @param year - Year to calculate Easter for
 * @returns Date - Easter Sunday date
 */
function calculateEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(year, month - 1, day);
}

/**
 * Calculate Carnaval date (47 days before Easter)
 *
 * @param year - Year to calculate Carnaval for
 * @returns Date - Carnaval Tuesday date
 */
function calculateCarnaval(year: number): Date {
  const easter = calculateEaster(year);
  const carnaval = new Date(easter);
  carnaval.setDate(easter.getDate() - 47);
  return carnaval;
}

/**
 * Calculate Good Friday (Sexta-feira Santa) date (2 days before Easter)
 *
 * @param year - Year to calculate Good Friday for
 * @returns Date - Good Friday date
 */
function calculateGoodFriday(year: number): Date {
  const easter = calculateEaster(year);
  const goodFriday = new Date(easter);
  goodFriday.setDate(easter.getDate() - 2);
  return goodFriday;
}

/**
 * Check if date is a Brazilian national holiday
 *
 * Includes both fixed holidays (New Year, Christmas) and movable holidays
 * (Carnaval, Good Friday) calculated based on Easter algorithm
 *
 * @param date - Date to check
 * @returns boolean - True if date is a Brazilian holiday
 *
 * @example
 * isBrazilianHoliday(new Date(2024, 0, 1)) // true (New Year)
 * isBrazilianHoliday(new Date(2024, 11, 25)) // true (Christmas)
 * isBrazilianHoliday(new Date(2024, 2, 29)) // false (not a holiday)
 */
export function isBrazilianHoliday(date: Date): boolean {
  const month = date.getMonth() + 1; // JavaScript months are 0-indexed
  const day = date.getDate();
  const year = date.getFullYear();

  // Check fixed holidays
  const isFixedHoliday = FIXED_BRAZILIAN_HOLIDAYS.some(
    (holiday) => holiday.month === month && holiday.day === day
  );

  if (isFixedHoliday) {
    return true;
  }

  // Check movable holidays
  const carnaval = calculateCarnaval(year);
  const goodFriday = calculateGoodFriday(year);

  const dateString = date.toDateString();
  return dateString === carnaval.toDateString() || dateString === goodFriday.toDateString();
}

/**
 * Check if date is a Saturday
 *
 * @param date - Date to check
 * @returns boolean - True if date is Saturday (day 6)
 *
 * @example
 * isSaturday(new Date(2024, 0, 6)) // true (Saturday)
 * isSaturday(new Date(2024, 0, 7)) // false (Sunday)
 */
export function isSaturday(date: Date): boolean {
  return date.getDay() === 6;
}

/**
 * Check if date is in the past (before current time)
 *
 * @param date - Date to check
 * @returns boolean - True if date is before current time
 *
 * @example
 * isPastDate(new Date(2020, 0, 1)) // true (past)
 * isPastDate(new Date(2030, 0, 1)) // false (future)
 */
export function isPastDate(date: Date): boolean {
  return date < new Date();
}

/**
 * Check if date is within N hours from now
 *
 * Used for cancellation window enforcement (12-hour window)
 *
 * @param date - Date to check
 * @param hours - Number of hours threshold
 * @returns boolean - True if date is within N hours from now (inclusive of boundary)
 *
 * @example
 * // If current time is 2024-01-01 09:00
 * isWithinHours(new Date(2024, 0, 1, 20, 0), 12) // true (11 hours away)
 * isWithinHours(new Date(2024, 0, 1, 21, 0), 12) // true (12 hours away - at boundary)
 * isWithinHours(new Date(2024, 0, 2, 0, 0), 12) // false (15 hours away)
 */
export function isWithinHours(date: Date, hours: number): boolean {
  const now = new Date();
  const hoursInMs = hours * 60 * 60 * 1000;
  const timeDiff = date.getTime() - now.getTime();
  return timeDiff <= hoursInMs;
}

/**
 * Normalize date to start of day (00:00:00)
 *
 * @param date - Date to normalize
 * @returns Date - Normalized date
 *
 * @example
 * normalizeDate(new Date(2024, 0, 1, 15, 30)) // 2024-01-01 00:00:00
 */
export function normalizeDate(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

/**
 * Check if two dates are the same day
 *
 * @param date1 - First date
 * @param date2 - Second date
 * @returns boolean - True if dates are same day
 *
 * @example
 * isSameDay(new Date(2024, 0, 1, 9, 0), new Date(2024, 0, 1, 15, 0)) // true
 * isSameDay(new Date(2024, 0, 1), new Date(2024, 0, 2)) // false
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}
