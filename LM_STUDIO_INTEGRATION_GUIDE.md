# LM Studio MCP Image Server Integration Guide

## 🎯 Overview

This is a file server optimized specifically for LM Studio and other MCP clients, supporting multimodal visual understanding of images.

## 🚀 Quick Start

### 1. Installation and Launch

```bash
# Clone or download the code
git clone https://github.com/aezizhu/simple-mcp-fileserver.git
cd simple-mcp-fileserver

# Install dependencies
npm install

# Start the server
node simple-mcp-fileserver.js
```

Server will start at `http://localhost:8090`.

### 2. LM Studio Configuration

Add to LM Studio's MCP settings:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "node",
      "args": ["/path/to/simple-mcp-fileserver.js"],
      "env": {
        "PORT": "8090"
      }
    }
  }
}
```

## 📊 Supported Format Modes

### 🔹 Simple Mode (Recommended for LM Studio)

**Trigger conditions:**
- Set `format: "simple"` parameter
- LM Studio User-Agent detected
- Set `clientHint: "lm-studio"` parameter
- Set HTTP header `X-MCP-Format: simple`

**Return format:**
```json
{
  "content": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
  "encoding": "dataurl",
  "mimeType": "image/jpeg",
  "byteLength": 12345,
  "uri": "http://localhost:8090/file?path=...",
  "base64": "/9j/4AAQSkZJRg...",
  "dataUrl": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
}
```

### 🔹 Advanced Mode (For clients supporting complex formats)

**Trigger conditions:**
- Set `format: "advanced"` or `format: "multimodal"` parameter
- Set HTTP header `X-MCP-Format: advanced`

**Return format:**
```json
{
  "content": {
    "type": "multimodal",
    "parts": [
      {"type": "image_url", "url": "http://..."},
      {"type": "image_base64", "data": "...", "mimeType": "image/jpeg"},
      {"type": "image_data_url", "dataUrl": "data:image/jpeg;base64,..."}
    ]
  },
  "encoding": "multimodal",
  "mimeType": "image/jpeg",
  "contentParts": [...],
  "base64": "...",
  "dataUrl": "..."
}
```

### 🔹 Hybrid Mode (Default)

**Features:**
- Main content is a simple dataURL string
- Also provides contentParts and multimodal fields
- Compatible with various clients

## 🛠️ Usage

### Using in LM Studio

1. **Basic image reading:**
   ```
   read_file /path/to/image.png
   ```

2. **Specify simple format (recommended):**
   ```json
   {
     "method": "readFile",
     "params": {
       "path": "/path/to/image.png",
       "format": "simple"
     }
   }
   ```

3. **Specify encoding format:**
   ```json
   {
     "method": "readFile", 
     "params": {
       "path": "/path/to/image.png",
       "encoding": "dataurl",
       "format": "simple"
     }
   }
   ```

### HTTP Header Settings

For different clients, specific HTTP headers can be set:

```bash
# LM Studio optimization
curl -H "X-Client: lm-studio" -H "X-MCP-Format: simple" ...

# Advanced format
curl -H "X-MCP-Format: advanced" ...
```

## 🔧 Configuration Options

### Environment Variables

```bash
# Server port
PORT=8090

# Root directory restriction (optional)
ROOT_DIR=/allowed/directory

# Maximum file size (default 25MB)
MAX_FILE_BYTES=26214400
```

### Parameter Options

| Parameter | Description | Possible Values |
|-----------|-------------|-----------------|
| `format` | Output format | `simple`, `advanced`, `multimodal` |
| `encoding` | Encoding method | `base64`, `dataurl` |
| `clientHint` | Client hint | `lm-studio` |

## 🎯 LM Studio Specific Optimizations

### 1. Auto Detection
- Automatically detects LM Studio User-Agent
- Automatically switches to simple format
- Optimizes content field to direct dataURL

### 2. Compatibility Enhancement
- Ensures encoding field is "dataurl" instead of "multimodal"
- Simplifies nested structures
- Provides multiple access methods (URL, base64, dataURL)

### 3. Error Handling
- Friendly error messages
- Detailed logging
- Automatic fallback mechanism

## 🧪 Test Examples

### 1. Test Text File
```bash
curl -X POST http://localhost:8090/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "readFile",
    "params": {"path": "/path/to/text.txt"},
    "id": 1
  }'
```

### 2. Test Image (Simple Format)
```bash
curl -X POST http://localhost:8090/mcp \
  -H "Content-Type: application/json" \
  -H "X-MCP-Format: simple" \
  -d '{
    "jsonrpc": "2.0",
    "method": "readFile", 
    "params": {
      "path": "/path/to/image.jpg",
      "format": "simple"
    },
    "id": 2
  }'
```

### 3. Test Image (Advanced Format)
```bash
curl -X POST http://localhost:8090/mcp \
  -H "Content-Type: application/json" \
  -H "X-MCP-Format: advanced" \
  -d '{
    "jsonrpc": "2.0",
    "method": "readFile",
    "params": {
      "path": "/path/to/image.jpg", 
      "format": "advanced"
    },
    "id": 3
  }'
```

## 🐛 Troubleshooting

### Common Issues

1. **LLM shows "Cannot read binary images"**
   - Ensure using simple format: `"format": "simple"`
   - Check if LM Studio is correctly detected
   - Verify image file path is correct

2. **Image cannot be displayed**
   - Check if URI endpoint is accessible
   - Verify MIME type is correct
   - Confirm base64 data is complete

3. **Performance issues**
   - Check image file size (default limit 25MB)
   - Consider using URI instead of base64 for large images
   - Monitor server memory usage

### Debug Mode

Enable verbose logging:
```bash
DEBUG=1 node simple-mcp-fileserver.js
```

Check server logs:
```bash
# View request logs
tail -f server.log

# Check errors
curl http://localhost:8090/health
```

## 📋 Supported Image Formats

- ✅ PNG (.png)
- ✅ JPEG (.jpg, .jpeg)
- ✅ WEBP (.webp)
- ✅ GIF (.gif)
- ✅ BMP (.bmp)
- ✅ TIFF (.tiff, .tif)

## 🔗 Related Links

- [GitHub Repository](https://github.com/aezizhu/simple-mcp-fileserver)
- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- [LM Studio Official Site](https://lmstudio.ai/)

## 📞 Technical Support

If you encounter issues, please:
1. Check the troubleshooting section in this guide
2. Review GitHub Issues
3. Provide detailed error logs and configuration information

---

**Version:** 1.1.0
**Updated:** January 2025
**Maintainer:** aezizhu