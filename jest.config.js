/**
 * Jest Configuration for MCP FileBridge
 *
 * Comprehensive test configuration for unit, integration, and e2e tests.
 * Includes coverage reporting, mocking, and performance testing.
 *
 * @author aezizhu
 */

module.exports = {
  // Test environment
  testEnvironment: 'node',

  // Test patterns
  testMatch: [
    '<rootDir>/tests/unit/**/*.test.(js|ts)',
    '<rootDir>/tests/integration/**/*.test.(js|ts)',
    '<rootDir>/tests/e2e/**/*.test.(js|ts)'
  ],

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // Module file extensions
  moduleFileExtensions: ['ts', 'js', 'json'],

  // Transform files
  transform: {
    '^.+\\.ts$': 'ts-jest',
    '^.+\\.js$': 'babel-jest'
  },

  // Module name mapping
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },

  // Test timeout (30 seconds for integration tests)
  testTimeout: 30000,

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.ts',
    'src/**/*.js',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts'
  ],

  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json-summary'
  ],

  coverageThreshold: {
    global: {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },

  // Test categories
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/',
    '/logs/'
  ],

  // Mock configuration
  clearMocks: true,
  restoreMocks: true,

  // Performance testing
  detectOpenHandles: true,
  forceExit: true,

  // Verbose output
  verbose: true,

  // Parallel execution
  maxWorkers: '50%',

  // Test reporting
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'test-results',
      outputName: 'junit.xml',
      suiteName: 'MCP FileBridge Tests'
    }]
  ],

  // Global setup/teardown
  globalSetup: '<rootDir>/tests/global-setup.js',
  globalTeardown: '<rootDir>/tests/global-teardown.js',

  // Test environment options
  testEnvironmentOptions: {
    url: 'http://localhost:3000'
  },

  // Snapshot configuration
  snapshotSerializers: ['jest-serializer-path'],

  // Custom matchers
  setupFiles: ['<rootDir>/tests/matchers.js']
};
