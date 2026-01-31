/**
 * Appointment service implementation
 *
 * Business logic layer for appointment booking, rescheduling, and cancellation
 * Implements IAppointmentService interface
 */

import { IAppointmentService } from './interfaces/appointment-service.interface';
import { IAppointmentRepository } from './interfaces/appointment-repository.interface';
import { PatientService } from '../patients/patient.service';
import {
  Appointment,
  CreateAppointmentDTO,
  UpdateAppointmentDTO,
  CancelAppointmentDTO,
  UpdateAppointmentStatusDTO,
  TimeSlot,
  AppointmentStatus,
  VALID_STATUS_TRANSITIONS,
} from './types/appointment.types';
import appointmentRepository from './appointment.repository';
import patientService from '../patients/patient.service';
import { AppError } from '../../shared/errors/AppError';
import { logger } from '../../infrastructure/config/logger';
import { Knex } from 'knex';
import db from '../../infrastructure/database/connection';
import {
  generateTimeSlots,
  isValidTimeSlot,
  areSlotsEqual,
} from './validators/availability.validator';
import {
  canCancelAppointment,
  getCancellationErrorMessage,
} from './validators/cancellation.validator';

/**
 * AppointmentService class
 *
 * Implements core appointment business logic with:
 * - Saturday-only 2-hour slot availability
 * - Double-booking prevention
 * - 12-hour cancellation window enforcement
 * - Brazilian holiday blocking
 * - Audit trail logging
 * - Patient validation and consent checking
 */
export class AppointmentService implements IAppointmentService {
  private repository: IAppointmentRepository;
  private patientService: PatientService;
  private db: Knex;

  constructor(
    repository: IAppointmentRepository = appointmentRepository,
    patientSvc: PatientService = patientService,
    database: Knex = db
  ) {
    this.repository = repository;
    this.patientService = patientSvc;
    this.db = database;
  }

  /**
   * Check available time slots for a given date
   *
   * @param date - Date to check availability for
   * @returns Promise<TimeSlot[]> - Array of available time slots
   */
  async checkAvailability(date: Date): Promise<TimeSlot[]> {
    logger.info({ date }, 'Checking appointment availability');

    // Generate all possible slots for the date (validates Saturday, not holiday, future date)
    const allSlots = generateTimeSlots(date);

    if (allSlots.length === 0) {
      logger.info({ date }, 'No slots available for date (not Saturday or is holiday)');
      return [];
    }

    // Get existing appointments for the date
    const existingAppointments = await this.repository.findByDate(date);

    // Filter out booked slots
    const availableSlots = allSlots.filter((slot) => {
      const isBooked = existingAppointments.some((appointment) => {
        const appointmentSlot: TimeSlot = {
          startTime: appointment.scheduledAt,
          endTime: new Date(appointment.scheduledAt.getTime() + 2 * 60 * 60 * 1000), // 2 hours
        };
        return areSlotsEqual(slot, appointmentSlot);
      });
      return !isBooked;
    });

    logger.info(
      { date, total: allSlots.length, available: availableSlots.length },
      'Availability check complete'
    );

    return availableSlots;
  }

  /**
   * Book new appointment
   *
   * @param data - Appointment creation data
   * @returns Promise<Appointment> - Created appointment
   */
  async book(data: CreateAppointmentDTO): Promise<Appointment> {
    logger.info(
      { patientId: data.patientId, scheduledAt: data.scheduledAt },
      'Booking appointment'
    );

    // Validate time slot
    const slot: TimeSlot = {
      startTime: data.scheduledAt,
      endTime: new Date(data.scheduledAt.getTime() + 2 * 60 * 60 * 1000), // 2 hours
    };

    if (!isValidTimeSlot(slot)) {
      throw new AppError(
        'Invalid time slot. Must be Saturday between 09:00-18:00, not a holiday, and in the future.',
        400
      );
    }

    // Validate patient exists and has consent
    // findPatientById throws AppError if patient not found
    const patient = await this.patientService.findPatientById(data.patientId);

    if (!patient.consent_given_at) {
      throw new AppError(
        'Patient has not given consent for data processing. Cannot book appointment.',
        400
      );
    }

    // Check for double-booking
    const existingAppointment = await this.repository.findBySlot(slot);

    if (existingAppointment) {
      throw new AppError('Slot already booked. Please choose another time.', 409);
    }

    // Create appointment
    const appointment = await this.repository.create(data);

    // Create audit log
    await this.createAuditLog(patient.id, 'appointment_booked', {
      appointmentId: appointment.id,
      scheduledAt: appointment.scheduledAt,
      status: appointment.status,
    });

    logger.info({ appointmentId: appointment.id }, 'Appointment booked successfully');

    return appointment;
  }

  /**
   * Reschedule existing appointment to new time slot
   *
   * @param appointmentId - UUID of appointment to reschedule
   * @param data - New schedule data
   * @returns Promise<Appointment> - Updated appointment
   */
  async reschedule(appointmentId: string, data: UpdateAppointmentDTO): Promise<Appointment> {
    logger.info({ appointmentId, newScheduledAt: data.scheduledAt }, 'Rescheduling appointment');

    // Find existing appointment
    const existingAppointment = await this.repository.findById(appointmentId);

    if (!existingAppointment) {
      throw new AppError('Appointment not found', 404);
    }

    // Validate appointment status allows rescheduling
    if (
      [
        AppointmentStatus.CANCELLED,
        AppointmentStatus.COMPLETED,
        AppointmentStatus.NO_SHOW,
      ].includes(existingAppointment.status)
    ) {
      throw new AppError('Cannot reschedule cancelled, completed, or no-show appointments', 400);
    }

    // Validate new time slot
    const newSlot: TimeSlot = {
      startTime: data.scheduledAt,
      endTime: new Date(data.scheduledAt.getTime() + 2 * 60 * 60 * 1000), // 2 hours
    };

    if (!isValidTimeSlot(newSlot)) {
      throw new AppError(
        'Invalid time slot. Must be Saturday between 09:00-18:00, not a holiday, and in the future.',
        400
      );
    }

    // Check for double-booking at new slot
    const conflictingAppointment = await this.repository.findBySlot(newSlot);

    if (conflictingAppointment && conflictingAppointment.id !== appointmentId) {
      throw new AppError('New slot already booked. Please choose another time.', 409);
    }

    // Update appointment
    const updatedAppointment = await this.repository.update(appointmentId, {
      scheduledAt: data.scheduledAt,
    });

    // Create audit log
    await this.createAuditLog(existingAppointment.patientId, 'appointment_rescheduled', {
      appointmentId,
      oldScheduledAt: existingAppointment.scheduledAt,
      newScheduledAt: updatedAppointment.scheduledAt,
    });

    logger.info({ appointmentId }, 'Appointment rescheduled successfully');

    return updatedAppointment;
  }

  /**
   * Cancel appointment
   *
   * @param appointmentId - UUID of appointment to cancel
   * @param data - Cancellation data with reason
   * @returns Promise<void>
   */
  async cancel(appointmentId: string, data: CancelAppointmentDTO): Promise<void> {
    logger.info({ appointmentId, reason: data.reason }, 'Cancelling appointment');

    // Find existing appointment
    const appointment = await this.repository.findById(appointmentId);

    if (!appointment) {
      throw new AppError('Appointment not found', 404);
    }

    // Validate appointment status allows cancellation
    if (
      [
        AppointmentStatus.CANCELLED,
        AppointmentStatus.COMPLETED,
        AppointmentStatus.NO_SHOW,
      ].includes(appointment.status)
    ) {
      throw new AppError(
        'Cannot cancel already cancelled, completed, or no-show appointments',
        400
      );
    }

    // Validate 12-hour cancellation window
    if (!canCancelAppointment(appointment.scheduledAt)) {
      const errorMessage = getCancellationErrorMessage(appointment.scheduledAt);
      throw new AppError(errorMessage, 400);
    }

    // Update appointment status to cancelled
    await this.repository.update(appointmentId, {
      status: AppointmentStatus.CANCELLED,
    });

    // Create audit log
    await this.createAuditLog(appointment.patientId, 'appointment_cancelled', {
      appointmentId,
      scheduledAt: appointment.scheduledAt,
      reason: data.reason,
    });

    logger.info({ appointmentId }, 'Appointment cancelled successfully');
  }

  /**
   * Update appointment status
   *
   * @param appointmentId - UUID of appointment to update
   * @param data - Status update data
   * @returns Promise<Appointment> - Updated appointment
   */
  async updateStatus(
    appointmentId: string,
    data: UpdateAppointmentStatusDTO
  ): Promise<Appointment> {
    logger.info({ appointmentId, newStatus: data.status }, 'Updating appointment status');

    // Find existing appointment
    const appointment = await this.repository.findById(appointmentId);

    if (!appointment) {
      throw new AppError('Appointment not found', 404);
    }

    // Validate status transition
    const validTransitions = VALID_STATUS_TRANSITIONS[appointment.status];

    if (!validTransitions.includes(data.status)) {
      throw new AppError(
        `Invalid status transition from ${appointment.status} to ${data.status}`,
        400
      );
    }

    // Update appointment status
    const updatedAppointment = await this.repository.update(appointmentId, {
      status: data.status,
    });

    // Create audit log
    await this.createAuditLog(appointment.patientId, 'appointment_status_updated', {
      appointmentId,
      oldStatus: appointment.status,
      newStatus: data.status,
    });

    logger.info({ appointmentId, status: data.status }, 'Appointment status updated successfully');

    return updatedAppointment;
  }

  /**
   * Find appointment by ID
   *
   * @param appointmentId - UUID of appointment
   * @returns Promise<Appointment | null> - Appointment or null if not found
   */
  async findById(appointmentId: string): Promise<Appointment | null> {
    return this.repository.findById(appointmentId);
  }

  /**
   * Find all appointments for a patient
   *
   * @param patientId - UUID of patient
   * @returns Promise<Appointment[]> - Array of appointments
   */
  async findByPatientId(patientId: string): Promise<Appointment[]> {
    return this.repository.findByPatientId(patientId);
  }

  /**
   * Create audit log entry
   *
   * Writes to audit_logs table for LGPD compliance
   *
   * @param patientId - UUID of patient
   * @param action - Action type
   * @param payload - JSONB payload with action details
   * @returns Promise<void>
   */
  private async createAuditLog(
    patientId: string,
    action: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    try {
      await this.db('audit_logs').insert({
        patient_id: patientId,
        action,
        payload,
        created_at: new Date(),
      });

      logger.debug({ patientId, action }, 'Audit log created');
    } catch (error) {
      logger.error({ error, patientId, action }, 'Failed to create audit log');
      // Don't throw - audit logging failure should not block business operation
    }
  }
}

// Export singleton instance for production use
export default new AppointmentService();
