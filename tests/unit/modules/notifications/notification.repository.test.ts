/**
 * Notification repository tests
 */

import { NotificationRepository } from '../../../../src/modules/notifications/notification.repository';
import { NotificationType } from '../../../../src/modules/notifications/notification.types';

describe('NotificationRepository', () => {
  let repository: NotificationRepository;
  let mockDb: any;

  beforeEach(() => {
    // Create mock database with chainable methods
    mockDb = jest.fn(() => mockDb);
    mockDb.insert = jest.fn().mockReturnThis();
    mockDb.where = jest.fn().mockReturnThis();
    mockDb.orderBy = jest.fn().mockReturnThis();
    mockDb.returning = jest.fn();
    mockDb.first = jest.fn();

    repository = new NotificationRepository(mockDb as any);
  });

  describe('create', () => {
    it('should create a new notification record', async () => {
      const mockRow = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        appointment_id: 'appointment-123',
        type: 'reminder_48h',
        sent_at: new Date('2025-02-15T10:00:00Z'),
      };

      mockDb.returning.mockResolvedValue([mockRow]);

      const result = await repository.create('appointment-123', NotificationType.REMINDER_48H);

      expect(mockDb).toHaveBeenCalledWith('notifications_sent');
      expect(mockDb.insert).toHaveBeenCalledWith({
        appointment_id: 'appointment-123',
        type: NotificationType.REMINDER_48H,
      });
      expect(result).toEqual({
        id: mockRow.id,
        appointmentId: mockRow.appointment_id,
        type: mockRow.type,
        sentAt: mockRow.sent_at,
      });
    });
  });

  describe('findByAppointmentAndType', () => {
    it('should find notification by appointment ID and type', async () => {
      const mockRow = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        appointment_id: 'appointment-123',
        type: 'reminder_48h',
        sent_at: new Date('2025-02-15T10:00:00Z'),
      };

      mockDb.first.mockResolvedValue(mockRow);

      const result = await repository.findByAppointmentAndType(
        'appointment-123',
        NotificationType.REMINDER_48H
      );

      expect(mockDb).toHaveBeenCalledWith('notifications_sent');
      expect(mockDb.where).toHaveBeenCalledWith({
        appointment_id: 'appointment-123',
        type: NotificationType.REMINDER_48H,
      });
      expect(result).toEqual({
        id: mockRow.id,
        appointmentId: mockRow.appointment_id,
        type: mockRow.type,
        sentAt: mockRow.sent_at,
      });
    });

    it('should return null when notification not found', async () => {
      mockDb.first.mockResolvedValue(undefined);

      const result = await repository.findByAppointmentAndType(
        'appointment-123',
        NotificationType.REMINDER_48H
      );

      expect(result).toBeNull();
    });
  });

  describe('findByAppointmentId', () => {
    it('should find all notifications for an appointment', async () => {
      const mockRows = [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          appointment_id: 'appointment-123',
          type: 'reminder_72h',
          sent_at: new Date('2025-02-13T10:00:00Z'),
        },
        {
          id: '223e4567-e89b-12d3-a456-426614174001',
          appointment_id: 'appointment-123',
          type: 'reminder_48h',
          sent_at: new Date('2025-02-14T10:00:00Z'),
        },
      ];

      mockDb.orderBy.mockResolvedValue(mockRows);

      const result = await repository.findByAppointmentId('appointment-123');

      expect(mockDb).toHaveBeenCalledWith('notifications_sent');
      expect(mockDb.where).toHaveBeenCalledWith({ appointment_id: 'appointment-123' });
      expect(mockDb.orderBy).toHaveBeenCalledWith('sent_at', 'desc');
      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('reminder_72h');
      expect(result[1].type).toBe('reminder_48h');
    });

    it('should return empty array when no notifications found', async () => {
      mockDb.orderBy.mockResolvedValue([]);

      const result = await repository.findByAppointmentId('appointment-123');

      expect(result).toEqual([]);
    });
  });
});
