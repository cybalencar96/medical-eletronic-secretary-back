/**
 * Unit tests for escalation repository
 */

import { EscalationRepository } from '../../../../src/modules/escalations/escalation.repository';
import { Knex } from 'knex';

describe('EscalationRepository', () => {
  let repository: EscalationRepository;
  let mockDb: Partial<Knex>;
  let mockQueryBuilder: any;

  beforeEach(() => {
    // Create mock query builder with chainable methods
    mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      join: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      whereNotNull: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      first: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([]),
    };

    // Mock database instance
    mockDb = jest.fn(() => mockQueryBuilder) as any;

    repository = new EscalationRepository(mockDb as Knex);
  });

  describe('list', () => {
    it('should list escalations with patient context', async () => {
      const mockRows = [
        {
          id: 'esc-123',
          patient_id: 'patient-456',
          message: 'Patient message',
          reason: 'Low confidence',
          resolved_at: null,
          resolved_by: null,
          created_at: new Date('2024-01-01'),
          patient_name: 'John Doe',
          patient_phone: '+5511999999999',
        },
      ];

      mockQueryBuilder.then = jest.fn((resolve) => resolve(mockRows));

      const result = await repository.list({
        limit: 50,
        offset: 0,
      });

      expect(mockDb).toHaveBeenCalledWith('escalations');
      expect(mockQueryBuilder.select).toHaveBeenCalled();
      expect(mockQueryBuilder.join).toHaveBeenCalledWith(
        'patients',
        'escalations.patient_id',
        'patients.id'
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'esc-123',
        patientId: 'patient-456',
        message: 'Patient message',
        reason: 'Low confidence',
        resolvedAt: null,
        resolvedBy: null,
        createdAt: mockRows[0].created_at,
        patientName: 'John Doe',
        patientPhone: '+5511999999999',
      });
    });

    it('should filter by resolved status (pending)', async () => {
      mockQueryBuilder.then = jest.fn((resolve) => resolve([]));

      await repository.list({
        resolved: false,
        limit: 50,
        offset: 0,
      });

      expect(mockQueryBuilder.whereNull).toHaveBeenCalledWith('escalations.resolved_at');
    });

    it('should filter by resolved status (resolved)', async () => {
      mockQueryBuilder.then = jest.fn((resolve) => resolve([]));

      await repository.list({
        resolved: true,
        limit: 50,
        offset: 0,
      });

      expect(mockQueryBuilder.whereNotNull).toHaveBeenCalledWith('escalations.resolved_at');
    });

    it('should apply pagination', async () => {
      mockQueryBuilder.then = jest.fn((resolve) => resolve([]));

      await repository.list({
        limit: 25,
        offset: 50,
      });

      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(25);
      expect(mockQueryBuilder.offset).toHaveBeenCalledWith(50);
    });
  });

  describe('findById', () => {
    it('should find escalation by ID', async () => {
      const mockRow = {
        id: 'esc-123',
        patient_id: 'patient-456',
        message: 'Patient message',
        reason: 'Low confidence',
        resolved_at: null,
        resolved_by: null,
        created_at: new Date('2024-01-01'),
      };

      mockQueryBuilder.first.mockResolvedValue(mockRow);

      const result = await repository.findById('esc-123');

      expect(mockDb).toHaveBeenCalledWith('escalations');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith({ id: 'esc-123' });
      expect(result).toEqual({
        id: 'esc-123',
        patientId: 'patient-456',
        message: 'Patient message',
        reason: 'Low confidence',
        resolvedAt: null,
        resolvedBy: null,
        createdAt: mockRow.created_at,
      });
    });

    it('should return null when escalation not found', async () => {
      mockQueryBuilder.first.mockResolvedValue(undefined);

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('resolve', () => {
    it('should resolve escalation', async () => {
      const mockRow = {
        id: 'esc-123',
        patient_id: 'patient-456',
        message: 'Patient message',
        reason: 'Low confidence',
        resolved_at: new Date('2024-01-02'),
        resolved_by: 'dr.smith',
        created_at: new Date('2024-01-01'),
      };

      mockQueryBuilder.returning.mockResolvedValue([mockRow]);

      const result = await repository.resolve('esc-123', 'dr.smith');

      expect(mockDb).toHaveBeenCalledWith('escalations');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith({ id: 'esc-123' });
      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        resolved_at: expect.any(Date),
        resolved_by: 'dr.smith',
      });
      expect(result.resolvedBy).toBe('dr.smith');
      expect(result.resolvedAt).toEqual(mockRow.resolved_at);
    });

    it('should throw error when escalation not found', async () => {
      mockQueryBuilder.returning.mockResolvedValue([]);

      await expect(repository.resolve('nonexistent', 'dr.smith')).rejects.toThrow(
        'Escalation with ID nonexistent not found'
      );
    });
  });

  describe('create', () => {
    it('should create new escalation', async () => {
      const mockRow = {
        id: 'esc-123',
        patient_id: 'patient-456',
        message: 'Patient message',
        reason: 'Low confidence',
        resolved_at: null,
        resolved_by: null,
        created_at: new Date('2024-01-01'),
      };

      mockQueryBuilder.returning.mockResolvedValue([mockRow]);

      const result = await repository.create('patient-456', 'Patient message', 'Low confidence');

      expect(mockDb).toHaveBeenCalledWith('escalations');
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith({
        patient_id: 'patient-456',
        message: 'Patient message',
        reason: 'Low confidence',
      });
      expect(result).toEqual({
        id: 'esc-123',
        patientId: 'patient-456',
        message: 'Patient message',
        reason: 'Low confidence',
        resolvedAt: null,
        resolvedBy: null,
        createdAt: mockRow.created_at,
      });
    });
  });
});
