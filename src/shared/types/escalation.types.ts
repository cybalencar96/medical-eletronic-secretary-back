/**
 * Escalation module type definitions
 *
 * Defines core types for the escalation system including:
 * - Escalation entity structure
 * - Escalation with patient context
 * - Data transfer objects (DTOs)
 */

/**
 * Escalation entity as stored in database
 *
 * Represents a patient message that requires human intervention
 */
export interface Escalation {
  id: string;
  patientId: string;
  message: string;
  reason: string;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  createdAt: Date;
}

/**
 * Escalation with patient context for dashboard display
 *
 * Includes patient name and phone for human review
 */
export interface EscalationWithPatient extends Escalation {
  patientName: string;
  patientPhone: string;
}

/**
 * DTO for resolving an escalation
 *
 * Used by resolution flow to mark escalation as handled
 */
export interface ResolveEscalationDTO {
  resolvedBy: string;
  resolutionNotes: string;
}

/**
 * Filter options for listing escalations
 */
export interface ListEscalationsFilter {
  resolved?: boolean;
  limit: number;
  offset: number;
}
