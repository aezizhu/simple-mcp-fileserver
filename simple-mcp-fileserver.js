const express = require('express');
const fs = require('fs');
const app = express();
app.use(express.json());

// The MCP protocol uses JSON-RPC 2.0 format
app.post('/mcp', (req, res) => {
  const { method, params, id } = req.body;
  if (method === 'readFile') {
    fs.readFile(params.path, 'utf8', (err, data) => {
      if (err) return res.json({ jsonrpc: '2.0', error: { code: 1, message: err.message }, id });
      res.json({ jsonrpc: '2.0', result: data, id });
    });
  } else if (method === 'writeFile') {
    fs.writeFile(params.path, params.content, err => {
      if (err) return res.json({ jsonrpc: '2.0', error: { code: 1, message: err.message }, id });
      res.json({ jsonrpc: '2.0', result: 'ok', id });
    });
  } else if (method === 'listDir') {
    fs.readdir(params.path, (err, files) => {
      if (err) return res.json({ jsonrpc: '2.0', error: { code: 1, message: err.message }, id });
      res.json({ jsonrpc: '2.0', result: files, id });
    });
  } else {
    res.json({ jsonrpc: '2.0', error: { code: -32601, message: 'Method not found' }, id });
  }
});

app.listen(8090, () => console.log('MCP FileServer running on port 8090'));
