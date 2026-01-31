/**
 * Patient Repository Integration Tests
 *
 * Tests for patient repository with real database operations
 */

import { Client } from 'pg';
import knex, { Knex } from 'knex';
import knexConfig from '../../../../knexfile';
import { PatientRepository } from '../../../../src/modules/patients/patient.repository';
import { CreatePatientDTO } from '../../../../src/modules/patients/interfaces/patient.interface';

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

describe('Patient Repository Integration Tests', () => {
  let db: Knex;
  let patientRepository: PatientRepository;
  let servicesAvailable: boolean;

  beforeAll(async () => {
    servicesAvailable = await areDockerServicesAvailable();

    if (!servicesAvailable) {
      console.warn('PostgreSQL is not available. Skipping integration tests.');
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

    // Ensure clean state and run migrations
    await db.migrate.rollback(undefined, true);
    await db.migrate.latest();

    // Create repository instance with test database
    patientRepository = new PatientRepository(db);
  });

  afterAll(async () => {
    if (servicesAvailable && db) {
      await db.migrate.rollback(undefined, true);
      await db.destroy();
    }
  });

  beforeEach(async () => {
    if (!servicesAvailable) return;

    // Clean up test data before each test
    await db('notifications_sent').del();
    await db('escalations').del();
    await db('audit_logs').del();
    await db('appointments').del();
    await db('patients').del();
  });

  describe('create', () => {
    it('should create a patient record in database', async () => {
      if (!servicesAvailable) return;

      const patientData: CreatePatientDTO = {
        phone: '+5511999999999',
        cpf: '12345678909',
        name: 'John Doe',
        consent_given_at: new Date(),
      };

      const patient = await patientRepository.create(patientData);

      expect(patient).toBeDefined();
      expect(patient.id).toBeDefined();
      expect(patient.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(patient.phone).toBe(patientData.phone);
      expect(patient.cpf).toBe(patientData.cpf);
      expect(patient.name).toBe(patientData.name);
      expect(patient.created_at).toBeDefined();
      expect(patient.consent_given_at).toBeDefined();
    });

    it('should create patient with null consent_given_at', async () => {
      if (!servicesAvailable) return;

      const patientData: CreatePatientDTO = {
        phone: '+5511888888888',
        cpf: '98765432100',
        name: 'Jane Doe',
      };

      const patient = await patientRepository.create(patientData);

      expect(patient).toBeDefined();
      expect(patient.consent_given_at).toBeNull();
    });

    it('should enforce unique constraint on phone number', async () => {
      if (!servicesAvailable) return;

      const patientData: CreatePatientDTO = {
        phone: '+5511999999999',
        cpf: '12345678909',
        name: 'John Doe',
        consent_given_at: new Date(),
      };

      await patientRepository.create(patientData);

      // Attempt to create duplicate phone
      const duplicateData: CreatePatientDTO = {
        phone: '+5511999999999',
        cpf: '98765432100',
        name: 'Jane Doe',
      };

      await expect(patientRepository.create(duplicateData)).rejects.toThrow();
    });
  });

  describe('findByPhone', () => {
    it('should find patient by phone number', async () => {
      if (!servicesAvailable) return;

      const patientData: CreatePatientDTO = {
        phone: '+5511999999999',
        cpf: '12345678909',
        name: 'John Doe',
        consent_given_at: new Date(),
      };

      const createdPatient = await patientRepository.create(patientData);

      const foundPatient = await patientRepository.findByPhone('+5511999999999');

      expect(foundPatient).toBeDefined();
      expect(foundPatient?.id).toBe(createdPatient.id);
      expect(foundPatient?.phone).toBe(createdPatient.phone);
      expect(foundPatient?.cpf).toBe(createdPatient.cpf);
      expect(foundPatient?.name).toBe(createdPatient.name);
    });

    it('should return null when patient not found by phone', async () => {
      if (!servicesAvailable) return;

      const foundPatient = await patientRepository.findByPhone('+5511000000000');

      expect(foundPatient).toBeNull();
    });

    it('should find correct patient when multiple patients exist', async () => {
      if (!servicesAvailable) return;

      const patient1Data: CreatePatientDTO = {
        phone: '+5511111111111',
        cpf: '11111111111',
        name: 'Patient One',
      };

      const patient2Data: CreatePatientDTO = {
        phone: '+5511222222222',
        cpf: '22222222222',
        name: 'Patient Two',
      };

      await patientRepository.create(patient1Data);
      const createdPatient2 = await patientRepository.create(patient2Data);

      const foundPatient = await patientRepository.findByPhone('+5511222222222');

      expect(foundPatient).toBeDefined();
      expect(foundPatient?.id).toBe(createdPatient2.id);
      expect(foundPatient?.phone).toBe(patient2Data.phone);
    });
  });

  describe('findById', () => {
    it('should find patient by ID', async () => {
      if (!servicesAvailable) return;

      const patientData: CreatePatientDTO = {
        phone: '+5511999999999',
        cpf: '12345678909',
        name: 'John Doe',
        consent_given_at: new Date(),
      };

      const createdPatient = await patientRepository.create(patientData);

      const foundPatient = await patientRepository.findById(createdPatient.id);

      expect(foundPatient).toBeDefined();
      expect(foundPatient?.id).toBe(createdPatient.id);
      expect(foundPatient?.phone).toBe(createdPatient.phone);
      expect(foundPatient?.cpf).toBe(createdPatient.cpf);
      expect(foundPatient?.name).toBe(createdPatient.name);
    });

    it('should return null when patient not found by ID', async () => {
      if (!servicesAvailable) return;

      const foundPatient = await patientRepository.findById('123e4567-e89b-12d3-a456-426614174000');

      expect(foundPatient).toBeNull();
    });
  });

  describe('update', () => {
    it('should update patient record', async () => {
      if (!servicesAvailable) return;

      const patientData: CreatePatientDTO = {
        phone: '+5511999999999',
        cpf: '12345678909',
        name: 'John Doe',
      };

      const createdPatient = await patientRepository.create(patientData);

      const consentDate = new Date();
      const updatedPatient = await patientRepository.update(createdPatient.id, {
        consent_given_at: consentDate,
      });

      expect(updatedPatient).toBeDefined();
      expect(updatedPatient.id).toBe(createdPatient.id);
      expect(updatedPatient.consent_given_at).toBeDefined();
    });

    it('should update patient name', async () => {
      if (!servicesAvailable) return;

      const patientData: CreatePatientDTO = {
        phone: '+5511999999999',
        cpf: '12345678909',
        name: 'John Doe',
      };

      const createdPatient = await patientRepository.create(patientData);

      const updatedPatient = await patientRepository.update(createdPatient.id, {
        name: 'John Smith',
      });

      expect(updatedPatient).toBeDefined();
      expect(updatedPatient.id).toBe(createdPatient.id);
      expect(updatedPatient.name).toBe('John Smith');
    });

    it('should update patient CPF', async () => {
      if (!servicesAvailable) return;

      const patientData: CreatePatientDTO = {
        phone: '+5511999999999',
        cpf: '12345678909',
        name: 'John Doe',
      };

      const createdPatient = await patientRepository.create(patientData);

      const updatedPatient = await patientRepository.update(createdPatient.id, {
        cpf: '98765432100',
      });

      expect(updatedPatient).toBeDefined();
      expect(updatedPatient.id).toBe(createdPatient.id);
      expect(updatedPatient.cpf).toBe('98765432100');
    });
  });

  describe('database transaction rollback', () => {
    it('should rollback transaction on error', async () => {
      if (!servicesAvailable) return;

      const patientData: CreatePatientDTO = {
        phone: '+5511999999999',
        cpf: '12345678909',
        name: 'John Doe',
      };

      await patientRepository.create(patientData);

      // Attempt to create duplicate should fail
      const duplicateData: CreatePatientDTO = {
        phone: '+5511999999999',
        cpf: '98765432100',
        name: 'Jane Doe',
      };

      await expect(patientRepository.create(duplicateData)).rejects.toThrow();

      // Verify only one patient exists
      const patients = await db('patients').select('*');
      expect(patients).toHaveLength(1);
    });
  });
});
