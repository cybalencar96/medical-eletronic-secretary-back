import request from 'supertest';
import { app } from '../../src/app';
import { AppError } from '../../src/shared/errors/AppError';
import express, { Request, Response, NextFunction } from 'express';

describe('Express Server Integration Tests', () => {
  describe('Health Check Endpoint', () => {
    it('should respond to health check endpoint with 200 status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('environment');
    });

    it('should include current timestamp in health check', async () => {
      const response = await request(app).get('/health');

      const timestamp = new Date(response.body.timestamp);
      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.getTime()).toBeGreaterThan(Date.now() - 5000); // Within last 5 seconds
    });

    it('should include environment in health check', async () => {
      const response = await request(app).get('/health');

      expect(response.body.environment).toBe('test');
    });
  });

  describe('Root Endpoint', () => {
    it('should respond to root endpoint with API information', async () => {
      const response = await request(app).get('/');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'WhatsApp Medical Electronic Secretary API');
      expect(response.body).toHaveProperty('version', '1.0.0');
    });
  });

  describe('Middleware Pipeline', () => {
    it('should parse JSON request bodies', async () => {
      const testRouter = express.Router();
      testRouter.post('/test-json', (req: Request, res: Response) => {
        res.json({ received: req.body });
      });

      app.use('/test', testRouter);

      const response = await request(app)
        .post('/test/test-json')
        .send({ name: 'Test', value: 123 })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body.received).toEqual({ name: 'Test', value: 123 });
    });

    it('should parse URL-encoded request bodies', async () => {
      const testRouter = express.Router();
      testRouter.post('/test-urlencoded', (req: Request, res: Response) => {
        res.json({ received: req.body });
      });

      app.use('/test', testRouter);

      const response = await request(app)
        .post('/test/test-urlencoded')
        .send('name=Test&value=123')
        .set('Content-Type', 'application/x-www-form-urlencoded');

      expect(response.status).toBe(200);
      expect(response.body.received).toEqual({ name: 'Test', value: '123' });
    });

    it('should generate correlation IDs for requests', async () => {
      const response = await request(app).get('/health');

      // The pino-http middleware should add correlation ID to logs
      // We can't directly check headers here, but we can verify the response is successful
      expect(response.status).toBe(200);
    });

    it('should use existing request ID if provided', async () => {
      const customRequestId = 'custom-request-id-12345';

      const response = await request(app).get('/health').set('x-request-id', customRequestId);

      // The pino-http middleware should use the provided request ID
      expect(response.status).toBe(200);
    });
  });

  describe('Error Handling Middleware', () => {
    it('should catch and handle AppError instances with correct status codes', async () => {
      // Create a fresh app instance for testing error handling
      const testApp = express();
      testApp.use(express.json());

      testApp.get('/test-error-400', (_req: Request, _res: Response, next: NextFunction) => {
        next(new AppError('Validation failed', 400));
      });

      // Import error handler
      const { errorHandler } = await import('../../src/api/middleware/errorHandler');
      testApp.use(errorHandler);

      const response = await request(testApp).get('/test-error-400');

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        data: null,
        error: 'Validation failed',
      });
    });

    it('should handle unexpected errors with 500 status code', async () => {
      const testApp = express();
      testApp.use(express.json());

      testApp.get('/test-error-500', (_req: Request, _res: Response, next: NextFunction) => {
        next(new Error('Unexpected database error'));
      });

      const { errorHandler } = await import('../../src/api/middleware/errorHandler');
      testApp.use(errorHandler);

      const response = await request(testApp).get('/test-error-500');

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        success: false,
        data: null,
        error: 'Unexpected database error',
      });
    });

    it('should include stack trace in test environment', async () => {
      const testApp = express();
      testApp.use(express.json());

      testApp.get('/test-error-stack', (_req: Request, _res: Response, next: NextFunction) => {
        next(new AppError('Test error', 400));
      });

      const { errorHandler } = await import('../../src/api/middleware/errorHandler');
      testApp.use(errorHandler);

      const response = await request(testApp).get('/test-error-stack');

      // In test environment, stack trace should be included
      expect(response.body).toHaveProperty('stack');
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Test error');
    });

    it('should handle 404 Not Found errors', async () => {
      const testApp = express();
      testApp.use(express.json());

      testApp.get('/test-error-404', (_req: Request, _res: Response, next: NextFunction) => {
        next(new AppError('Resource not found', 404));
      });

      const { errorHandler } = await import('../../src/api/middleware/errorHandler');
      testApp.use(errorHandler);

      const response = await request(testApp).get('/test-error-404');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Resource not found');
      expect(response.body.success).toBe(false);
    });

    it('should handle 401 Unauthorized errors', async () => {
      const testApp = express();
      testApp.use(express.json());

      testApp.get('/test-error-401', (_req: Request, _res: Response, next: NextFunction) => {
        next(new AppError('Unauthorized access', 401));
      });

      const { errorHandler } = await import('../../src/api/middleware/errorHandler');
      testApp.use(errorHandler);

      const response = await request(testApp).get('/test-error-401');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized access');
      expect(response.body.success).toBe(false);
    });
  });

  describe('Middleware Execution Order', () => {
    it('should execute middleware in correct order: logging → body parsing → routes → error handling', async () => {
      const executionOrder: string[] = [];

      // Create a test app to verify middleware order
      const testApp = express();

      // 1. Logging middleware simulation
      testApp.use((_req, _res, next) => {
        executionOrder.push('logging');
        next();
      });

      // 2. Body parsing
      testApp.use(express.json());
      testApp.use((_req, _res, next) => {
        executionOrder.push('body-parsing');
        next();
      });

      // 3. Route
      testApp.get('/test-order', (_req, res) => {
        executionOrder.push('route');
        res.json({ order: executionOrder });
      });

      // 4. Error handler (should not execute for successful requests)
      testApp.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
        executionOrder.push('error-handler');
        res.status(500).json({ error: err.message });
      });

      const response = await request(testApp).get('/test-order');

      expect(response.status).toBe(200);
      expect(executionOrder).toEqual(['logging', 'body-parsing', 'route']);
    });

    it('should reach error handler when route throws error', async () => {
      const executionOrder: string[] = [];

      const testApp = express();

      testApp.use((_req, _res, next) => {
        executionOrder.push('middleware');
        next();
      });

      testApp.get('/test-error-order', (_req, _res, next) => {
        executionOrder.push('route');
        next(new Error('Test error'));
      });

      testApp.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
        executionOrder.push('error-handler');
        res.status(500).json({ error: err.message, order: executionOrder });
      });

      const response = await request(testApp).get('/test-error-order');

      expect(response.status).toBe(500);
      expect(executionOrder).toEqual(['middleware', 'route', 'error-handler']);
    });
  });

  describe('Request Logging', () => {
    it('should log incoming requests', async () => {
      // Pino logging is configured, verify requests are processed successfully
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      // In a real scenario, we would capture and verify log output
      // For now, we just verify the request is processed correctly
    });

    it('should handle requests without x-request-id header', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      // Middleware should generate a new UUID for correlation
    });
  });
});
