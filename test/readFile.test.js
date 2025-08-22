// Node built-ins
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

// Small 1x1 images
const PNG_1x1_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHGgKafqD5tQAAAABJRU5ErkJggg==';
// minimal JPEG (1x1)
const JPG_1x1_BASE64 =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxISEhISEhIVFhUVFRUVFRUVFRUVFRUXFhUVFRUYHSggGBolGxUVITEhJSkrLi4uFx8zODMsNygtLisBCgoKDg0OGxAQGy0lHyUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAKAAoAMBIgACEQEDEQH/xAAbAAEAAgMBAQAAAAAAAAAAAAAABQYBAgMHB//EADkQAAIBAgMFBgQEBgMAAAAAAAABAgMRBBIhMQVBUWEGInGBkaHB0RNCUrHR8BMiYpKiM2KSwhVDc8L/xAAYAQEBAQEBAAAAAAAAAAAAAAAAAQIDBf/EAB8RAQEBAAMBAQEBAAAAAAAAAAABAhEDITFBURITI//aAAwDAQACEQMRAD8A+zREQEREBERAREQEREBERA8G9mY0dXb7L2d4c9w3V1PqOEGqHUKf8ARp1nOeZ1y3b8d0fSK3XkN8KZ8Wg2F9o4mloqJ8t8k8u8k+M8QY6sPLd5vFq8n2Zy0m4xbm9C7s2R9eG3Jr2QmJYyP1K1/FgOx7xP8AJR8G8r7b1o5C1o1Ljmq2jHTb9Vw3r3VTw+uJ1RUC8gK2b0hZx+XgFx8Xv8sG3V3l6MzxXfXKxQzRq3rN1z+0xXH7Z8xJm1kcwzjHFFf7p7rwYzXzQ+TXfD6hK1y3L1+vhU1emJcqt/8A5K0+2VfH3mR6z8m7WNv4xT+Vi1miu6m6d7V8ZzZ4u0eIcy8diZc0H5m2J8O4bXq8ZK0q2h9xV8n0n2x+o5q7Yq6mJHqf7Py7tnJr8xM2Yz8o0QxERAREQEREBERAREQEREBERAXw7m7m1mJvbdt1G1v4fW3f1g2o1Sp1Gm6z1nlnks9m9n6jluB8Z1R8V4HcG0s1kmS9K9s8zJ8aV6cr8b8o+YsW8u8oz5mXHgnv3V4oykzqV1P6Gzr3q87/9k=';
// minimal WEBP (1x1)
const WEBP_1x1_BASE64 =
  'UklGRiIAAABXRUJQVlA4ICAAAAAwAQCdASoEAAQAAVAfJZACAA==';

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
  tempDir = fs.mkdtempSync(path.join(fs.realpathSync(require('node:os').tmpdir()), 'mcpfs-'));
  // prepare fixtures
  fs.writeFileSync(path.join(tempDir, 'hello.txt'), 'hello world');
  writeBase64ToFile(PNG_1x1_BASE64, path.join(tempDir, 'pixel.png'));
  writeBase64ToFile(JPG_1x1_BASE64, path.join(tempDir, 'pixel.jpg'));
  writeBase64ToFile(WEBP_1x1_BASE64, path.join(tempDir, 'pixel.webp'));
  fs.writeFileSync(path.join(tempDir, 'file.bin'), Buffer.from([0, 255, 1, 2, 3, 4, 5]));

  // set env BEFORE requiring app
  process.env.ROOT_DIR = tempDir;
  const mod = require('../simple-mcp-fileserver');
  const started = await startServer(mod.app);
  server = started.server;
  baseUrl = started.baseUrl;
});

after(() => {
  if (server) server.close();
  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
});

test('initialize reports capabilities and version', async () => {
  const res = await rpc(baseUrl, { jsonrpc: '2.0', method: 'initialize', params: {}, id: 1 });
  assert.equal(res.jsonrpc, '2.0');
  assert.equal(res.result.serverName, 'simple-mcp-fileserver');
  assert.match(res.result.version, /1\.\d+\.\d+/);
  assert.ok(res.result.capabilities && res.result.capabilities.readFile);
});

test('readFile text returns string', async () => {
  const res = await rpc(baseUrl, { jsonrpc: '2.0', method: 'readFile', params: { path: path.join(tempDir, 'hello.txt') }, id: 2 });
  assert.equal(typeof res.result, 'string');
  assert.equal(res.result, 'hello world');
});

test('readFile non-image binary returns base64 object', async () => {
  const res = await rpc(baseUrl, { jsonrpc: '2.0', method: 'readFile', params: { path: path.join(tempDir, 'file.bin') }, id: 3 });
  assert.equal(typeof res.result, 'object');
  assert.equal(res.result.encoding === 'base64' || res.result.encoding === 'dataurl', true);
  assert.equal(res.result.mimeType, 'application/octet-stream');
  assert.ok(typeof res.result.content === 'string');
});

for (const name of ['pixel.png', 'pixel.jpg', 'pixel.webp']) {
  test(`readFile image (${name}) returns multimodal-friendly payload`, async () => {
    const res = await rpc(baseUrl, { jsonrpc: '2.0', method: 'readFile', params: { path: path.join(tempDir, name) }, id: 10 });
    assert.equal(typeof res.result, 'object');
    assert.ok(res.result.mimeType.startsWith('image/'));
    assert.ok(res.result.byteLength > 0);
    assert.equal(res.result.encoding, 'multimodal');
    assert.equal(typeof res.result.content, 'object');
    assert.equal(res.result.content.type, 'multimodal');
    assert.ok(Array.isArray(res.result.content.parts));
    assert.ok(typeof res.result.uri === 'string');
    assert.ok(Array.isArray(res.result.contentParts));
    assert.ok(typeof res.result.base64 === 'string');
    assert.ok(typeof res.result.dataUrl === 'string');
    const kinds = res.result.contentParts.map(p => p.type).sort();
    assert.deepEqual(kinds, ['image_base64', 'image_data_url', 'image_url']);
  });
}

test('readFile image with base64 encoding still includes multimodal fields', async () => {
  const res = await rpc(baseUrl, { jsonrpc: '2.0', method: 'readFile', params: { path: path.join(tempDir, 'pixel.png'), encoding: 'base64' }, id: 11 });
  assert.equal(res.result.encoding, 'base64');
  assert.ok(res.result.uri);
  assert.ok(Array.isArray(res.result.contentParts));
});

test('readFile error for missing file', async () => {
  const res = await rpc(baseUrl, { jsonrpc: '2.0', method: 'readFile', params: { path: path.join(tempDir, 'nope.png') }, id: 12 });
  assert.ok(res.error);
  assert.equal(res.error.code, -32004);
});

test('readFile size limit error', async () => {
  // restart server with tiny MAX_FILE_BYTES
  if (server) server.close();

  // reload module fresh with new env by clearing require cache
  process.env.MAX_FILE_BYTES = '6';
  delete require.cache[require.resolve('../simple-mcp-fileserver')];
  const mod2 = require('../simple-mcp-fileserver');
  const started2 = await startServer(mod2.app);
  server = started2.server;
  baseUrl = started2.baseUrl;

  const res = await rpc(baseUrl, { jsonrpc: '2.0', method: 'readFile', params: { path: path.join(tempDir, 'file.bin') }, id: 13 });
  assert.ok(res.error);
  assert.equal(res.error.code, -32010);
});

test('listDir works and writeFile writes', async () => {
  const list = await rpc(baseUrl, { jsonrpc: '2.0', method: 'listDir', params: { path: path.join(tempDir) }, id: 14 });
  if (list.error) throw new Error(`listDir error: ${JSON.stringify(list.error)}`);
  assert.ok(Array.isArray(list.result));

  const target = path.join(tempDir, 'new.txt');
  const write = await rpc(baseUrl, { jsonrpc: '2.0', method: 'writeFile', params: { path: target, content: 'abc' }, id: 15 });
  assert.equal(write.result, 'ok');
  const txt = fs.readFileSync(target, 'utf8');
  assert.equal(txt, 'abc');
});

test('GET /file serves image with correct Content-Type', async () => {
  const fileUrl = `${baseUrl}/file?path=${encodeURIComponent(path.join(tempDir, 'pixel.png'))}`;
  const resp = await fetch(fileUrl);
  assert.equal(resp.status, 200);
  assert.equal(resp.headers.get('content-type'), 'image/png');
  const buf = Buffer.from(await resp.arrayBuffer());
  assert.ok(buf.length > 0);
});


