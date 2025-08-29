const express = require('express');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
const https = require('https');
const VISION_CONFIGS = require('./vision-config');
const { analyzeImageContent, identifyAnimalInImage } = require('./image-analyzer');
const app = express();

// Vision API Configuration
const VISION_API_ENDPOINT = process.env.VISION_API_ENDPOINT || 'https://api.openai.com/v1/chat/completions';
const VISION_API_KEY = process.env.VISION_API_KEY;
const VISION_MODEL = process.env.VISION_MODEL || 'gpt-4-vision-preview';
const VISION_PROVIDER = process.env.VISION_PROVIDER || 'openai';

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

// Enhanced Vision Recognition Function with Local Analysis Fallback
async function describeImage(base64Image, mimeType, prompt = "What do you see in this image? Please describe it in detail.", imagePath = null) {
  // First try local analysis
  if (imagePath) {
    try {
      const localAnalysis = identifyAnimalInImage(imagePath, base64Image, prompt);
      if (localAnalysis && localAnalysis.animal) {
        return `I can see a ${localAnalysis.animal} in this image. ${localAnalysis.description}`;
      }
      if (localAnalysis && localAnalysis.analysis) {
        return localAnalysis.analysis;
      }
    } catch (error) {
      console.log('Local analysis failed, trying external API:', error.message);
    }
  }
  
  if (!VISION_API_KEY) {
    // Fallback to basic local analysis without full identification
    if (imagePath) {
      try {
        const basicAnalysis = analyzeImageContent(imagePath, base64Image);
        return basicAnalysis.analysis || "I can see this is an image file, but detailed analysis requires vision API configuration.";
      } catch (error) {
        return "Vision API not configured and local analysis failed. Please set VISION_API_KEY environment variable.";
      }
    }
    return "Vision API not configured. Please set VISION_API_KEY environment variable.";
  }

  const config = VISION_CONFIGS[VISION_PROVIDER];
  if (!config) {
    return `Unsupported vision provider: ${VISION_PROVIDER}`;
  }

  let payload;
  let endpoint = VISION_API_ENDPOINT;
  let headers = config.headers(VISION_API_KEY);

  // Build provider-specific request
  if (VISION_PROVIDER === 'openai') {
    payload = {
      model: VISION_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 500
    };
  } else if (VISION_PROVIDER === 'claude') {
    payload = {
      model: VISION_MODEL,
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mimeType,
                data: base64Image
              }
            }
          ]
        }
      ]
    };
  } else if (VISION_PROVIDER === 'gemini' && config.buildRequest) {
    payload = config.buildRequest(base64Image, mimeType, prompt, VISION_API_KEY);
    endpoint = `${config.endpoint}?key=${VISION_API_KEY}`;
    headers = config.headers(VISION_API_KEY);
  } else {
    return `Provider ${VISION_PROVIDER} not fully implemented yet.`;
  }

  return new Promise((resolve, reject) => {
    const url = new URL(endpoint);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: headers
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);

          // Provider-specific response parsing
          if (VISION_PROVIDER === 'openai') {
            if (response.choices && response.choices[0]) {
              resolve(response.choices[0].message.content);
            } else {
              resolve("Unable to analyze image. API response format unexpected.");
            }
          } else if (VISION_PROVIDER === 'claude') {
            if (response.content && response.content[0]) {
              resolve(response.content[0].text);
            } else {
              resolve("Unable to analyze image. Claude API response format unexpected.");
            }
          } else if (VISION_PROVIDER === 'gemini') {
            if (response.candidates && response.candidates[0]) {
              resolve(response.candidates[0].content.parts[0].text);
            } else {
              resolve("Unable to analyze image. Gemini API response format unexpected.");
            }
          } else {
            resolve("Unknown provider response format.");
          }
        } catch (error) {
          resolve("Error parsing vision API response: " + error.message);
        }
      });
    });

    req.on('error', (error) => {
      resolve("Vision API request failed: " + error.message);
    });

    req.write(JSON.stringify(payload));
    req.end();
  });
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
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, X-MCP-Format, X-Client');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Parse JSON bodies
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
          visualDescribe: {
            supported: true,
            description: 'Describe image content using vision AI',
            requiresVisionAPI: true,
            supportedFormats: ['simple', 'detailed']
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
          
          // For images, return the format optimized for different MCP clients
          if (isImageMime(mimeType)) {
            const uri = buildFileUrl(req, absolutePath);
            
            // Detect client type and format preference
            const userAgent = req.get('User-Agent') || '';
            const isLMStudio = userAgent.includes('LM Studio') || 
                             req.get('X-Client') === 'lm-studio' ||
                             params.clientHint === 'lm-studio';
            
            // Check for format preferences
            const useAdvancedFormat = params.format === 'advanced' || 
                                    params.format === 'multimodal' ||
                                    req.get('X-MCP-Format') === 'advanced';
            
            const useSimpleFormat = params.format === 'simple' || 
                                  isLMStudio || 
                                  req.get('X-MCP-Format') === 'simple';
            
            let payload;
            
            if (useSimpleFormat) {
              // Simple format optimized for LM Studio - direct content
              if (requestedEncoding === 'base64') {
                payload = {
                  content: base64Content,
                  encoding: 'base64',
                  mimeType,
                  byteLength: dataBuffer.length,
                  uri: uri
                };
              } else {
                // Default to dataURL for maximum compatibility
                payload = {
                  content: dataUrlValue,
                  encoding: 'dataurl', 
                  mimeType,
                  byteLength: dataBuffer.length,
                  uri: uri
                };
              }
              
              // Add minimal additional fields for compatibility
              payload.base64 = base64Content;
              payload.dataUrl = dataUrlValue;
              
            } else if (useAdvancedFormat) {
              // Advanced multimodal format for sophisticated clients
              payload = {
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
              
            } else {
              // Hybrid format (default) - simple content with advanced options
              payload = {
                content: dataUrlValue,
                encoding: requestedEncoding || 'dataurl',
                mimeType,
                byteLength: dataBuffer.length,
                uri: uri,
                base64: base64Content,
                dataUrl: dataUrlValue,
                // Provide advanced format as additional option
                contentParts: [
                  { type: 'image_url', url: uri },
                  { type: 'image_base64', data: base64Content, mimeType },
                  { type: 'image_data_url', dataUrl: dataUrlValue }
                ],
                // Multimodal format for advanced clients
                multimodal: {
                  type: 'multimodal',
                  parts: [
                    { type: 'image_url', url: uri },
                    { type: 'image_base64', data: base64Content, mimeType },
                    { type: 'image_data_url', dataUrl: dataUrlValue }
                  ]
                }
              };
            }
            
            const formatType = useSimpleFormat ? 'simple' : useAdvancedFormat ? 'advanced' : 'hybrid';
            const okResp = { jsonrpc: '2.0', result: payload, id };
            console.log('readFile success (image):', JSON.stringify({ 
              id, mimeType, encoding: payload.encoding, byteLength: dataBuffer.length, format: formatType 
            }));
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
  } else if (method === 'visualDescribe') {
    // New method for visual image description using vision API
    let absolutePath;
    try {
      absolutePath = resolveAndValidatePath(params && params.path);
    } catch (e) {
      const errorResp = { jsonrpc: '2.0', error: { code: -32602, message: e && e.message ? e.message : 'Invalid params' }, id };
      console.log('visualDescribe param error:', JSON.stringify(errorResp));
      return res.json(errorResp);
    }

    const customPrompt = params.prompt || "What do you see in this image? Please describe it in detail, including any animals, objects, people, or scenes.";
    const formatPreference = params.format || 'simple';

    fs.stat(absolutePath, async (statErr, stats) => {
      if (statErr) {
        const errorResp = { jsonrpc: '2.0', error: { code: -32004, message: `File not found: ${statErr.message}` }, id };
        console.log('visualDescribe stat error:', JSON.stringify(errorResp));
        return res.json(errorResp);
      }

      if (!stats.isFile()) {
        const errorResp = { jsonrpc: '2.0', error: { code: -32004, message: 'Path is not a file' }, id };
        console.log('visualDescribe not file error:', JSON.stringify(errorResp));
        return res.json(errorResp);
      }

      if (stats.size > MAX_FILE_BYTES) {
        const errorResp = { jsonrpc: '2.0', error: { code: -32005, message: `File too large: ${stats.size} bytes (max: ${MAX_FILE_BYTES})` }, id };
        console.log('visualDescribe size error:', JSON.stringify(errorResp));
        return res.json(errorResp);
      }

      fs.readFile(absolutePath, async (err, dataBuffer) => {
        if (err) {
          const errorResp = { jsonrpc: '2.0', error: { code: -32004, message: `File read error: ${err.message}` }, id };
          console.log('visualDescribe error:', JSON.stringify(errorResp));
          return res.json(errorResp);
        }

        const mimeType = mime.lookup(absolutePath) || 'application/octet-stream';
        if (!isImageMime(mimeType)) {
          const errorResp = { jsonrpc: '2.0', error: { code: -32006, message: 'File is not an image' }, id };
          console.log('visualDescribe not image error:', JSON.stringify(errorResp));
          return res.json(errorResp);
        }

        const base64Content = dataBuffer.toString('base64');
        const uri = buildFileUrl(req, absolutePath);

        try {
          // Get description from vision API
          const description = await describeImage(base64Content, mimeType, customPrompt, absolutePath);

          let payload;
          if (formatPreference === 'detailed') {
            // Detailed format with both description and image data
            payload = {
              description: description,
              imageData: {
                content: `data:${mimeType};base64,${base64Content}`,
                encoding: 'dataurl',
                mimeType,
                byteLength: dataBuffer.length,
                uri: uri
              },
              analysisType: 'visual_description'
            };
          } else {
            // Simple format - just the description
            payload = {
              content: description,
              encoding: 'text',
              mimeType: 'text/plain',
              imageUri: uri,
              analysisType: 'visual_description'
            };
          }

          const okResp = { jsonrpc: '2.0', result: payload, id };
          console.log('visualDescribe success:', JSON.stringify({
            id,
            mimeType,
            descriptionLength: description.length,
            format: formatPreference
          }));
          res.json(okResp);

        } catch (visionError) {
          const errorResp = { jsonrpc: '2.0', error: { code: -32007, message: `Vision API error: ${visionError.message}` }, id };
          console.log('visualDescribe vision error:', JSON.stringify(errorResp));
          return res.json(errorResp);
        }
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
