# 📄 PRD — Secretária Eletrônica para Consultório Médico (v1)

## 1. Visão do Produto

Desenvolver uma **secretária eletrônica via WhatsApp** para um consultório médico de pequeno porte, com o objetivo de **reduzir erros operacionais**, **diminuir a carga da secretária humana** e **organizar a agenda médica**, mantendo controle humano para exceções.

O sistema atua como **assistente administrativo**, não substituindo profissionais de saúde nem realizando decisões clínicas ou financeiras.

---

## 2. Problema a Ser Resolvido

Consultórios pequenos enfrentam falhas recorrentes devido a:

- erros manuais de agendamento  
- baixa organização operacional  
- dependência excessiva de secretária humana  
- dificuldade de gerenciar agenda, reagendamentos e confirmações  
- mensagens fora do horário e tarefas repetitivas  

Essas falhas geram:
- conflitos de agenda  
- faltas de pacientes  
- retrabalho  
- insatisfação do médico e dos pacientes  

---

## 3. Objetivos do Produto

### Objetivos Principais
- Reduzir erros de agendamento  
- Automatizar tarefas administrativas repetitivas  
- Garantir consistência e confiabilidade da agenda  
- Melhorar a comunicação com pacientes  

### Objetivos Fora do Escopo
- Pagamentos  
- Emissão de recibo saúde  
- Orientações médicas clínicas  
- Diagnóstico, prescrição ou triagem médica  

---

## 4. Usuários e Personas

### Paciente
- Agenda, confirma, reage nda ou cancela consultas via WhatsApp  
- Recebe orientações administrativas  
- Não recebe orientação médica  

### Secretária
- Valida exceções  
- Atua como fallback humano  
- Confere solicitações fora das regras automáticas  

### Médico
- Visualiza agenda e status das consultas  
- Recebe notificações relevantes  
- Atua como administrador do sistema  

---

## 5. Escopo do MVP

### Funcionalidades Incluídas
- Agendamento via WhatsApp  
- Reagendamento via WhatsApp  
- Cancelamento de consultas com regras  
- Confirmação automática de consultas  
- Envio de lembretes e orientações administrativas  
- Dashboard simples para médico e secretária  
- Notificações automáticas ao médico  

### Funcionalidades Excluídas
- Pagamentos  
- Emissão de recibos  
- Orientações médicas  
- Comunicação clínica  
- Encaixes automáticos  

---

## 6. Regras de Agenda (Business Rules)

### Janela mínima de cancelamento
- Cancelamentos permitidos até **12 horas antes** da consulta  
- Cancelamentos fora dessa janela:
  - não são automáticos  
  - exigem validação humana  
  - podem gerar penalidades futuras (fora do escopo do MVP)  

### Duração da consulta
- Duração fixa de **2 horas**  
- Não é permitido estender o horário final da consulta  

### Reagendamentos
- Permitidos sem limite  
- Devem respeitar regras de horário e disponibilidade  

### Horários de atendimento
- Atendimento apenas aos **sábados, das 09:00 às 18:00**  
- Todos os outros horários são bloqueados  
- Feriados são automaticamente bloqueados  

### Política de atraso
- Tolerância de até **20 minutos**  
- Após esse período, a consulta é marcada como **não comparecimento**  
- O horário final não pode ser estendido  

---

## 7. Contrato de Responsabilidade do Chatbot

### Papel do Chatbot
O chatbot atua como **assistente administrativo**, responsável por executar regras de agenda, interagir com pacientes e escalar exceções para humanos.

### O chatbot PODE:
- Agendar consultas em horários disponíveis  
- Reagendar consultas conforme regras  
- Cancelar consultas dentro da janela permitida  
- Solicitar confirmação de presença  
- Enviar lembretes e orientações administrativas  
- Informar regras do consultório  
- Encaminhar solicitações fora do padrão para a secretária  
- Notificar o médico sobre eventos relevantes  

### O chatbot NÃO PODE:
- Fornecer orientações médicas  
- Responder dúvidas clínicas  
- Interpretar exames  
- Realizar diagnósticos  
- Prescrever tratamentos  
- Processar pagamentos  
- Emitir recibos  
- Autorizar exceções às regras  
- Estender consultas  
- Autorizar encaixes  

### Frases obrigatórias de contenção
O chatbot deve utilizar mensagens padronizadas como:
- “Essa solicitação precisa ser avaliada pela secretária.”  
- “Para dúvidas médicas, por favor aguarde o atendimento direto com o médico.”  
- “Não consigo realizar essa ação automaticamente, mas vou registrar sua solicitação.”  

---

## 8. Comunicação Ativa com o Médico

O chatbot deve notificar o médico nos seguintes momentos:

### Criação ou reagendamento de consulta
- Notificação imediata após confirmação  

### Confirmação do paciente
- Notificação no momento da confirmação  

### Lembrete antecipado
- Envio de resumo da agenda **48 horas antes** das consultas  

### Orientações pré-consulta
- **72 horas antes** da consulta:
  - verificar se há orientações específicas  
  - enviar orientações ao paciente, se existirem  
  - caso contrário, enviar mensagem padrão  

---

## 9. Segurança e Guardrails

- O chatbot não aceita redefinição de papel ou autoridade  
- Regras de agenda não podem ser alteradas por linguagem natural  
- Todas as ações passam por validação determinística  
- Solicitações fora do padrão são escaladas para humanos  
- Pacientes só acessam seus próprios dados  
- Limitação de ações repetitivas para evitar abuso  

---

## 10. Compliance LGPD (nível produto)

- Tratamento de dados pessoais e sensíveis  
- Registro e auditoria de interações  
- Consentimento explícito do paciente  
- Possibilidade de exclusão de dados  
- Dados não utilizados para treino de modelos  

---

## 11. Métricas de Sucesso

- Percentual de agendamentos automatizados  
- Redução de erros de agenda  
- Redução de mensagens manuais  
- Taxa de faltas antes e depois do sistema  
- Tempo médio de resposta ao paciente  

---

## 12. Riscos Identificados

- Ambiguidade na linguagem do paciente  
- Dependência excessiva do chatbot  
- Falhas em integrações externas  
- Resistência operacional da secretária  

---

## 13. Fora do Escopo (explícito)

- Pagamentos  
- Emissão de recibos  
- Atendimento clínico  
- Diagnóstico ou triagem  
- Automação de decisões excepcionais  

---

**Fim do PRD — versão v1**
