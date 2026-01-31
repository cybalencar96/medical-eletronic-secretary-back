/**
 * Reminder scheduler tests
 */

import { checkAndEnqueueReminders } from '../../../../src/modules/notifications/reminder-scheduler';

// Mock dependencies
jest.mock('../../../../src/modules/appointments/appointment.repository');
jest.mock('../../../../src/modules/patients/patient.repository');
jest.mock('../../../../src/modules/notifications/notification.repository');
jest.mock('../../../../src/infrastructure/queue/queues');

import appointmentRepository from '../../../../src/modules/appointments/appointment.repository';
import patientRepository from '../../../../src/modules/patients/patient.repository';
import notificationRepository from '../../../../src/modules/notifications/notification.repository';
import { queues } from '../../../../src/infrastructure/queue/queues';
import { AppointmentStatus } from '../../../../src/modules/appointments/types/appointment.types';

describe('Reminder Scheduler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkAndEnqueueReminders', () => {
    it('should enqueue 48h reminder for eligible appointment', async () => {
      const now = new Date();
      const futureDate = new Date(now.getTime() + 48.5 * 60 * 60 * 1000); // 48.5 hours from now

      const mockAppointment = {
        id: 'appt-123',
        patientId: 'patient-123',
        scheduledAt: futureDate,
        status: AppointmentStatus.SCHEDULED,
        createdAt: now,
        updatedAt: now,
      };

      const mockPatient = {
        id: 'patient-123',
        phone: '+5511999999999',
        cpf: '12345678901',
        name: 'João Silva',
        created_at: now,
        consent_given_at: now,
      };

      (appointmentRepository.findByDateRange as jest.Mock).mockResolvedValue([mockAppointment]);
      (patientRepository.findById as jest.Mock).mockResolvedValue(mockPatient);
      (notificationRepository.findByAppointmentAndType as jest.Mock).mockResolvedValue(null);
      (queues.notifications.add as jest.Mock) = jest.fn().mockResolvedValue(undefined);

      await checkAndEnqueueReminders();

      expect(queues.notifications.add).toHaveBeenCalled();
    });

    it('should skip cancelled appointments', async () => {
      const now = new Date();
      const futureDate = new Date(now.getTime() + 48.5 * 60 * 60 * 1000);

      const mockAppointment = {
        id: 'appt-123',
        patientId: 'patient-123',
        scheduledAt: futureDate,
        status: AppointmentStatus.CANCELLED,
        createdAt: now,
        updatedAt: now,
      };

      (appointmentRepository.findByDateRange as jest.Mock).mockResolvedValue([mockAppointment]);

      await checkAndEnqueueReminders();

      expect(patientRepository.findById).not.toHaveBeenCalled();
      expect(queues.notifications.add).not.toHaveBeenCalled();
    });

    it('should skip patients without consent', async () => {
      const now = new Date();
      const futureDate = new Date(now.getTime() + 48.5 * 60 * 60 * 1000);

      const mockAppointment = {
        id: 'appt-123',
        patientId: 'patient-123',
        scheduledAt: futureDate,
        status: AppointmentStatus.SCHEDULED,
        createdAt: now,
        updatedAt: now,
      };

      const mockPatient = {
        id: 'patient-123',
        phone: '+5511999999999',
        cpf: '12345678901',
        name: 'João Silva',
        created_at: now,
        consent_given_at: null,
      };

      (appointmentRepository.findByDateRange as jest.Mock).mockResolvedValue([mockAppointment]);
      (patientRepository.findById as jest.Mock).mockResolvedValue(mockPatient);

      await checkAndEnqueueReminders();

      expect(queues.notifications.add).not.toHaveBeenCalled();
    });

    it('should not enqueue duplicate reminders', async () => {
      const now = new Date();
      const futureDate = new Date(now.getTime() + 48.5 * 60 * 60 * 1000);

      const mockAppointment = {
        id: 'appt-123',
        patientId: 'patient-123',
        scheduledAt: futureDate,
        status: AppointmentStatus.SCHEDULED,
        createdAt: now,
        updatedAt: now,
      };

      const mockPatient = {
        id: 'patient-123',
        phone: '+5511999999999',
        cpf: '12345678901',
        name: 'João Silva',
        created_at: now,
        consent_given_at: now,
      };

      const mockNotification = {
        id: 'notif-123',
        appointmentId: 'appt-123',
        type: 'reminder_48h',
        sentAt: now,
      };

      (appointmentRepository.findByDateRange as jest.Mock).mockResolvedValue([mockAppointment]);
      (patientRepository.findById as jest.Mock).mockResolvedValue(mockPatient);
      (notificationRepository.findByAppointmentAndType as jest.Mock).mockResolvedValue(
        mockNotification
      );

      await checkAndEnqueueReminders();

      expect(queues.notifications.add).not.toHaveBeenCalled();
    });
  });
});
