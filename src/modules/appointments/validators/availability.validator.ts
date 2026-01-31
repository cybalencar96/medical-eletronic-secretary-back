/**
 * Availability validation for appointment slots
 *
 * Implements Saturday-only 2-hour slot generation with holiday blocking
 */

import { TimeSlot } from '../types/appointment.types';
import {
  isSaturday,
  isBrazilianHoliday,
  isPastDate,
  normalizeDate,
} from '../../../shared/validators/date.validator';

/**
 * Operating hours configuration
 */
const OPERATING_START_HOUR = 9; // 09:00
const OPERATING_END_HOUR = 18; // 18:00
const SLOT_DURATION_HOURS = 2;

/**
 * Generate all possible time slots for a given date
 *
 * Returns 4 slots for Saturdays (09:00-11:00, 11:00-13:00, 13:00-15:00, 15:00-17:00)
 * Returns empty array for:
 * - Non-Saturday dates
 * - Brazilian holidays
 * - Past dates
 *
 * @param date - Date to generate slots for
 * @returns TimeSlot[] - Array of time slots (empty if date is invalid)
 *
 * @example
 * // For Saturday 2024-01-06 (not a holiday)
 * generateTimeSlots(new Date(2024, 0, 6))
 * // Returns:
 * // [
 * //   { startTime: 2024-01-06 09:00, endTime: 2024-01-06 11:00 },
 * //   { startTime: 2024-01-06 11:00, endTime: 2024-01-06 13:00 },
 * //   { startTime: 2024-01-06 13:00, endTime: 2024-01-06 15:00 },
 * //   { startTime: 2024-01-06 15:00, endTime: 2024-01-06 17:00 }
 * // ]
 *
 * @example
 * // For Sunday 2024-01-07
 * generateTimeSlots(new Date(2024, 0, 7)) // Returns: []
 */
export function generateTimeSlots(date: Date): TimeSlot[] {
  // Normalize date to start of day for consistent comparison
  const normalizedDate = normalizeDate(date);

  // Validate date is Saturday, not a holiday, and in the future
  if (!isSaturday(normalizedDate)) {
    return [];
  }

  if (isBrazilianHoliday(normalizedDate)) {
    return [];
  }

  // Allow current day bookings (check if any slot is still in the future)
  const firstSlotStart = new Date(normalizedDate);
  firstSlotStart.setHours(OPERATING_START_HOUR, 0, 0, 0);

  if (isPastDate(firstSlotStart) && !isToday(normalizedDate)) {
    return [];
  }

  // Generate 2-hour slots from 09:00 to 18:00 (4 slots total)
  const slots: TimeSlot[] = [];
  for (
    let hour = OPERATING_START_HOUR;
    hour + SLOT_DURATION_HOURS <= OPERATING_END_HOUR;
    hour += SLOT_DURATION_HOURS
  ) {
    const startTime = new Date(normalizedDate);
    startTime.setHours(hour, 0, 0, 0);

    const endTime = new Date(normalizedDate);
    endTime.setHours(hour + SLOT_DURATION_HOURS, 0, 0, 0);

    // Only include slots that haven't started yet (allow booking on same day)
    if (!isPastDate(startTime)) {
      slots.push({ startTime, endTime });
    }
  }

  return slots;
}

/**
 * Check if date is today
 *
 * @param date - Date to check
 * @returns boolean - True if date is today
 */
function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

/**
 * Check if time slot is valid (Saturday, not holiday, future date)
 *
 * Validates:
 * - Date is Saturday
 * - Date is not a Brazilian holiday
 * - Start time is in the future
 * - Slot is within operating hours (09:00-18:00)
 * - Slot duration is exactly 2 hours
 *
 * @param slot - Time slot to validate
 * @returns boolean - True if slot is valid
 *
 * @example
 * const slot = {
 *   startTime: new Date(2024, 0, 6, 9, 0), // Saturday 09:00
 *   endTime: new Date(2024, 0, 6, 11, 0)   // Saturday 11:00
 * };
 * isValidTimeSlot(slot) // true
 */
export function isValidTimeSlot(slot: TimeSlot): boolean {
  const { startTime, endTime } = slot;

  // Check if Saturday
  if (!isSaturday(startTime)) {
    return false;
  }

  // Check if holiday
  if (isBrazilianHoliday(startTime)) {
    return false;
  }

  // Check if in the future
  if (isPastDate(startTime)) {
    return false;
  }

  // Check within operating hours
  const startHour = startTime.getHours();
  const endHour = endTime.getHours();

  if (startHour < OPERATING_START_HOUR || endHour > OPERATING_END_HOUR) {
    return false;
  }

  // Check slot duration is exactly 2 hours
  const durationMs = endTime.getTime() - startTime.getTime();
  const durationHours = durationMs / (1000 * 60 * 60);

  if (durationHours !== SLOT_DURATION_HOURS) {
    return false;
  }

  // Check start and end are on same day
  if (
    startTime.getFullYear() !== endTime.getFullYear() ||
    startTime.getMonth() !== endTime.getMonth() ||
    startTime.getDate() !== endTime.getDate()
  ) {
    return false;
  }

  return true;
}

/**
 * Check if two time slots overlap
 *
 * Slots overlap if one starts before the other ends
 *
 * @param slot1 - First time slot
 * @param slot2 - Second time slot
 * @returns boolean - True if slots overlap
 *
 * @example
 * const slot1 = {
 *   startTime: new Date(2024, 0, 6, 9, 0),
 *   endTime: new Date(2024, 0, 6, 11, 0)
 * };
 * const slot2 = {
 *   startTime: new Date(2024, 0, 6, 11, 0),
 *   endTime: new Date(2024, 0, 6, 13, 0)
 * };
 * doSlotsOverlap(slot1, slot2) // false (adjacent, not overlapping)
 */
export function doSlotsOverlap(slot1: TimeSlot, slot2: TimeSlot): boolean {
  return slot1.startTime < slot2.endTime && slot2.startTime < slot1.endTime;
}

/**
 * Check if two time slots are the same
 *
 * @param slot1 - First time slot
 * @param slot2 - Second time slot
 * @returns boolean - True if slots have same start and end times
 *
 * @example
 * const slot1 = {
 *   startTime: new Date(2024, 0, 6, 9, 0),
 *   endTime: new Date(2024, 0, 6, 11, 0)
 * };
 * const slot2 = {
 *   startTime: new Date(2024, 0, 6, 9, 0),
 *   endTime: new Date(2024, 0, 6, 11, 0)
 * };
 * areSlotsEqual(slot1, slot2) // true
 */
export function areSlotsEqual(slot1: TimeSlot, slot2: TimeSlot): boolean {
  return (
    slot1.startTime.getTime() === slot2.startTime.getTime() &&
    slot1.endTime.getTime() === slot2.endTime.getTime()
  );
}
