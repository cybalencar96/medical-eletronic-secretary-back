/**
 * Appointment service interface
 *
 * Defines contract for appointment business logic operations.
 * Consumed by queue workers (WhatsApp flow) and dashboard API.
 */

import {
  Appointment,
  CreateAppointmentDTO,
  UpdateAppointmentDTO,
  CancelAppointmentDTO,
  UpdateAppointmentStatusDTO,
  TimeSlot,
} from '../types/appointment.types';

export interface IAppointmentService {
  /**
   * Check available time slots for a given date
   *
   * Returns all available 2-hour slots for Saturdays (09:00-18:00)
   * Excludes:
   * - Already booked slots
   * - Non-Saturday dates (returns empty array)
   * - Brazilian national holidays
   * - Past dates
   *
   * @param date - Date to check availability for
   * @returns Promise<TimeSlot[]> - Array of available time slots
   */
  checkAvailability(date: Date): Promise<TimeSlot[]>;

  /**
   * Book new appointment
   *
   * Validates:
   * - Patient exists and has given consent
   * - Slot is available (no double-booking)
   * - Date is Saturday within operating hours
   * - Date is not a Brazilian holiday
   * - Date is in the future
   *
   * Creates audit log entry for booking action
   *
   * @param data - Appointment creation data
   * @returns Promise<Appointment> - Created appointment
   * @throws AppError - Validation failures (400), patient not found (404), slot already booked (409)
   */
  book(data: CreateAppointmentDTO): Promise<Appointment>;

  /**
   * Reschedule existing appointment to new time slot
   *
   * Validates:
   * - Appointment exists and is not cancelled/completed/no-show
   * - New slot is available
   * - New slot meets all booking criteria (Saturday, not holiday, future date)
   *
   * Creates audit log entry with old and new scheduled_at
   * No limit on reschedule count (unlimited rescheduling allowed)
   *
   * @param appointmentId - UUID of appointment to reschedule
   * @param data - New schedule data
   * @returns Promise<Appointment> - Updated appointment
   * @throws AppError - Appointment not found (404), invalid status (400), slot unavailable (409)
   */
  reschedule(appointmentId: string, data: UpdateAppointmentDTO): Promise<Appointment>;

  /**
   * Cancel appointment
   *
   * Validates:
   * - Appointment exists and is not already cancelled/completed/no-show
   * - Cancellation is >12 hours before scheduled_at (12-hour window enforcement)
   *
   * Sets status to 'cancelled' and frees the slot for rebooking
   * Creates audit log entry with cancellation reason
   *
   * @param appointmentId - UUID of appointment to cancel
   * @param data - Cancellation data with reason
   * @returns Promise<void>
   * @throws AppError - Appointment not found (404), within 12-hour window (400), invalid status (400)
   */
  cancel(appointmentId: string, data: CancelAppointmentDTO): Promise<void>;

  /**
   * Update appointment status
   *
   * Validates:
   * - Appointment exists
   * - Status transition is valid according to state machine
   *
   * Creates audit log entry for status change
   *
   * @param appointmentId - UUID of appointment to update
   * @param data - Status update data
   * @returns Promise<Appointment> - Updated appointment
   * @throws AppError - Appointment not found (404), invalid transition (400)
   */
  updateStatus(appointmentId: string, data: UpdateAppointmentStatusDTO): Promise<Appointment>;

  /**
   * Find appointment by ID
   *
   * @param appointmentId - UUID of appointment
   * @returns Promise<Appointment | null> - Appointment or null if not found
   */
  findById(appointmentId: string): Promise<Appointment | null>;

  /**
   * Find all appointments for a patient
   *
   * @param patientId - UUID of patient
   * @returns Promise<Appointment[]> - Array of appointments
   */
  findByPatientId(patientId: string): Promise<Appointment[]>;
}
