const express = require('express');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
const app = express();

// Configuration
const ROOT_DIR = process.env.ROOT_DIR || process.env.MCP_ROOT_DIR || '';
const MAX_FILE_BYTES = (() => {
  const raw = process.env.MAX_FILE_BYTES || process.env.MCP_MAX_FILE_BYTES || '26214400'; // 25 MiB default
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 26214400;
})();

function resolveAndValidatePath(userProvidedPath) {
  if (!userProvidedPath || typeof userProvidedPath !== 'string') {
    const err = new Error('Invalid or missing "path" parameter');
    err.code = 'ERR_INVALID_PATH_PARAM';
    throw err;
  }
  const absolutePath = path.resolve(String(userProvidedPath));
  if (ROOT_DIR) {
    const rootResolved = path.resolve(ROOT_DIR);
    const relative = path.relative(rootResolved, absolutePath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      const err = new Error('Access denied: Path is outside the allowed root directory');
      err.code = 'ERR_OUTSIDE_ROOT';
      throw err;
    }
  }
  return absolutePath;
}

function isImageMime(mimeType) {
  return /^image\//.test(String(mimeType || ''));
}

function buildFileUrl(req, absolutePath) {
  const host = req.get('host');
  const protocol = req.protocol;
  return `${protocol}://${host}/file?path=${encodeURIComponent(absolutePath)}`;
}

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
          readFile: { 
            supported: true, 
            description: 'Read a file from disk',
            imageSupport: true,
            supportedEncodings: ['utf8', 'base64', 'dataurl']
          },
          writeFile: { supported: true, description: 'Write a file to disk' },
          listDir: { supported: true, description: 'List directory contents' }
        },
        serverName: 'simple-mcp-fileserver',
        version: '1.1.0',
        mcp: 'filesystem',
        imageOutputModes: ['uri', 'dataurl', 'base64']
      },
      id,
    };
    console.log('Responding to initialize:', JSON.stringify(response));
    return res.json(response);
  } else if (method === 'readFile') {
    let absolutePath;
    try {
      absolutePath = resolveAndValidatePath(params && params.path);
    } catch (e) {
      const errorResp = { jsonrpc: '2.0', error: { code: -32602, message: e && e.message ? e.message : 'Invalid params' }, id };
      console.log('readFile param error:', JSON.stringify(errorResp));
      return res.json(errorResp);
    }

    fs.stat(absolutePath, (statErr, stats) => {
      if (statErr) {
        const errorResp = { jsonrpc: '2.0', error: { code: -32004, message: `File not found: ${statErr.message}` }, id };
        console.log('readFile stat error:', JSON.stringify(errorResp));
        return res.json(errorResp);
      }

      if (stats.size > MAX_FILE_BYTES) {
        const errorResp = { jsonrpc: '2.0', error: { code: -32010, message: `File too large: ${stats.size} bytes (limit ${MAX_FILE_BYTES})`, data: { byteLength: stats.size, maxBytes: MAX_FILE_BYTES } }, id };
        console.log('readFile size error:', JSON.stringify(errorResp));
        return res.json(errorResp);
      }

      fs.readFile(absolutePath, (err, dataBuffer) => {
        if (err) {
          const errorResp = { jsonrpc: '2.0', error: { code: -32603, message: err.message }, id };
          console.log('readFile error:', JSON.stringify(errorResp));
          return res.json(errorResp);
        }

        const requestedEncoding = (params && params.encoding) ? String(params.encoding).toLowerCase() : undefined;
        const mimeType = mime.lookup(absolutePath) || 'application/octet-stream';
        const isLikelyBinaryByMime = /^(image|audio|video)\//.test(mimeType) || /^(application)\/(pdf|zip|octet-stream)/.test(mimeType);
        const shouldReturnBinary = requestedEncoding === 'base64' || requestedEncoding === 'dataurl' || isLikelyBinaryByMime;

        if (shouldReturnBinary) {
          const base64Content = dataBuffer.toString('base64');
          const isDataUrl = requestedEncoding === 'dataurl' || (!requestedEncoding && /^image\//.test(mimeType));
          const dataUrlValue = `data:${mimeType};base64,${base64Content}`;
          
          // For images, return the multimodal format that MCP clients expect
          if (isImageMime(mimeType)) {
            const uri = buildFileUrl(req, absolutePath);
            const payload = {
              content: {
                type: 'multimodal',
                parts: [
                  { type: 'image_url', url: uri },
                  { type: 'image_base64', data: base64Content, mimeType },
                  { type: 'image_data_url', dataUrl: dataUrlValue }
                ]
              },
              encoding: requestedEncoding || 'multimodal',
              mimeType,
              byteLength: dataBuffer.length,
              uri: uri,
              contentParts: [
                { type: 'image_url', url: uri },
                { type: 'image_base64', data: base64Content, mimeType },
                { type: 'image_data_url', dataUrl: dataUrlValue }
              ],
              base64: base64Content,
              dataUrl: dataUrlValue
            };
            
            const okResp = { jsonrpc: '2.0', result: payload, id };
            console.log('readFile success (image):', JSON.stringify({ id, mimeType, encoding: payload.encoding, byteLength: dataBuffer.length }));
            return res.json(okResp);
          }
          
          // For other binary files, return base64 or dataurl as requested
          const payload = isDataUrl
            ? { content: dataUrlValue, encoding: 'dataurl', mimeType, byteLength: dataBuffer.length }
            : { content: base64Content, encoding: 'base64', mimeType, byteLength: dataBuffer.length };

          const okResp = { jsonrpc: '2.0', result: payload, id };
          console.log('readFile success (binary):', JSON.stringify({ id, mimeType, encoding: payload.encoding, byteLength: dataBuffer.length }));
          return res.json(okResp);
        }

        const textContent = dataBuffer.toString('utf8');
        const okResp = { jsonrpc: '2.0', result: textContent, id };
        console.log('readFile success (text):', JSON.stringify({ id, mimeType, length: textContent.length }));
        res.json(okResp);
      });
    });
  } else if (method === 'writeFile') {
    let absolutePath;
    try {
      absolutePath = resolveAndValidatePath(params && params.path);
    } catch (e) {
      const errorResp = { jsonrpc: '2.0', error: { code: -32602, message: e && e.message ? e.message : 'Invalid params' }, id };
      console.log('writeFile param error:', JSON.stringify(errorResp));
      return res.json(errorResp);
    }
    const content = params && Object.prototype.hasOwnProperty.call(params, 'content') ? params.content : undefined;
    if (typeof content !== 'string') {
      const errorResp = { jsonrpc: '2.0', error: { code: -32602, message: 'Invalid or missing "content" parameter (expected string)' }, id };
      console.log('writeFile param error:', JSON.stringify(errorResp));
      return res.json(errorResp);
    }
    fs.writeFile(absolutePath, content, err => {
      if (err) {
        const errorResp = { jsonrpc: '2.0', error: { code: -32603, message: err.message }, id };
        console.log('writeFile error:', JSON.stringify(errorResp));
        return res.json(errorResp);
      }
      const okResp = { jsonrpc: '2.0', result: 'ok', id };
      console.log('writeFile success:', JSON.stringify(okResp));
      res.json(okResp);
    });
  } else if (method === 'listDir') {
    let absolutePath;
    try {
      absolutePath = resolveAndValidatePath(params && params.path);
    } catch (e) {
      const errorResp = { jsonrpc: '2.0', error: { code: -32602, message: e && e.message ? e.message : 'Invalid params' }, id };
      console.log('listDir param error:', JSON.stringify(errorResp));
      return res.json(errorResp);
    }
    fs.readdir(absolutePath, (err, files) => {
      if (err) {
        const errorResp = { jsonrpc: '2.0', error: { code: -32603, message: err.message }, id };
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

// Serve files directly with proper Content-Type for use as URLs (e.g., in image_url)
app.get('/file', (req, res) => {
  const filePath = req.query.path;
  if (!filePath) {
    return res.status(400).send('Missing "path" query parameter');
  }

  let resolvedPath;
  try {
    resolvedPath = resolveAndValidatePath(filePath);
  } catch (e) {
    return res.status(403).send(e && e.message ? e.message : 'Forbidden');
  }

  fs.stat(resolvedPath, (statErr, stats) => {
    if (statErr) {
      return res.status(404).send(statErr.message);
    }
    const mimeType = mime.lookup(resolvedPath) || 'application/octet-stream';
    res.setHeader('Content-Type', mimeType);

    const stream = fs.createReadStream(resolvedPath);
    stream.on('error', (err) => {
      res.status(404).send(err.message);
    });
    stream.pipe(res);
  });
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`MCP FileServer running on port ${PORT}`));
}

module.exports = { app, resolveAndValidatePath, isImageMime, buildFileUrl, MAX_FILE_BYTES, ROOT_DIR };
