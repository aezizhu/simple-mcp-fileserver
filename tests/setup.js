/**
 * Jest Test Setup
 *
 * Global test setup for MCP FileBridge tests.
 * Configures mocking, environment, and test utilities.
 *
 * @author aezizhu
 */

// Set test environment
process.env.NODE_ENV = 'test';
process.env.TZ = 'UTC';

// Mock console methods to reduce noise during tests
const originalConsole = { ...console };

beforeAll(() => {
  // Suppress console output during tests unless explicitly needed
  console.log = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
  console.debug = jest.fn();
});

afterAll(() => {
  // Restore original console methods
  Object.assign(console, originalConsole);
});

// Mock external dependencies
jest.mock('fs/promises');
jest.mock('sharp');
jest.mock('tesseract.js');
jest.mock('axios');
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    expire: jest.fn(),
    ping: jest.fn()
  }))
}));
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  })),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    json: jest.fn(),
    colorize: jest.fn(),
    simple: jest.fn()
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn()
  }
}));

// Mock environment variables for consistent testing
process.env = {
  ...process.env,
  NODE_ENV: 'test',
  HOST: 'localhost',
  PORT: '3000',
  CACHE_ENABLED: 'false',
  LOG_LEVEL: 'error',
  MAX_FILE_SIZE: '1048576', // 1MB for tests
  ALLOWED_EXTENSIONS: '.txt,.js,.json,.jpg,.png'
};

// Global test utilities
global.testUtils = {
  // Create temporary test files
  createTempFile: async (content = 'test content', extension = '.txt') => {
    const fs = require('fs/promises');
    const path = require('path');
    const os = require('os');

    const tempDir = path.join(os.tmpdir(), 'mcp-test-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });

    const filePath = path.join(tempDir, `test-file-${Date.now()}${extension}`);
    await fs.writeFile(filePath, content);

    return {
      path: filePath,
      content,
      cleanup: async () => {
        try {
          await fs.rm(tempDir, { recursive: true, force: true });
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    };
  },

  // Create mock image buffer
  createMockImage: (width = 100, height = 100, format = 'jpeg') => {
    // Return a minimal valid image buffer
    if (format === 'jpeg') {
      return Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xD9
      ]);
    } else if (format === 'png') {
      return Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x64, 0x00, 0x00, 0x00, 0x64
      ]);
    }
    return Buffer.from('mock-image-data');
  },

  // Mock HTTP responses
  mockHttpResponse: (status = 200, data = {}, headers = {}) => ({
    status,
    data: typeof data === 'string' ? data : JSON.stringify(data),
    headers: {
      'content-type': 'application/json',
      ...headers
    }
  }),

  // Wait for async operations
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  // Generate random test data
  randomString: (length = 10) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },

  // Mock file system operations
  mockFileSystem: () => {
    const fs = require('fs/promises');
    const originalReadFile = fs.readFile;
    const originalWriteFile = fs.writeFile;
    const originalStat = fs.stat;
    const originalAccess = fs.access;

    return {
      mockReadFile: (mockFn) => fs.readFile = jest.fn(mockFn),
      mockWriteFile: (mockFn) => fs.writeFile = jest.fn(mockFn),
      mockStat: (mockFn) => fs.stat = jest.fn(mockFn),
      mockAccess: (mockFn) => fs.access = jest.fn(mockFn),
      restore: () => {
        fs.readFile = originalReadFile;
        fs.writeFile = originalWriteFile;
        fs.stat = originalStat;
        fs.access = originalAccess;
      }
    };
  }
};

// Custom matchers
expect.extend({
  toBeValidJsonRpcResponse(received) {
    const pass = received &&
                typeof received === 'object' &&
                received.jsonrpc === '2.0' &&
                (received.result !== undefined || received.error !== undefined) &&
                received.id !== undefined;

    return {
      message: () => `expected ${received} to be a valid JSON-RPC response`,
      pass
    };
  },

  toBeValidToolResult(received) {
    const pass = received &&
                typeof received === 'object' &&
                received.content &&
                Array.isArray(received.content) &&
                received.content.length > 0 &&
                received.content[0].type &&
                received.content[0].text;

    return {
      message: () => `expected ${received} to be a valid tool result`,
      pass
    };
  },

  toContainImageMetadata(received) {
    const pass = received &&
                typeof received === 'string' &&
                (received.includes('Format:') ||
                 received.includes('Dimensions:') ||
                 received.includes('File Size:'));

    return {
      message: () => `expected ${received} to contain image metadata`,
      pass
    };
  }
});

// Memory leak detection
if (typeof global.gc === 'function') {
  beforeEach(() => {
    global.gc();
  });
}

// Performance monitoring
global.performanceMarks = new Map();

global.markPerformance = (name) => {
  global.performanceMarks.set(name, Date.now());
};

global.measurePerformance = (name) => {
  const startTime = global.performanceMarks.get(name);
  if (startTime) {
    return Date.now() - startTime;
  }
  return 0;
};
