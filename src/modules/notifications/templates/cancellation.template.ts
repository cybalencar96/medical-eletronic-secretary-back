/**
 * Cancellation message template for appointments
 * All messages in Brazilian Portuguese (pt-BR)
 */

import { IMessageTemplate, NotificationTemplateData } from '../notification.types';

/**
 * Appointment cancellation template
 */
export class CancellationTemplate implements IMessageTemplate {
  render(data: NotificationTemplateData): string {
    const reasonText = data.reason ? `\n\n*Motivo:* ${data.reason}` : '';

    return `❌ *Consulta Cancelada*

Olá, ${data.patientName},

Sua consulta agendada para ${data.appointmentDate} foi cancelada.${reasonText}

🔄 *Deseja reagendar?*
Entre em contato conosco para marcar uma nova data. Temos horários disponíveis e ficaremos felizes em atendê-lo.

📞 Responda esta mensagem ou ligue para agendar.

Esperamos vê-lo em breve! 🏥`;
  }
}
