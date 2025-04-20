const express = require('express');
const fs = require('fs');
const app = express();

// Enable CORS for all routes
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

// The MCP protocol uses JSON-RPC 2.0 format
app.post('/mcp', (req, res) => {
  console.log('Received MCP request:', JSON.stringify(req.body));
  res.setHeader('Content-Type', 'application/json');
  const { method, params, id } = req.body;
  if (method === 'initialize') {
    const response = {
      jsonrpc: '2.0',
      result: {
        capabilities: {
          readFile: { supported: true, description: 'Read a file from disk' },
          writeFile: { supported: true, description: 'Write a file to disk' },
          listDir: { supported: true, description: 'List directory contents' }
        },
        serverName: 'simple-mcp-fileserver',
        version: '1.0.0',
        mcp: 'filesystem'
      },
      id,
    };
    console.log('Responding to initialize:', JSON.stringify(response));
    return res.json(response);
  } else if (method === 'readFile') {
    fs.readFile(params.path, 'utf8', (err, data) => {
      if (err) {
        const errorResp = { jsonrpc: '2.0', error: { code: 1, message: err.message }, id };
        console.log('readFile error:', JSON.stringify(errorResp));
        return res.json(errorResp);
      }
      const okResp = { jsonrpc: '2.0', result: data, id };
      console.log('readFile success:', JSON.stringify(okResp));
      res.json(okResp);
    });
  } else if (method === 'writeFile') {
    fs.writeFile(params.path, params.content, err => {
      if (err) {
        const errorResp = { jsonrpc: '2.0', error: { code: 1, message: err.message }, id };
        console.log('writeFile error:', JSON.stringify(errorResp));
        return res.json(errorResp);
      }
      const okResp = { jsonrpc: '2.0', result: 'ok', id };
      console.log('writeFile success:', JSON.stringify(okResp));
      res.json(okResp);
    });
  } else if (method === 'listDir') {
    fs.readdir(params.path, (err, files) => {
      if (err) {
        const errorResp = { jsonrpc: '2.0', error: { code: 1, message: err.message }, id };
        console.log('listDir error:', JSON.stringify(errorResp));
        return res.json(errorResp);
      }
      const okResp = { jsonrpc: '2.0', result: files, id };
      console.log('listDir success:', JSON.stringify(okResp));
      res.json(okResp);
    });
  } else {
    const errorResp = { jsonrpc: '2.0', error: { code: -32601, message: 'Method not found' }, id };
    console.log('Unknown method:', JSON.stringify(errorResp));
    res.json(errorResp);
  }
});

// Configuration: allow external tool to set port via environment variables
const PORT = process.env.PORT || process.env.MCP_PORT || 8090;

// Simple health‑check endpoint for orchestrators
app.get('/health', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send('ok');
});

app.listen(PORT, () => console.log(`MCP FileServer running on port ${PORT}`));
