/**
 * Notification module types and interfaces
 */

/**
 * Notification types supported by the system
 */
export enum NotificationType {
  REMINDER_48H = 'reminder_48h',
  REMINDER_72H = 'reminder_72h',
  CONFIRMATION = 'confirmation',
  CANCELLATION = 'cancellation',
  DOCTOR_ALERT = 'doctor_alert',
}

/**
 * Notification record in the database
 */
export interface NotificationSent {
  id: string;
  appointmentId: string;
  type: NotificationType;
  sentAt: Date;
}

/**
 * Template data for rendering notification messages
 */
export interface NotificationTemplateData {
  patientName: string;
  appointmentDate: string; // Formatted as "Saturday, DD/MM/YYYY at HH:MM"
  appointmentTime: string;
  clinicName?: string;
  doctorName?: string;
  reason?: string;
  escalationReason?: string;
}

/**
 * Notification service interface
 */
export interface INotificationService {
  /**
   * Send a notification to a patient
   */
  sendNotification(
    appointmentId: string,
    patientPhone: string,
    type: NotificationType,
    templateData: NotificationTemplateData
  ): Promise<void>;

  /**
   * Check if a notification was already sent
   */
  wasNotificationSent(appointmentId: string, type: NotificationType): Promise<boolean>;

  /**
   * Send a doctor alert
   */
  sendDoctorAlert(doctorPhone: string, message: string, escalationDetails: string): Promise<void>;
}

/**
 * Message template interface
 */
export interface IMessageTemplate {
  /**
   * Render the template with the provided data
   */
  render(data: NotificationTemplateData): string;
}
