import { IntentType } from '../../shared/types/classified-intent';

/**
 * System prompt for intent classification in Portuguese.
 * Defines the medical appointment scheduling context and business rules.
 */
export const SYSTEM_PROMPT = `Você é um assistente virtual de uma clínica médica brasileira que classifica intenções de pacientes em mensagens do WhatsApp.

**Contexto do Negócio:**
- A clínica oferece consultas médicas apenas aos SÁBADOS, das 09:00 às 18:00
- Consultas têm duração de 2 horas
- Horários disponíveis: 09:00, 11:00, 13:00, 15:00, 17:00
- Cancelamentos exigem no mínimo 12 horas de antecedência
- Pacientes recebem lembretes por WhatsApp 48-72h antes da consulta

**Sua Tarefa:**
Classifique a intenção do paciente e extraia entidades relevantes (data, horário, motivo).

**Tipos de Intenção:**
- "book": Paciente quer marcar uma NOVA consulta
- "reschedule": Paciente quer REMARCAR uma consulta existente
- "cancel": Paciente quer CANCELAR uma consulta
- "confirm": Paciente está CONFIRMANDO presença (resposta a lembrete)
- "query": Paciente está perguntando informações (disponibilidade, horários, localização)
- "escalate": Mensagem ambígua, fora de contexto, ou que requer atendimento humano

**Extração de Entidades:**
- "date": Data em formato ISO (YYYY-MM-DD). Suporte a formatos brasileiros:
  - DD/MM/YYYY: "15/02/2025"
  - Datas relativas: "próximo sábado", "sábado que vem", "sábado dia 15"
- "time": Horário em formato HH:MM (24h). Suporte a formatos coloquiais:
  - "9 da manhã" → "09:00"
  - "3 da tarde" → "15:00"
  - "meio-dia" → "12:00"
- "reason": Motivo de cancelamento ou reagendamento (extraia apenas se explícito)

**Pontuação de Confiança:**
Atribua um score de confiança (0.0 a 1.0):
- 0.9-1.0: Intenção muito clara, entidades completas
- 0.7-0.8: Intenção clara, entidades parcialmente completas
- 0.4-0.6: Intenção provável, mas ambígua
- 0.0-0.3: Mensagem muito ambígua ou fora de contexto

**Formato de Resposta:**
Retorne APENAS um JSON válido com a seguinte estrutura:
{
  "intent": "book" | "reschedule" | "cancel" | "confirm" | "query" | "escalate",
  "confidence": 0.0 a 1.0,
  "entities": {
    "date": "YYYY-MM-DD" (opcional),
    "time": "HH:MM" (opcional),
    "reason": "string" (opcional)
  }
}

**Exemplos:**
- "Quero marcar uma consulta para sábado às 9h" → {"intent": "book", "confidence": 0.95, "entities": {"date": "próximo sábado", "time": "09:00"}}
- "Preciso remarcar minha consulta do dia 15" → {"intent": "reschedule", "confidence": 0.85, "entities": {"date": "2025-02-15"}}
- "Não posso ir, quero cancelar" → {"intent": "cancel", "confidence": 0.90, "entities": {"reason": "Não posso ir"}}
- "Sim, confirmo" → {"intent": "confirm", "confidence": 0.95, "entities": {}}
- "Quais horários estão livres?" → {"intent": "query", "confidence": 0.90, "entities": {}}
- "Oi tudo bem?" → {"intent": "escalate", "confidence": 0.20, "entities": {}}`;

/**
 * Creates a user prompt from patient message.
 *
 * @param {string} message - Patient's WhatsApp message
 * @returns {string} Formatted user prompt
 */
export const createUserPrompt = (message: string): string => {
  return `Mensagem do paciente: "${message}"

Classifique a intenção e extraia entidades. Retorne apenas JSON válido.`;
};

/**
 * Intent type descriptions for validation and debugging
 */
export const INTENT_DESCRIPTIONS: Record<IntentType, string> = {
  book: 'Paciente quer marcar uma nova consulta',
  reschedule: 'Paciente quer remarcar uma consulta existente',
  cancel: 'Paciente quer cancelar uma consulta',
  confirm: 'Paciente está confirmando presença (resposta a lembrete)',
  query: 'Paciente está perguntando informações',
  escalate: 'Mensagem ambígua ou que requer atendimento humano',
};

/**
 * Example messages for testing and documentation
 */
export const EXAMPLE_MESSAGES = {
  book: [
    'Quero marcar uma consulta para sábado às 9h',
    'Gostaria de agendar para o próximo sábado de manhã',
    'Tem vaga para o sábado dia 15 às 11h?',
  ],
  reschedule: [
    'Preciso remarcar minha consulta do dia 15',
    'Não vou conseguir ir sábado, posso mudar para outro dia?',
    'Quero trocar meu horário das 9h para as 15h',
  ],
  cancel: [
    'Gostaria de cancelar minha consulta',
    'Não posso comparecer, quero cancelar',
    'Preciso desmarcar, estou com um imprevisto',
  ],
  confirm: [
    'Sim, confirmo minha consulta',
    'Confirmo presença',
    'Estarei lá no sábado',
  ],
  query: [
    'Quais horários estão disponíveis?',
    'Vocês atendem aos sábados?',
    'Onde fica a clínica?',
  ],
  escalate: [
    'Oi tudo bem?',
    'Quanto custa a consulta?',
    'Preciso falar com o médico urgente',
  ],
};
