/**
 * Patient Service
 *
 * Business logic for patient management including registration,
 * CPF validation, LGPD consent tracking, and audit logging
 */

import { Knex } from 'knex';
import { AppError } from '../../shared/errors/AppError';
import { isValidCpf, normalizeCpf } from '../../shared/validators/cpf.validator';
import { logger } from '../../infrastructure/config/logger';
import db from '../../infrastructure/database/connection';
import patientRepository from './patient.repository';
import { Patient, CreatePatientDTO, IPatientRepository } from './interfaces/patient.interface';

/**
 * Patient Service for managing patient records
 */
export class PatientService {
  private db: Knex;

  constructor(
    private repository: IPatientRepository,
    dbInstance?: Knex
  ) {
    this.db = dbInstance || db;
  }

  /**
   * Registers a new patient with CPF validation and consent tracking
   *
   * @param data - Patient registration data
   * @returns Created patient entity
   * @throws AppError if CPF is invalid or phone already exists
   */
  async registerPatient(data: CreatePatientDTO): Promise<Patient> {
    // Validate CPF
    if (!isValidCpf(data.cpf)) {
      logger.warn({ cpf: data.cpf }, 'Invalid CPF provided during patient registration');
      throw new AppError('Invalid CPF', 400);
    }

    // Normalize CPF before storage
    const normalizedCpf = normalizeCpf(data.cpf);

    // Check if phone already exists
    const existingPatient = await this.repository.findByPhone(data.phone);
    if (existingPatient) {
      logger.warn({ phone: data.phone }, 'Duplicate phone number during patient registration');
      throw new AppError('Phone number already registered', 409);
    }

    // Create patient with normalized CPF
    const patientData: CreatePatientDTO = {
      ...data,
      cpf: normalizedCpf,
      consent_given_at: data.consent_given_at || new Date(),
    };

    const patient = await this.repository.create(patientData);

    // Log patient creation for LGPD compliance
    await this.auditPatientOperation(patient.id, 'CREATE', {
      phone: patient.phone,
      cpf: normalizedCpf,
      name: patient.name,
      consent_given_at: patient.consent_given_at,
    });

    logger.info({ patientId: patient.id, phone: patient.phone }, 'Patient registered successfully');

    return patient;
  }

  /**
   * Finds a patient by phone number
   *
   * @param phone - Patient phone number in E.164 format
   * @returns Patient entity or null if not found
   */
  async findPatientByPhone(phone: string): Promise<Patient | null> {
    const patient = await this.repository.findByPhone(phone);

    if (patient) {
      logger.debug({ patientId: patient.id, phone }, 'Patient found by phone');
    } else {
      logger.debug({ phone }, 'Patient not found by phone');
    }

    return patient;
  }

  /**
   * Finds a patient by ID
   *
   * @param id - Patient UUID
   * @returns Patient entity
   * @throws AppError if patient not found
   */
  async findPatientById(id: string): Promise<Patient> {
    const patient = await this.repository.findById(id);

    if (!patient) {
      logger.warn({ patientId: id }, 'Patient not found by ID');
      throw new AppError('Patient not found', 404);
    }

    logger.debug({ patientId: id }, 'Patient found by ID');
    return patient;
  }

  /**
   * Updates patient consent timestamp
   *
   * @param id - Patient UUID
   * @param consentGivenAt - Consent timestamp
   * @returns Updated patient entity
   * @throws AppError if patient not found
   */
  async updateConsent(id: string, consentGivenAt: Date): Promise<Patient> {
    const existingPatient = await this.repository.findById(id);
    if (!existingPatient) {
      logger.warn({ patientId: id }, 'Patient not found for consent update');
      throw new AppError('Patient not found', 404);
    }

    const patient = await this.repository.update(id, { consent_given_at: consentGivenAt });

    // Log consent update for LGPD compliance
    await this.auditPatientOperation(patient.id, 'UPDATE_CONSENT', {
      consent_given_at: consentGivenAt,
    });

    logger.info({ patientId: id }, 'Patient consent updated');

    return patient;
  }

  /**
   * Logs patient operations to audit_logs table for LGPD compliance
   *
   * @param patientId - Patient UUID
   * @param action - Operation action (CREATE, UPDATE, UPDATE_CONSENT, etc.)
   * @param payload - Operation payload data
   */
  private async auditPatientOperation(
    patientId: string,
    action: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    try {
      await this.db('audit_logs').insert({
        patient_id: patientId,
        action,
        payload: JSON.stringify(payload),
      });

      logger.debug(
        { patientId, action },
        'Patient operation logged to audit_logs for LGPD compliance'
      );
    } catch (error) {
      // Log the error but don't fail the main operation
      logger.error({ error, patientId, action }, 'Failed to log patient operation to audit_logs');
    }
  }
}

// Export singleton instance with default repository
export default new PatientService(patientRepository);
