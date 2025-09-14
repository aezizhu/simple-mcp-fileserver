/**
 * Global Test Teardown
 *
 * Cleanup executed once after all test suites.
 * Cleans up test environment and resources.
 *
 * @author aezizhu
 */

const fs = require('fs').promises;
const path = require('path');

module.exports = async () => {
  console.log('🧹 Cleaning up MCP FileBridge test environment...');

  // Clean up temporary test files
  const cleanupDirs = [
    'tests/temp',
    'tests/results',
    'temp'
  ];

  for (const dir of cleanupDirs) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
      console.log(`🗑️  Cleaned up directory: ${dir}`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn(`⚠️  Failed to cleanup ${dir}:`, error.message);
      }
    }
  }

  // Clean up any remaining test processes
  if (global.testProcesses) {
    for (const process of global.testProcesses) {
      try {
        process.kill('SIGTERM');
      } catch (error) {
        // Ignore process cleanup errors
      }
    }
  }

  // Reset environment variables
  delete process.env.TEST_MODE;

  console.log('✅ Global test teardown completed');
};
