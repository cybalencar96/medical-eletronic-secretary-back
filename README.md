# WhatsApp Medical Electronic Secretary - Backend

AI-powered medical appointment scheduling system using WhatsApp Cloud API with intent recognition via OpenAI GPT-4o-mini.

## Overview

This backend system provides:
- **WhatsApp Integration**: Webhook-driven message handling via WhatsApp Cloud API
- **AI Intent Recognition**: OpenAI GPT-4o-mini for classifying user intents (appointment booking, cancellation, etc.)
- **Appointment Management**: Scheduling, confirmation, cancellation, and reminder notifications
- **Patient Registry**: CPF validation, consent management, and LGPD compliance
- **Queue Processing**: Asynchronous message handling with BullMQ and Redis
- **Dashboard API**: REST endpoints for clinic staff to manage appointments and view analytics

## Tech Stack

- **Runtime**: Node.js 20 LTS
- **Language**: TypeScript 5.x
- **Framework**: Express.js 4.x
- **Database**: PostgreSQL 15
- **Queue**: Redis 7 + BullMQ 5.x
- **Migrations**: Knex.js 3.x
- **AI**: OpenAI GPT-4o-mini
- **Testing**: Jest
- **Logging**: Pino

## Prerequisites

- Docker 24.x or higher
- Docker Compose 2.x or higher
- Node.js 20 LTS (for local development without Docker)

## Quick Start with Docker

### 1. Clone the repository

```bash
git clone <repository-url>
cd medical-eletronic-secretary-back
```

### 2. Set up environment variables

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env` and configure:
- **WhatsApp Cloud API**: Get credentials from [Meta Business Suite](https://business.facebook.com/)
- **OpenAI API**: Get API key from [OpenAI Platform](https://platform.openai.com/api-keys)
- **Database & Redis**: Default values work for local Docker setup
- **JWT**: Generate a secure secret with `openssl rand -base64 32`

### 3. Start the development environment

```bash
docker-compose up
```

This will start:
- **PostgreSQL 15** on port 5432
- **Redis 7** on port 6379
- **Application** on port 3000

### 4. Verify the setup

Check all services are healthy:

```bash
# Check application health
curl http://localhost:3000/health

# Expected response:
# {"status":"ok","timestamp":"2024-01-15T10:30:00.000Z","environment":"development"}
```

## Development Workflow

### Running the application

```bash
# Start all services
docker-compose up

# Start in detached mode (background)
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop all services
docker-compose down

# Stop and remove volumes (⚠️ deletes data)
docker-compose down -v
```

### Testing

```bash
# Run all tests
make test

# Run tests in watch mode
npm run test:watch

# Run integration tests only
npm run test:integration
```

### Linting and Formatting

```bash
# Run linting
make lint

# Fix linting issues
npm run lint:fix

# Format code with Prettier
npm run format

# Check formatting
npm run format:check
```

### Database Migrations

```bash
# Run pending migrations
npm run migrate:latest

# Rollback last migration
npm run migrate:rollback

# Create new migration
npm run migrate:make migration_name
```

## Project Structure

```
├── src/
│   ├── modules/           # Domain modules
│   │   ├── appointments/  # Appointment booking logic
│   │   ├── patients/      # Patient registration and consent
│   │   ├── notifications/ # Reminder scheduling
│   │   ├── whatsapp/      # WhatsApp integration
│   │   └── auth/          # JWT authentication
│   ├── infrastructure/    # Technical infrastructure
│   │   ├── database/      # Knex.js configuration
│   │   ├── queue/         # BullMQ setup
│   │   ├── llm/           # OpenAI integration
│   │   └── config/        # Environment config
│   ├── shared/            # Cross-cutting concerns
│   │   ├── errors/        # Error classes
│   │   ├── validators/    # Input validation
│   │   └── types/         # Shared TypeScript types
│   ├── api/               # HTTP layer
│   │   ├── routes/        # Express routes
│   │   └── middleware/    # Request middleware
│   └── index.ts           # Application entry point
├── migrations/            # Knex.js database migrations
├── tests/                 # Test files
│   ├── unit/             # Unit tests
│   └── integration/      # Integration tests
├── docker-compose.yml     # Docker services
├── Dockerfile             # Application container
└── package.json          # Node.js dependencies
```

## Environment Variables

See `.env.example` for complete list. Key variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/medical_secretary` |
| `REDIS_HOST` | Redis hostname | `localhost` |
| `WHATSAPP_PHONE_ID` | WhatsApp Phone Number ID from Meta | - |
| `WHATSAPP_ACCESS_TOKEN` | WhatsApp Access Token | - |
| `WHATSAPP_MOCK` | Use mock mode without real API | `true` |
| `OPENAI_API_KEY` | OpenAI API key | - |
| `OPENAI_MODEL` | OpenAI model to use | `gpt-4o-mini` |
| `JWT_SECRET` | Secret for JWT signing | - |

## API Endpoints

### Health Check
```
GET /health
```

### Root
```
GET /
```

More endpoints will be added as modules are implemented.

## Testing

The project requires ≥80% test coverage. Tests are organized into:

- **Unit tests**: Test individual components in isolation
- **Integration tests**: Test Docker services and API endpoints

Run tests with:
```bash
make test
```

## Contributing

1. Create a feature branch
2. Make your changes with tests
3. Ensure tests pass (`make test`)
4. Ensure linting passes (`make lint`)
5. Submit a pull request

## License

ISC
