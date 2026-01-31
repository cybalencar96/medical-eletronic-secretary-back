/**
 * Cancellation template tests
 */

import { CancellationTemplate } from '../../../../../src/modules/notifications/templates/cancellation.template';
import { NotificationTemplateData } from '../../../../../src/modules/notifications/notification.types';

describe('CancellationTemplate', () => {
  let template: CancellationTemplate;

  beforeEach(() => {
    template = new CancellationTemplate();
  });

  const mockTemplateData: NotificationTemplateData = {
    patientName: 'João Silva',
    appointmentDate: 'Sábado, 15/02/2025 às 10:00',
    appointmentTime: '10:00',
    reason: 'Conflito de agenda',
  };

  it('should render message with patient name', () => {
    const message = template.render(mockTemplateData);
    expect(message).toContain('João Silva');
  });

  it('should render message with appointment date and time', () => {
    const message = template.render(mockTemplateData);
    expect(message).toContain('Sábado, 15/02/2025 às 10:00');
  });

  it('should include cancellation indicator', () => {
    const message = template.render(mockTemplateData);
    expect(message).toContain('Consulta Cancelada');
  });

  it('should include cancellation reason when provided', () => {
    const message = template.render(mockTemplateData);
    expect(message).toContain('Conflito de agenda');
  });

  it('should not include reason section when reason is not provided', () => {
    const dataWithoutReason = { ...mockTemplateData, reason: undefined };
    const message = template.render(dataWithoutReason);
    expect(message).not.toContain('Motivo:');
  });

  it('should offer rebooking option', () => {
    const message = template.render(mockTemplateData);
    expect(message).toContain('Deseja reagendar');
  });

  it('should be in Brazilian Portuguese', () => {
    const message = template.render(mockTemplateData);
    expect(message).toContain('Olá');
    expect(message).toContain('foi cancelada');
    expect(message).toContain('Esperamos vê-lo em breve');
  });
});
