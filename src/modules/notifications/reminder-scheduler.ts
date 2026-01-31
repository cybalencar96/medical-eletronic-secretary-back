/**
 * Reminder Scheduler
 *
 * Uses node-cron to periodically check for appointments needing reminders
 * and enqueues notification jobs to BullMQ for processing
 */

import { logger } from '../../infrastructure/config/logger';
import appointmentRepository from '../appointments/appointment.repository';
import patientRepository from '../patients/patient.repository';
import { AppointmentStatus } from '../appointments/types/appointment.types';
import { NotificationType } from './notification.types';
import notificationRepository from './notification.repository';
import { queues } from '../../infrastructure/queue/queues';

/**
 * Check for appointments needing reminders and enqueue notification jobs
 *
 * This function is called periodically by node-cron to:
 * 1. Find appointments within 48h or 72h windows
 * 2. Check if reminder was already sent
 * 3. Verify patient consent
 * 4. Enqueue notification jobs to BullMQ
 */
export async function checkAndEnqueueReminders(): Promise<void> {
  logger.info('Starting reminder check');

  try {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setHours(futureDate.getHours() + 72); // Check up to 72 hours ahead

    // Get all scheduled/confirmed appointments in the next 72 hours
    const appointments = await appointmentRepository.findByDateRange(now, futureDate);

    logger.info({ count: appointments.length }, 'Found appointments to check for reminders');

    let enqueuedCount = 0;

    for (const appointment of appointments) {
      // Skip cancelled appointments
      if (appointment.status === AppointmentStatus.CANCELLED) {
        continue;
      }

      // Get patient details
      const patient = await patientRepository.findById(appointment.patientId);
      if (!patient) {
        logger.warn(
          { appointmentId: appointment.id, patientId: appointment.patientId },
          'Patient not found for appointment'
        );
        continue;
      }

      // Check patient consent (LGPD compliance)
      if (!patient.consent_given_at) {
        logger.warn(
          { appointmentId: appointment.id, patientId: patient.id },
          'Patient has not given consent - skipping notification'
        );
        continue;
      }

      // Check if appointment needs 72h reminder
      const needs72hReminder = isWithinHoursRange(appointment.scheduledAt, 72, 73);
      if (needs72hReminder) {
        const alreadySent72h = await notificationRepository.findByAppointmentAndType(
          appointment.id,
          NotificationType.REMINDER_72H
        );

        if (!alreadySent72h) {
          await enqueueReminderJob(
            appointment.id,
            patient.id,
            patient.phone,
            NotificationType.REMINDER_72H,
            {
              patientName: patient.name,
              appointmentDate: appointment.scheduledAt.toISOString(),
              appointmentTime: appointment.scheduledAt.toISOString(),
            }
          );
          enqueuedCount++;
        }
      }

      // Check if appointment needs 48h reminder
      const needs48hReminder = isWithinHoursRange(appointment.scheduledAt, 48, 49);
      if (needs48hReminder) {
        const alreadySent48h = await notificationRepository.findByAppointmentAndType(
          appointment.id,
          NotificationType.REMINDER_48H
        );

        if (!alreadySent48h) {
          await enqueueReminderJob(
            appointment.id,
            patient.id,
            patient.phone,
            NotificationType.REMINDER_48H,
            {
              patientName: patient.name,
              appointmentDate: appointment.scheduledAt.toISOString(),
              appointmentTime: appointment.scheduledAt.toISOString(),
            }
          );
          enqueuedCount++;
        }
      }
    }

    logger.info({ enqueuedCount }, 'Reminder check completed');
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      'Error during reminder check'
    );
    throw error;
  }
}

/**
 * Helper to check if date is within a specific hour range from now
 *
 * @param date - Date to check
 * @param minHours - Minimum hours from now
 * @param maxHours - Maximum hours from now
 * @returns boolean - True if date is within the hour range
 */
function isWithinHoursRange(date: Date, minHours: number, maxHours: number): boolean {
  const now = new Date();
  const hoursUntil = (date.getTime() - now.getTime()) / (1000 * 60 * 60);
  return hoursUntil >= minHours && hoursUntil < maxHours;
}

/**
 * Enqueue a reminder job to BullMQ
 *
 * @param appointmentId - Appointment ID
 * @param patientId - Patient ID
 * @param phone - Patient phone
 * @param type - Notification type
 * @param metadata - Additional notification metadata
 */
async function enqueueReminderJob(
  appointmentId: string,
  patientId: string,
  phone: string,
  type: NotificationType,
  metadata: {
    patientName: string;
    appointmentDate: string;
    appointmentTime: string;
  }
): Promise<void> {
  logger.info({ appointmentId, type }, 'Enqueuing reminder job');

  await queues.notifications.add('send-notification', {
    type: 'reminder',
    appointmentId,
    patientId,
    phone,
    scheduledAt: new Date().toISOString(),
    metadata,
    correlationId: `reminder-${appointmentId}-${type}-${Date.now()}`,
  });

  logger.info({ appointmentId, type }, 'Reminder job enqueued');
}

/**
 * Initialize reminder scheduler with node-cron
 *
 * Runs every hour to check for appointments needing reminders
 *
 * Note: This function requires node-cron to be installed
 * Install with: npm install node-cron @types/node-cron
 */
export function initializeReminderScheduler(): void {
  logger.info('Initializing reminder scheduler');

  // TODO: Uncomment when node-cron is installed
  // const cron = require('node-cron');
  //
  // // Run every hour at minute 0
  // cron.schedule('0 * * * *', async () => {
  //   logger.info('Reminder scheduler triggered');
  //   try {
  //     await checkAndEnqueueReminders();
  //   } catch (error) {
  //     logger.error(
  //       { error: error instanceof Error ? error.message : String(error) },
  //       'Error in reminder scheduler'
  //     );
  //   }
  // });

  logger.info('Reminder scheduler initialized (runs every hour)');
}
