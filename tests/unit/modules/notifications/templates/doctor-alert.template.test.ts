/**
 * Doctor alert template tests
 */

import { DoctorAlertTemplate } from '../../../../../src/modules/notifications/templates/doctor-alert.template';
import { NotificationTemplateData } from '../../../../../src/modules/notifications/notification.types';

describe('DoctorAlertTemplate', () => {
  let template: DoctorAlertTemplate;

  beforeEach(() => {
    template = new DoctorAlertTemplate();
  });

  const mockTemplateData: NotificationTemplateData = {
    patientName: 'João Silva',
    appointmentDate: 'Sábado, 15/02/2025 às 10:00',
    appointmentTime: '10:00',
    escalationReason: 'Paciente reportou dor intensa',
  };

  it('should render message with patient name', () => {
    const message = template.render(mockTemplateData);
    expect(message).toContain('João Silva');
  });

  it('should render message with appointment date', () => {
    const message = template.render(mockTemplateData);
    expect(message).toContain('Sábado, 15/02/2025 às 10:00');
  });

  it('should include urgent alert indicator', () => {
    const message = template.render(mockTemplateData);
    expect(message).toContain('ALERTA URGENTE');
  });

  it('should include escalation reason', () => {
    const message = template.render(mockTemplateData);
    expect(message).toContain('Paciente reportou dor intensa');
  });

  it('should use default reason when not provided', () => {
    const dataWithoutReason = { ...mockTemplateData, escalationReason: undefined };
    const message = template.render(dataWithoutReason);
    expect(message).toContain('Mensagem urgente do paciente');
  });

  it('should indicate action required', () => {
    const message = template.render(mockTemplateData);
    expect(message).toContain('AÇÃO NECESSÁRIA');
  });

  it('should be in Brazilian Portuguese', () => {
    const message = template.render(mockTemplateData);
    expect(message).toContain('Paciente');
    expect(message).toContain('Data da Consulta');
    expect(message).toContain('Motivo do Alerta');
  });
});
