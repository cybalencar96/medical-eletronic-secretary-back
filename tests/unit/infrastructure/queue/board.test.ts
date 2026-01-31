/**
 * Unit tests for Bull Board configuration module.
 *
 * Note: Bull Board uses module-level initialization (side effects on import),
 * which makes traditional unit testing with mocks impractical. This module
 * is properly validated through integration tests in
 * tests/integration/api/bull-board.routes.test.ts which verify:
 * - Bull Board router is correctly mounted at /admin/queues
 * - JWT authentication protects access
 * - All queues are visible in the UI
 * - Real-time metrics and job operations work correctly
 *
 * The tests below verify module structure and exports.
 */

import { bullBoardRouter } from '../../../../src/infrastructure/queue/board';

// Mock BullMQ to prevent actual Redis connections during tests
jest.mock('bullmq');

describe('Bull Board Module', () => {
  it('should export bullBoardRouter', () => {
    // This is a smoke test to verify the module structure
    // Full functionality is tested in integration tests
    expect(bullBoardRouter).toBeDefined();
    expect(typeof bullBoardRouter).toBe('function'); // Express Router is a function
  });
});
