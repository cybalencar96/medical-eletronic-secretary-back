/**
 * Patient Repository
 *
 * Database operations for patient management using Knex.js
 */

import { Knex } from 'knex';
import db from '../../infrastructure/database/connection';
import {
  Patient,
  CreatePatientDTO,
  UpdatePatientDTO,
  IPatientRepository,
} from './interfaces/patient.interface';

const TABLE_NAME = 'patients';

/**
 * Patient Repository implementation with Knex.js
 */
export class PatientRepository implements IPatientRepository {
  private db: Knex;

  constructor(dbInstance?: Knex) {
    this.db = dbInstance || db;
  }

  /**
   * Creates a new patient record in the database
   *
   * @param data - Patient data
   * @returns Created patient entity
   */
  async create(data: CreatePatientDTO): Promise<Patient> {
    const result = await this.db(TABLE_NAME).insert(data).returning('*');
    return result[0] as Patient;
  }

  /**
   * Finds a patient by phone number
   *
   * @param phone - Patient phone number in E.164 format
   * @returns Patient entity or null if not found
   */
  async findByPhone(phone: string): Promise<Patient | null> {
    const patient = await this.db(TABLE_NAME).where({ phone }).first<Patient>();
    return patient || null;
  }

  /**
   * Finds a patient by ID
   *
   * @param id - Patient UUID
   * @returns Patient entity or null if not found
   */
  async findById(id: string): Promise<Patient | null> {
    const patient = await this.db(TABLE_NAME).where({ id }).first<Patient>();
    return patient || null;
  }

  /**
   * Updates a patient record
   *
   * @param id - Patient UUID
   * @param data - Patient data to update
   * @returns Updated patient entity
   */
  async update(id: string, data: UpdatePatientDTO): Promise<Patient> {
    const result = await this.db(TABLE_NAME).where({ id }).update(data).returning('*');
    return result[0] as Patient;
  }
}

// Export singleton instance
export default new PatientRepository();
