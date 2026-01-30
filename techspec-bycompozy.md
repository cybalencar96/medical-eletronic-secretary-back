## Executive Summary

A monolithic Express.js application organized into domain modules (appointments, patients, notifications, whatsapp) that provides an automated WhatsApp-based secretary for a medical clinic. The system processes patient messages asynchronously via BullMQ/Redis, uses LLM for intent recognition, enforces deterministic business rules, and escalates exceptions to human staff. A REST API serves the dashboard for doctor and secretary access.

## System Architecture

### Domain Placement

```
src/
├── modules/
│   ├── appointments/     # Booking, rescheduling, cancellation logic
│   ├── patients/         # Patient records, CPF verification
│   ├── notifications/    # Reminders, doctor alerts, message templates
│   ├── whatsapp/         # Webhook handler, message sender, Cloud API client
│   └── auth/             # Dashboard authentication (doctor/secretary)
├── infrastructure/
│   ├── database/         # PostgreSQL connection, migrations
│   ├── queue/            # BullMQ setup, workers, job definitions
│   ├── llm/              # LLM client, intent classification, prompt templates
│   └── config/           # Environment config, business rules constants
├── shared/
│   ├── errors/           # Custom error classes
│   ├── validators/       # CPF validator, date validators
│   └── types/            # TypeScript interfaces
└── api/
    ├── routes/           # REST endpoints for dashboard
    └── middleware/       # Auth, error handling, request logging
```

### Component Overview

- **WhatsApp Module**: Receives webhooks, validates signatures, publishes messages to queue
- **Queue Workers**: Process messages, invoke LLM, execute actions, send responses
- **Appointments Module**: CRUD operations, availability checks, business rule enforcement
- **Notifications Module**: Scheduled reminders (48h/72h), doctor alerts, message formatting
- **LLM Infrastructure**: Intent classification, entity extraction, response generation

## Implementation Design

### Core Interfaces

```typescript
// Intent classification result from LLM
interface ClassifiedIntent {
  intent: 'book' | 'reschedule' | 'cancel' | 'confirm' | 'query' | 'escalate';
  confidence: number;
  entities: { date?: string; time?: string; reason?: string };
}

// Appointment service interface
interface IAppointmentService {
  checkAvailability(date: Date): Promise<TimeSlot[]>;
  book(patientId: string, slot: TimeSlot): Promise<Appointment>;
  reschedule(appointmentId: string, newSlot: TimeSlot): Promise<Appointment>;
  cancel(appointmentId: string, reason: string): Promise<void>;
}

// Message processing job
interface MessageJob {
  messageId: string;
  from: string;        // WhatsApp phone number
  text: string;
  timestamp: Date;
}
```

### Data Models

```
patients: id, phone, cpf, name, created_at, consent_given_at
appointments: id, patient_id, scheduled_at, status, created_at, updated_at
audit_logs: id, patient_id, action, payload, created_at
escalations: id, patient_id, message, reason, resolved_at, resolved_by
notifications_sent: id, appointment_id, type, sent_at
```

### API Endpoints

| Method | Path | Description |
| --- | --- | --- |
| POST | `/webhook/whatsapp` | Receives WhatsApp messages |
| GET | `/webhook/whatsapp` | Webhook verification |
| GET | `/api/appointments` | List appointments (filtered by date) |
| GET | `/api/appointments/:id` | Get appointment details |
| PATCH | `/api/appointments/:id` | Update appointment status |
| GET | `/api/escalations` | List pending escalations |
| POST | `/api/escalations/:id/resolve` | Resolve escalation |
| GET | `/api/patients` | List patients |
| POST | `/api/patients` | Register new patient |

## Integration Points

### WhatsApp Cloud API

- **Webhook**: Receives messages at `/webhook/whatsapp`, validates `X-Hub-Signature-256`
- **Send API**: `POST https://graph.facebook.com/v18.0/{phone_id}/messages`
- **Required**: `WHATSAPP_PHONE_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_VERIFY_TOKEN`

### LLM Provider (OpenAI/Anthropic)

- Used for intent classification and response generation
- Structured output for deterministic parsing
- Fallback to escalation on low confidence (&lt;0.7)

## Impact Analysis

| Affected Component | Type of Impact | Description & Risk Level | Required Action |
| --- | --- | --- | --- |
| Redis | New dependency | Required for BullMQ. Low risk. | Provision Redis instance |
| PostgreSQL | New schema | New tables for patients, appointments. Low risk. | Run migrations |
| WhatsApp Business | External integration | Requires Meta Business verification. Medium risk. | Complete verification process |

## Testing Approach

### Unit Tests

- **Business rules**: Cancellation window (12h), availability checks, CPF validation
- **Intent parsing**: LLM response parsing, entity extraction
- **Date/time utilities**: Saturday-only validation, holiday detection

### Integration Tests

- **Booking flow**: Message → Queue → LLM → Appointment creation → Response
- **Cancellation flow**: Within/outside cancellation window scenarios
- **Reminder jobs**: Scheduled job execution, message sending
- **Escalation flow**: Low confidence → Escalation creation → Secretary notification

Test directory: `tests/unit/`, `tests/integration/`

## Development Sequencing

### Build Order

1. **Database schema & migrations** - Foundation for all modules
2. **Patient module** - Registration, CPF validation, lookup by phone
3. **Appointment module** - Core booking logic, business rules
4. **WhatsApp module** - Webhook handler, message sender (mock LLM initially)
5. **Queue infrastructure** - BullMQ setup, worker skeleton
6. **LLM integration** - Intent classification, response generation
7. **Notifications module** - Reminder scheduler, message templates
8. **Dashboard API** - REST endpoints for doctor/secretary
9. **End-to-end testing** - Full flow validation

### Technical Dependencies

- Redis instance (local Docker for dev)
- PostgreSQL instance
- WhatsApp Business API access (Meta Business verification)
- LLM API key (OpenAI or Anthropic)

## Monitoring & Observability

- **Metrics**: Queue depth, processing time, LLM latency, error rates
- **Logs**: Structured JSON logging with correlation IDs per conversation
- **Alerts**: Queue backlog &gt; 100, LLM errors &gt; 5/min, failed message sends
- **Dashboard**: Bull Board for queue monitoring at `/admin/queues`

## Technical Considerations

### Key Decisions

| Decision | Rationale |
| --- | --- |
| BullMQ over SQS | Node.js native, simpler local dev, sufficient for single-clinic scale |
| LLM for intent | Portuguese language flexibility, handles variations better than rules |
| Phone + CPF | Balances UX (phone lookup) with security (CPF verification for booking) |
| Monolith | MVP simplicity, single clinic scope, can evolve later |

### Known Risks

| Risk | Mitigation |
| --- | --- |
| LLM hallucination | Structured output, confidence threshold, deterministic rule validation |
| WhatsApp API rate limits | Queue-based throttling, retry with backoff |
| Patient data exposure | Row-level access control, audit logging, LGPD compliance |

### LGPD Compliance

- **Consent**: Explicit opt-in stored in `patients.consent_given_at`
- **Audit trail**: All actions logged in `audit_logs` table
- **Data deletion**: API endpoint to anonymize patient data on request
- **Data access**: Patients can only access their own appointment data

### Standards Compliance

- Express.js with TypeScript for type safety
- PostgreSQL with Knex.js for migrations and queries
- Jest for unit and integration testing
- ESLint + Prettier for code formatting
- Structured error handling with custom error classes