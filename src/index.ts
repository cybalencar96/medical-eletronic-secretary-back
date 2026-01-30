import { Server } from 'http';
import { app } from './app';
import { env } from './infrastructure/config/env';
import { logger } from './infrastructure/config/logger';

let server: Server | null = null;

/**
 * Starts the Express server on the configured port.
 * Only starts the server if not in test mode to allow integration testing.
 */
const startServer = (): Server => {
  const serverInstance = app.listen(env.PORT, () => {
    logger.info(`Server is running on port ${env.PORT}`);
    logger.info(`Environment: ${env.NODE_ENV}`);
  });

  return serverInstance;
};

/**
 * Graceful shutdown handler.
 *
 * Closes the HTTP server gracefully, allowing existing connections to complete
 * before terminating the process. This ensures:
 * - No in-flight requests are dropped
 * - Database connections are closed properly
 * - Queue workers are shut down cleanly
 */
const gracefulShutdown = (signal: string) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');

      // Close other connections here (database, queue, etc.)
      // These will be added in future tasks

      logger.info('Graceful shutdown completed');
      process.exit(0);
    });

    // Force shutdown after 10 seconds if graceful shutdown fails
    setTimeout(() => {
      logger.error('Graceful shutdown timeout. Forcing shutdown...');
      process.exit(1);
    }, 10000);
  } else {
    logger.info('No server to close. Exiting immediately');
    process.exit(0);
  }
};

// Only start the server if not in test mode
if (env.NODE_ENV !== 'test') {
  server = startServer();

  // Register graceful shutdown handlers
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

// Export app for testing
export { app, server };
