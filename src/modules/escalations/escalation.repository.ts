/**
 * Escalation repository implementation
 *
 * Data access layer for escalations table using Knex.js
 * Provides methods to list escalations with patient context and resolve them
 */

import { Knex } from 'knex';
import {
  Escalation,
  EscalationWithPatient,
  ListEscalationsFilter,
} from '../../shared/types/escalation.types';
import db from '../../infrastructure/database/connection';
import { logger } from '../../infrastructure/config/logger';

const TABLE_NAME = 'escalations';
const PATIENTS_TABLE = 'patients';

/**
 * Database row type for escalations table
 */
interface EscalationRow {
  id: string;
  patient_id: string;
  message: string;
  reason: string;
  resolved_at: Date | null;
  resolved_by: string | null;
  created_at: Date;
}

/**
 * Database row type for escalations joined with patients
 */
interface EscalationWithPatientRow extends EscalationRow {
  patient_name: string;
  patient_phone: string;
}

/**
 * Map database row to Escalation entity
 *
 * Converts snake_case database columns to camelCase entity properties
 *
 * @param row - Database row
 * @returns Escalation - Mapped entity
 */
function mapToEntity(row: EscalationRow): Escalation {
  return {
    id: row.id,
    patientId: row.patient_id,
    message: row.message,
    reason: row.reason,
    resolvedAt: row.resolved_at ? new Date(row.resolved_at) : null,
    resolvedBy: row.resolved_by,
    createdAt: new Date(row.created_at),
  };
}

/**
 * Map database row with patient data to EscalationWithPatient entity
 *
 * @param row - Database row with patient join
 * @returns EscalationWithPatient - Mapped entity with patient context
 */
function mapToEntityWithPatient(row: EscalationWithPatientRow): EscalationWithPatient {
  return {
    ...mapToEntity(row),
    patientName: row.patient_name,
    patientPhone: row.patient_phone,
  };
}

/**
 * EscalationRepository class
 *
 * Implements data access operations for escalations table
 * Uses Knex.js for database queries with PostgreSQL
 */
export class EscalationRepository {
  private db: Knex;

  constructor(database: Knex = db) {
    this.db = database;
  }

  /**
   * List escalations with patient context
   *
   * Joins patients table to include patient name and phone
   * Supports filtering by resolved status and pagination
   *
   * @param filter - Filter options for listing escalations
   * @returns Promise<EscalationWithPatient[]> - Array of escalations with patient context
   */
  async list(filter: ListEscalationsFilter): Promise<EscalationWithPatient[]> {
    logger.debug({ filter }, 'Listing escalations with filter');

    let query = this.db(TABLE_NAME)
      .select(
        `${TABLE_NAME}.*`,
        `${PATIENTS_TABLE}.name as patient_name`,
        `${PATIENTS_TABLE}.phone as patient_phone`
      )
      .join(PATIENTS_TABLE, `${TABLE_NAME}.patient_id`, `${PATIENTS_TABLE}.id`)
      .orderBy(`${TABLE_NAME}.created_at`, 'desc')
      .limit(filter.limit)
      .offset(filter.offset);

    // Filter by resolved status if specified
    if (filter.resolved !== undefined) {
      if (filter.resolved) {
        query = query.whereNotNull(`${TABLE_NAME}.resolved_at`);
      } else {
        query = query.whereNull(`${TABLE_NAME}.resolved_at`);
      }
    }

    const rows = (await query) as EscalationWithPatientRow[];

    logger.debug({ count: rows.length }, 'Found escalations');

    return rows.map(mapToEntityWithPatient);
  }

  /**
   * Find escalation by ID
   *
   * @param id - UUID of escalation
   * @returns Promise<Escalation | null> - Escalation or null if not found
   */
  async findById(id: string): Promise<Escalation | null> {
    logger.debug({ escalationId: id }, 'Finding escalation by ID');

    const row = (await this.db(TABLE_NAME).where({ id }).first()) as EscalationRow | undefined;

    if (!row) {
      logger.debug({ escalationId: id }, 'Escalation not found');
      return null;
    }

    return mapToEntity(row);
  }

  /**
   * Resolve escalation
   *
   * Updates resolved_at timestamp and resolved_by identifier
   *
   * @param id - UUID of escalation to resolve
   * @param resolvedBy - Identifier of the resolver (username or user ID)
   * @returns Promise<Escalation> - Updated escalation
   * @throws Error if escalation not found
   */
  async resolve(id: string, resolvedBy: string): Promise<Escalation> {
    logger.info({ escalationId: id, resolvedBy }, 'Resolving escalation');

    const [row] = (await this.db(TABLE_NAME)
      .where({ id })
      .update({
        resolved_at: new Date(),
        resolved_by: resolvedBy,
      })
      .returning('*')) as EscalationRow[];

    if (!row) {
      logger.error({ escalationId: id }, 'Escalation not found for resolve');
      throw new Error(`Escalation with ID ${id} not found`);
    }

    logger.info({ escalationId: id }, 'Escalation resolved successfully');

    return mapToEntity(row);
  }

  /**
   * Create new escalation
   *
   * Used by the message processing flow to escalate ambiguous messages
   *
   * @param patientId - UUID of patient
   * @param message - Original patient message
   * @param reason - Reason for escalation
   * @returns Promise<Escalation> - Created escalation
   */
  async create(patientId: string, message: string, reason: string): Promise<Escalation> {
    logger.info({ patientId, reason }, 'Creating escalation');

    const [row] = (await this.db(TABLE_NAME)
      .insert({
        patient_id: patientId,
        message,
        reason,
      })
      .returning('*')) as EscalationRow[];

    const escalation = mapToEntity(row);
    logger.info({ escalationId: escalation.id }, 'Escalation created successfully');

    return escalation;
  }
}

// Export singleton instance for production use
export default new EscalationRepository();
