.PHONY: help install build dev test test-watch test-integration lint lint-fix format format-check clean docker-up docker-down docker-logs migrate-latest migrate-rollback

# Default target
help:
	@echo "Available targets:"
	@echo "  install          - Install dependencies"
	@echo "  build            - Build TypeScript to JavaScript"
	@echo "  dev              - Run development server with hot-reload"
	@echo "  test             - Run all tests with coverage"
	@echo "  test-watch       - Run tests in watch mode"
	@echo "  test-integration - Run integration tests only"
	@echo "  lint             - Run ESLint"
	@echo "  lint-fix         - Fix ESLint issues automatically"
	@echo "  format           - Format code with Prettier"
	@echo "  format-check     - Check code formatting"
	@echo "  clean            - Remove build artifacts"
	@echo "  docker-up        - Start Docker Compose services"
	@echo "  docker-down      - Stop Docker Compose services"
	@echo "  docker-logs      - View Docker Compose logs"
	@echo "  migrate-latest   - Run database migrations"
	@echo "  migrate-rollback - Rollback last migration"

# Install dependencies
install:
	npm ci

# Build TypeScript
build:
	npm run build

# Development server
dev:
	npm run dev

# Testing
test:
	npm run test

test-watch:
	npm run test:watch

test-integration:
	npm run test:integration

# Linting
lint:
	npm run lint

lint-fix:
	npm run lint:fix

# Formatting
format:
	npm run format

format-check:
	npm run format:check

# Clean build artifacts
clean:
	rm -rf dist coverage node_modules

# Docker operations
docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

docker-logs:
	docker-compose logs -f

# Database migrations
migrate-latest:
	npm run migrate:latest

migrate-rollback:
	npm run migrate:rollback
