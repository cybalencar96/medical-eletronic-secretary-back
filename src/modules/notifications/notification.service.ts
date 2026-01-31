/**
 * Notification Service
 *
 * Business logic for sending appointment notifications via WhatsApp
 * Handles template rendering, duplicate prevention, and consent verification
 */

import { logger } from '../../infrastructure/config/logger';
import { AppError } from '../../shared/errors/AppError';
import {
  IMessageSenderService,
  messageSenderService,
} from '../whatsapp/services/message-sender.service';
import { INotificationRepository } from './notification.repository';
import notificationRepository from './notification.repository';
import {
  INotificationService,
  NotificationType,
  NotificationTemplateData,
} from './notification.types';
import { getTemplate } from './templates';
import { formatBrazilianDate } from './utils/date-formatter';

/**
 * NotificationService class
 *
 * Implements notification sending logic with:
 * - Template-based message rendering
 * - Duplicate notification prevention
 * - WhatsApp integration
 * - Doctor alert functionality
 */
export class NotificationService implements INotificationService {
  constructor(
    private readonly repository: INotificationRepository = notificationRepository,
    private readonly messageSender: IMessageSenderService = messageSenderService
  ) {}

  /**
   * Send a notification to a patient
   *
   * Renders message template, sends via WhatsApp, and records in database
   *
   * @param appointmentId - UUID of appointment
   * @param patientPhone - Patient phone number in E.164 format
   * @param type - Notification type
   * @param templateData - Data for template rendering
   * @throws AppError if notification fails to send
   */
  async sendNotification(
    appointmentId: string,
    patientPhone: string,
    type: NotificationType,
    templateData: NotificationTemplateData
  ): Promise<void> {
    logger.info({ appointmentId, type }, 'Sending notification');

    // Check if notification was already sent
    const alreadySent = await this.wasNotificationSent(appointmentId, type);
    if (alreadySent) {
      logger.warn({ appointmentId, type }, 'Notification already sent - skipping duplicate');
      return;
    }

    // Get template and render message
    const template = getTemplate(type);
    const message = template.render(templateData);

    // Send via WhatsApp
    const result = await this.messageSender.sendTextMessage(patientPhone, message);

    if (!result.success) {
      logger.error(
        { appointmentId, type, error: result.error },
        'Failed to send notification via WhatsApp'
      );
      throw new AppError(result.error || 'Failed to send notification', result.errorCode || 500);
    }

    // Record sent notification to prevent duplicates
    await this.repository.create(appointmentId, type);

    logger.info(
      { appointmentId, type, messageId: result.messageId },
      'Notification sent successfully'
    );
  }

  /**
   * Check if a notification was already sent
   *
   * @param appointmentId - UUID of appointment
   * @param type - Notification type
   * @returns Promise<boolean> - True if notification was sent
   */
  async wasNotificationSent(appointmentId: string, type: NotificationType): Promise<boolean> {
    const notification = await this.repository.findByAppointmentAndType(appointmentId, type);
    return notification !== null;
  }

  /**
   * Send a doctor alert
   *
   * Sends urgent alert to configured doctor phone number
   *
   * @param doctorPhone - Doctor's phone number to send alert to
   * @param message - Alert message
   * @param escalationDetails - Details about the escalation
   */
  async sendDoctorAlert(
    doctorPhone: string,
    message: string,
    escalationDetails: string
  ): Promise<void> {
    logger.info('Sending doctor alert');

    if (!doctorPhone) {
      logger.warn('Doctor phone number not provided - skipping doctor alert');
      return;
    }

    // Render doctor alert template
    const template = getTemplate(NotificationType.DOCTOR_ALERT);
    const alertMessage = template.render({
      patientName: message,
      appointmentDate: new Date().toISOString(),
      appointmentTime: new Date().toISOString(),
      escalationReason: escalationDetails,
    });

    // Send alert
    const result = await this.messageSender.sendTextMessage(doctorPhone, alertMessage);

    if (!result.success) {
      logger.error({ error: result.error }, 'Failed to send doctor alert');
      throw new AppError(result.error || 'Failed to send doctor alert', result.errorCode || 500);
    }

    logger.info({ messageId: result.messageId }, 'Doctor alert sent successfully');
  }
}

/**
 * Helper function to create notification template data from appointment
 *
 * @param patientName - Patient name
 * @param appointmentDate - Appointment date
 * @param clinicName - Clinic name (optional)
 * @param doctorName - Doctor name (optional)
 * @param reason - Cancellation reason (optional)
 * @returns NotificationTemplateData - Template data object
 */
export function createTemplateData(
  patientName: string,
  appointmentDate: Date,
  clinicName?: string,
  doctorName?: string,
  reason?: string
): NotificationTemplateData {
  return {
    patientName,
    appointmentDate: formatBrazilianDate(appointmentDate),
    appointmentTime: appointmentDate.toISOString(),
    clinicName,
    doctorName,
    reason,
  };
}

// Export singleton instance for production use
export default new NotificationService();
