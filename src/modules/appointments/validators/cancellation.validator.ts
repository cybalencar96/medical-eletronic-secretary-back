/**
 * Cancellation validation for appointment business rules
 *
 * Implements 12-hour minimum cancellation window enforcement
 */

import { isWithinHours } from '../../../shared/validators/date.validator';

/**
 * Minimum cancellation window in hours
 *
 * Appointments cannot be cancelled within 12 hours of scheduled time
 * Gives time for rebooking slot to other patients
 */
const CANCELLATION_WINDOW_HOURS = 12;

/**
 * Validate if appointment can be cancelled based on 12-hour window
 *
 * Returns true if cancellation is allowed (>12 hours before scheduled time)
 * Returns false if within 12-hour window
 *
 * @param scheduledAt - Scheduled appointment date/time
 * @returns boolean - True if cancellation is allowed
 *
 * @example
 * // Current time: 2024-01-05 09:00
 * // Appointment: 2024-01-06 09:00 (24 hours away)
 * canCancelAppointment(new Date(2024, 0, 6, 9, 0)) // true
 *
 * @example
 * // Current time: 2024-01-06 00:00
 * // Appointment: 2024-01-06 09:00 (9 hours away)
 * canCancelAppointment(new Date(2024, 0, 6, 9, 0)) // false
 */
export function canCancelAppointment(scheduledAt: Date): boolean {
  return !isWithinHours(scheduledAt, CANCELLATION_WINDOW_HOURS);
}

/**
 * Get hours until appointment
 *
 * Returns number of hours from current time to scheduled appointment
 * Returns negative if appointment is in the past
 *
 * @param scheduledAt - Scheduled appointment date/time
 * @returns number - Hours until appointment (negative if past)
 *
 * @example
 * // Current time: 2024-01-05 09:00
 * // Appointment: 2024-01-06 09:00
 * getHoursUntilAppointment(new Date(2024, 0, 6, 9, 0)) // 24
 */
export function getHoursUntilAppointment(scheduledAt: Date): number {
  const now = new Date();
  const diffMs = scheduledAt.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  return Math.floor(diffHours);
}

/**
 * Get cancellation error message
 *
 * Returns user-friendly message explaining why cancellation is blocked
 * Includes hours until appointment for context
 *
 * @param scheduledAt - Scheduled appointment date/time
 * @returns string - Error message
 *
 * @example
 * getCancellationErrorMessage(new Date(2024, 0, 6, 9, 0))
 * // Returns: "Cannot cancel appointment within 12 hours of scheduled time. Appointment is in 9 hours."
 */
export function getCancellationErrorMessage(scheduledAt: Date): string {
  const hoursUntil = getHoursUntilAppointment(scheduledAt);
  return `Cannot cancel appointment within ${CANCELLATION_WINDOW_HOURS} hours of scheduled time. Appointment is in ${hoursUntil} hours.`;
}
