/**
 * Patient Service Unit Tests
 *
 * Tests for patient service business logic with mocked repository
 */

import { PatientService } from '../../../../src/modules/patients/patient.service';
import {
  IPatientRepository,
  Patient,
} from '../../../../src/modules/patients/interfaces/patient.interface';
import { AppError } from '../../../../src/shared/errors/AppError';

// Mock insert function for audit logging
const mockDbInsert = jest.fn().mockResolvedValue([]);

// Mock database connection
jest.mock('../../../../src/infrastructure/database/connection', () =>
  jest.fn(() => ({
    insert: mockDbInsert,
  }))
);

// Mock logger
jest.mock('../../../../src/infrastructure/config/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  },
}));

import db from '../../../../src/infrastructure/database/connection';
const mockDb = db as unknown as jest.Mock;

describe('PatientService', () => {
  let patientService: PatientService;
  let mockRepository: jest.Mocked<IPatientRepository>;

  beforeEach(() => {
    // Create mock repository
    mockRepository = {
      create: jest.fn(),
      findByPhone: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
    };

    // Create service with mocked repository
    patientService = new PatientService(mockRepository);

    // Clear all mocks
    jest.clearAllMocks();

    // Reset db insert mock
    mockDbInsert.mockResolvedValue([]);
  });

  describe('registerPatient', () => {
    const validPatientData = {
      phone: '+5511999999999',
      cpf: '123.456.789-09',
      name: 'John Doe',
    };

    it('should register a patient with valid CPF', async () => {
      const mockPatient: Patient = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        phone: validPatientData.phone,
        cpf: '12345678909',
        name: validPatientData.name,
        created_at: new Date(),
        consent_given_at: new Date(),
      };

      mockRepository.findByPhone.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(mockPatient);

      const result = await patientService.registerPatient(validPatientData);

      expect(result).toEqual(mockPatient);
      expect(mockRepository.findByPhone).toHaveBeenCalledWith(validPatientData.phone);
      expect(mockRepository.create).toHaveBeenCalledWith({
        phone: validPatientData.phone,
        cpf: '12345678909',
        name: validPatientData.name,
        consent_given_at: expect.any(Date),
      });
    });

    it('should register a patient with unformatted CPF', async () => {
      const mockPatient: Patient = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        phone: validPatientData.phone,
        cpf: '12345678909',
        name: validPatientData.name,
        created_at: new Date(),
        consent_given_at: new Date(),
      };

      mockRepository.findByPhone.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(mockPatient);

      await patientService.registerPatient({
        ...validPatientData,
        cpf: '12345678909',
      });

      expect(mockRepository.create).toHaveBeenCalledWith({
        phone: validPatientData.phone,
        cpf: '12345678909',
        name: validPatientData.name,
        consent_given_at: expect.any(Date),
      });
    });

    it('should throw AppError with status 400 for invalid CPF', async () => {
      const invalidPatientData = {
        ...validPatientData,
        cpf: '123.456.789-00',
      };

      await expect(patientService.registerPatient(invalidPatientData)).rejects.toThrow(AppError);
      await expect(patientService.registerPatient(invalidPatientData)).rejects.toMatchObject({
        message: 'Invalid CPF',
        statusCode: 400,
      });

      expect(mockRepository.findByPhone).not.toHaveBeenCalled();
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should throw AppError with status 400 for known invalid CPF patterns', async () => {
      const invalidPatientData = {
        ...validPatientData,
        cpf: '111.111.111-11',
      };

      await expect(patientService.registerPatient(invalidPatientData)).rejects.toThrow(AppError);
      await expect(patientService.registerPatient(invalidPatientData)).rejects.toMatchObject({
        message: 'Invalid CPF',
        statusCode: 400,
      });
    });

    it('should throw AppError with status 409 for duplicate phone number', async () => {
      const existingPatient: Patient = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        phone: validPatientData.phone,
        cpf: '12345678909',
        name: 'Jane Doe',
        created_at: new Date(),
        consent_given_at: new Date(),
      };

      mockRepository.findByPhone.mockResolvedValue(existingPatient);

      await expect(patientService.registerPatient(validPatientData)).rejects.toThrow(AppError);
      await expect(patientService.registerPatient(validPatientData)).rejects.toMatchObject({
        message: 'Phone number already registered',
        statusCode: 409,
      });

      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should use provided consent timestamp if available', async () => {
      const consentDate = new Date('2024-01-01T00:00:00Z');
      const mockPatient: Patient = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        phone: validPatientData.phone,
        cpf: '12345678909',
        name: validPatientData.name,
        created_at: new Date(),
        consent_given_at: consentDate,
      };

      mockRepository.findByPhone.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(mockPatient);

      await patientService.registerPatient({
        ...validPatientData,
        consent_given_at: consentDate,
      });

      expect(mockRepository.create).toHaveBeenCalledWith({
        phone: validPatientData.phone,
        cpf: '12345678909',
        name: validPatientData.name,
        consent_given_at: consentDate,
      });
    });

    it('should create audit log after patient registration', async () => {
      const mockPatient: Patient = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        phone: validPatientData.phone,
        cpf: '12345678909',
        name: validPatientData.name,
        created_at: new Date(),
        consent_given_at: new Date(),
      };

      mockRepository.findByPhone.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(mockPatient);

      await patientService.registerPatient(validPatientData);

      expect(mockDb).toHaveBeenCalledWith('audit_logs');
      expect(mockDbInsert).toHaveBeenCalledWith({
        patient_id: mockPatient.id,
        action: 'CREATE',
        payload: expect.any(String),
      });
    });
  });

  describe('findPatientByPhone', () => {
    it('should return patient when found by phone', async () => {
      const mockPatient: Patient = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        phone: '+5511999999999',
        cpf: '12345678909',
        name: 'John Doe',
        created_at: new Date(),
        consent_given_at: new Date(),
      };

      mockRepository.findByPhone.mockResolvedValue(mockPatient);

      const result = await patientService.findPatientByPhone('+5511999999999');

      expect(result).toEqual(mockPatient);
      expect(mockRepository.findByPhone).toHaveBeenCalledWith('+5511999999999');
    });

    it('should return null when patient not found by phone', async () => {
      mockRepository.findByPhone.mockResolvedValue(null);

      const result = await patientService.findPatientByPhone('+5511999999999');

      expect(result).toBeNull();
      expect(mockRepository.findByPhone).toHaveBeenCalledWith('+5511999999999');
    });
  });

  describe('findPatientById', () => {
    it('should return patient when found by ID', async () => {
      const mockPatient: Patient = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        phone: '+5511999999999',
        cpf: '12345678909',
        name: 'John Doe',
        created_at: new Date(),
        consent_given_at: new Date(),
      };

      mockRepository.findById.mockResolvedValue(mockPatient);

      const result = await patientService.findPatientById('123e4567-e89b-12d3-a456-426614174000');

      expect(result).toEqual(mockPatient);
      expect(mockRepository.findById).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000');
    });

    it('should throw AppError with status 404 when patient not found by ID', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(
        patientService.findPatientById('123e4567-e89b-12d3-a456-426614174000'),
      ).rejects.toThrow(AppError);
      await expect(
        patientService.findPatientById('123e4567-e89b-12d3-a456-426614174000'),
      ).rejects.toMatchObject({
        message: 'Patient not found',
        statusCode: 404,
      });
    });
  });

  describe('updateConsent', () => {
    it('should update consent timestamp for existing patient', async () => {
      const existingPatient: Patient = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        phone: '+5511999999999',
        cpf: '12345678909',
        name: 'John Doe',
        created_at: new Date(),
        consent_given_at: null,
      };

      const consentDate = new Date('2024-01-01T00:00:00Z');
      const updatedPatient: Patient = {
        ...existingPatient,
        consent_given_at: consentDate,
      };

      mockRepository.findById.mockResolvedValue(existingPatient);
      mockRepository.update.mockResolvedValue(updatedPatient);

      const result = await patientService.updateConsent(existingPatient.id, consentDate);

      expect(result).toEqual(updatedPatient);
      expect(mockRepository.update).toHaveBeenCalledWith(existingPatient.id, {
        consent_given_at: consentDate,
      });
    });

    it('should throw AppError with status 404 when patient not found for consent update', async () => {
      mockRepository.findById.mockResolvedValue(null);

      const consentDate = new Date('2024-01-01T00:00:00Z');

      await expect(
        patientService.updateConsent('123e4567-e89b-12d3-a456-426614174000', consentDate),
      ).rejects.toThrow(AppError);
      await expect(
        patientService.updateConsent('123e4567-e89b-12d3-a456-426614174000', consentDate),
      ).rejects.toMatchObject({
        message: 'Patient not found',
        statusCode: 404,
      });

      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should create audit log after consent update', async () => {
      const existingPatient: Patient = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        phone: '+5511999999999',
        cpf: '12345678909',
        name: 'John Doe',
        created_at: new Date(),
        consent_given_at: null,
      };

      const consentDate = new Date('2024-01-01T00:00:00Z');
      const updatedPatient: Patient = {
        ...existingPatient,
        consent_given_at: consentDate,
      };

      mockRepository.findById.mockResolvedValue(existingPatient);
      mockRepository.update.mockResolvedValue(updatedPatient);

      await patientService.updateConsent(existingPatient.id, consentDate);

      expect(mockDb).toHaveBeenCalledWith('audit_logs');
      expect(mockDbInsert).toHaveBeenCalledWith({
        patient_id: existingPatient.id,
        action: 'UPDATE_CONSENT',
        payload: expect.any(String),
      });
    });
  });
});
