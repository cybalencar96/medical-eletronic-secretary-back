import { ExtractedEntities } from '../../shared/types/classified-intent';

/**
 * Normalizes extracted date to ISO format (YYYY-MM-DD).
 *
 * Handles:
 * - Brazilian format (DD/MM/YYYY)
 * - ISO format (YYYY-MM-DD) - passthrough
 * - Relative dates (próximo sábado, sábado que vem) - converts to next Saturday
 *
 * @param {string} dateString - Raw date string from LLM
 * @returns {string | undefined} Normalized date in ISO format or undefined if invalid
 */
export const normalizeDate = (dateString: string): string | undefined => {
  if (!dateString || dateString.trim() === '') {
    return undefined;
  }

  const trimmed = dateString.trim();

  // Handle ISO format (YYYY-MM-DD) - passthrough
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // Handle Brazilian format (DD/MM/YYYY)
  const brDateMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (brDateMatch) {
    const [, day, month, year] = brDateMatch;
    const paddedDay = day.padStart(2, '0');
    const paddedMonth = month.padStart(2, '0');
    return `${year}-${paddedMonth}-${paddedDay}`;
  }

  // Handle relative dates (próximo sábado, sábado que vem)
  const lowerTrimmed = trimmed.toLowerCase();
  if (
    lowerTrimmed.includes('próximo sábado') ||
    lowerTrimmed.includes('proximo sabado') ||
    lowerTrimmed.includes('sábado que vem') ||
    lowerTrimmed.includes('sabado que vem') ||
    lowerTrimmed === 'sábado' ||
    lowerTrimmed === 'sabado'
  ) {
    return getNextSaturday();
  }

  // Unable to parse - return undefined
  return undefined;
};

/**
 * Normalizes extracted time to HH:MM format (24-hour).
 *
 * Handles:
 * - HH:MM format - passthrough
 * - H:MM format - pad hour
 * - Coloquial formats (9 da manhã, 3 da tarde, meio-dia)
 *
 * @param {string} timeString - Raw time string from LLM
 * @returns {string | undefined} Normalized time in HH:MM format or undefined if invalid
 */
export const normalizeTime = (timeString: string): string | undefined => {
  if (!timeString || timeString.trim() === '') {
    return undefined;
  }

  const trimmed = timeString.trim();

  // Handle HH:MM or H:MM format
  const timeMatch = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (timeMatch) {
    const [, hour, minute] = timeMatch;
    const paddedHour = hour.padStart(2, '0');
    return `${paddedHour}:${minute}`;
  }

  // Handle coloquial formats
  const lowerTrimmed = trimmed.toLowerCase();

  // meio-dia / meio dia
  if (lowerTrimmed.includes('meio') && lowerTrimmed.includes('dia')) {
    return '12:00';
  }

  // X da manhã / X da manha (9 da manhã → 09:00)
  const morningMatch = lowerTrimmed.match(/(\d{1,2})\s*da\s*manh[aã]/);
  if (morningMatch) {
    const hour = morningMatch[1].padStart(2, '0');
    return `${hour}:00`;
  }

  // X da tarde (1 da tarde → 13:00, 2 da tarde → 14:00, etc.)
  const afternoonMatch = lowerTrimmed.match(/(\d{1,2})\s*da\s*tarde/);
  if (afternoonMatch) {
    const hour = parseInt(afternoonMatch[1], 10);
    const adjustedHour = hour < 12 ? hour + 12 : hour;
    return `${adjustedHour.toString().padStart(2, '0')}:00`;
  }

  // X da noite (7 da noite → 19:00, 8 da noite → 20:00)
  const nightMatch = lowerTrimmed.match(/(\d{1,2})\s*da\s*noite/);
  if (nightMatch) {
    const hour = parseInt(nightMatch[1], 10);
    const adjustedHour = hour < 12 ? hour + 12 : hour;
    return `${adjustedHour.toString().padStart(2, '0')}:00`;
  }

  // Unable to parse - return undefined
  return undefined;
};

/**
 * Normalizes all entities in ClassifiedIntent result.
 * Converts dates and times to standard formats.
 *
 * @param {ExtractedEntities} entities - Raw entities from LLM
 * @returns {ExtractedEntities} Normalized entities
 */
export const normalizeEntities = (entities: ExtractedEntities): ExtractedEntities => {
  return {
    date: entities.date ? normalizeDate(entities.date) : undefined,
    time: entities.time ? normalizeTime(entities.time) : undefined,
    reason: entities.reason,
  };
};

/**
 * Gets the date of the next Saturday in ISO format (YYYY-MM-DD).
 *
 * @returns {string} Next Saturday's date in ISO format
 */
export const getNextSaturday = (): string => {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
  const daysUntilSaturday = dayOfWeek === 6 ? 7 : (6 - dayOfWeek + 7) % 7;

  const nextSaturday = new Date(today);
  nextSaturday.setDate(today.getDate() + (daysUntilSaturday === 0 ? 7 : daysUntilSaturday));

  return nextSaturday.toISOString().split('T')[0];
};

/**
 * Validates that a date string is actually a Saturday.
 * Used to validate appointment dates against business rules.
 *
 * @param {string} dateString - Date in ISO format (YYYY-MM-DD)
 * @returns {boolean} True if date is a Saturday, false otherwise
 */
export const isSaturday = (dateString: string): boolean => {
  if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return false;
  }

  const date = new Date(dateString + 'T00:00:00');
  return date.getDay() === 6;
};

/**
 * Validates that a time string is within business hours (09:00-18:00).
 *
 * @param {string} timeString - Time in HH:MM format
 * @returns {boolean} True if time is within business hours, false otherwise
 */
export const isWithinBusinessHours = (timeString: string): boolean => {
  if (!timeString || !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(timeString)) {
    return false;
  }

  const [hourStr, minuteStr] = timeString.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);

  // Business hours: 09:00 - 18:00
  // 09:00 is valid, 18:00 is valid (18:01 is not)
  if (hour < 9 || hour > 18) {
    return false;
  }

  if (hour === 18 && minute > 0) {
    return false;
  }

  return true;
};

/**
 * Validates that a time string is a valid appointment slot.
 * Valid slots: 09:00, 11:00, 13:00, 15:00, 17:00 (2-hour slots)
 *
 * @param {string} timeString - Time in HH:MM format
 * @returns {boolean} True if time is a valid slot, false otherwise
 */
export const isValidAppointmentSlot = (timeString: string): boolean => {
  const validSlots = ['09:00', '11:00', '13:00', '15:00', '17:00'];
  return validSlots.includes(timeString);
};
