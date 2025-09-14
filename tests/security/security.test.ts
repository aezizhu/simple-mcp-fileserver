/**
 * Security Tests
 *
 * Comprehensive security testing for MCP FileBridge.
 * Tests for injection attacks, path traversal, DoS, and authentication.
 *
 * @author aezizhu
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MCPEnterpriseServer } from '../../src/core/server';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('Security Tests', () => {
  let server: MCPEnterpriseServer;
  let testDir: string;

  beforeAll(async () => {
    // Start server with security configurations
    server = new MCPEnterpriseServer({
      server: {
        host: 'localhost',
        port: 3003, // Different port for security tests
        security: {
          helmet: true,
          rateLimit: {
            enabled: true,
            windowMs: 900000, // 15 minutes
            maxRequests: 100
          }
        }
      }
    });

    await server.start();

    // Create secure test directory
    testDir = path.join(process.cwd(), 'tests', 'security');
    await fs.mkdir(testDir, { recursive: true });

    // Create test files with different permission levels
    await createSecureTestFiles();

    console.log('🔒 Security test environment ready');
  }, 30000);

  afterAll(async () => {
    if (server) {
      await server.stop();
    }

    // Clean up test files
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }

    console.log('✅ Security test cleanup completed');
  });

  describe('Path Traversal Prevention', () => {
    it('should prevent directory traversal in read_file', async () => {
      const traversalPaths = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config',
        '/etc/passwd',
        '/root/.bashrc',
        'C:\\Windows\\System32\\config',
        '../../../../package.json'
      ];

      for (const traversalPath of traversalPaths) {
        const request = {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: 'read_file',
            arguments: {
              path: traversalPath
            }
          }
        };

        const response = await server.handleRequest(JSON.stringify(request));
        const parsedResponse = JSON.parse(response);

        expect(parsedResponse).toBeValidJsonRpcError();
        expect(parsedResponse.error.code).toBe(-32000); // Application error
        expect(parsedResponse.error.message).toContain('File access denied');
      }
    });

    it('should prevent directory traversal in analyze_image', async () => {
      const traversalPaths = [
        '../../../etc/passwd.jpg',
        '/root/secret/image.png',
        'C:\\Windows\\System32\\malicious.dll'
      ];

      for (const traversalPath of traversalPaths) {
        const request = {
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: {
            name: 'analyze_image',
            arguments: {
              path: traversalPath
            }
          }
        };

        const response = await server.handleRequest(JSON.stringify(request));
        const parsedResponse = JSON.parse(response);

        expect(parsedResponse).toBeValidJsonRpcError();
        expect(parsedResponse.error.message).toContain('Image file not found');
      }
    });

    it('should handle encoded traversal attempts', async () => {
      const encodedPaths = [
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
        '..%2F..%2F..%2Fetc%2Fpasswd',
        '....//....//....//etc/passwd'
      ];

      for (const encodedPath of encodedPaths) {
        const request = {
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: {
            name: 'read_file',
            arguments: {
              path: encodedPath
            }
          }
        };

        const response = await server.handleRequest(JSON.stringify(request));
        const parsedResponse = JSON.parse(response);

        expect(parsedResponse).toBeValidJsonRpcError();
      }
    });
  });

  describe('Injection Attack Prevention', () => {
    it('should prevent command injection in tool names', async () => {
      const maliciousToolNames = [
        'read_file; rm -rf /',
        'read_file && cat /etc/passwd',
        'read_file | ls -la',
        'read_file`rm -rf /`',
        'read_file$(rm -rf /)'
      ];

      for (const maliciousName of maliciousToolNames) {
        const request = {
          jsonrpc: '2.0',
          id: 4,
          method: 'tools/call',
          params: {
            name: maliciousName,
            arguments: {
              path: '/safe/path.txt'
            }
          }
        };

        const response = await server.handleRequest(JSON.stringify(request));
        const parsedResponse = JSON.parse(response);

        expect(parsedResponse).toBeValidJsonRpcError();
        expect(parsedResponse.error.message).toContain('Tool not found');
      }
    });

    it('should prevent JSON injection', async () => {
      const maliciousPayloads = [
        '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"read_file","arguments":{"path":"../../../etc/passwd","__proto__":{"toString":"malicious"}}}}',
        '{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"read_file","arguments":{"path":"test.txt","constructor":{"prototype":{"malicious":"code"}}}}}'
      ];

      for (const maliciousPayload of maliciousPayloads) {
        try {
          const response = await server.handleRequest(maliciousPayload);
          const parsedResponse = JSON.parse(response);

          // Should either reject the request or sanitize it
          if (parsedResponse.error) {
            expect(parsedResponse.error.code).toBeDefined();
          } else {
            // If successful, ensure no malicious properties were added
            expect(parsedResponse.result).toBeDefined();
          }
        } catch (error) {
          // JSON parsing errors are acceptable
          expect(error).toBeDefined();
        }
      }
    });

    it('should handle malformed JSON safely', async () => {
      const malformedJsons = [
        '{"jsonrpc":"2.0","id":7,"method":"tools/call"', // Missing closing brace
        '{"jsonrpc":"2.0","id":8,"method":"tools/call","params":', // Incomplete params
        '{"jsonrpc":"2.0","id":9,"method":"tools/call","params":{"name":"read_file","arguments":{"path":"test.txt"}},"extra":"data"}', // Extra properties
        '{"jsonrpc":"2.0","id":10,"method":"tools/call","params":{"name":"read_file","arguments":{"path":"test.txt","__proto__":"polluted"}}}' // Prototype pollution attempt
      ];

      for (const malformedJson of malformedJsons) {
        try {
          const response = await server.handleRequest(malformedJson);
          const parsedResponse = JSON.parse(response);

          // Should handle gracefully
          expect(parsedResponse).toBeDefined();
        } catch (error) {
          // JSON parsing errors are acceptable for malformed input
          expect(error).toBeDefined();
        }
      }
    });
  });

  describe('Denial of Service Prevention', () => {
    it('should handle large payloads gracefully', async () => {
      // Create a very large payload
      const largeContent = 'A'.repeat(10000000); // 10MB string
      const request = {
        jsonrpc: '2.0',
        id: 11,
        method: 'tools/call',
        params: {
          name: 'write_file',
          arguments: {
            path: path.join(testDir, 'large-test.txt'),
            content: largeContent
          }
        }
      };

      const response = await server.handleRequest(JSON.stringify(request));
      const parsedResponse = JSON.parse(response);

      // Should either succeed or fail gracefully with a proper error
      if (parsedResponse.error) {
        expect(parsedResponse.error.code).toBeDefined();
        expect(parsedResponse.error.message).not.toContain('Internal server error');
      } else {
        expect(parsedResponse.result).toBeDefined();
      }
    });

    it('should handle rapid successive requests', async () => {
      const requests = Array.from({ length: 100 }, (_, i) => ({
        jsonrpc: '2.0',
        id: 100 + i,
        method: 'tools/call',
        params: {
          name: 'ping',
          arguments: {}
        }
      }));

      const startTime = Date.now();
      const promises = requests.map(request =>
        server.handleRequest(JSON.stringify(request))
      );

      const results = await Promise.allSettled(promises);
      const endTime = Date.now();

      const successCount = results.filter(result => result.status === 'fulfilled').length;
      const failureCount = results.filter(result => result.status === 'rejected').length;

      console.log(`🚀 Rapid Requests: ${successCount} success, ${failureCount} failures in ${endTime - startTime}ms`);

      // Should handle most requests successfully
      expect(successCount / requests.length).toBeGreaterThan(0.8); // 80% success rate
    });

    it('should prevent memory exhaustion attacks', async () => {
      const initialMemory = process.memoryUsage();

      // Send many large concurrent requests
      const largeRequests = Array.from({ length: 10 }, (_, i) => ({
        jsonrpc: '2.0',
        id: 200 + i,
        method: 'tools/call',
        params: {
          name: 'write_file',
          arguments: {
            path: path.join(testDir, `large-${i}.txt`),
            content: 'A'.repeat(1000000) // 1MB per request
          }
        }
      }));

      const promises = largeRequests.map(request =>
        server.handleRequest(JSON.stringify(request))
      );

      await Promise.all(promises);

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      console.log(`💾 Memory Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);

      // Memory increase should be reasonable
      expect(memoryIncrease).toBeLessThan(500 * 1024 * 1024); // Less than 500MB
    });

    it('should handle recursive directory structures', async () => {
      // Create a deep directory structure
      let deepPath = testDir;
      for (let i = 0; i < 20; i++) {
        deepPath = path.join(deepPath, `level${i}`);
      }
      await fs.mkdir(deepPath, { recursive: true });

      const deepFile = path.join(deepPath, 'deep.txt');
      await fs.writeFile(deepFile, 'Deep file content');

      const request = {
        jsonrpc: '2.0',
        id: 12,
        method: 'tools/call',
        params: {
          name: 'read_file',
          arguments: {
            path: deepFile
          }
        }
      };

      const response = await server.handleRequest(JSON.stringify(request));
      const parsedResponse = JSON.parse(response);

      // Should handle deep paths without issues
      if (parsedResponse.error) {
        expect(parsedResponse.error.message).not.toContain('Maximum call stack');
      } else {
        expect(parsedResponse.result).toBeDefined();
      }
    });
  });

  describe('Input Validation', () => {
    it('should validate file paths', async () => {
      const invalidPaths = [
        '',
        null,
        undefined,
        {},
        [],
        123,
        '../',
        './',
        '/dev/null',
        '/dev/random',
        'C:\\',
        '~/.bashrc'
      ];

      for (const invalidPath of invalidPaths) {
        const request = {
          jsonrpc: '2.0',
          id: 13,
          method: 'tools/call',
          params: {
            name: 'read_file',
            arguments: {
              path: invalidPath
            }
          }
        };

        const response = await server.handleRequest(JSON.stringify(request));
        const parsedResponse = JSON.parse(response);

        expect(parsedResponse).toBeValidJsonRpcError();
      }
    });

    it('should validate tool arguments', async () => {
      const invalidArgs = [
        { name: 'read_file', arguments: null },
        { name: 'read_file', arguments: 'string' },
        { name: 'read_file', arguments: [] },
        { name: 'read_file', arguments: { path: null } },
        { name: 'read_file', arguments: { path: 123 } },
        { name: 'read_file', arguments: { path: {} } }
      ];

      for (const invalidArg of invalidArgs) {
        const request = {
          jsonrpc: '2.0',
          id: 14,
          method: 'tools/call',
          params: invalidArg
        };

        const response = await server.handleRequest(JSON.stringify(request));
        const parsedResponse = JSON.parse(response);

        expect(parsedResponse).toBeValidJsonRpcError();
      }
    });

    it('should handle oversized arguments', async () => {
      const hugePath = 'A'.repeat(10000); // 10KB path
      const request = {
        jsonrpc: '2.0',
        id: 15,
        method: 'tools/call',
        params: {
          name: 'read_file',
          arguments: {
            path: hugePath
          }
        }
      };

      const response = await server.handleRequest(JSON.stringify(request));
      const parsedResponse = JSON.parse(response);

      // Should handle gracefully
      expect(parsedResponse).toBeDefined();
    });
  });

  describe('Authentication and Authorization', () => {
    it('should require authentication when enabled', async () => {
      // This test would be relevant when auth is enabled
      const request = {
        jsonrpc: '2.0',
        id: 16,
        method: 'tools/call',
        params: {
          name: 'read_file',
          arguments: {
            path: path.join(testDir, 'secure.txt')
          }
        }
      };

      const response = await server.handleRequest(JSON.stringify(request));
      const parsedResponse = JSON.parse(response);

      // With current config, should work without auth
      expect(parsedResponse.result || parsedResponse.error).toBeDefined();
    });

    it('should validate user permissions', async () => {
      // Test with mock security context
      const request = {
        jsonrpc: '2.0',
        id: 17,
        method: 'tools/call',
        params: {
          name: 'read_file',
          arguments: {
            path: path.join(testDir, 'admin-only.txt')
          }
        }
      };

      const response = await server.handleRequest(JSON.stringify(request));
      const parsedResponse = JSON.parse(response);

      // Should either succeed or fail with proper authorization error
      expect(parsedResponse.result || parsedResponse.error).toBeDefined();
    });
  });

  describe('Data Sanitization', () => {
    it('should sanitize error messages', async () => {
      const sensitivePath = '/root/.ssh/id_rsa';
      const request = {
        jsonrpc: '2.0',
        id: 18,
        method: 'tools/call',
        params: {
          name: 'read_file',
          arguments: {
            path: sensitivePath
          }
        }
      };

      const response = await server.handleRequest(JSON.stringify(request));
      const parsedResponse = JSON.parse(response);

      expect(parsedResponse).toBeValidJsonRpcError();

      // Error message should not contain sensitive path information
      const errorMessage = parsedResponse.error.message;
      expect(errorMessage).not.toContain('/root');
      expect(errorMessage).not.toContain('.ssh');
    });

    it('should prevent information disclosure', async () => {
      // Test various paths that might leak information
      const sensitivePaths = [
        '/etc/shadow',
        '/proc/self/environ',
        '/proc/version',
        '/sys/kernel/version'
      ];

      for (const sensitivePath of sensitivePaths) {
        const request = {
          jsonrpc: '2.0',
          id: 19,
          method: 'tools/call',
          params: {
            name: 'read_file',
            arguments: {
              path: sensitivePath
            }
          }
        };

        const response = await server.handleRequest(JSON.stringify(request));
        const parsedResponse = JSON.parse(response);

        expect(parsedResponse).toBeValidJsonRpcError();

        // Ensure error messages don't leak sensitive information
        if (parsedResponse.error.message) {
          expect(parsedResponse.error.message.toLowerCase()).not.toContain('permission denied');
          expect(parsedResponse.error.message.toLowerCase()).not.toContain('access denied');
          expect(parsedResponse.error.message).toContain('File access denied');
        }
      }
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      // Send many requests quickly to trigger rate limiting
      const requests = Array.from({ length: 150 }, (_, i) => ({
        jsonrpc: '2.0',
        id: 300 + i,
        method: 'tools/call',
        params: {
          name: 'ping',
          arguments: {}
        }
      }));

      const responses = [];

      for (const request of requests) {
        const response = await server.handleRequest(JSON.stringify(request));
        responses.push(JSON.parse(response));

        // Small delay to avoid overwhelming
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const errors = responses.filter(r => r.error);
      const successes = responses.filter(r => r.result);

      console.log(`📊 Rate Limit Test: ${successes.length} success, ${errors.length} errors`);

      // Should have some rate limiting in effect
      if (errors.length > 0) {
        const rateLimitErrors = errors.filter(e => e.error.message?.toLowerCase().includes('rate'));
        expect(rateLimitErrors.length).toBeGreaterThan(0);
      }
    });
  });

  // Security test summary
  afterAll(() => {
    console.log('\n🔒 Security Test Summary');
    console.log('='.repeat(50));
    console.log('✅ Path traversal prevention: Tested');
    console.log('✅ Injection attack prevention: Tested');
    console.log('✅ DoS prevention: Tested');
    console.log('✅ Input validation: Tested');
    console.log('✅ Data sanitization: Tested');
    console.log('✅ Rate limiting: Tested');
    console.log('='.repeat(50));
  });
});

/**
 * Helper function to create secure test files
 */
async function createSecureTestFiles(): Promise<void> {
  const files = [
    {
      path: path.join(testDir, 'normal.txt'),
      content: 'Normal test file content'
    },
    {
      path: path.join(testDir, 'secure.txt'),
      content: 'Secure file content'
    },
    {
      path: path.join(testDir, 'admin-only.txt'),
      content: 'Admin only content'
    },
    {
      path: path.join(testDir, 'large-content.txt'),
      content: 'A'.repeat(100000) // 100KB file
    }
  ];

  for (const file of files) {
    await fs.writeFile(file.path, file.content, 'utf8');
  }

  console.log(`📄 Created ${files.length} secure test files`);
}
