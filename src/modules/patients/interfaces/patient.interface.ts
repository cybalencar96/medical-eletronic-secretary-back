/**
 * Patient Module Interfaces
 *
 * Defines TypeScript interfaces for patient entities and data transfer objects
 */

/**
 * Patient entity representing a patient record in the database
 */
export interface Patient {
  id: string;
  phone: string;
  cpf: string;
  name: string;
  created_at: Date;
  consent_given_at: Date | null;
}

/**
 * Data Transfer Object for creating a new patient
 */
export interface CreatePatientDTO {
  phone: string;
  cpf: string;
  name: string;
  consent_given_at?: Date;
}

/**
 * Data Transfer Object for updating a patient
 */
export interface UpdatePatientDTO {
  name?: string;
  cpf?: string;
  consent_given_at?: Date;
}

/**
 * Patient Repository interface defining database operations
 */
export interface IPatientRepository {
  /**
   * Creates a new patient record
   *
   * @param data - Patient data
   * @returns Created patient entity
   */
  create(data: CreatePatientDTO): Promise<Patient>;

  /**
   * Finds a patient by phone number
   *
   * @param phone - Patient phone number in E.164 format
   * @returns Patient entity or null if not found
   */
  findByPhone(phone: string): Promise<Patient | null>;

  /**
   * Finds a patient by ID
   *
   * @param id - Patient UUID
   * @returns Patient entity or null if not found
   */
  findById(id: string): Promise<Patient | null>;

  /**
   * Updates a patient record
   *
   * @param id - Patient UUID
   * @param data - Patient data to update
   * @returns Updated patient entity
   */
  update(id: string, data: UpdatePatientDTO): Promise<Patient>;
}
