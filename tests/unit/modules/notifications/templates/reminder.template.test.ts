/**
 * Reminder template tests
 */

import { Reminder48hTemplate, Reminder72hTemplate } from '../../../../../src/modules/notifications/templates/reminder.template';
import { NotificationTemplateData } from '../../../../../src/modules/notifications/notification.types';

describe('Reminder Templates', () => {
  const mockTemplateData: NotificationTemplateData = {
    patientName: 'João Silva',
    appointmentDate: 'Sábado, 15/02/2025 às 10:00',
    appointmentTime: '10:00',
    clinicName: 'Clínica Saúde Total',
    doctorName: 'Dr. Maria Santos',
  };

  describe('Reminder48hTemplate', () => {
    let template: Reminder48hTemplate;

    beforeEach(() => {
      template = new Reminder48hTemplate();
    });

    it('should render message with patient name', () => {
      const message = template.render(mockTemplateData);
      expect(message).toContain('João Silva');
    });

    it('should render message with appointment date and time', () => {
      const message = template.render(mockTemplateData);
      expect(message).toContain('Sábado, 15/02/2025 às 10:00');
    });

    it('should include clinic name in message', () => {
      const message = template.render(mockTemplateData);
      expect(message).toContain('Clínica Saúde Total');
    });

    it('should include doctor name in message', () => {
      const message = template.render(mockTemplateData);
      expect(message).toContain('Dr. Maria Santos');
    });

    it('should include cancellation policy with 12-hour window', () => {
      const message = template.render(mockTemplateData);
      expect(message).toContain('12 horas');
      expect(message).toContain('Cancelamento');
    });

    it('should be in Brazilian Portuguese', () => {
      const message = template.render(mockTemplateData);
      expect(message).toContain('Olá');
      expect(message).toContain('consulta agendada');
      expect(message).toContain('Local');
      expect(message).toContain('Profissional');
    });

    it('should use default clinic name when not provided', () => {
      const dataWithoutClinic = { ...mockTemplateData, clinicName: undefined };
      const message = template.render(dataWithoutClinic);
      expect(message).toContain('Clínica Médica');
    });

    it('should use default doctor name when not provided', () => {
      const dataWithoutDoctor = { ...mockTemplateData, doctorName: undefined };
      const message = template.render(dataWithoutDoctor);
      expect(message).toContain('Dr(a).');
    });
  });

  describe('Reminder72hTemplate', () => {
    let template: Reminder72hTemplate;

    beforeEach(() => {
      template = new Reminder72hTemplate();
    });

    it('should render message with patient name', () => {
      const message = template.render(mockTemplateData);
      expect(message).toContain('João Silva');
    });

    it('should render message with appointment date and time', () => {
      const message = template.render(mockTemplateData);
      expect(message).toContain('Sábado, 15/02/2025 às 10:00');
    });

    it('should request confirmation from patient', () => {
      const message = template.render(mockTemplateData);
      expect(message).toContain('confirme sua presença');
    });

    it('should include cancellation reminder', () => {
      const message = template.render(mockTemplateData);
      expect(message).toContain('12 horas');
    });

    it('should be in Brazilian Portuguese', () => {
      const message = template.render(mockTemplateData);
      expect(message).toContain('Olá');
      expect(message).toContain('consulta agendada');
      expect(message).toContain('Aguardamos você');
    });
  });
});
