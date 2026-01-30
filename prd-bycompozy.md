## Overview

A WhatsApp-based electronic secretary for small medical clinics that automates appointment scheduling, reduces operational errors, and decreases the administrative burden on human staff. The system acts as an administrative assistant only - never providing medical advice or making clinical decisions.

With 82% of Brazilians already using WhatsApp for healthcare communication, this solution meets patients where they are, while addressing the 15-30% no-show rates typical in small clinics.

**Target**: Start with a single clinic, designed for future expansion through configurable business rules.

## Goals

- **Reduce scheduling errors** by automating appointment booking, rescheduling, and cancellation with deterministic rule validation
- **Decrease no-show rates** through automated reminders and confirmation requests
- **Free secretary time** by handling repetitive scheduling tasks automatically
- **Improve patient satisfaction** by providing 24/7 self-service scheduling via WhatsApp
- **Maintain human control** by escalating exceptions immediately to the secretary

## User Stories

### Patient

- As a patient, I want to book an appointment via WhatsApp so I can schedule without calling during office hours
- As a patient, I want to reschedule my appointment via WhatsApp so I can adjust when my availability changes
- As a patient, I want to cancel my appointment via WhatsApp so I can free the slot for others
- As a patient, I want to receive reminders so I don't forget my appointment
- As a patient, I want to confirm my attendance so the clinic knows I'm coming

### Secretary

- As a secretary, I want the chatbot to handle standard scheduling so I can focus on complex tasks
- As a secretary, I want to receive immediate transfers with context when the chatbot cannot handle a request
- As a secretary, I want clear visibility into what actions the chatbot performed

### Doctor

- As a doctor, I want a reliable, consistent schedule without double-bookings or errors
- As a doctor, I want to be notified when appointments are created, changed, or confirmed

## Core Features

### 1. Appointment Booking via WhatsApp

Patients can book appointments through natural conversation on WhatsApp.

- Show available time slots based on clinic schedule
- Collect patient identification and contact information
- Confirm booking with appointment details
- Notify doctor of new appointment

**Functional Requirements:**

- FR1.1: Only offer slots within configured operating hours (Saturdays 09:00-18:00)
- FR1.2: Respect 2-hour consultation duration when calculating availability
- FR1.3: Block holidays automatically
- FR1.4: Prevent double-booking same time slot

### 2. Appointment Rescheduling via WhatsApp

Patients can reschedule existing appointments to new available slots.

- Identify patient's existing appointment
- Show alternative available slots
- Update appointment and notify relevant parties

**Functional Requirements:**

- FR2.1: Allow unlimited rescheduling
- FR2.2: Maintain appointment history for audit
- FR2.3: Notify doctor of rescheduled appointments

### 3. Appointment Cancellation via WhatsApp

Patients can cancel appointments following the clinic's cancellation policy.

- Validate cancellation is within allowed window (12+ hours before)
- Process cancellation and free the slot
- Escalate to secretary if outside cancellation window

**Functional Requirements:**

- FR3.1: Allow automatic cancellation only if 12+ hours before appointment
- FR3.2: Cancellations within 12 hours require secretary validation
- FR3.3: Record cancellation reason for reporting

### 4. Automated Reminders and Confirmations

System proactively contacts patients to confirm attendance and reduce no-shows.

- Send reminder 48 hours before appointment
- Request confirmation of attendance
- Track confirmation status

**Functional Requirements:**

- FR4.1: Send reminder message 48 hours before each appointment
- FR4.2: Allow patient to confirm, reschedule, or cancel from reminder
- FR4.3: Notify doctor of confirmation status

### 5. Human Escalation

When the chatbot cannot handle a request, it transfers immediately to the secretary with full context.

- Detect requests outside automated capabilities
- Transfer conversation with context to secretary
- Inform patient that secretary will assist

**Functional Requirements:**

- FR5.1: Escalate immediately with conversation history
- FR5.2: Clearly inform patient of the handoff
- FR5.3: Never attempt to answer medical questions

## User Experience

### Patient Journey

1. Patient sends message to clinic's WhatsApp
2. Chatbot greets and identifies intent (book, reschedule, cancel, or other)
3. For scheduling actions: chatbot guides through the process with clear options
4. For exceptions: chatbot transfers to secretary immediately with context
5. Patient receives confirmation of completed action
6. Patient receives reminder 48 hours before appointment

### Chatbot Boundaries

The chatbot MUST use containment phrases when appropriate:

- "This request needs to be evaluated by the secretary."
- "For medical questions, please wait for your appointment with the doctor."
- "I cannot perform this action automatically, but I'll register your request."

### Accessibility

- Simple, clear language appropriate for all literacy levels
- Numbered options for easy selection
- Support for voice messages (transcribed for processing)

## Non-Goals (Out of Scope)

### MVP Exclusions

- Dashboard for doctor/secretary (Phase 2)
- Pre-consultation instructions (Phase 2)
- Advanced doctor notifications beyond basic alerts (Phase 2)
- Waitlist management for cancelled slots (Future)
- Post-appointment feedback collection (Future)

### Permanent Exclusions

- Payment processing
- Receipt/invoice generation
- Medical advice or clinical information
- Diagnosis, prescriptions, or triage
- Automatic fit-in appointments (encaixes)
- Extending consultation duration beyond 2 hours

## Business Rules

| Rule | Value | Notes |
| --- | --- | --- |
| Operating hours | Saturdays 09:00-18:00 | Configurable for expansion |
| Consultation duration | 2 hours fixed | Cannot be extended |
| Cancellation window | 12 hours minimum | Earlier cancellations require secretary |
| Late tolerance | 20 minutes | After which marked as no-show |
| Holidays | Automatically blocked | Based on Brazilian calendar |
| Rescheduling limit | Unlimited | Must respect availability |

## Compliance Requirements

- **LGPD**: Health data is sensitive personal data requiring explicit consent
- **Data minimization**: Collect only necessary information
- **Audit trail**: Log all interactions and actions
- **Data deletion**: Support patient data deletion requests
- **No AI training**: Patient data not used to train models

## Success Metrics

| Metric | Target | Baseline |
| --- | --- | --- |
| Automated booking rate | 70% of appointments via WhatsApp | 0% |
| No-show rate reduction | 40-50% reduction | 20-30% typical |
| Scheduling errors | Near zero | Manual error rate |
| Secretary time saved | 60% reduction in scheduling tasks | 3-4 hours daily |
| Patient response time | Under 30 seconds | N/A |
| Confirmation rate | 90% appointments confirmed | 50-60% with manual calls |

## Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Ambiguous patient messages | Wrong action taken | Conservative interpretation + escalation |
| Over-reliance on chatbot | Missed exceptions | Clear escalation paths, secretary oversight |
| WhatsApp API changes | Service disruption | Monitor API updates, maintain fallback |
| Secretary resistance | Poor adoption | Involve secretary in testing, show time savings |
| Patient adoption | Low usage | Clear communication about availability |
