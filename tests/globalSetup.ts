/**
 * Jest global setup hook
 * Runs once before all tests to verify Docker services are available and apply database migrations
 */

import knex, { Knex } from 'knex';
import { Client } from 'pg';
import knexConfig from '../knexfile';
import { waitForServices } from './utils/service-health';

/**
 * Creates the test database if it doesn't exist
 */
async function ensureTestDatabaseExists(): Promise<void> {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: 'postgres', // Connect to default postgres database
  });

  try {
    await client.connect();

    // Check if the test database exists
    const result = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = 'medical_secretary_test'"
    );

    if (result.rows.length === 0) {
      console.warn('Creating test database: medical_secretary_test');
      await client.query('CREATE DATABASE medical_secretary_test');
      console.warn('Test database created successfully');
    } else {
      console.warn('Test database already exists');
    }
  } finally {
    await client.end();
  }
}

/**
 * Global setup function that Jest calls before running any tests
 * Verifies that PostgreSQL and Redis are available and applies database migrations
 *
 * Note: This only runs for integration tests. Unit tests skip service verification.
 *
 * @throws Error when services are unavailable after 30s timeout
 */
export default async function globalSetup(): Promise<void> {
  // Check if we're running integration tests
  // Jest passes command line args through process.argv
  const isIntegrationTest = process.argv.some(
    (arg) => arg.includes('testPathPattern') && arg.includes('integration')
  );

  // Check if we're explicitly ignoring integration tests (unit test run)
  const isUnitTest = process.argv.some(
    (arg) => arg.includes('testPathIgnorePatterns') && arg.includes('integration')
  );

  // Skip service checks for unit tests
  if (isUnitTest && !isIntegrationTest) {
    console.warn('\n=== Jest Global Setup ===');
    console.warn('Skipping service verification for unit tests');
    console.warn('=== Global Setup Complete ===\n');
    return;
  }

  console.warn('\n=== Jest Global Setup ===');
  console.warn('Verifying Docker services are available...\n');

  try {
    // Wait for PostgreSQL and Redis to be healthy (30s timeout)
    await waitForServices({
      maxRetries: 10,
      retryDelayMs: 3000,
      timeoutMs: 30000,
    });

    console.warn('\n=== Ensuring Test Database Exists ===');
    await ensureTestDatabaseExists();

    console.warn('\n=== Running Database Migrations ===');

    // Create Knex instance for test environment
    const environment = process.env.NODE_ENV || 'test';
    const db: Knex = knex(knexConfig[environment]);

    try {
      // Apply all pending migrations
      const [batchNo, log] = await db.migrate.latest();

      if (log.length === 0) {
        console.warn('Database is already up to date (no new migrations applied)');
      } else {
        console.warn(`Batch ${batchNo} run: ${log.length} migration(s)`);
        log.forEach((migration: string) => {
          console.warn(`  - ${migration}`);
        });
      }

      console.warn('\n=== Global Setup Complete ===\n');
    } finally {
      // Clean up the Knex connection
      await db.destroy();
    }
  } catch (error) {
    console.error('\n=== Global Setup Failed ===');
    console.error(error instanceof Error ? error.message : String(error));
    console.error('\nPlease ensure Docker services are running:');
    console.error('  docker compose --profile test up -d\n');
    throw error;
  }
}
