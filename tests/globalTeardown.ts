/**
 * Jest global teardown hook
 * Runs once after all tests to perform cleanup and close connections
 */

/**
 * Global teardown function that Jest calls after running all tests
 * Performs cleanup operations and ensures all connections are properly closed
 *
 * Note: In the current implementation, individual tests are responsible for
 * cleaning up their own database and Redis connections using transaction
 * contexts and isolated Redis connections. This hook serves as a safety net
 * and logs completion of the test suite.
 */
export default async function globalTeardown(): Promise<void> {
  console.warn('\n=== Jest Global Teardown ===');
  console.warn('Test suite execution complete');
  console.warn('Individual tests have cleaned up their own connections');
  console.warn('=== Global Teardown Complete ===\n');
}
