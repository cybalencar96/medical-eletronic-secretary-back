/**
 * Unit tests for escalation Zod validation schemas
 */

import {
  getEscalationsQuerySchema,
  resolveEscalationParamsSchema,
  resolveEscalationBodySchema,
} from '../../../../src/api/schemas/escalation.schema';

describe('Escalation Schemas', () => {
  describe('getEscalationsQuerySchema', () => {
    it('should accept valid query with all parameters', () => {
      const query = {
        resolved: 'false',
        limit: '25',
        offset: '10',
      };

      const result = getEscalationsQuerySchema.parse(query);

      expect(result.resolved).toBe(false);
      expect(result.limit).toBe(25);
      expect(result.offset).toBe(10);
    });

    it('should apply defaults for limit and offset', () => {
      const query = {};
      const result = getEscalationsQuerySchema.parse(query);

      expect(result.limit).toBe(50);
      expect(result.offset).toBe(0);
      expect(result.resolved).toBeUndefined();
    });

    it('should accept boolean string values for resolved', () => {
      expect(getEscalationsQuerySchema.parse({ resolved: 'true' }).resolved).toBe(true);
      expect(getEscalationsQuerySchema.parse({ resolved: 'false' }).resolved).toBe(false);
      expect(getEscalationsQuerySchema.parse({ resolved: '1' }).resolved).toBe(true);
      expect(getEscalationsQuerySchema.parse({ resolved: '0' }).resolved).toBe(false);
    });

    it('should enforce limit maximum of 100', () => {
      const query = { limit: '150' };
      expect(() => getEscalationsQuerySchema.parse(query)).toThrow();
    });

    it('should enforce offset minimum of 0', () => {
      const query = { offset: '-1' };
      expect(() => getEscalationsQuerySchema.parse(query)).toThrow();
    });
  });

  describe('resolveEscalationParamsSchema', () => {
    it('should accept valid UUID in params', () => {
      const params = { id: '550e8400-e29b-41d4-a716-446655440000' };
      const result = resolveEscalationParamsSchema.parse(params);
      expect(result.id).toBe(params.id);
    });

    it('should reject invalid UUID in params', () => {
      const params = { id: 'not-a-uuid' };
      expect(() => resolveEscalationParamsSchema.parse(params)).toThrow();
    });
  });

  describe('resolveEscalationBodySchema', () => {
    it('should accept valid resolution body', () => {
      const body = {
        resolution_notes: 'Contacted patient and resolved the issue via phone call',
        resolved_by: 'dr.smith',
      };

      const result = resolveEscalationBodySchema.parse(body);

      expect(result.resolution_notes).toBe(body.resolution_notes);
      expect(result.resolved_by).toBe(body.resolved_by);
    });

    it('should reject resolution notes shorter than 10 characters', () => {
      const body = {
        resolution_notes: 'Too short',
        resolved_by: 'dr.smith',
      };

      expect(() => resolveEscalationBodySchema.parse(body)).toThrow();
    });

    it('should reject resolution notes longer than 1000 characters', () => {
      const body = {
        resolution_notes: 'a'.repeat(1001),
        resolved_by: 'dr.smith',
      };

      expect(() => resolveEscalationBodySchema.parse(body)).toThrow();
    });

    it('should reject empty resolved_by', () => {
      const body = {
        resolution_notes: 'Valid resolution notes here',
        resolved_by: '',
      };

      expect(() => resolveEscalationBodySchema.parse(body)).toThrow();
    });

    it('should reject missing fields', () => {
      expect(() => resolveEscalationBodySchema.parse({})).toThrow();
      expect(() =>
        resolveEscalationBodySchema.parse({ resolution_notes: 'Valid notes here' })
      ).toThrow();
      expect(() => resolveEscalationBodySchema.parse({ resolved_by: 'dr.smith' })).toThrow();
    });
  });
});
