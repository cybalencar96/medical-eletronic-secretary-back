/**
 * Doctor alert message template for escalations and urgent events
 * All messages in Brazilian Portuguese (pt-BR)
 */

import { IMessageTemplate, NotificationTemplateData } from '../notification.types';

/**
 * Doctor alert template for urgent notifications
 */
export class DoctorAlertTemplate implements IMessageTemplate {
  render(data: NotificationTemplateData): string {
    return `🚨 *ALERTA URGENTE*

*Paciente:* ${data.patientName}
*Data da Consulta:* ${data.appointmentDate}

*Motivo do Alerta:*
${data.escalationReason || 'Mensagem urgente do paciente'}

⚠️ *AÇÃO NECESSÁRIA*
Este alerta requer atenção imediata da equipe médica. Por favor, verifique os detalhes e tome as providências necessárias.

Enviado automaticamente pelo sistema de agendamento.`;
  }
}
