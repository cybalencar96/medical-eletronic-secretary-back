/**
 * Notification processor tests
 */

import { Job } from 'bullmq';
import { processNotification } from '../../../../../src/infrastructure/queue/processors/notification.processor';
import { NotificationJob } from '../../../../../src/infrastructure/queue/types';
import { AppointmentStatus } from '../../../../../src/modules/appointments/types/appointment.types';

// Mock dependencies
jest.mock('../../../../../src/modules/appointments/appointment.repository');
jest.mock('../../../../../src/modules/patients/patient.repository');
jest.mock('../../../../../src/modules/notifications/notification.service');

import appointmentRepository from '../../../../../src/modules/appointments/appointment.repository';
import patientRepository from '../../../../../src/modules/patients/patient.repository';
import notificationService from '../../../../../src/modules/notifications/notification.service';

describe('Notification Processor', () => {
  let mockJob: Partial<Job<NotificationJob>>;
  const now = new Date();

  beforeEach(() => {
    jest.clearAllMocks();

    mockJob = {
      data: {
        type: 'reminder',
        appointmentId: 'appt-123',
        patientId: 'patient-123',
        phone: '+5511999999999',
        scheduledAt: now.toISOString(),
        metadata: {
          patientName: 'João Silva',
          appointmentDate: 'Sábado, 15/02/2025 às 10:00',
          appointmentTime: '10:00',
        },
        correlationId: 'corr-123',
      },
    };
  });

  it('should process notification job successfully', async () => {
    const mockAppointment = {
      id: 'appt-123',
      patientId: 'patient-123',
      scheduledAt: now,
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

    (appointmentRepository.findById as jest.Mock).mockResolvedValue(mockAppointment);
    (patientRepository.findById as jest.Mock).mockResolvedValue(mockPatient);
    (notificationService.sendNotification as jest.Mock).mockResolvedValue(undefined);

    await processNotification(mockJob as Job<NotificationJob>);

    expect(appointmentRepository.findById).toHaveBeenCalledWith('appt-123');
    expect(patientRepository.findById).toHaveBeenCalledWith('patient-123');
    expect(notificationService.sendNotification).toHaveBeenCalled();
  });

  it('should skip notification if appointment not found', async () => {
    (appointmentRepository.findById as jest.Mock).mockResolvedValue(null);

    await processNotification(mockJob as Job<NotificationJob>);

    expect(patientRepository.findById).not.toHaveBeenCalled();
    expect(notificationService.sendNotification).not.toHaveBeenCalled();
  });

  it('should skip notification if appointment is cancelled', async () => {
    const mockAppointment = {
      id: 'appt-123',
      patientId: 'patient-123',
      scheduledAt: now,
      status: AppointmentStatus.CANCELLED,
      createdAt: now,
      updatedAt: now,
    };

    (appointmentRepository.findById as jest.Mock).mockResolvedValue(mockAppointment);

    await processNotification(mockJob as Job<NotificationJob>);

    expect(patientRepository.findById).not.toHaveBeenCalled();
    expect(notificationService.sendNotification).not.toHaveBeenCalled();
  });

  it('should skip notification if patient not found', async () => {
    const mockAppointment = {
      id: 'appt-123',
      patientId: 'patient-123',
      scheduledAt: now,
      status: AppointmentStatus.SCHEDULED,
      createdAt: now,
      updatedAt: now,
    };

    (appointmentRepository.findById as jest.Mock).mockResolvedValue(mockAppointment);
    (patientRepository.findById as jest.Mock).mockResolvedValue(null);

    await processNotification(mockJob as Job<NotificationJob>);

    expect(notificationService.sendNotification).not.toHaveBeenCalled();
  });

  it('should skip notification if patient has no consent', async () => {
    const mockAppointment = {
      id: 'appt-123',
      patientId: 'patient-123',
      scheduledAt: now,
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

    (appointmentRepository.findById as jest.Mock).mockResolvedValue(mockAppointment);
    (patientRepository.findById as jest.Mock).mockResolvedValue(mockPatient);

    await processNotification(mockJob as Job<NotificationJob>);

    expect(notificationService.sendNotification).not.toHaveBeenCalled();
  });

  it('should throw error if notification sending fails', async () => {
    const mockAppointment = {
      id: 'appt-123',
      patientId: 'patient-123',
      scheduledAt: now,
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

    (appointmentRepository.findById as jest.Mock).mockResolvedValue(mockAppointment);
    (patientRepository.findById as jest.Mock).mockResolvedValue(mockPatient);
    (notificationService.sendNotification as jest.Mock).mockRejectedValue(
      new Error('WhatsApp API error')
    );

    await expect(processNotification(mockJob as Job<NotificationJob>)).rejects.toThrow(
      'WhatsApp API error'
    );
  });
});
