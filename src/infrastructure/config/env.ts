import dotenv from 'dotenv';
import { AppError } from '../../shared/errors/AppError';

// Load environment variables from .env file
dotenv.config();

/**
 * Environment variable configuration interface.
 * Defines all required and optional environment variables used by the application.
 */
interface EnvConfig {
  // Server configuration
  NODE_ENV: string;
  PORT: number;

  // Database configuration (optional, will be required in future tasks)
  DB_HOST?: string;
  DB_PORT?: number;
  DB_NAME?: string;
  DB_USER?: string;
  DB_PASSWORD?: string;

  // Redis configuration (optional, will be required in future tasks)
  REDIS_HOST?: string;
  REDIS_PORT?: number;
  REDIS_PASSWORD?: string;

  // WhatsApp Cloud API configuration (optional, will be required in future tasks)
  WHATSAPP_PHONE_NUMBER_ID?: string;
  WHATSAPP_ACCESS_TOKEN?: string;
  WHATSAPP_VERIFY_TOKEN?: string;
  WHATSAPP_WEBHOOK_SECRET?: string;

  // OpenAI API configuration (optional, will be required in future tasks)
  OPENAI_API_KEY?: string;

  // JWT configuration (optional, will be required in future tasks)
  JWT_SECRET?: string;
  JWT_EXPIRES_IN?: string;
}

/**
 * Validates and returns the environment configuration.
 *
 * This function ensures all required environment variables are present
 * and converts them to the appropriate types. It throws an AppError
 * if any required variable is missing.
 *
 * @returns {EnvConfig} Validated environment configuration
 * @throws {AppError} If required environment variables are missing
 */
const loadEnvConfig = (): EnvConfig => {
  const requiredVars = ['NODE_ENV', 'PORT'];
  const missingVars = requiredVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new AppError(
      `Missing required environment variables: ${missingVars.join(', ')}`,
      500,
      false
    );
  }

  return {
    NODE_ENV: process.env.NODE_ENV as string,
    PORT: parseInt(process.env.PORT as string, 10),

    // Database configuration
    DB_HOST: process.env.DB_HOST,
    DB_PORT: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : undefined,
    DB_NAME: process.env.DB_NAME,
    DB_USER: process.env.DB_USER,
    DB_PASSWORD: process.env.DB_PASSWORD,

    // Redis configuration
    REDIS_HOST: process.env.REDIS_HOST,
    REDIS_PORT: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : undefined,
    REDIS_PASSWORD: process.env.REDIS_PASSWORD,

    // WhatsApp Cloud API configuration
    WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID,
    WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN,
    WHATSAPP_VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN,
    WHATSAPP_WEBHOOK_SECRET: process.env.WHATSAPP_WEBHOOK_SECRET,

    // OpenAI API configuration
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,

    // JWT configuration
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
  };
};

/**
 * Singleton environment configuration instance.
 * Loaded once at application startup to ensure consistency.
 */
export const env = loadEnvConfig();
