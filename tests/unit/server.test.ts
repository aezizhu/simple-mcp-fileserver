/**
 * MCP Server Unit Tests
 *
 * Unit tests for the main MCP server functionality.
 * Tests request handling, tool execution, and server lifecycle.
 *
 * @author aezizhu
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { MCPEnterpriseServer } from '../../src/core/server';
import { Logger, ContentType } from '../../src/types/mcp';

describe('MCPEnterpriseServer', () => {
  let server: MCPEnterpriseServer;
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    } as Logger;

    // Mock the logger in the server
    jest.spyOn(require('../../src/services/logger.service'), 'LoggerService')
      .mockImplementation(() => mockLogger);

    server = new MCPEnterpriseServer({
      server: {
        host: 'localhost',
        port: 3000
      }
    });
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
    jest.clearAllMocks();
  });

  describe('Server Lifecycle', () => {
    it('should initialize successfully', async () => {
      await expect(server.start()).resolves.not.toThrow();
      expect(mockLogger.info).toHaveBeenCalledWith('Initializing MCP Enterprise Server...');
    });

    it('should stop gracefully', async () => {
      await server.start();
      await expect(server.stop()).resolves.not.toThrow();
      expect(mockLogger.info).toHaveBeenCalledWith('MCP Enterprise Server stopped');
    });

    it('should handle double start gracefully', async () => {
      await server.start();
      await expect(server.start()).resolves.not.toThrow();
    });

    it('should handle double stop gracefully', async () => {
      await server.start();
      await server.stop();
      await expect(server.stop()).resolves.not.toThrow();
    });
  });

  describe('Request Handling', () => {
    beforeEach(async () => {
      await server.start();
    });

    it('should handle initialize request', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'test-client',
            version: '1.0.0'
          }
        }
      };

      const response = await server.handleRequest(JSON.stringify(request));

      expect(response).toBeValidJsonRpcResponse();
      expect(JSON.parse(response).result.protocolVersion).toBe('2024-11-05');
      expect(JSON.parse(response).result.serverInfo.name).toBe('@aezizhu/mcp-filebridge');
    });

    it('should handle tools/list request', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {}
      };

      const response = await server.handleRequest(JSON.stringify(request));
      const parsedResponse = JSON.parse(response);

      expect(parsedResponse).toBeValidJsonRpcResponse();
      expect(parsedResponse.result.tools).toContainTools(['read_file', 'analyze_image']);
    });

    it('should handle tools/call request', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'ping',
          arguments: {}
        }
      };

      const response = await server.handleRequest(JSON.stringify(request));
      const parsedResponse = JSON.parse(response);

      expect(parsedResponse).toBeValidJsonRpcResponse();
      expect(parsedResponse.result.content[0].text).toContain('🏓 Pong!');
    });

    it('should handle invalid JSON', async () => {
      const response = await server.handleRequest('invalid json');

      expect(JSON.parse(response)).toBeValidJsonRpcError();
    });

    it('should handle unknown method', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 4,
        method: 'unknown_method',
        params: {}
      };

      const response = await server.handleRequest(JSON.stringify(request));
      const parsedResponse = JSON.parse(response);

      expect(parsedResponse).toBeValidJsonRpcError();
      expect(parsedResponse.error.code).toBe(-32601);
    });

    it('should handle missing method', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 5,
        params: {}
      };

      const response = await server.handleRequest(JSON.stringify(request));
      const parsedResponse = JSON.parse(response);

      expect(parsedResponse).toBeValidJsonRpcError();
      expect(parsedResponse.error.code).toBe(-32600);
    });
  });

  describe('Tool Execution', () => {
    beforeEach(async () => {
      await server.start();
    });

    it('should execute read_file tool', async () => {
      const fs = require('fs/promises');
      const mockContent = 'test file content';

      // Mock file system
      jest.spyOn(fs, 'readFile').mockResolvedValue(mockContent);
      jest.spyOn(fs, 'stat').mockResolvedValue({
        size: mockContent.length,
        mtime: new Date(),
        isDirectory: () => false
      } as any);
      jest.spyOn(fs, 'access').mockResolvedValue(undefined);

      const request = {
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/call',
        params: {
          name: 'read_file',
          arguments: {
            path: '/test/file.txt'
          }
        }
      };

      const response = await server.handleRequest(JSON.stringify(request));
      const parsedResponse = JSON.parse(response);

      expect(parsedResponse).toBeValidJsonRpcResponse();
      expect(parsedResponse.result.content[0].text).toContain('test file content');
    });

    it('should handle tool execution errors', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 7,
        method: 'tools/call',
        params: {
          name: 'read_file',
          arguments: {
            path: '/nonexistent/file.txt'
          }
        }
      };

      const response = await server.handleRequest(JSON.stringify(request));
      const parsedResponse = JSON.parse(response);

      expect(parsedResponse).toBeValidJsonRpcError();
    });

    it('should handle unknown tools', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 8,
        method: 'tools/call',
        params: {
          name: 'unknown_tool',
          arguments: {}
        }
      };

      const response = await server.handleRequest(JSON.stringify(request));
      const parsedResponse = JSON.parse(response);

      expect(parsedResponse).toBeValidJsonRpcError();
      expect(parsedResponse.error.message).toContain('Tool not found');
    });

    it('should validate tool arguments', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 9,
        method: 'tools/call',
        params: {
          name: 'read_file',
          arguments: {} // Missing required path
        }
      };

      const response = await server.handleRequest(JSON.stringify(request));
      const parsedResponse = JSON.parse(response);

      expect(parsedResponse).toBeValidJsonRpcError();
    });
  });

  describe('Server Capabilities', () => {
    it('should return correct capabilities', async () => {
      await server.start();

      const request = {
        jsonrpc: '2.0',
        id: 10,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'test-client',
            version: '1.0.0'
          }
        }
      };

      const response = await server.handleRequest(JSON.stringify(request));
      const parsedResponse = JSON.parse(response);

      expect(parsedResponse.result.capabilities).toHaveProperty('tools');
      expect(parsedResponse.result.capabilities.tools).toBe(true);
    });

    it('should return correct server info', async () => {
      await server.start();

      const request = {
        jsonrpc: '2.0',
        id: 11,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'test-client',
            version: '1.0.0'
          }
        }
      };

      const response = await server.handleRequest(JSON.stringify(request));
      const parsedResponse = JSON.parse(response);

      expect(parsedResponse.result.serverInfo).toBeValidServerInfo();
      expect(parsedResponse.result.serverInfo.name).toBe('@aezizhu/mcp-filebridge');
      expect(parsedResponse.result.serverInfo.version).toBe('1.0.0');
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await server.start();
    });

    it('should handle malformed JSON-RPC requests', async () => {
      const malformedRequests = [
        '{"jsonrpc": "2.0", "method": "test"}', // Missing id
        '{"jsonrpc": "1.0", "id": 1, "method": "test"}', // Wrong version
        '{"id": 1, "method": "test"}', // Missing jsonrpc
        'null',
        '[]'
      ];

      for (const malformedRequest of malformedRequests) {
        const response = await server.handleRequest(malformedRequest);
        const parsedResponse = JSON.parse(response);
        expect(parsedResponse).toBeValidJsonRpcError();
      }
    });

    it('should handle batch requests', async () => {
      const batchRequest = [
        {
          jsonrpc: '2.0',
          id: 12,
          method: 'ping',
          params: {}
        },
        {
          jsonrpc: '2.0',
          id: 13,
          method: 'tools/list',
          params: {}
        }
      ];

      const response = await server.handleRequest(JSON.stringify(batchRequest));
      const parsedResponse = JSON.parse(response);

      expect(Array.isArray(parsedResponse)).toBe(true);
      expect(parsedResponse).toHaveLength(2);
      expect(parsedResponse[0]).toBeValidJsonRpcResponse();
      expect(parsedResponse[1]).toBeValidJsonRpcResponse();
    });

    it('should handle notifications (requests without id)', async () => {
      const notification = {
        jsonrpc: '2.0',
        method: 'test_notification',
        params: { message: 'test' }
      };

      // Notifications should not return a response
      const response = await server.handleRequest(JSON.stringify(notification));
      expect(response).toBeUndefined();
    });
  });

  describe('Performance and Monitoring', () => {
    beforeEach(async () => {
      await server.start();
    });

    it('should track request metrics', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 14,
        method: 'ping',
        params: {}
      };

      const startTime = Date.now();
      await server.handleRequest(JSON.stringify(request));
      const endTime = Date.now();

      expect(endTime - startTime).toBeWithinPerformanceLimit(1000); // Should complete within 1 second
    });

    it('should handle concurrent requests', async () => {
      const requests = Array.from({ length: 10 }, (_, i) => ({
        jsonrpc: '2.0',
        id: 100 + i,
        method: 'ping',
        params: {}
      }));

      const promises = requests.map(request =>
        server.handleRequest(JSON.stringify(request))
      );

      const responses = await Promise.all(promises);

      expect(responses).toHaveLength(10);
      responses.forEach((response, index) => {
        const parsedResponse = JSON.parse(response);
        expect(parsedResponse.id).toBe(100 + index);
        expect(parsedResponse.result.content[0].text).toContain('Pong!');
      });
    });

    it('should handle high load gracefully', async () => {
      const requests = Array.from({ length: 50 }, (_, i) => ({
        jsonrpc: '2.0',
        id: 200 + i,
        method: 'tools/list',
        params: {}
      }));

      const promises = requests.map(request =>
        server.handleRequest(JSON.stringify(request))
      );

      const responses = await Promise.all(promises);

      expect(responses).toHaveLength(50);
      responses.forEach(response => {
        const parsedResponse = JSON.parse(response);
        expect(parsedResponse).toBeValidJsonRpcResponse();
        expect(parsedResponse.result.tools).toContainTools(['read_file']);
      });
    });
  });

  describe('Security', () => {
    beforeEach(async () => {
      await server.start();
    });

    it('should validate request size limits', async () => {
      // Create a very large request
      const largeParams = { data: 'x'.repeat(1000000) }; // 1MB of data
      const request = {
        jsonrpc: '2.0',
        id: 15,
        method: 'test',
        params: largeParams
      };

      // This should either handle gracefully or reject appropriately
      try {
        const response = await server.handleRequest(JSON.stringify(request));
        expect(JSON.parse(response)).toBeValidJsonRpcError();
      } catch (error) {
        // Request might be too large to process
        expect(error.message).toContain('request entity too large');
      }
    });

    it('should prevent method injection', async () => {
      const maliciousRequest = {
        jsonrpc: '2.0',
        id: 16,
        method: '../../../etc/passwd',
        params: {}
      };

      const response = await server.handleRequest(JSON.stringify(maliciousRequest));
      const parsedResponse = JSON.parse(response);

      expect(parsedResponse).toBeValidJsonRpcError();
      expect(parsedResponse.error.code).toBe(-32601); // Method not found
    });

    it('should handle malformed parameters safely', async () => {
      const badRequests = [
        {
          jsonrpc: '2.0',
          id: 17,
          method: 'tools/call',
          params: {
            name: 'read_file',
            arguments: null // Invalid arguments
          }
        },
        {
          jsonrpc: '2.0',
          id: 18,
          method: 'tools/call',
          params: {
            name: null, // Invalid tool name
            arguments: {}
          }
        }
      ];

      for (const badRequest of badRequests) {
        const response = await server.handleRequest(JSON.stringify(badRequest));
        const parsedResponse = JSON.parse(response);
        expect(parsedResponse).toBeValidJsonRpcError();
      }
    });
  });
});
