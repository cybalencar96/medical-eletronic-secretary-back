/**
 * Notification repository implementation
 *
 * Data access layer for notifications_sent table using Knex.js
 * Tracks sent notifications to prevent duplicates
 */

import { Knex } from 'knex';
import { NotificationSent, NotificationType } from './notification.types';
import db from '../../infrastructure/database/connection';
import { logger } from '../../infrastructure/config/logger';

const TABLE_NAME = 'notifications_sent';

/**
 * Database row type for notifications_sent table
 */
interface NotificationRow {
  id: string;
  appointment_id: string;
  type: string;
  sent_at: Date;
}

/**
 * Map database row to NotificationSent entity
 *
 * Converts snake_case database columns to camelCase entity properties
 *
 * @param row - Database row
 * @returns NotificationSent - Mapped entity
 */
function mapToEntity(row: NotificationRow): NotificationSent {
  return {
    id: row.id,
    appointmentId: row.appointment_id,
    type: row.type as NotificationType,
    sentAt: new Date(row.sent_at),
  };
}

/**
 * Notification repository interface
 */
export interface INotificationRepository {
  create(appointmentId: string, type: NotificationType): Promise<NotificationSent>;
  findByAppointmentAndType(
    appointmentId: string,
    type: NotificationType
  ): Promise<NotificationSent | null>;
  findByAppointmentId(appointmentId: string): Promise<NotificationSent[]>;
}

/**
 * NotificationRepository class
 *
 * Implements data access operations for notifications_sent table
 * Uses Knex.js for database queries with PostgreSQL
 */
export class NotificationRepository implements INotificationRepository {
  private db: Knex;

  constructor(database: Knex = db) {
    this.db = database;
  }

  /**
   * Create new notification record
   *
   * @param appointmentId - UUID of appointment
   * @param type - Type of notification sent
   * @returns Promise<NotificationSent> - Created notification record
   */
  async create(appointmentId: string, type: NotificationType): Promise<NotificationSent> {
    logger.info({ appointmentId, type }, 'Recording sent notification');

    const [row] = (await this.db(TABLE_NAME)
      .insert({
        appointment_id: appointmentId,
        type,
      })
      .returning('*')) as NotificationRow[];

    const notification = mapToEntity(row);
    logger.info({ notificationId: notification.id }, 'Notification recorded successfully');

    return notification;
  }

  /**
   * Find notification by appointment and type
   *
   * Check if a specific notification type was already sent for an appointment
   *
   * @param appointmentId - UUID of appointment
   * @param type - Type of notification
   * @returns Promise<NotificationSent | null> - Notification or null if not sent
   */
  async findByAppointmentAndType(
    appointmentId: string,
    type: NotificationType
  ): Promise<NotificationSent | null> {
    logger.debug({ appointmentId, type }, 'Checking if notification was sent');

    const row = (await this.db(TABLE_NAME)
      .where({ appointment_id: appointmentId, type })
      .first()) as NotificationRow | undefined;

    if (!row) {
      logger.debug({ appointmentId, type }, 'Notification not found');
      return null;
    }

    return mapToEntity(row);
  }

  /**
   * Find all notifications for an appointment
   *
   * @param appointmentId - UUID of appointment
   * @returns Promise<NotificationSent[]> - Array of notifications ordered by sent_at DESC
   */
  async findByAppointmentId(appointmentId: string): Promise<NotificationSent[]> {
    logger.debug({ appointmentId }, 'Finding notifications by appointment ID');

    const rows = (await this.db(TABLE_NAME)
      .where({ appointment_id: appointmentId })
      .orderBy('sent_at', 'desc')) as NotificationRow[];

    logger.debug({ appointmentId, count: rows.length }, 'Found notifications');

    return rows.map(mapToEntity);
  }
}

// Export singleton instance for production use
export default new NotificationRepository();
