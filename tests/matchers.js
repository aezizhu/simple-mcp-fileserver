/**
 * Custom Jest Matchers
 *
 * Custom matchers for MCP FileBridge testing.
 * Extends Jest with domain-specific assertions.
 *
 * @author aezizhu
 */

// Custom matchers for JSON-RPC
expect.extend({
  /**
   * Check if response is a valid JSON-RPC response
   */
  toBeValidJsonRpcResponse(received) {
    const pass = received &&
                typeof received === 'object' &&
                received.jsonrpc === '2.0' &&
                (received.result !== undefined || received.error !== undefined) &&
                received.id !== undefined;

    return {
      message: () => `Expected ${JSON.stringify(received)} to be a valid JSON-RPC 2.0 response`,
      pass
    };
  },

  /**
   * Check if result is a valid tool execution result
   */
  toBeValidToolResult(received) {
    const pass = received &&
                typeof received === 'object' &&
                received.content &&
                Array.isArray(received.content) &&
                received.content.length > 0 &&
                received.content.every(item =>
                  item.type && item.text !== undefined
                );

    return {
      message: () => `Expected ${JSON.stringify(received)} to be a valid tool result`,
      pass
    };
  },

  /**
   * Check if string contains image analysis metadata
   */
  toContainImageMetadata(received) {
    const pass = typeof received === 'string' &&
                (received.includes('Format:') ||
                 received.includes('Dimensions:') ||
                 received.includes('File Size:') ||
                 received.includes('Image Analysis'));

    return {
      message: () => `Expected string to contain image metadata, but received: ${received}`,
      pass
    };
  },

  /**
   * Check if response contains file information
   */
  toContainFileInfo(received) {
    const pass = typeof received === 'string' &&
                (received.includes('📄') ||
                 received.includes('File Information') ||
                 received.includes('Size:') ||
                 received.includes('Modified:'));

    return {
      message: () => `Expected string to contain file information, but received: ${received}`,
      pass
    };
  },

  /**
   * Check if response is a valid MCP server info
   */
  toBeValidServerInfo(received) {
    const pass = received &&
                typeof received === 'object' &&
                received.name &&
                received.version &&
                received.description &&
                received.author;

    return {
      message: () => `Expected ${JSON.stringify(received)} to be valid server info`,
      pass
    };
  },

  /**
   * Check if response contains health check information
   */
  toContainHealthInfo(received) {
    const pass = typeof received === 'string' &&
                (received.includes('healthy') ||
                 received.includes('status') ||
                 received.includes('Health Check'));

    return {
      message: () => `Expected string to contain health information, but received: ${received}`,
      pass
    };
  },

  /**
   * Check if error response is properly formatted
   */
  toBeValidJsonRpcError(received) {
    const pass = received &&
                typeof received === 'object' &&
                received.jsonrpc === '2.0' &&
                received.error &&
                typeof received.error === 'object' &&
                typeof received.error.code === 'number' &&
                received.error.message &&
                received.id !== undefined;

    return {
      message: () => `Expected ${JSON.stringify(received)} to be a valid JSON-RPC 2.0 error`,
      pass
    };
  },

  /**
   * Check if tool list contains expected tools
   */
  toContainTools(received, expectedTools) {
    const pass = received &&
                Array.isArray(received) &&
                expectedTools.every(toolName =>
                  received.some(tool => tool.name === toolName)
                );

    return {
      message: () => `Expected tool list to contain ${expectedTools.join(', ')}, but received: ${JSON.stringify(received)}`,
      pass
    };
  },

  /**
   * Check if string contains search results
   */
  toContainSearchResults(received) {
    const pass = typeof received === 'string' &&
                (received.includes('🔍 File Search Results') ||
                 received.includes('No files found') ||
                 received.includes('Results Found:'));

    return {
      message: () => `Expected string to contain search results, but received: ${received}`,
      pass
    };
  },

  /**
   * Check if response contains directory listing
   */
  toContainDirectoryListing(received) {
    const pass = typeof received === 'string' &&
                (received.includes('📁 Directory Listing') ||
                 received.includes('📂 Directory:') ||
                 received.includes('📊 Total Items:'));

    return {
      message: () => `Expected string to contain directory listing, but received: ${received}`,
      pass
    };
  },

  /**
   * Check if object has required properties
   */
  toHaveRequiredProperties(received, requiredProps) {
    const pass = received &&
                typeof received === 'object' &&
                requiredProps.every(prop => received.hasOwnProperty(prop));

    return {
      message: () => `Expected object to have required properties ${requiredProps.join(', ')}, but received: ${JSON.stringify(received)}`,
      pass
    };
  },

  /**
   * Check if value is within performance limits
   */
  toBeWithinPerformanceLimit(received, limit) {
    const pass = typeof received === 'number' && received <= limit;

    return {
      message: () => `Expected ${received}ms to be within ${limit}ms performance limit`,
      pass
    };
  },

  /**
   * Check if response contains proper security headers
   */
  toHaveSecurityHeaders(received) {
    const pass = received &&
                typeof received === 'object' &&
                (received['x-content-type-options'] ||
                 received['x-frame-options'] ||
                 received['content-security-policy']);

    return {
      message: () => `Expected response to have security headers, but received: ${JSON.stringify(received)}`,
      pass
    };
  }
});

// Helper functions for common test patterns
global.testHelpers = {
  /**
   * Create a valid JSON-RPC request
   */
  createJsonRpcRequest: (method, params = {}, id = 1) => ({
    jsonrpc: '2.0',
    id,
    method,
    params
  }),

  /**
   * Create a tool call request
   */
  createToolCallRequest: (toolName, args = {}, id = 1) => ({
    jsonrpc: '2.0',
    id,
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: args
    }
  }),

  /**
   * Mock file system for testing
   */
  mockFileSystem: () => {
    const fs = require('fs/promises');
    const originalMethods = {};

    return {
      mockReadFile: (result) => {
        originalMethods.readFile = fs.readFile;
        fs.readFile = jest.fn().mockResolvedValue(result);
      },
      mockWriteFile: () => {
        originalMethods.writeFile = fs.writeFile;
        fs.writeFile = jest.fn().mockResolvedValue(undefined);
      },
      mockStat: (stats) => {
        originalMethods.stat = fs.stat;
        fs.stat = jest.fn().mockResolvedValue(stats);
      },
      mockAccess: () => {
        originalMethods.access = fs.access;
        fs.access = jest.fn().mockResolvedValue(undefined);
      },
      restore: () => {
        Object.assign(fs, originalMethods);
      }
    };
  },

  /**
   * Wait for server to be ready
   */
  waitForServer: async (url, timeout = 5000) => {
    const http = require('http');
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        await new Promise((resolve, reject) => {
          const req = http.get(url, (res) => {
            if (res.statusCode === 200) {
              resolve();
            } else {
              reject();
            }
          });
          req.on('error', reject);
          req.setTimeout(1000, () => reject());
        });
        return true;
      } catch (error) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    return false;
  }
};
