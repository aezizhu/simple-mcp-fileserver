import http from 'http';

// MCP客户端测试
class MCPClient {
  constructor(port = 3000) {
    this.port = port;
    this.nextId = 1;
  }

  async call(method, params = {}) {
    return new Promise((resolve, reject) => {
      const requestData = {
        jsonrpc: '2.0',
        id: this.nextId++,
        method,
        params
      };

      const options = {
        hostname: 'localhost',
        port: this.port,
        path: '/mcp',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(JSON.stringify(requestData))
        }
      };

      console.log('发送请求到:', `http://localhost:${this.port}/mcp`);
      console.log('请求数据:', JSON.stringify(requestData, null, 2));

      const req = http.request(options, (res) => {
        console.log('响应状态码:', res.statusCode);
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          console.log('响应数据:', data);
          try {
            const response = JSON.parse(data);
            resolve(response);
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        console.error('请求错误:', error);
        reject(error);
      });

      req.write(JSON.stringify(requestData));
      req.end();
    });
  }

  async initialize() {
    return this.call('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'test-client',
        version: '1.0.0'
      }
    });
  }

  async listDir(path) {
    return this.call('tools/call', {
      name: 'list_directory',
      arguments: {
        path: path,
        recursive: false
      }
    });
  }

  async readFile(path) {
    return this.call('tools/call', {
      name: 'read_file',
      arguments: {
        path: path
      }
    });
  }
}

// 测试函数
async function testMCP() {
  const client = new MCPClient();

  try {
    console.log('初始化MCP连接...');
    const initResponse = await client.initialize();
    console.log('初始化响应:', JSON.stringify(initResponse, null, 2));

    console.log('\n读取目录 /Users/aezi/Downloads/athoney...');
    const listResponse = await client.listDir('/Users/aezi/Downloads/athoney');
    console.log('目录列表响应:', JSON.stringify(listResponse, null, 2));

    // 如果有文件，读取第一个文件
    if (listResponse.result && listResponse.result.content) {
      const content = JSON.parse(listResponse.result.content[0].text);
      if (content.entries && content.entries.length > 0) {
        const firstFile = content.entries[0];
        console.log(`\n读取第一个文件: ${firstFile.name}`);
        const fileResponse = await client.readFile(`/Users/aezi/Downloads/athoney/${firstFile.name}`);
        console.log('文件内容响应:', JSON.stringify(fileResponse, null, 2));
      }
    }

  } catch (error) {
    console.error('测试失败:', error.message);
  }
}

testMCP();
