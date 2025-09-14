const http = require('http');

// Simple MCP Client Test
class SimpleMCPClient {
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

      console.log(`Sending ${method} request...`);

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            resolve(response);
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(JSON.stringify(requestData));
      req.end();
    });
  }

  async initialize() {
    return this.call('initialize');
  }

  async listDirectory(dirPath, recursive = false) {
    return this.call('tools/call', {
      name: 'list_directory',
      arguments: {
        path: dirPath,
        recursive
      }
    });
  }

  async readFile(filePath) {
    return this.call('tools/call', {
      name: 'read_file',
      arguments: {
        path: filePath
      }
    });
  }

  async analyzeImage(imagePath) {
    return this.call('tools/call', {
      name: 'analyze_image',
      arguments: {
        path: imagePath
      }
    });
  }
}

// Test function
async function testMCP() {
  const client = new SimpleMCPClient();

  try {
    console.log('Initializing MCP connection...');
    const initResponse = await client.initialize();
    console.log('✓ Initialization successful');
    console.log('');

    console.log('Reading directory: /Users/aezi/Downloads/athoney');
    const listResponse = await client.listDirectory('/Users/aezi/Downloads/athoney', true);
    console.log('✓ Directory listing successful');

    if (listResponse.result && listResponse.result.content) {
      const content = JSON.parse(listResponse.result.content[0].text);
      console.log(`Found ${content.entries.length} items:`);
      console.log('');

      // Display first 10 items
      content.entries.slice(0, 10).forEach((entry, index) => {
        const icon = entry.type === 'directory' ? '📁' : '📄';
        const size = entry.size ? ` (${(entry.size / 1024).toFixed(1)} KB)` : '';
        console.log(`${index + 1}. ${icon} ${entry.name}${size}`);
      });

      if (content.entries.length > 10) {
        console.log(`... and ${content.entries.length - 10} more items`);
      }

      console.log('');

      // Try to read the first text file if any
      const textFiles = content.entries.filter(entry =>
        entry.type === 'file' &&
        (entry.name.endsWith('.txt') || entry.name.endsWith('.md') || entry.name.endsWith('.json'))
      );

      if (textFiles.length > 0) {
        const firstTextFile = textFiles[0];
        console.log(`Reading first text file: ${firstTextFile.name}`);
        const fileResponse = await client.readFile(firstTextFile.path);

        if (fileResponse.result && fileResponse.result.content) {
          const fileContent = fileResponse.result.content[0].text;
          console.log('✓ File reading successful');
          console.log('File content preview:');
          console.log(fileContent.substring(0, 200) + (fileContent.length > 200 ? '...' : ''));
        }
      }

      // Try to analyze the first image file if any
      const imageFiles = content.entries.filter(entry =>
        entry.type === 'file' &&
        /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(entry.name)
      );

      if (imageFiles.length > 0) {
        const firstImageFile = imageFiles[0];
        console.log(`Analyzing first image file: ${firstImageFile.name}`);
        const imageResponse = await client.analyzeImage(firstImageFile.path);

        if (imageResponse.result && imageResponse.result.content) {
          const imageData = JSON.parse(imageResponse.result.content[0].text);
          console.log('✓ Image analysis successful');
          console.log(`Image format: ${imageData.technical_metadata.format}`);
          console.log(`Dimensions: ${imageData.technical_metadata.width}x${imageData.technical_metadata.height}`);

          if (imageData.extracted_text) {
            console.log('Extracted text preview:');
            console.log(imageData.extracted_text.substring(0, 100) + (imageData.extracted_text.length > 100 ? '...' : ''));
          }

          console.log('Base64 data available for LLM vision models');
        }
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('Make sure the MCP server is running on port 3000');
      console.error('Run: node simple-mcp-server.js');
    }
  }
}

console.log('=== MCP File Server Test ===');
console.log('Testing directory: /Users/aezi/Downloads/athoney');
console.log('');

testMCP();
