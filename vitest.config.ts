/**
 * Vitest Configuration for MCP FileBridge
 *
 * Comprehensive test configuration for unit, integration, and performance tests.
 * Includes coverage reporting, mocking, and test environment setup.
 *
 * @author aezizhu
 */

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  // Test environment
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],

    // Test patterns
    include: [
      'tests/unit/**/*.test.(ts|js)',
      'tests/integration/**/*.test.(ts|js)',
      'tests/e2e/**/*.test.(ts|js)',
      'tests/performance/**/*.test.(ts|js)',
      'tests/security/**/*.test.(ts|js)'
    ],

    exclude: [
      'node_modules',
      'dist',
      'coverage',
      'logs',
      '**/*.d.ts'
    ],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'dist/',
        'coverage/',
        'logs/',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.spec.ts',
        'tests/',
        'src/index.ts', // Entry point
        'src/types/',
        'src/**/*.config.ts'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 85,
          lines: 85,
          statements: 85
        },
        './src/core/': {
          branches: 90,
          functions: 95,
          lines: 90,
          statements: 90
        }
      }
    },

    // Test timeout
    testTimeout: 30000,

    // Global test configuration
    globalSetup: './tests/global-setup.ts',
    globalTeardown: './tests/global-teardown.ts',

    // Mocking
    mockReset: true,
    restoreMocks: true,

    // Parallel execution
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        useAtomics: true
      }
    },

    // Performance
    maxThreads: 4,
    minThreads: 1,

    // Reporters
    reporters: process.env.CI
      ? ['verbose', 'junit']
      : ['verbose'],

    outputFile: {
      junit: './test-results/junit.xml'
    },

    // Environment variables
    env: {
      NODE_ENV: 'test',
      TEST_MODE: 'true',
      LOG_LEVEL: 'error'
    }
  },

  // Path resolution
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '~': path.resolve(__dirname, './tests')
    }
  },

  // Build configuration for test files
  esbuild: {
    target: 'node18'
  }
});

/**
 * Integration test configuration
 */
export const integrationConfig = defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/integration/**/*.test.(ts|js)'],
    exclude: ['node_modules', 'dist', 'coverage'],

    // Longer timeout for integration tests
    testTimeout: 60000,

    // Sequential execution for integration tests
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true
      }
    },

    // Integration-specific environment
    env: {
      NODE_ENV: 'test',
      TEST_MODE: 'integration',
      INTEGRATION_TEST: 'true',
      LOG_LEVEL: 'warn'
    }
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '~': path.resolve(__dirname, './tests')
    }
  }
});

/**
 * Performance test configuration
 */
export const performanceConfig = defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/performance/**/*.test.(ts|js)'],

    // Performance test specific settings
    testTimeout: 120000, // 2 minutes
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true // Sequential for accurate measurements
      }
    },

    reporters: ['verbose', 'json'],

    env: {
      NODE_ENV: 'test',
      TEST_MODE: 'performance',
      PERFORMANCE_TEST: 'true',
      LOG_LEVEL: 'error'
    }
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '~': path.resolve(__dirname, './tests')
    }
  }
});

/**
 * Security test configuration
 */
export const securityConfig = defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/security/**/*.test.(ts|js)'],

    testTimeout: 45000,

    env: {
      NODE_ENV: 'test',
      TEST_MODE: 'security',
      SECURITY_TEST: 'true',
      LOG_LEVEL: 'warn'
    }
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '~': path.resolve(__dirname, './tests')
    }
  }
});
