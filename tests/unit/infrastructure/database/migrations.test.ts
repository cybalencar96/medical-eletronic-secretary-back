import knex, { Knex } from 'knex';
import { Client } from 'pg';
import knexConfig from '../../../../knexfile';

/**
 * Check if Docker services (PostgreSQL) are available
 */
async function areDockerServicesAvailable(): Promise<boolean> {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: 'postgres',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  try {
    await client.connect();
    await client.end();
    return true;
  } catch {
    return false;
  }
}

describe('Database Migrations', () => {
  let db: Knex;
  let servicesAvailable: boolean;

  beforeAll(async () => {
    servicesAvailable = await areDockerServicesAvailable();

    if (!servicesAvailable) {
      console.warn('PostgreSQL is not available. Skipping migration tests.');
      return;
    }

    // Use test database configuration
    const testConfig = {
      ...knexConfig.development,
      connection: {
        ...(knexConfig.development.connection as Knex.PgConnectionConfig),
        database: 'medical_secretary_test',
      },
    };
    db = knex(testConfig);

    // Ensure clean state
    await db.migrate.rollback(undefined, true);
  });

  afterAll(async () => {
    if (servicesAvailable && db) {
      await db.migrate.rollback(undefined, true);
      await db.destroy();
    }
  });

  describe('Migration Execution', () => {
    it('should run all migrations successfully', async () => {
      if (!servicesAvailable) return;

      const [batch, migrations] = await db.migrate.latest();
      expect(batch).toBeGreaterThan(0);
      expect(migrations).toHaveLength(5);
      expect(migrations).toEqual(
        expect.arrayContaining([
          expect.stringContaining('create_patients_table'),
          expect.stringContaining('create_appointments_table'),
          expect.stringContaining('create_audit_logs_table'),
          expect.stringContaining('create_escalations_table'),
          expect.stringContaining('create_notifications_sent_table'),
        ])
      );
    });

    it('should create patients table with correct schema', async () => {
      if (!servicesAvailable) return;

      const hasTable = await db.schema.hasTable('patients');
      expect(hasTable).toBe(true);

      const columns = await db('patients').columnInfo();
      expect(columns).toHaveProperty('id');
      expect(columns).toHaveProperty('phone');
      expect(columns).toHaveProperty('cpf');
      expect(columns).toHaveProperty('name');
      expect(columns).toHaveProperty('created_at');
      expect(columns).toHaveProperty('consent_given_at');
    });

    it('should create appointments table with correct schema', async () => {
      if (!servicesAvailable) return;

      const hasTable = await db.schema.hasTable('appointments');
      expect(hasTable).toBe(true);

      const columns = await db('appointments').columnInfo();
      expect(columns).toHaveProperty('id');
      expect(columns).toHaveProperty('patient_id');
      expect(columns).toHaveProperty('scheduled_at');
      expect(columns).toHaveProperty('status');
      expect(columns).toHaveProperty('created_at');
      expect(columns).toHaveProperty('updated_at');
    });

    it('should create audit_logs table with correct schema', async () => {
      if (!servicesAvailable) return;

      const hasTable = await db.schema.hasTable('audit_logs');
      expect(hasTable).toBe(true);

      const columns = await db('audit_logs').columnInfo();
      expect(columns).toHaveProperty('id');
      expect(columns).toHaveProperty('patient_id');
      expect(columns).toHaveProperty('action');
      expect(columns).toHaveProperty('payload');
      expect(columns).toHaveProperty('created_at');
    });

    it('should create escalations table with correct schema', async () => {
      if (!servicesAvailable) return;

      const hasTable = await db.schema.hasTable('escalations');
      expect(hasTable).toBe(true);

      const columns = await db('escalations').columnInfo();
      expect(columns).toHaveProperty('id');
      expect(columns).toHaveProperty('patient_id');
      expect(columns).toHaveProperty('message');
      expect(columns).toHaveProperty('reason');
      expect(columns).toHaveProperty('created_at');
      expect(columns).toHaveProperty('resolved_at');
      expect(columns).toHaveProperty('resolved_by');
    });

    it('should create notifications_sent table with correct schema', async () => {
      if (!servicesAvailable) return;

      const hasTable = await db.schema.hasTable('notifications_sent');
      expect(hasTable).toBe(true);

      const columns = await db('notifications_sent').columnInfo();
      expect(columns).toHaveProperty('id');
      expect(columns).toHaveProperty('appointment_id');
      expect(columns).toHaveProperty('type');
      expect(columns).toHaveProperty('sent_at');
    });
  });

  describe('Migration Rollback', () => {
    it('should rollback all migrations successfully', async () => {
      if (!servicesAvailable) return;

      const [batch, migrations] = await db.migrate.rollback(undefined, true);
      expect(batch).toBeGreaterThan(0);
      expect(migrations).toHaveLength(5);
    });

    it('should remove all tables after rollback', async () => {
      if (!servicesAvailable) return;

      const hasPatients = await db.schema.hasTable('patients');
      const hasAppointments = await db.schema.hasTable('appointments');
      const hasAuditLogs = await db.schema.hasTable('audit_logs');
      const hasEscalations = await db.schema.hasTable('escalations');
      const hasNotifications = await db.schema.hasTable('notifications_sent');

      expect(hasPatients).toBe(false);
      expect(hasAppointments).toBe(false);
      expect(hasAuditLogs).toBe(false);
      expect(hasEscalations).toBe(false);
      expect(hasNotifications).toBe(false);
    });

    it('should be able to re-run migrations after rollback', async () => {
      if (!servicesAvailable) return;

      const [batch, migrations] = await db.migrate.latest();
      expect(batch).toBeGreaterThan(0);
      expect(migrations).toHaveLength(5);

      const hasPatients = await db.schema.hasTable('patients');
      expect(hasPatients).toBe(true);
    });
  });

  describe('Table Structure Validation', () => {
    beforeAll(async () => {
      if (servicesAvailable) {
        await db.migrate.latest();
      }
    });

    it('should validate timestamp columns have defaults', async () => {
      if (!servicesAvailable) return;

      const patientColumns = await db('patients').columnInfo();
      expect(patientColumns.created_at.defaultValue).not.toBeNull();

      const appointmentColumns = await db('appointments').columnInfo();
      expect(appointmentColumns.created_at.defaultValue).not.toBeNull();
      expect(appointmentColumns.updated_at.defaultValue).not.toBeNull();
    });

    it('should validate appointments status enum has correct values', async () => {
      if (!servicesAvailable) return;

      const columns = await db('appointments').columnInfo();
      // Knex enum() creates a text column with a check constraint in PostgreSQL
      expect(columns.status.type).toBe('text');
      expect(columns.status.defaultValue).toContain('scheduled');
    });

    it('should validate UUID columns use gen_random_uuid()', async () => {
      if (!servicesAvailable) return;

      const patientColumns = await db('patients').columnInfo();
      expect(patientColumns.id.defaultValue).toContain('gen_random_uuid');

      const appointmentColumns = await db('appointments').columnInfo();
      expect(appointmentColumns.id.defaultValue).toContain('gen_random_uuid');
    });
  });
});
