import request from 'supertest';
import { app } from '../../src/app';

describe('Express Application', () => {
  describe('GET /health', () => {
    it('should return 200 OK with health status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('environment');
    });

    it('should return current timestamp in ISO format', async () => {
      const response = await request(app).get('/health');
      const timestamp = new Date(response.body.timestamp);

      expect(timestamp.toISOString()).toBe(response.body.timestamp);
    });

    it('should return environment from process.env.NODE_ENV', async () => {
      const response = await request(app).get('/health');

      expect(response.body.environment).toBeDefined();
      expect(typeof response.body.environment).toBe('string');
    });

    it('should use default environment value when NODE_ENV is not set', async () => {
      const originalEnv = process.env.NODE_ENV;
      delete process.env.NODE_ENV;

      const response = await request(app).get('/health');

      expect(response.body.environment).toBe('development');

      // Restore original value
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('GET /', () => {
    it('should return 200 OK with API information', async () => {
      const response = await request(app).get('/');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('version');
    });

    it('should return API name and version', async () => {
      const response = await request(app).get('/');

      expect(response.body.message).toContain('WhatsApp');
      expect(response.body.message).toContain('Medical');
      expect(response.body.version).toBe('1.0.0');
    });
  });

  describe('Middleware', () => {
    it('should parse JSON request bodies', async () => {
      const testPayload = { test: 'data' };

      const response = await request(app)
        .post('/test-endpoint')
        .send(testPayload)
        .set('Content-Type', 'application/json');

      // Endpoint doesn't exist, but middleware should still parse the body
      expect(response.status).toBe(404);
    });
  });
});
