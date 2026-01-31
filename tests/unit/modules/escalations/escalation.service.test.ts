/**
 * Unit tests for escalation service
 */

import { EscalationService } from '../../../../src/modules/escalations/escalation.service';
import { EscalationRepository } from '../../../../src/modules/escalations/escalation.repository';
import { AppError } from '../../../../src/shared/errors/AppError';
import { Escalation, EscalationWithPatient } from '../../../../src/shared/types/escalation.types';

describe('EscalationService', () => {
  let service: EscalationService;
  let mockRepository: jest.Mocked<EscalationRepository>;

  beforeEach(() => {
    mockRepository = {
      list: jest.fn(),
      findById: jest.fn(),
      resolve: jest.fn(),
      create: jest.fn(),
    } as any;

    service = new EscalationService(mockRepository);
  });

  describe('list', () => {
    it('should list escalations with patient context', async () => {
      const mockEscalations: EscalationWithPatient[] = [
        {
          id: 'esc-123',
          patientId: 'patient-456',
          message: 'Patient message',
          reason: 'Low confidence',
          resolvedAt: null,
          resolvedBy: null,
          createdAt: new Date('2024-01-01'),
          patientName: 'John Doe',
          patientPhone: '+5511999999999',
        },
      ];

      mockRepository.list.mockResolvedValue(mockEscalations);

      const result = await service.list({
        limit: 50,
        offset: 0,
      });

      expect(mockRepository.list).toHaveBeenCalledWith({
        limit: 50,
        offset: 0,
      });
      expect(result).toEqual(mockEscalations);
    });

    it('should filter by resolved status', async () => {
      mockRepository.list.mockResolvedValue([]);

      await service.list({
        resolved: false,
        limit: 50,
        offset: 0,
      });

      expect(mockRepository.list).toHaveBeenCalledWith({
        resolved: false,
        limit: 50,
        offset: 0,
      });
    });

    it('should return empty array when no escalations found', async () => {
      mockRepository.list.mockResolvedValue([]);

      const result = await service.list({
        limit: 50,
        offset: 0,
      });

      expect(result).toEqual([]);
    });
  });

  describe('resolve', () => {
    it('should resolve escalation successfully', async () => {
      const mockEscalation: Escalation = {
        id: 'esc-123',
        patientId: 'patient-456',
        message: 'Patient message',
        reason: 'Low confidence',
        resolvedAt: null,
        resolvedBy: null,
        createdAt: new Date('2024-01-01'),
      };

      const mockResolvedEscalation: Escalation = {
        ...mockEscalation,
        resolvedAt: new Date('2024-01-02'),
        resolvedBy: 'dr.smith',
      };

      mockRepository.findById.mockResolvedValue(mockEscalation);
      mockRepository.resolve.mockResolvedValue(mockResolvedEscalation);

      const result = await service.resolve('esc-123', {
        resolvedBy: 'dr.smith',
        resolutionNotes: 'Contacted patient and resolved the issue',
      });

      expect(mockRepository.findById).toHaveBeenCalledWith('esc-123');
      expect(mockRepository.resolve).toHaveBeenCalledWith('esc-123', 'dr.smith');
      expect(result).toEqual(mockResolvedEscalation);
    });

    it('should throw 404 error when escalation not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(
        service.resolve('nonexistent', {
          resolvedBy: 'dr.smith',
          resolutionNotes: 'Resolution notes',
        })
      ).rejects.toThrow(AppError);

      await expect(
        service.resolve('nonexistent', {
          resolvedBy: 'dr.smith',
          resolutionNotes: 'Resolution notes',
        })
      ).rejects.toMatchObject({
        statusCode: 404,
        message: 'Escalation not found',
      });
    });

    it('should throw 409 error when escalation already resolved', async () => {
      const mockResolvedEscalation: Escalation = {
        id: 'esc-123',
        patientId: 'patient-456',
        message: 'Patient message',
        reason: 'Low confidence',
        resolvedAt: new Date('2024-01-02'),
        resolvedBy: 'dr.jones',
        createdAt: new Date('2024-01-01'),
      };

      mockRepository.findById.mockResolvedValue(mockResolvedEscalation);

      await expect(
        service.resolve('esc-123', {
          resolvedBy: 'dr.smith',
          resolutionNotes: 'Resolution notes',
        })
      ).rejects.toThrow(AppError);

      await expect(
        service.resolve('esc-123', {
          resolvedBy: 'dr.smith',
          resolutionNotes: 'Resolution notes',
        })
      ).rejects.toMatchObject({
        statusCode: 409,
        message: 'Escalation is already resolved',
      });
    });
  });

  describe('create', () => {
    it('should create new escalation', async () => {
      const mockEscalation: Escalation = {
        id: 'esc-123',
        patientId: 'patient-456',
        message: 'Patient message',
        reason: 'Low confidence',
        resolvedAt: null,
        resolvedBy: null,
        createdAt: new Date('2024-01-01'),
      };

      mockRepository.create.mockResolvedValue(mockEscalation);

      const result = await service.create('patient-456', 'Patient message', 'Low confidence');

      expect(mockRepository.create).toHaveBeenCalledWith(
        'patient-456',
        'Patient message',
        'Low confidence'
      );
      expect(result).toEqual(mockEscalation);
    });
  });
});
