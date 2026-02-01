/**
 * Jest setup file that runs before all test files.
 * Sets environment variables needed for testing before any modules are imported.
 */

// Set test environment variables before any module imports
process.env.NODE_ENV = 'test';
process.env.PORT = '3000';

// Database configuration - must match docker-compose.yml defaults
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'medical_secretary_test';
process.env.DB_USER = 'postgres';
process.env.DB_PASSWORD = 'postgres';

// Redis configuration
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.REDIS_PASSWORD = 'redis';

// WhatsApp Cloud API configuration
process.env.WHATSAPP_PHONE_ID = 'test_phone_id';
process.env.WHATSAPP_ACCESS_TOKEN = 'test_access_token';
process.env.WHATSAPP_VERIFY_TOKEN = 'test-verify-token';
process.env.WHATSAPP_WEBHOOK_SECRET = 'test-webhook-secret';
process.env.WHATSAPP_MOCK = 'false'; // Default to false, tests can override

// OpenAI API configuration
process.env.OPENAI_API_KEY = 'test_openai_key';

// JWT configuration
process.env.JWT_SECRET = 'test_jwt_secret';
process.env.JWT_EXPIRES_IN = '24h';
