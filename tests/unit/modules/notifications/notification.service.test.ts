/**
 * Notification service tests
 */

import { NotificationService, createTemplateData } from '../../../../src/modules/notifications/notification.service';
import { NotificationType } from '../../../../src/modules/notifications/notification.types';
import { INotificationRepository } from '../../../../src/modules/notifications/notification.repository';
import { IMessageSenderService } from '../../../../src/modules/whatsapp/services/message-sender.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let mockRepository: jest.Mocked<INotificationRepository>;
  let mockMessageSender: jest.Mocked<IMessageSenderService>;

  beforeEach(() => {
    mockRepository = {
      create: jest.fn(),
      findByAppointmentAndType: jest.fn(),
      findByAppointmentId: jest.fn(),
    };

    mockMessageSender = {
      sendTextMessage: jest.fn(),
    };

    service = new NotificationService(mockRepository, mockMessageSender);
  });

  describe('sendNotification', () => {
    const templateData = {
      patientName: 'João Silva',
      appointmentDate: 'Sábado, 15/02/2025 às 10:00',
      appointmentTime: '10:00',
    };

    it('should send notification successfully', async () => {
      mockRepository.findByAppointmentAndType.mockResolvedValue(null);
      mockMessageSender.sendTextMessage.mockResolvedValue({
        success: true,
        messageId: 'msg-123',
        isMock: false,
      });
      mockRepository.create.mockResolvedValue({
        id: 'notif-123',
        appointmentId: 'appt-123',
        type: NotificationType.REMINDER_48H,
        sentAt: new Date(),
      });

      await service.sendNotification(
        'appt-123',
        '+5511999999999',
        NotificationType.REMINDER_48H,
        templateData
      );

      expect(mockRepository.findByAppointmentAndType).toHaveBeenCalledWith(
        'appt-123',
        NotificationType.REMINDER_48H
      );
      expect(mockMessageSender.sendTextMessage).toHaveBeenCalled();
      expect(mockRepository.create).toHaveBeenCalledWith(
        'appt-123',
        NotificationType.REMINDER_48H
      );
    });

    it('should skip sending if notification already sent', async () => {
      mockRepository.findByAppointmentAndType.mockResolvedValue({
        id: 'notif-123',
        appointmentId: 'appt-123',
        type: NotificationType.REMINDER_48H,
        sentAt: new Date(),
      });

      await service.sendNotification(
        'appt-123',
        '+5511999999999',
        NotificationType.REMINDER_48H,
        templateData
      );

      expect(mockMessageSender.sendTextMessage).not.toHaveBeenCalled();
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error if WhatsApp message fails', async () => {
      mockRepository.findByAppointmentAndType.mockResolvedValue(null);
      mockMessageSender.sendTextMessage.mockResolvedValue({
        success: false,
        error: 'WhatsApp API error',
        errorCode: 500,
        isMock: false,
      });

      await expect(
        service.sendNotification(
          'appt-123',
          '+5511999999999',
          NotificationType.REMINDER_48H,
          templateData
        )
      ).rejects.toThrow('WhatsApp API error');

      expect(mockRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('wasNotificationSent', () => {
    it('should return true if notification exists', async () => {
      mockRepository.findByAppointmentAndType.mockResolvedValue({
        id: 'notif-123',
        appointmentId: 'appt-123',
        type: NotificationType.REMINDER_48H,
        sentAt: new Date(),
      });

      const result = await service.wasNotificationSent('appt-123', NotificationType.REMINDER_48H);

      expect(result).toBe(true);
    });

    it('should return false if notification does not exist', async () => {
      mockRepository.findByAppointmentAndType.mockResolvedValue(null);

      const result = await service.wasNotificationSent('appt-123', NotificationType.REMINDER_48H);

      expect(result).toBe(false);
    });
  });

  describe('createTemplateData', () => {
    it('should create template data with formatted date', () => {
      const appointmentDate = new Date('2025-02-15T10:00:00');

      const data = createTemplateData(
        'João Silva',
        appointmentDate,
        'Clínica Saúde',
        'Dr. Maria'
      );

      expect(data.patientName).toBe('João Silva');
      expect(data.appointmentDate).toMatch(/Sábado, 15\/02\/2025 às \d{2}:\d{2}/);
      expect(data.clinicName).toBe('Clínica Saúde');
      expect(data.doctorName).toBe('Dr. Maria');
    });

    it('should handle optional fields', () => {
      const appointmentDate = new Date('2025-02-15T10:00:00');

      const data = createTemplateData(
        'João Silva',
        appointmentDate
      );

      expect(data.patientName).toBe('João Silva');
      expect(data.clinicName).toBeUndefined();
      expect(data.doctorName).toBeUndefined();
    });
  });
});
