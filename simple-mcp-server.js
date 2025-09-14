#!/usr/bin/env node

/**
 * Simple MCP File Server
 * A basic Model Context Protocol server for reading files and directories
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { createWorker } = require('tesseract.js');
const sharp = require('sharp');

class SimpleMCPServer {
  constructor(port = 3000) {
    this.port = port;
    this.nextId = 1;
    this.ocrWorker = null;
    this.server = null;
  }

  async initialize() {
    // Initialize OCR worker
    try {
      this.ocrWorker = await createWorker();
      await this.ocrWorker.loadLanguage('eng');
      await this.ocrWorker.initialize('eng');
      console.log('OCR worker initialized');
    } catch (error) {
      console.warn('OCR initialization failed, text extraction will be disabled:', error.message);
    }
  }

  async handleRequest(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.method !== 'POST' || req.url !== '/mcp') {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    }

    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const request = JSON.parse(body);
        const response = await this.processRequest(request);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
      } catch (error) {
        console.error('Request processing error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal error',
            data: error.message
          },
          id: null
        }));
      }
    });
  }

  async processRequest(request) {
    const { method, params, id } = request;

    switch (method) {
      case 'initialize':
        return this.handleInitialize(id);
      case 'tools/call':
        return this.handleToolCall(params, id);
      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  handleInitialize(id) {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {
            listChanged: false
          }
        },
        serverInfo: {
          name: 'simple-mcp-fileserver',
          version: '1.0.0'
        }
      }
    };
  }

  async handleToolCall(params, id) {
    const { name, arguments: args } = params;

    switch (name) {
      case 'list_directory':
        return this.handleListDirectory(args, id);
      case 'read_file':
        return this.handleReadFile(args, id);
      case 'analyze_image':
        return this.handleAnalyzeImage(args, id);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  async handleListDirectory(args, id) {
    const { path: dirPath, recursive = false } = args;

    try {
      const entries = await this.readDirectory(dirPath, recursive);
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [{
            type: 'text',
            text: JSON.stringify({ entries }, null, 2)
          }]
        }
      };
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: `Failed to list directory: ${error.message}`
        }
      };
    }
  }

  async readDirectory(dirPath, recursive = false, maxDepth = 3) {
    const entries = [];

    async function readDir(currentPath, currentDepth = 0) {
      if (currentDepth > maxDepth) return;

      try {
        const items = await fs.promises.readdir(currentPath, { withFileTypes: true });

        for (const item of items) {
          const fullPath = path.join(currentPath, item.name);
          const entry = {
            name: item.name,
            type: item.isDirectory() ? 'directory' : 'file',
            path: fullPath
          };

          if (item.isFile()) {
            try {
              const stats = await fs.promises.stat(fullPath);
              entry.size = stats.size;
              entry.modified = stats.mtime.toISOString();
            } catch (error) {
              // Ignore stat errors
            }
          }

          entries.push(entry);

          if (recursive && item.isDirectory() && currentDepth < maxDepth) {
            await readDir(fullPath, currentDepth + 1);
          }
        }
      } catch (error) {
        console.warn(`Failed to read directory ${currentPath}:`, error.message);
      }
    }

    await readDir(dirPath);
    return entries;
  }

  async handleReadFile(args, id) {
    const { path: filePath } = args;

    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [{
            type: 'text',
            text: content
          }]
        }
      };
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: `Failed to read file: ${error.message}`
        }
      };
    }
  }

  async handleAnalyzeImage(args, id) {
    const { path: imagePath } = args;

    try {
      // Get basic image metadata using Sharp
      const metadata = await sharp(imagePath).metadata();

      let ocrText = null;
      if (this.ocrWorker) {
        try {
          const { data: { text } } = await this.ocrWorker.recognize(imagePath);
          ocrText = text.trim();
        } catch (error) {
          console.warn('OCR failed:', error.message);
        }
      }

      // Convert to base64 for LLM usage
      const imageBuffer = await sharp(imagePath).png().toBuffer();
      const base64Data = imageBuffer.toString('base64');

      const result = {
        technical_metadata: {
          format: metadata.format,
          width: metadata.width,
          height: metadata.height,
          channels: metadata.channels,
          density: metadata.density,
          colorSpace: metadata.colourspace || metadata.colorspace,
          hasAlpha: metadata.hasAlpha,
          orientation: metadata.orientation
        },
        extracted_text: ocrText,
        base64_data: `data:image/png;base64,${base64Data}`,
        note: 'This analysis provides only technical metadata and extracted text. For visual content identification, use the base64_data with a vision-enabled LLM like GPT-4V or Claude Vision.'
      };

      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        }
      };
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: `Failed to analyze image: ${error.message}`
        }
      };
    }
  }

  async start() {
    await this.initialize();

    this.server = http.createServer((req, res) => this.handleRequest(req, res));

    return new Promise((resolve, reject) => {
      this.server.listen(this.port, () => {
        console.log(`MCP File Server listening on port ${this.port}`);
        console.log(`Available tools: list_directory, read_file, analyze_image`);
        resolve();
      });

      this.server.on('error', reject);
    });
  }

  async stop() {
    if (this.ocrWorker) {
      await this.ocrWorker.terminate();
    }

    if (this.server) {
      return new Promise(resolve => {
        this.server.close(resolve);
      });
    }
  }
}

// CLI
if (require.main === module) {
  const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  const server = new SimpleMCPServer(port);

  process.on('SIGINT', async () => {
    console.log('Shutting down server...');
    await server.stop();
    process.exit(0);
  });

  server.start().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

module.exports = SimpleMCPServer;
