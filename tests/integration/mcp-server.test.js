/**
 * MCP Server Integration Tests
 *
 * End-to-end tests for MCP server functionality.
 * Tests JSON-RPC communication, tool execution, and error handling.
 *
 * @author aezizhu
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const http = require('http');

describe('MCP Server Integration', () => {
  let serverProcess;
  let serverPort = 3001; // Use different port for tests
  let serverUrl = `http://localhost:${serverPort}`;

  beforeAll(async () => {
    // Start the MCP server for testing
    const serverPath = path.join(__dirname, '../../dist/index.js');

    return new Promise((resolve, reject) => {
      serverProcess = spawn('node', [serverPath], {
        cwd: path.join(__dirname, '../..'),
        env: {
          ...process.env,
          NODE_ENV: 'test',
          PORT: serverPort,
          HOST: 'localhost',
          CACHE_ENABLED: 'false', // Disable cache for tests
          LOG_LEVEL: 'error' // Reduce log noise
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Wait for server to start
      let started = false;
      const timeout = setTimeout(() => {
        if (!started) {
          reject(new Error('Server failed to start within timeout'));
        }
      }, 10000);

      serverProcess.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('MCP FileBridge started') && !started) {
          started = true;
          clearTimeout(timeout);
          resolve();
        }
      });

      serverProcess.stderr.on('data', (data) => {
        console.error('Server stderr:', data.toString());
      });

      serverProcess.on('error', (error) => {
        reject(error);
      });
    });
  }, 15000);

  afterAll(async () => {
    // Clean up server process
    if (serverProcess) {
      serverProcess.kill('SIGTERM');

      // Wait for process to exit
      await new Promise((resolve) => {
        serverProcess.on('exit', resolve);
        setTimeout(resolve, 5000); // Timeout after 5 seconds
      });
    }
  });

  describe('Server Startup', () => {
    test('server should be running and responding', async () => {
      const response = await makeRequest('GET', '/health');

      expect(response.status).toBe(200);
      expect(JSON.parse(response.data)).toHaveProperty('status', 'healthy');
    });

    test('server should respond to root endpoint', async () => {
      const response = await makeRequest('GET', '/');

      expect(response.status).toBe(200);
      expect(response.data).toContain('MCP FileBridge');
    });
  });

  describe('MCP Protocol Handshake', () => {
    test('should respond to initialize request', async () => {
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

      const response = await makeJsonRpcRequest(request);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(1);
      expect(response.result).toHaveProperty('protocolVersion', '2024-11-05');
      expect(response.result).toHaveProperty('serverInfo');
      expect(response.result.serverInfo.name).toBe('@aezizhu/mcp-filebridge');
    });

    test('should provide server capabilities', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 2,
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

      const response = await makeJsonRpcRequest(request);

      expect(response.result).toHaveProperty('capabilities');
      expect(response.result.capabilities).toHaveProperty('tools');
      expect(response.result.capabilities.tools).toBeDefined();
    });
  });

  describe('Tool Discovery', () => {
    test('should list available tools', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/list',
        params: {}
      };

      const response = await makeJsonRpcRequest(request);

      expect(response.result).toHaveProperty('tools');
      expect(Array.isArray(response.result.tools)).toBe(true);
      expect(response.result.tools.length).toBeGreaterThan(0);

      // Check for expected tools
      const toolNames = response.result.tools.map(tool => tool.name);
      expect(toolNames).toContain('read_file');
      expect(toolNames).toContain('analyze_image');
      expect(toolNames).toContain('get_server_info');
    });

    test('should provide tool schemas', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/list',
        params: {}
      };

      const response = await makeJsonRpcRequest(request);

      const readFileTool = response.result.tools.find(tool => tool.name === 'read_file');
      expect(readFileTool).toBeDefined();
      expect(readFileTool).toHaveProperty('inputSchema');
      expect(readFileTool.inputSchema).toHaveProperty('type', 'object');
      expect(readFileTool.inputSchema).toHaveProperty('properties');
    });
  });

  describe('File Operations', () => {
    let testFile;
    let testContent;

    beforeAll(async () => {
      // Create a test file
      testFile = path.join(__dirname, '../fixtures/test-file.txt');
      testContent = 'This is a test file for integration testing.\nIt contains multiple lines.';
      await fs.writeFile(testFile, testContent);
    });

    afterAll(async () => {
      // Clean up test file
      try {
        await fs.unlink(testFile);
      } catch (error) {
        // Ignore if file doesn't exist
      }
    });

    test('should read file content', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'read_file',
          arguments: {
            path: testFile,
            encoding: 'utf8'
          }
        }
      };

      const response = await makeJsonRpcRequest(request);

      expect(response.result).toHaveProperty('content');
      expect(response.result.content[0]).toHaveProperty('type', 'text');
      expect(response.result.content[0].text).toContain(testContent);
      expect(response.result.content[0].text).toContain('test-file.txt');
    });

    test('should handle file not found', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/call',
        params: {
          name: 'read_file',
          arguments: {
            path: '/nonexistent/file.txt'
          }
        }
      };

      const response = await makeJsonRpcRequest(request);

      expect(response).toHaveProperty('error');
      expect(response.error.code).toBe(-32000);
      expect(response.error.message).toContain('File access denied');
    });

    test('should write file content', async () => {
      const writeFile = path.join(__dirname, '../fixtures/write-test.txt');
      const writeContent = 'Content written by integration test';

      const request = {
        jsonrpc: '2.0',
        id: 7,
        method: 'tools/call',
        params: {
          name: 'write_file',
          arguments: {
            path: writeFile,
            content: writeContent,
            encoding: 'utf8'
          }
        }
      };

      const response = await makeJsonRpcRequest(request);

      expect(response.result).toHaveProperty('content');
      expect(response.result.content[0].text).toContain('File written successfully');

      // Verify file was actually written
      const writtenContent = await fs.readFile(writeFile, 'utf8');
      expect(writtenContent).toBe(writeContent);

      // Clean up
      await fs.unlink(writeFile);
    });
  });

  describe('Image Analysis', () => {
    test('should analyze image file', async () => {
      const imageFile = path.join(__dirname, '../fixtures/test.jpg');

      // Create a simple test image if it doesn't exist
      if (!await fileExists(imageFile)) {
        // Skip test if no test image available
        console.warn('Skipping image analysis test - no test image available');
        return;
      }

      const request = {
        jsonrpc: '2.0',
        id: 8,
        method: 'tools/call',
        params: {
          name: 'analyze_image',
          arguments: {
            path: imageFile
          }
        }
      };

      const response = await makeJsonRpcRequest(request);

      expect(response.result).toHaveProperty('content');
      expect(response.result.content[0].text).toContain('Image Analysis');
      expect(response.result.content[0].text).toContain('Format:');
      expect(response.result.content[0].text).toContain('Dimensions:');
    });

    test('should handle invalid image path', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 9,
        method: 'tools/call',
        params: {
          name: 'analyze_image',
          arguments: {
            path: '/invalid/image/path.jpg'
          }
        }
      };

      const response = await makeJsonRpcRequest(request);

      expect(response).toHaveProperty('error');
      expect(response.error.message).toContain('Image file not found');
    });
  });

  describe('System Tools', () => {
    test('should provide server information', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 10,
        method: 'tools/call',
        params: {
          name: 'get_server_info',
          arguments: {}
        }
      };

      const response = await makeJsonRpcRequest(request);

      expect(response.result).toHaveProperty('content');
      expect(response.result.content[0].text).toContain('MCP FileBridge');
      expect(response.result.content[0].text).toContain('healthy');
    });

    test('should respond to ping', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 11,
        method: 'tools/call',
        params: {
          name: 'ping',
          arguments: {}
        }
      };

      const response = await makeJsonRpcRequest(request);

      expect(response.result).toHaveProperty('content');
      expect(response.result.content[0].text).toContain('🏓 Pong!');
    });

    test('should perform health check', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 12,
        method: 'tools/call',
        params: {
          name: 'health_check',
          arguments: {
            detailed: true
          }
        }
      };

      const response = await makeJsonRpcRequest(request);

      expect(response.result).toHaveProperty('content');
      expect(response.result.content[0].text).toContain('Health Check Results');
      expect(response.result.content[0].text).toContain('healthy');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid JSON-RPC format', async () => {
      const response = await makeHttpRequest('POST', '/', 'invalid json');

      expect(response.status).toBe(400);
      const error = JSON.parse(response.data);
      expect(error).toHaveProperty('error');
    });

    test('should handle unknown method', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 13,
        method: 'unknown_method',
        params: {}
      };

      const response = await makeJsonRpcRequest(request);

      expect(response).toHaveProperty('error');
      expect(response.error.code).toBe(-32601);
      expect(response.error.message).toContain('Method not found');
    });

    test('should handle invalid tool name', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 14,
        method: 'tools/call',
        params: {
          name: 'nonexistent_tool',
          arguments: {}
        }
      };

      const response = await makeJsonRpcRequest(request);

      expect(response).toHaveProperty('error');
      expect(response.error.message).toContain('Tool not found');
    });

    test('should handle invalid parameters', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 15,
        method: 'tools/call',
        params: {
          name: 'read_file',
          arguments: {} // Missing required path parameter
        }
      };

      const response = await makeJsonRpcRequest(request);

      expect(response).toHaveProperty('error');
      expect(response.error.message).toContain('Invalid arguments');
    });
  });

  describe('Performance and Load', () => {
    test('should handle concurrent requests', async () => {
      const requests = Array.from({ length: 10 }, (_, i) => ({
        jsonrpc: '2.0',
        id: 100 + i,
        method: 'tools/call',
        params: {
          name: 'ping',
          arguments: {}
        }
      }));

      const promises = requests.map(request => makeJsonRpcRequest(request));
      const responses = await Promise.all(promises);

      expect(responses).toHaveLength(10);
      responses.forEach((response, index) => {
        expect(response.id).toBe(100 + index);
        expect(response.result.content[0].text).toContain('Pong!');
      });
    });

    test('should handle large payloads', async () => {
      const largeContent = 'A'.repeat(100000); // 100KB content
      const largeFile = path.join(__dirname, '../fixtures/large-test.txt');
      await fs.writeFile(largeFile, largeContent);

      const request = {
        jsonrpc: '2.0',
        id: 16,
        method: 'tools/call',
        params: {
          name: 'read_file',
          arguments: {
            path: largeFile,
            max_size: 200000
          }
        }
      };

      const response = await makeJsonRpcRequest(request);

      expect(response.result.content[0].text).toContain('100,000 bytes');

      // Clean up
      await fs.unlink(largeFile);
    });
  });

  describe('Security', () => {
    test('should prevent directory traversal', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 17,
        method: 'tools/call',
        params: {
          name: 'read_file',
          arguments: {
            path: '../../../etc/passwd'
          }
        }
      };

      const response = await makeJsonRpcRequest(request);

      expect(response).toHaveProperty('error');
      expect(response.error.message).toContain('File access denied');
    });

    test('should validate file paths', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 18,
        method: 'tools/call',
        params: {
          name: 'read_file',
          arguments: {
            path: '/root/secret-file.txt'
          }
        }
      };

      const response = await makeJsonRpcRequest(request);

      expect(response).toHaveProperty('error');
    });
  });
});

/**
 * Helper function to make HTTP requests
 */
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: serverPort,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          data: body,
          headers: res.headers
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

/**
 * Helper function to make JSON-RPC requests
 */
async function makeJsonRpcRequest(request) {
  const response = await makeRequest('POST', '/', request);
  return JSON.parse(response.data);
}

/**
 * Helper function to make raw HTTP requests
 */
async function makeHttpRequest(method, path, data) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: serverPort,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          data: body,
          headers: res.headers
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(data);
    }

    req.end();
  });
}

/**
 * Helper function to check if file exists
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
