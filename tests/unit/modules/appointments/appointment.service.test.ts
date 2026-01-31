/**
 * Unit tests for AppointmentService
 *
 * Tests business logic with mocked repository and patient service
 */

import { AppointmentService } from '../../../../src/modules/appointments/appointment.service';
import { IAppointmentRepository } from '../../../../src/modules/appointments/interfaces/appointment-repository.interface';
import { PatientService } from '../../../../src/modules/patients/patient.service';
import {
  Appointment,
  AppointmentStatus,
} from '../../../../src/modules/appointments/types/appointment.types';
import { Patient } from '../../../../src/modules/patients/interfaces/patient.interface';
import { AppError } from '../../../../src/shared/errors/AppError';

describe('AppointmentService', () => {
  let service: AppointmentService;
  let mockRepository: jest.Mocked<IAppointmentRepository>;
  let mockPatientService: jest.Mocked<PatientService>;
  let mockDb: any;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2024, 0, 1, 0, 0, 0)); // Jan 1, 2024 00:00

    // Mock repository
    mockRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByPatientId: jest.fn(),
      findBySlot: jest.fn(),
      findByDate: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as jest.Mocked<IAppointmentRepository>;

    // Mock patient service
    mockPatientService = {
      registerPatient: jest.fn(),
      updateConsent: jest.fn(),
      findPatientById: jest.fn(),
      findPatientByCpf: jest.fn(),
      findPatientByPhone: jest.fn(),
      delete: jest.fn(),
    } as any;

    // Mock database
    mockDb = jest.fn(() => ({
      insert: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([]),
    }));

    service = new AppointmentService(mockRepository, mockPatientService, mockDb as any);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('checkAvailability', () => {
    it('should return 4 available slots for Saturday with no bookings', async () => {
      const saturday = new Date(2024, 0, 6); // Jan 6, 2024 (Saturday)
      mockRepository.findByDate.mockResolvedValue([]);

      const slots = await service.checkAvailability(saturday);

      expect(slots).toHaveLength(4);
      expect(slots[0].startTime.getHours()).toBe(9);
      expect(slots[3].endTime.getHours()).toBe(17);
      expect(mockRepository.findByDate).toHaveBeenCalledWith(saturday);
    });

    it('should return empty array for Sunday', async () => {
      const sunday = new Date(2024, 0, 7); // Jan 7, 2024 (Sunday)

      const slots = await service.checkAvailability(sunday);

      expect(slots).toHaveLength(0);
      expect(mockRepository.findByDate).not.toHaveBeenCalled();
    });

    it('should exclude booked slots from availability', async () => {
      const saturday = new Date(2024, 0, 6); // Jan 6, 2024 (Saturday)
      const bookedAppointment: Appointment = {
        id: '123',
        patientId: 'patient-1',
        scheduledAt: new Date(2024, 0, 6, 9, 0), // 09:00-11:00 slot booked
        status: AppointmentStatus.SCHEDULED,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findByDate.mockResolvedValue([bookedAppointment]);

      const slots = await service.checkAvailability(saturday);

      expect(slots).toHaveLength(3); // 4 total slots - 1 booked = 3 available
      expect(slots.every((slot) => slot.startTime.getHours() !== 9)).toBe(true);
    });

    it('should return empty array for Brazilian holiday', async () => {
      const christmas = new Date(2021, 11, 25); // Dec 25, 2021 (Saturday, but Christmas)

      const slots = await service.checkAvailability(christmas);

      expect(slots).toHaveLength(0);
    });
  });

  describe('book', () => {
    const validPatient: Patient = {
      id: 'patient-1',
      name: 'John Doe',
      cpf: '12345678900',
      phone: '+5511999999999',
      consent_given_at: new Date(2024, 0, 1),
      created_at: new Date(),
    };

    it('should successfully book appointment for valid slot', async () => {
      const scheduledAt = new Date(2024, 0, 6, 9, 0); // Saturday 09:00
      const createdAppointment: Appointment = {
        id: 'appointment-1',
        patientId: 'patient-1',
        scheduledAt,
        status: AppointmentStatus.SCHEDULED,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPatientService.findPatientById.mockResolvedValue(validPatient);
      mockRepository.findBySlot.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(createdAppointment);

      const result = await service.book({ patientId: 'patient-1', scheduledAt });

      expect(result).toEqual(createdAppointment);
      expect(mockPatientService.findPatientById).toHaveBeenCalledWith('patient-1');
      expect(mockRepository.findBySlot).toHaveBeenCalled();
      expect(mockRepository.create).toHaveBeenCalledWith({
        patientId: 'patient-1',
        scheduledAt,
      });
    });

    it('should reject booking if patient not found', async () => {
      const scheduledAt = new Date(2024, 0, 6, 9, 0);
      mockPatientService.findPatientById.mockRejectedValue(new AppError('Patient not found', 404));

      await expect(service.book({ patientId: 'invalid', scheduledAt })).rejects.toThrow(AppError);
      await expect(service.book({ patientId: 'invalid', scheduledAt })).rejects.toThrow(
        'Patient not found',
      );
    });

    it('should reject booking if patient has not given consent', async () => {
      const scheduledAt = new Date(2024, 0, 6, 9, 0);
      const patientWithoutConsent: Patient = {
        ...validPatient,
        consent_given_at: null,
      };

      mockPatientService.findPatientById.mockResolvedValue(patientWithoutConsent);

      await expect(
        service.book({ patientId: 'patient-1', scheduledAt }),
      ).rejects.toThrow(AppError);
      await expect(service.book({ patientId: 'patient-1', scheduledAt })).rejects.toThrow(
        'not given consent',
      );
    });

    it('should reject booking for invalid time slot (Sunday)', async () => {
      const scheduledAt = new Date(2024, 0, 7, 9, 0); // Sunday
      mockPatientService.findPatientById.mockResolvedValue(validPatient);

      await expect(
        service.book({ patientId: 'patient-1', scheduledAt }),
      ).rejects.toThrow(AppError);
      await expect(service.book({ patientId: 'patient-1', scheduledAt })).rejects.toThrow(
        'Invalid time slot',
      );
    });

    it('should reject booking if slot already booked (double-booking prevention)', async () => {
      const scheduledAt = new Date(2024, 0, 6, 9, 0);
      const existingAppointment: Appointment = {
        id: 'existing-1',
        patientId: 'other-patient',
        scheduledAt,
        status: AppointmentStatus.SCHEDULED,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPatientService.findPatientById.mockResolvedValue(validPatient);
      mockRepository.findBySlot.mockResolvedValue(existingAppointment);

      await expect(
        service.book({ patientId: 'patient-1', scheduledAt }),
      ).rejects.toThrow(AppError);
      await expect(service.book({ patientId: 'patient-1', scheduledAt })).rejects.toThrow(
        'Slot already booked',
      );
    });

    it('should reject booking for past date', async () => {
      jest.setSystemTime(new Date(2024, 0, 15, 0, 0, 0)); // Jan 15, 2024
      const scheduledAt = new Date(2024, 0, 6, 9, 0); // Jan 6, 2024 (past)
      mockPatientService.findPatientById.mockResolvedValue(validPatient);

      await expect(
        service.book({ patientId: 'patient-1', scheduledAt }),
      ).rejects.toThrow(AppError);
    });

    it('should reject booking outside operating hours (17:00-19:00)', async () => {
      const scheduledAt = new Date(2024, 0, 6, 17, 0); // Saturday 17:00 (invalid)
      mockPatientService.findPatientById.mockResolvedValue(validPatient);

      await expect(
        service.book({ patientId: 'patient-1', scheduledAt }),
      ).rejects.toThrow(AppError);
    });
  });

  describe('reschedule', () => {
    const existingAppointment: Appointment = {
      id: 'appointment-1',
      patientId: 'patient-1',
      scheduledAt: new Date(2024, 0, 6, 9, 0), // Saturday 09:00
      status: AppointmentStatus.SCHEDULED,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should successfully reschedule appointment to new valid slot', async () => {
      const newScheduledAt = new Date(2024, 0, 6, 11, 0); // Saturday 11:00
      const updatedAppointment: Appointment = {
        ...existingAppointment,
        scheduledAt: newScheduledAt,
      };

      mockRepository.findById.mockResolvedValue(existingAppointment);
      mockRepository.findBySlot.mockResolvedValue(null);
      mockRepository.update.mockResolvedValue(updatedAppointment);

      const result = await service.reschedule('appointment-1', { scheduledAt: newScheduledAt });

      expect(result.scheduledAt).toEqual(newScheduledAt);
      expect(mockRepository.update).toHaveBeenCalledWith('appointment-1', {
        scheduledAt: newScheduledAt,
      });
    });

    it('should reject rescheduling if appointment not found', async () => {
      const newScheduledAt = new Date(2024, 0, 6, 11, 0);
      mockRepository.findById.mockResolvedValue(null);

      await expect(
        service.reschedule('invalid-id', { scheduledAt: newScheduledAt }),
      ).rejects.toThrow(AppError);
      await expect(
        service.reschedule('invalid-id', { scheduledAt: newScheduledAt }),
      ).rejects.toThrow('Appointment not found');
    });

    it('should reject rescheduling cancelled appointment', async () => {
      const cancelledAppointment: Appointment = {
        ...existingAppointment,
        status: AppointmentStatus.CANCELLED,
      };
      const newScheduledAt = new Date(2024, 0, 6, 11, 0);

      mockRepository.findById.mockResolvedValue(cancelledAppointment);

      await expect(
        service.reschedule('appointment-1', { scheduledAt: newScheduledAt }),
      ).rejects.toThrow(AppError);
      await expect(
        service.reschedule('appointment-1', { scheduledAt: newScheduledAt }),
      ).rejects.toThrow('Cannot reschedule cancelled');
    });

    it('should reject rescheduling to invalid slot (Sunday)', async () => {
      const newScheduledAt = new Date(2024, 0, 7, 9, 0); // Sunday
      mockRepository.findById.mockResolvedValue(existingAppointment);

      await expect(
        service.reschedule('appointment-1', { scheduledAt: newScheduledAt }),
      ).rejects.toThrow(AppError);
    });

    it('should reject rescheduling if new slot already booked', async () => {
      const newScheduledAt = new Date(2024, 0, 6, 11, 0);
      const conflictingAppointment: Appointment = {
        id: 'other-appointment',
        patientId: 'other-patient',
        scheduledAt: newScheduledAt,
        status: AppointmentStatus.SCHEDULED,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findById.mockResolvedValue(existingAppointment);
      mockRepository.findBySlot.mockResolvedValue(conflictingAppointment);

      await expect(
        service.reschedule('appointment-1', { scheduledAt: newScheduledAt }),
      ).rejects.toThrow(AppError);
      await expect(
        service.reschedule('appointment-1', { scheduledAt: newScheduledAt }),
      ).rejects.toThrow('New slot already booked');
    });

    it('should allow rescheduling to same slot (no conflict with itself)', async () => {
      const newScheduledAt = new Date(2024, 0, 6, 9, 0); // Same slot
      const updatedAppointment: Appointment = {
        ...existingAppointment,
        scheduledAt: newScheduledAt,
      };

      mockRepository.findById.mockResolvedValue(existingAppointment);
      mockRepository.findBySlot.mockResolvedValue(existingAppointment); // Same appointment
      mockRepository.update.mockResolvedValue(updatedAppointment);

      const result = await service.reschedule('appointment-1', { scheduledAt: newScheduledAt });

      expect(result).toBeDefined();
      expect(mockRepository.update).toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    const existingAppointment: Appointment = {
      id: 'appointment-1',
      patientId: 'patient-1',
      scheduledAt: new Date(2024, 0, 6, 9, 0), // Saturday 09:00
      status: AppointmentStatus.SCHEDULED,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should successfully cancel appointment outside 12-hour window', async () => {
      jest.setSystemTime(new Date(2024, 0, 5, 20, 0)); // Jan 5, 2024 20:00 (13 hours before)
      mockRepository.findById.mockResolvedValue(existingAppointment);
      mockRepository.update.mockResolvedValue({
        ...existingAppointment,
        status: AppointmentStatus.CANCELLED,
      });

      await service.cancel('appointment-1', { reason: 'Patient request' });

      expect(mockRepository.update).toHaveBeenCalledWith('appointment-1', {
        status: AppointmentStatus.CANCELLED,
      });
    });

    it('should reject cancellation within 12-hour window', async () => {
      jest.setSystemTime(new Date(2024, 0, 5, 22, 0)); // Jan 5, 2024 22:00 (11 hours before)
      mockRepository.findById.mockResolvedValue(existingAppointment);

      await expect(
        service.cancel('appointment-1', { reason: 'Late cancellation' }),
      ).rejects.toThrow(AppError);
      await expect(
        service.cancel('appointment-1', { reason: 'Late cancellation' }),
      ).rejects.toThrow('Cannot cancel appointment within 12 hours');
    });

    it('should reject cancellation if appointment not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(
        service.cancel('invalid-id', { reason: 'Cancel' }),
      ).rejects.toThrow(AppError);
      await expect(service.cancel('invalid-id', { reason: 'Cancel' })).rejects.toThrow(
        'Appointment not found',
      );
    });

    it('should reject cancellation of already cancelled appointment', async () => {
      const cancelledAppointment: Appointment = {
        ...existingAppointment,
        status: AppointmentStatus.CANCELLED,
      };
      mockRepository.findById.mockResolvedValue(cancelledAppointment);

      await expect(
        service.cancel('appointment-1', { reason: 'Cancel again' }),
      ).rejects.toThrow(AppError);
      await expect(
        service.cancel('appointment-1', { reason: 'Cancel again' }),
      ).rejects.toThrow('Cannot cancel already cancelled');
    });

    it('should reject cancellation of completed appointment', async () => {
      const completedAppointment: Appointment = {
        ...existingAppointment,
        status: AppointmentStatus.COMPLETED,
      };
      mockRepository.findById.mockResolvedValue(completedAppointment);

      await expect(
        service.cancel('appointment-1', { reason: 'Cancel completed' }),
      ).rejects.toThrow(AppError);
    });
  });

  describe('updateStatus', () => {
    const existingAppointment: Appointment = {
      id: 'appointment-1',
      patientId: 'patient-1',
      scheduledAt: new Date(2024, 0, 6, 9, 0),
      status: AppointmentStatus.SCHEDULED,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should successfully update status from scheduled to confirmed', async () => {
      const updatedAppointment: Appointment = {
        ...existingAppointment,
        status: AppointmentStatus.CONFIRMED,
      };

      mockRepository.findById.mockResolvedValue(existingAppointment);
      mockRepository.update.mockResolvedValue(updatedAppointment);

      const result = await service.updateStatus('appointment-1', {
        status: AppointmentStatus.CONFIRMED,
      });

      expect(result.status).toBe(AppointmentStatus.CONFIRMED);
      expect(mockRepository.update).toHaveBeenCalledWith('appointment-1', {
        status: AppointmentStatus.CONFIRMED,
      });
    });

    it('should successfully update status from confirmed to completed', async () => {
      const confirmedAppointment: Appointment = {
        ...existingAppointment,
        status: AppointmentStatus.CONFIRMED,
      };
      const updatedAppointment: Appointment = {
        ...confirmedAppointment,
        status: AppointmentStatus.COMPLETED,
      };

      mockRepository.findById.mockResolvedValue(confirmedAppointment);
      mockRepository.update.mockResolvedValue(updatedAppointment);

      const result = await service.updateStatus('appointment-1', {
        status: AppointmentStatus.COMPLETED,
      });

      expect(result.status).toBe(AppointmentStatus.COMPLETED);
    });

    it('should reject invalid transition from completed to scheduled', async () => {
      const completedAppointment: Appointment = {
        ...existingAppointment,
        status: AppointmentStatus.COMPLETED,
      };

      mockRepository.findById.mockResolvedValue(completedAppointment);

      await expect(
        service.updateStatus('appointment-1', { status: AppointmentStatus.SCHEDULED }),
      ).rejects.toThrow(AppError);
      await expect(
        service.updateStatus('appointment-1', { status: AppointmentStatus.SCHEDULED }),
      ).rejects.toThrow('Invalid status transition');
    });

    it('should reject invalid transition from cancelled to confirmed', async () => {
      const cancelledAppointment: Appointment = {
        ...existingAppointment,
        status: AppointmentStatus.CANCELLED,
      };

      mockRepository.findById.mockResolvedValue(cancelledAppointment);

      await expect(
        service.updateStatus('appointment-1', { status: AppointmentStatus.CONFIRMED }),
      ).rejects.toThrow(AppError);
    });

    it('should reject status update if appointment not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(
        service.updateStatus('invalid-id', { status: AppointmentStatus.CONFIRMED }),
      ).rejects.toThrow(AppError);
      await expect(
        service.updateStatus('invalid-id', { status: AppointmentStatus.CONFIRMED }),
      ).rejects.toThrow('Appointment not found');
    });
  });

  describe('findById', () => {
    it('should return appointment if found', async () => {
      const appointment: Appointment = {
        id: 'appointment-1',
        patientId: 'patient-1',
        scheduledAt: new Date(2024, 0, 6, 9, 0),
        status: AppointmentStatus.SCHEDULED,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findById.mockResolvedValue(appointment);

      const result = await service.findById('appointment-1');

      expect(result).toEqual(appointment);
      expect(mockRepository.findById).toHaveBeenCalledWith('appointment-1');
    });

    it('should return null if appointment not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      const result = await service.findById('invalid-id');

      expect(result).toBeNull();
    });
  });

  describe('findByPatientId', () => {
    it('should return all appointments for patient', async () => {
      const appointments: Appointment[] = [
        {
          id: 'appointment-1',
          patientId: 'patient-1',
          scheduledAt: new Date(2024, 0, 6, 9, 0),
          status: AppointmentStatus.SCHEDULED,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'appointment-2',
          patientId: 'patient-1',
          scheduledAt: new Date(2024, 0, 13, 11, 0),
          status: AppointmentStatus.CONFIRMED,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockRepository.findByPatientId.mockResolvedValue(appointments);

      const result = await service.findByPatientId('patient-1');

      expect(result).toEqual(appointments);
      expect(result).toHaveLength(2);
      expect(mockRepository.findByPatientId).toHaveBeenCalledWith('patient-1');
    });

    it('should return empty array if no appointments found', async () => {
      mockRepository.findByPatientId.mockResolvedValue([]);

      const result = await service.findByPatientId('patient-without-appointments');

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });
});
