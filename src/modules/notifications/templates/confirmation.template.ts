/**
 * Confirmation message template for appointment bookings
 * All messages in Brazilian Portuguese (pt-BR)
 */

import { IMessageTemplate, NotificationTemplateData } from '../notification.types';

/**
 * Appointment confirmation template
 */
export class ConfirmationTemplate implements IMessageTemplate {
  render(data: NotificationTemplateData): string {
    return `✅ *Consulta Confirmada*

Olá, ${data.patientName}!

Sua consulta foi agendada com sucesso para ${data.appointmentDate}.

📍 Local: ${data.clinicName || 'Clínica Médica'}
👨‍⚕️ Profissional: ${data.doctorName || 'Dr(a).'}

*Por favor, confirme sua presença respondendo a esta mensagem.*

⚠️ *Importante*
- Chegue com 15 minutos de antecedência
- Traga documentos de identificação e cartão do convênio (se aplicável)
- Cancelamentos devem ser feitos com pelo menos 12 horas de antecedência

Qualquer dúvida, estamos à disposição!

Até breve! 🏥`;
  }
}
