import fs from 'fs';
import path from 'path';
import yaml from 'yaml';

describe('Docker Setup Configuration', () => {
  const rootDir = path.resolve(__dirname, '../..');

  describe('docker-compose.yml validation', () => {
    let dockerCompose: any;

    beforeAll(() => {
      const dockerComposeContent = fs.readFileSync(
        path.join(rootDir, 'docker-compose.yml'),
        'utf-8'
      );
      dockerCompose = yaml.parse(dockerComposeContent);
    });

    it('should have valid YAML syntax', () => {
      expect(dockerCompose).toBeDefined();
      expect(dockerCompose.version).toBe('3.8');
    });

    it('should define PostgreSQL 15 service', () => {
      expect(dockerCompose.services.postgres).toBeDefined();
      expect(dockerCompose.services.postgres.image).toMatch(/postgres:15/);
    });

    it('should define Redis 7 service', () => {
      expect(dockerCompose.services.redis).toBeDefined();
      expect(dockerCompose.services.redis.image).toMatch(/redis:7/);
    });

    it('should define application service', () => {
      expect(dockerCompose.services.app).toBeDefined();
      expect(dockerCompose.services.app.build).toBeDefined();
    });

    it('should configure PostgreSQL health check', () => {
      expect(dockerCompose.services.postgres.healthcheck).toBeDefined();
      expect(dockerCompose.services.postgres.healthcheck.test).toBeDefined();
    });

    it('should configure Redis health check', () => {
      expect(dockerCompose.services.redis.healthcheck).toBeDefined();
      expect(dockerCompose.services.redis.healthcheck.test).toBeDefined();
    });

    it('should configure application health check', () => {
      expect(dockerCompose.services.app.healthcheck).toBeDefined();
      expect(dockerCompose.services.app.healthcheck.test).toBeDefined();
    });

    it('should expose correct ports', () => {
      expect(dockerCompose.services.postgres.ports).toContain('${DB_PORT:-5432}:5432');
      expect(dockerCompose.services.redis.ports).toContain('${REDIS_PORT:-6379}:6379');
      expect(dockerCompose.services.app.ports).toContain('${PORT:-3000}:3000');
    });

    it('should define persistent volumes', () => {
      expect(dockerCompose.volumes.postgres_data).toBeDefined();
      expect(dockerCompose.volumes.redis_data).toBeDefined();
    });

    it('should configure app service dependencies', () => {
      expect(dockerCompose.services.app.depends_on).toBeDefined();
      expect(dockerCompose.services.app.depends_on.postgres).toBeDefined();
      expect(dockerCompose.services.app.depends_on.redis).toBeDefined();
    });

    it('should define network configuration', () => {
      expect(dockerCompose.networks['medical-secretary-network']).toBeDefined();
    });
  });

  describe('Dockerfile validation', () => {
    let dockerfileContent: string;

    beforeAll(() => {
      dockerfileContent = fs.readFileSync(path.join(rootDir, 'Dockerfile'), 'utf-8');
    });

    it('should exist and be readable', () => {
      expect(dockerfileContent).toBeDefined();
      expect(dockerfileContent.length).toBeGreaterThan(0);
    });

    it('should use Node.js 20 alpine base image', () => {
      expect(dockerfileContent).toMatch(/FROM node:20-alpine/);
    });

    it('should have multi-stage build', () => {
      expect(dockerfileContent).toMatch(/FROM.*AS base/);
      expect(dockerfileContent).toMatch(/FROM.*AS dependencies/);
      expect(dockerfileContent).toMatch(/FROM.*AS build/);
      expect(dockerfileContent).toMatch(/FROM.*AS development/);
      expect(dockerfileContent).toMatch(/FROM.*AS production/);
    });

    it('should expose port 3000', () => {
      expect(dockerfileContent).toMatch(/EXPOSE 3000/);
    });

    it('should set working directory', () => {
      expect(dockerfileContent).toMatch(/WORKDIR \/app/);
    });
  });

  describe('.env.example validation', () => {
    let envExampleContent: string;

    beforeAll(() => {
      envExampleContent = fs.readFileSync(path.join(rootDir, '.env.example'), 'utf-8');
    });

    it('should exist and be readable', () => {
      expect(envExampleContent).toBeDefined();
      expect(envExampleContent.length).toBeGreaterThan(0);
    });

    it('should include database configuration variables', () => {
      expect(envExampleContent).toMatch(/DATABASE_URL/);
      expect(envExampleContent).toMatch(/DB_HOST/);
      expect(envExampleContent).toMatch(/DB_PORT/);
      expect(envExampleContent).toMatch(/DB_NAME/);
      expect(envExampleContent).toMatch(/DB_USER/);
      expect(envExampleContent).toMatch(/DB_PASSWORD/);
    });

    it('should include Redis configuration variables', () => {
      expect(envExampleContent).toMatch(/REDIS_HOST/);
      expect(envExampleContent).toMatch(/REDIS_PORT/);
      expect(envExampleContent).toMatch(/REDIS_PASSWORD/);
    });

    it('should include WhatsApp configuration variables', () => {
      expect(envExampleContent).toMatch(/WHATSAPP_PHONE_ID/);
      expect(envExampleContent).toMatch(/WHATSAPP_ACCESS_TOKEN/);
      expect(envExampleContent).toMatch(/WHATSAPP_VERIFY_TOKEN/);
      expect(envExampleContent).toMatch(/WHATSAPP_MOCK/);
    });

    it('should include OpenAI configuration variables', () => {
      expect(envExampleContent).toMatch(/OPENAI_API_KEY/);
      expect(envExampleContent).toMatch(/OPENAI_MODEL/);
    });

    it('should include JWT configuration variables', () => {
      expect(envExampleContent).toMatch(/JWT_SECRET/);
      expect(envExampleContent).toMatch(/JWT_EXPIRES_IN/);
    });
  });

  describe('.dockerignore validation', () => {
    let dockerignoreContent: string;

    beforeAll(() => {
      dockerignoreContent = fs.readFileSync(path.join(rootDir, '.dockerignore'), 'utf-8');
    });

    it('should exist and be readable', () => {
      expect(dockerignoreContent).toBeDefined();
      expect(dockerignoreContent.length).toBeGreaterThan(0);
    });

    it('should exclude node_modules', () => {
      expect(dockerignoreContent).toMatch(/node_modules/);
    });

    it('should exclude .git directory', () => {
      expect(dockerignoreContent).toMatch(/\.git/);
    });

    it('should exclude environment files', () => {
      expect(dockerignoreContent).toMatch(/\.env/);
    });

    it('should exclude build outputs', () => {
      expect(dockerignoreContent).toMatch(/dist/);
    });

    it('should exclude coverage reports', () => {
      expect(dockerignoreContent).toMatch(/coverage/);
    });
  });
});
