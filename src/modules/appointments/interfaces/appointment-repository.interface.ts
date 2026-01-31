/**
 * Appointment repository interface
 *
 * Defines contract for appointment data access operations.
 * Abstracts database implementation (Knex.js) from business logic.
 */

import { Appointment, CreateAppointmentDTO, TimeSlot } from '../types/appointment.types';

export interface IAppointmentRepository {
  /**
   * Create new appointment in database
   *
   * @param data - Appointment creation data
   * @returns Promise<Appointment> - Created appointment with generated ID and timestamps
   */
  create(data: CreateAppointmentDTO): Promise<Appointment>;

  /**
   * Find appointment by ID
   *
   * @param id - UUID of appointment
   * @returns Promise<Appointment | null> - Appointment or null if not found
   */
  findById(id: string): Promise<Appointment | null>;

  /**
   * Find all appointments for a patient
   *
   * @param patientId - UUID of patient
   * @returns Promise<Appointment[]> - Array of appointments ordered by scheduled_at DESC
   */
  findByPatientId(patientId: string): Promise<Appointment[]>;

  /**
   * Find appointment by time slot
   *
   * Checks if any active (non-cancelled) appointment exists for the given time slot
   * Used for double-booking prevention
   *
   * @param slot - Time slot to check
   * @returns Promise<Appointment | null> - Appointment in slot or null if available
   */
  findBySlot(slot: TimeSlot): Promise<Appointment | null>;

  /**
   * Find all appointments on a given date
   *
   * Returns all appointments scheduled for the date (any status)
   * Used for availability calculation
   *
   * @param date - Date to query
   * @returns Promise<Appointment[]> - Array of appointments on date
   */
  findByDate(date: Date): Promise<Appointment[]>;

  /**
   * Update appointment
   *
   * @param id - UUID of appointment to update
   * @param data - Partial appointment data to update
   * @returns Promise<Appointment> - Updated appointment
   * @throws Error if appointment not found
   */
  update(id: string, data: Partial<Appointment>): Promise<Appointment>;

  /**
   * Delete appointment (soft delete by setting status to cancelled)
   *
   * @param id - UUID of appointment to delete
   * @returns Promise<void>
   */
  delete(id: string): Promise<void>;
}
