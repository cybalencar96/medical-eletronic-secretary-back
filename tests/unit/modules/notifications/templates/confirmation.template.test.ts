/**
 * Confirmation template tests
 */

import { ConfirmationTemplate } from '../../../../../src/modules/notifications/templates/confirmation.template';
import { NotificationTemplateData } from '../../../../../src/modules/notifications/notification.types';

describe('ConfirmationTemplate', () => {
  let template: ConfirmationTemplate;

  beforeEach(() => {
    template = new ConfirmationTemplate();
  });

  const mockTemplateData: NotificationTemplateData = {
    patientName: 'João Silva',
    appointmentDate: 'Sábado, 15/02/2025 às 10:00',
    appointmentTime: '10:00',
    clinicName: 'Clínica Saúde Total',
    doctorName: 'Dr. Maria Santos',
  };

  it('should render message with patient name', () => {
    const message = template.render(mockTemplateData);
    expect(message).toContain('João Silva');
  });

  it('should render message with appointment date and time', () => {
    const message = template.render(mockTemplateData);
    expect(message).toContain('Sábado, 15/02/2025 às 10:00');
  });

  it('should include confirmation indicator', () => {
    const message = template.render(mockTemplateData);
    expect(message).toContain('Consulta Confirmada');
  });

  it('should request explicit confirmation', () => {
    const message = template.render(mockTemplateData);
    expect(message).toContain('confirme sua presença');
  });

  it('should include arrival instructions', () => {
    const message = template.render(mockTemplateData);
    expect(message).toContain('15 minutos de antecedência');
  });

  it('should include document requirements', () => {
    const message = template.render(mockTemplateData);
    expect(message).toContain('documentos de identificação');
  });

  it('should be in Brazilian Portuguese', () => {
    const message = template.render(mockTemplateData);
    expect(message).toContain('Olá');
    expect(message).toContain('agendada com sucesso');
    expect(message).toContain('Importante');
  });
});
