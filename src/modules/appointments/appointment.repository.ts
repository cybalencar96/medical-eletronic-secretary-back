/**
 * Appointment repository implementation
 *
 * Data access layer for appointments table using Knex.js
 * Implements IAppointmentRepository interface
 */

import { Knex } from 'knex';
import { IAppointmentRepository } from './interfaces/appointment-repository.interface';
import {
  Appointment,
  CreateAppointmentDTO,
  TimeSlot,
  AppointmentStatus,
} from './types/appointment.types';
import db from '../../infrastructure/database/connection';
import { logger } from '../../infrastructure/config/logger';

const TABLE_NAME = 'appointments';

/**
 * Database row type for appointments table
 */
interface AppointmentRow {
  id: string;
  patient_id: string;
  scheduled_at: Date;
  status: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Map database row to Appointment entity
 *
 * Converts snake_case database columns to camelCase entity properties
 *
 * @param row - Database row
 * @returns Appointment - Mapped entity
 */
function mapToEntity(row: AppointmentRow): Appointment {
  return {
    id: row.id,
    patientId: row.patient_id,
    scheduledAt: new Date(row.scheduled_at),
    status: row.status as AppointmentStatus,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * AppointmentRepository class
 *
 * Implements data access operations for appointments table
 * Uses Knex.js for database queries with PostgreSQL
 */
export class AppointmentRepository implements IAppointmentRepository {
  private db: Knex;

  constructor(database: Knex = db) {
    this.db = database;
  }

  /**
   * Create new appointment
   *
   * @param data - Appointment creation data
   * @returns Promise<Appointment> - Created appointment
   */
  async create(data: CreateAppointmentDTO): Promise<Appointment> {
    logger.info({ patientId: data.patientId }, 'Creating appointment');

    const [row] = (await this.db(TABLE_NAME)
      .insert({
        patient_id: data.patientId,
        scheduled_at: data.scheduledAt,
        status: AppointmentStatus.SCHEDULED,
      })
      .returning('*')) as AppointmentRow[];

    const appointment = mapToEntity(row);
    logger.info({ appointmentId: appointment.id }, 'Appointment created successfully');

    return appointment;
  }

  /**
   * Find appointment by ID
   *
   * @param id - UUID of appointment
   * @returns Promise<Appointment | null> - Appointment or null if not found
   */
  async findById(id: string): Promise<Appointment | null> {
    logger.debug({ appointmentId: id }, 'Finding appointment by ID');

    const row = (await this.db(TABLE_NAME).where({ id }).first()) as AppointmentRow | undefined;

    if (!row) {
      logger.debug({ appointmentId: id }, 'Appointment not found');
      return null;
    }

    return mapToEntity(row);
  }

  /**
   * Find all appointments for a patient
   *
   * @param patientId - UUID of patient
   * @returns Promise<Appointment[]> - Array of appointments ordered by scheduled_at DESC
   */
  async findByPatientId(patientId: string): Promise<Appointment[]> {
    logger.debug({ patientId }, 'Finding appointments by patient ID');

    const rows = (await this.db(TABLE_NAME)
      .where({ patient_id: patientId })
      .orderBy('scheduled_at', 'desc')) as AppointmentRow[];

    logger.debug({ patientId, count: rows.length }, 'Found appointments');

    return rows.map(mapToEntity);
  }

  /**
   * Find appointment by time slot
   *
   * Checks if any active (non-cancelled) appointment exists for the given time slot
   * Used for double-booking prevention
   *
   * @param slot - Time slot to check
   * @returns Promise<Appointment | null> - Appointment in slot or null if available
   */
  async findBySlot(slot: TimeSlot): Promise<Appointment | null> {
    logger.debug(
      { startTime: slot.startTime, endTime: slot.endTime },
      'Finding appointment by slot'
    );

    const row = (await this.db(TABLE_NAME)
      .where('scheduled_at', '>=', slot.startTime)
      .where('scheduled_at', '<', slot.endTime)
      .whereNotIn('status', [AppointmentStatus.CANCELLED])
      .first()) as AppointmentRow | undefined;

    if (!row) {
      logger.debug('Slot is available');
      return null;
    }

    logger.debug({ appointmentId: row.id }, 'Slot already booked');
    return mapToEntity(row);
  }

  /**
   * Find all appointments on a given date
   *
   * Returns all appointments scheduled for the date (any status)
   * Used for availability calculation
   *
   * @param date - Date to query
   * @returns Promise<Appointment[]> - Array of appointments on date
   */
  async findByDate(date: Date): Promise<Appointment[]> {
    logger.debug({ date }, 'Finding appointments by date');

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const rows = (await this.db(TABLE_NAME)
      .where('scheduled_at', '>=', startOfDay)
      .where('scheduled_at', '<=', endOfDay)
      .whereNotIn('status', [AppointmentStatus.CANCELLED])
      .orderBy('scheduled_at', 'asc')) as AppointmentRow[];

    logger.debug({ date, count: rows.length }, 'Found appointments on date');

    return rows.map(mapToEntity);
  }

  /**
   * Find all appointments within a date range
   *
   * Returns all appointments scheduled between start and end dates
   * Used for reminder scheduling
   *
   * @param startDate - Start date of range
   * @param endDate - End date of range
   * @returns Promise<Appointment[]> - Array of appointments in range
   */
  async findByDateRange(startDate: Date, endDate: Date): Promise<Appointment[]> {
    logger.debug({ startDate, endDate }, 'Finding appointments by date range');

    const rows = (await this.db(TABLE_NAME)
      .where('scheduled_at', '>=', startDate)
      .where('scheduled_at', '<=', endDate)
      .orderBy('scheduled_at', 'asc')) as AppointmentRow[];

    logger.debug({ startDate, endDate, count: rows.length }, 'Found appointments in date range');

    return rows.map(mapToEntity);
  }

  /**
   * Update appointment
   *
   * @param id - UUID of appointment to update
   * @param data - Partial appointment data to update
   * @returns Promise<Appointment> - Updated appointment
   * @throws Error if appointment not found
   */
  async update(id: string, data: Partial<Appointment>): Promise<Appointment> {
    logger.info({ appointmentId: id }, 'Updating appointment');

    const updateData: Partial<AppointmentRow> = {};

    if (data.scheduledAt !== undefined) {
      updateData.scheduled_at = data.scheduledAt;
    }

    if (data.status !== undefined) {
      updateData.status = data.status;
    }

    // Always update updated_at timestamp
    updateData.updated_at = new Date();

    const [row] = (await this.db(TABLE_NAME)
      .where({ id })
      .update(updateData)
      .returning('*')) as AppointmentRow[];

    if (!row) {
      logger.error({ appointmentId: id }, 'Appointment not found for update');
      throw new Error(`Appointment with ID ${id} not found`);
    }

    const appointment = mapToEntity(row);
    logger.info({ appointmentId: id }, 'Appointment updated successfully');

    return appointment;
  }

  /**
   * Delete appointment (soft delete by setting status to cancelled)
   *
   * @param id - UUID of appointment to delete
   * @returns Promise<void>
   */
  async delete(id: string): Promise<void> {
    logger.info({ appointmentId: id }, 'Deleting appointment');

    await this.db(TABLE_NAME).where({ id }).update({
      status: AppointmentStatus.CANCELLED,
      updated_at: new Date(),
    });

    logger.info({ appointmentId: id }, 'Appointment deleted successfully');
  }
}

// Export singleton instance for production use
export default new AppointmentRepository();
