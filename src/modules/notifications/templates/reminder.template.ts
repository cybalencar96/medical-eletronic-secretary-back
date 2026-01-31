/**
 * Reminder message templates for appointment notifications
 * All messages in Brazilian Portuguese (pt-BR)
 */

import { IMessageTemplate, NotificationTemplateData } from '../notification.types';

/**
 * 48-hour reminder template
 */
export class Reminder48hTemplate implements IMessageTemplate {
  render(data: NotificationTemplateData): string {
    return `Olá, ${data.patientName}! 👋

Este é um lembrete de que você tem uma consulta agendada para ${data.appointmentDate}.

📍 Local: ${data.clinicName || 'Clínica Médica'}
👨‍⚕️ Profissional: ${data.doctorName || 'Dr(a).'}

⚠️ *Política de Cancelamento*
Caso precise cancelar, por favor nos informe com pelo menos 12 horas de antecedência. Cancelamentos com menos de 12 horas de antecedência poderão incorrer em taxas.

Para cancelar ou reagendar, responda esta mensagem ou entre em contato conosco.

Até breve! 🏥`;
  }
}

/**
 * 72-hour reminder template
 */
export class Reminder72hTemplate implements IMessageTemplate {
  render(data: NotificationTemplateData): string {
    return `Olá, ${data.patientName}! 👋

Lembramos que você tem uma consulta agendada para ${data.appointmentDate}.

📍 Local: ${data.clinicName || 'Clínica Médica'}
👨‍⚕️ Profissional: ${data.doctorName || 'Dr(a).'}

Por favor, confirme sua presença respondendo esta mensagem.

⚠️ Lembre-se: cancelamentos devem ser feitos com pelo menos 12 horas de antecedência.

Aguardamos você! 🏥`;
  }
}
