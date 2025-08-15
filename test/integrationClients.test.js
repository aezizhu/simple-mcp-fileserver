const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PNG_1x1_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHGgKafqD5tQAAAABJRU5ErkJggg==';

function writeBase64ToFile(base64, filePath) {
  const buf = Buffer.from(base64, 'base64');
  fs.writeFileSync(filePath, buf);
  return buf.length;
}

function startServer(app) {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, () => {
      const address = server.address();
      const baseUrl = `http://127.0.0.1:${address.port}`;
      resolve({ server, baseUrl });
    });
  });
}

async function rpc(baseUrl, body) {
  const resp = await fetch(`${baseUrl}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  assert.equal(resp.status, 200);
  return resp.json();
}

let tempDir;
let server;
let baseUrl;

before(async () => {
  tempDir = fs.mkdtempSync(path.join(fs.realpathSync(require('node:os').tmpdir()), 'mcpfs-clients-'));
  process.env.ROOT_DIR = tempDir;
  const imgPath = path.join(tempDir, 'pixel.png');
  writeBase64ToFile(PNG_1x1_BASE64, imgPath);
  const mod = require('../simple-mcp-fileserver');
  const started = await startServer(mod.app);
  server = started.server;
  baseUrl = started.baseUrl;
});

after(() => {
  if (server) server.close();
  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
});

test('Clients can adapt image payload to OpenAI and Claude formats', async () => {
  const filePath = path.join(tempDir, 'pixel.png');
  const res = await rpc(baseUrl, { jsonrpc: '2.0', method: 'readFile', params: { path: filePath }, id: 50 });
  assert.equal(res.jsonrpc, '2.0');
  assert.ok(res.result && res.result.mimeType === 'image/png');
  const { uri, contentParts } = res.result;
  assert.ok(uri && Array.isArray(contentParts));

  const openaiMessage = {
    model: 'gpt-4o',
    messages: [
      { role: 'user', content: [
        { type: 'text', text: 'Describe the image' },
        { type: 'image_url', image_url: { url: uri } }
      ] }
    ]
  };

  assert.equal(openaiMessage.messages[0].content[1].type, 'image_url');
  assert.equal(openaiMessage.messages[0].content[1].image_url.url, uri);

  const anthropicMessage = {
    model: 'claude-3-5-sonnet',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'url', url: uri, media_type: 'image/png' } },
          { type: 'text', text: 'Describe the image' }
        ]
      }
    ]
  };

  const imagePart = anthropicMessage.messages[0].content[0];
  assert.equal(imagePart.type, 'image');
  assert.equal(imagePart.source.type, 'url');
  assert.equal(imagePart.source.url, uri);
});


