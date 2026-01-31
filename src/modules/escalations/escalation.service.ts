/**
 * Escalation service implementation
 *
 * Business logic layer for escalation management
 * Handles listing escalations with patient context and resolving them
 */

import { EscalationRepository } from './escalation.repository';
import {
  EscalationWithPatient,
  ListEscalationsFilter,
  ResolveEscalationDTO,
  Escalation,
} from '../../shared/types/escalation.types';
import escalationRepository from './escalation.repository';
import { AppError } from '../../shared/errors/AppError';
import { logger } from '../../infrastructure/config/logger';

/**
 * EscalationService class
 *
 * Implements escalation business logic with:
 * - List escalations with patient context (name, phone)
 * - Filter by resolved status
 * - Pagination support
 * - Resolve escalations with notes tracking
 */
export class EscalationService {
  private repository: EscalationRepository;

  constructor(repository: EscalationRepository = escalationRepository) {
    this.repository = repository;
  }

  /**
   * List escalations with patient context
   *
   * Returns escalations with patient name and phone for dashboard display
   * Supports filtering by resolved status and pagination
   *
   * @param filter - Filter options
   * @returns Promise<EscalationWithPatient[]> - Array of escalations with patient context
   */
  async list(filter: ListEscalationsFilter): Promise<EscalationWithPatient[]> {
    logger.info({ filter }, 'Listing escalations');

    const escalations = await this.repository.list(filter);

    logger.info({ count: escalations.length }, 'Escalations retrieved successfully');

    return escalations;
  }

  /**
   * Resolve an escalation
   *
   * Marks escalation as resolved with timestamp and resolver identifier
   * Validates that escalation exists and is not already resolved
   *
   * @param escalationId - UUID of escalation to resolve
   * @param dto - Resolution data with notes and resolver
   * @returns Promise<Escalation> - Updated escalation
   * @throws AppError 404 if escalation not found
   * @throws AppError 409 if escalation already resolved
   */
  async resolve(escalationId: string, dto: ResolveEscalationDTO): Promise<Escalation> {
    logger.info({ escalationId, resolvedBy: dto.resolvedBy }, 'Resolving escalation');

    // Verify escalation exists
    const existing = await this.repository.findById(escalationId);
    if (!existing) {
      throw new AppError('Escalation not found', 404);
    }

    // Check if already resolved
    if (existing.resolvedAt) {
      throw new AppError('Escalation is already resolved', 409);
    }

    // Resolve the escalation
    const resolved = await this.repository.resolve(escalationId, dto.resolvedBy);

    logger.info({ escalationId, resolvedBy: dto.resolvedBy }, 'Escalation resolved successfully');

    return resolved;
  }

  /**
   * Create a new escalation
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

    const escalation = await this.repository.create(patientId, message, reason);

    logger.info({ escalationId: escalation.id }, 'Escalation created successfully');

    return escalation;
  }
}

// Export singleton instance for production use
export default new EscalationService();
