/**
 * Notification queue processor
 *
 * Processes notification jobs from BullMQ queue
 * Sends appointment reminders and alerts via WhatsApp
 */

import { Job } from 'bullmq';
import { logger } from '../../config/logger';
import { NotificationJob } from '../types';
import notificationService from '../../../modules/notifications/notification.service';
import { NotificationType } from '../../../modules/notifications/notification.types';
import appointmentRepository from '../../../modules/appointments/appointment.repository';
import patientRepository from '../../../modules/patients/patient.repository';
import { createTemplateData } from '../../../modules/notifications/notification.service';
import { AppointmentStatus } from '../../../modules/appointments/types/appointment.types';

/**
 * Process notification job
 *
 * Workflow:
 * 1. Fetch appointment and patient details
 * 2. Verify patient consent (LGPD compliance)
 * 3. Check appointment status (skip if cancelled)
 * 4. Render message template with appointment data
 * 5. Send notification via WhatsApp
 * 6. Record sent notification to prevent duplicates
 *
 * @param job - BullMQ notification job
 */
export async function processNotification(job: Job<NotificationJob>): Promise<void> {
  const { type, appointmentId, patientId, phone, metadata, correlationId } = job.data;

  logger.info(
    {
      correlationId,
      appointmentId,
      patientId,
      type,
    },
    'Processing notification job'
  );

  try {
    // Fetch appointment details
    const appointment = await appointmentRepository.findById(appointmentId);
    if (!appointment) {
      logger.warn(
        { correlationId, appointmentId },
        'Appointment not found - skipping notification'
      );
      return;
    }

    // Check if appointment is cancelled
    if (appointment.status === AppointmentStatus.CANCELLED) {
      logger.info(
        { correlationId, appointmentId },
        'Appointment is cancelled - skipping notification'
      );
      return;
    }

    // Fetch patient details
    const patient = await patientRepository.findById(patientId);
    if (!patient) {
      logger.warn({ correlationId, patientId }, 'Patient not found - skipping notification');
      return;
    }

    // Verify patient consent (LGPD compliance)
    if (!patient.consent_given_at) {
      logger.warn(
        { correlationId, patientId },
        'Patient has not given consent - skipping notification per LGPD'
      );
      return;
    }

    // Map job type to NotificationType enum
    const notificationType = mapJobTypeToNotificationType(type);

    // Create template data
    const templateData = createTemplateData(
      metadata.patientName || patient.name,
      appointment.scheduledAt,
      metadata.doctorName,
      metadata.doctorName,
      metadata.reason
    );

    // Send notification
    await notificationService.sendNotification(
      appointmentId,
      phone,
      notificationType,
      templateData
    );

    logger.info(
      {
        correlationId,
        appointmentId,
        type,
      },
      'Notification processed successfully'
    );
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        correlationId,
        appointmentId,
        type,
      },
      'Failed to process notification job'
    );
    throw error; // Re-throw to trigger BullMQ retry
  }
}

/**
 * Map job type string to NotificationType enum
 *
 * @param type - Job type from NotificationJob
 * @returns NotificationType - Mapped enum value
 */
function mapJobTypeToNotificationType(
  type: 'reminder' | 'confirmation' | 'cancellation' | 'doctor_alert'
): NotificationType {
  switch (type) {
    case 'reminder':
      // Default to 48h reminder (will be determined by job metadata)
      return NotificationType.REMINDER_48H;
    case 'confirmation':
      return NotificationType.CONFIRMATION;
    case 'cancellation':
      return NotificationType.CANCELLATION;
    case 'doctor_alert':
      return NotificationType.DOCTOR_ALERT;
    default: {
      const exhaustiveCheck: never = type;
      throw new Error(`Unknown notification type: ${String(exhaustiveCheck)}`);
    }
  }
}
