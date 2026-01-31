/**
 * Appointment module type definitions
 *
 * Defines core types for the appointment booking system including:
 * - Appointment entity structure
 * - Status state machine enum
 * - Time slot representation
 * - Data transfer objects (DTOs)
 */

/**
 * Appointment status enumeration
 *
 * Valid state transitions:
 * - scheduled → confirmed (patient confirms via WhatsApp reminder)
 * - scheduled → cancelled (cancellation >12h before appointment)
 * - confirmed → cancelled (cancellation >12h before appointment)
 * - confirmed → completed (appointment occurred)
 * - confirmed → no-show (patient didn't attend)
 */
export enum AppointmentStatus {
  SCHEDULED = 'scheduled',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
  NO_SHOW = 'no-show',
}

/**
 * Time slot representation for 2-hour consultation blocks
 *
 * Valid Saturday slots (09:00-18:00):
 * - 09:00-11:00
 * - 11:00-13:00
 * - 13:00-15:00
 * - 15:00-17:00
 */
export interface TimeSlot {
  startTime: Date;
  endTime: Date;
}

/**
 * Appointment entity as stored in database
 *
 * Represents a single appointment with patient, schedule, and status tracking
 */
export interface Appointment {
  id: string;
  patientId: string;
  scheduledAt: Date;
  status: AppointmentStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * DTO for creating new appointment
 *
 * Used by booking flow to validate and create appointments
 */
export interface CreateAppointmentDTO {
  patientId: string;
  scheduledAt: Date;
}

/**
 * DTO for updating appointment schedule
 *
 * Used by rescheduling flow to change appointment time
 */
export interface UpdateAppointmentDTO {
  scheduledAt: Date;
}

/**
 * DTO for cancelling appointment
 *
 * Used by cancellation flow to track cancellation reason
 */
export interface CancelAppointmentDTO {
  reason: string;
}

/**
 * DTO for updating appointment status
 *
 * Used by status transition flow (confirmation, completion, no-show)
 */
export interface UpdateAppointmentStatusDTO {
  status: AppointmentStatus;
}

/**
 * Valid state machine transitions
 *
 * Maps current status to allowed next statuses
 */
export const VALID_STATUS_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  [AppointmentStatus.SCHEDULED]: [AppointmentStatus.CONFIRMED, AppointmentStatus.CANCELLED],
  [AppointmentStatus.CONFIRMED]: [
    AppointmentStatus.CANCELLED,
    AppointmentStatus.COMPLETED,
    AppointmentStatus.NO_SHOW,
  ],
  [AppointmentStatus.CANCELLED]: [],
  [AppointmentStatus.COMPLETED]: [],
  [AppointmentStatus.NO_SHOW]: [],
};
