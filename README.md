# Simple MCP FileServer

A lightweight Model Context Protocol (MCP) file system server that enables AI agents (like Codeium, Claude, Windsurf, etc.) to interact with your local file system through a standardized JSON-RPC interface.

## What is MCP?

The Model Context Protocol (MCP) is a standardized way for AI agents to interact with external systems. This implementation provides file system operations, allowing AI assistants to read, write, and manipulate files on your local machine in a controlled and secure manner.

## How It Works

This server implements a JSON-RPC 2.0 API that AI agents can call to perform file operations:

1. **Communication Protocol**: Uses HTTP with JSON-RPC 2.0 format for requests and responses
2. **Method Dispatching**: Routes requests to appropriate file system operations
3. **Error Handling**: Provides standardized error responses with meaningful codes
4. **Capability Discovery**: Supports the `initialize` method for capability reporting

The server acts as a bridge between AI agents and your file system, translating JSON-RPC requests into actual file operations and returning the results.

## Features

- **File Operations**:
  - Read file content (`readFile` method)
  - Write or overwrite file content (`writeFile` method)
  - List directory contents (`listDir` method)
- **MCP Protocol Compatibility**:
  - Full JSON-RPC 2.0 protocol compliance
  - Supports `initialize` method with capability reporting
  - Detailed error handling and logging
- **CORS Support**: Built-in cross-origin support for web client integration
- **Health Check**: Provides a `/health` endpoint for monitoring and probing
 - **Multimodal Image Outputs**: `readFile` returns image results that include both `image_url` and base64/data URL forms to be consumed by MCP clients as model inputs

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/simple-mcp-fileserver.git
   cd simple-mcp-fileserver
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Configuration

The server configuration is flexible and supports the following environment variables:

- `PORT` or `MCP_PORT`: Specify the server listening port (default: 8090)
- `ROOT_DIR` or `MCP_ROOT_DIR`: Restrict accessible files to this directory (optional; when set, paths outside are denied)
- `MAX_FILE_BYTES` or `MCP_MAX_FILE_BYTES`: Maximum allowed file size for `readFile` (default: 26214400 bytes, i.e., 25 MiB)

## Usage

### Method 1: Direct Launch

Start the server directly from the command line:

```bash
node simple-mcp-fileserver.js
```

With custom port:
```bash
PORT=9000 node simple-mcp-fileserver.js
```

### Method 2: Configure in MCP Orchestrator

Add to `.codeium/windsurf/mcp_config.json` to integrate with Codeium/Windsurf:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "node",
      "args": [
        "/path/to/simple-mcp-fileserver/simple-mcp-fileserver.js"
      ],
      "env": {
        "PORT": "9000"
      }
    }
  }
}
```

### Method 3: Use Official MCP Filesystem Server

If you encounter compatibility issues, you can use the official MCP filesystem server:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/path/to/allowed/directory"
      ]
    }
  }
}
```

## Integration with AI Assistants

Once your MCP server is running, AI assistants that support the MCP protocol can interact with your file system. The assistant will:

1. Connect to your MCP server
2. Initialize the connection to discover capabilities
3. Make requests to read, write, or list files as needed
4. Process the responses to provide you with relevant information

This enables powerful workflows where AI assistants can help you with coding tasks that require file system access.

## API Reference

### initialize

Initialize connection and get server capabilities.

**Request**:
```json
{
  "jsonrpc": "2.0",
  "method": "initialize",
  "params": {},
  "id": 1
}
```

**Response**:
```json
{
  "jsonrpc": "2.0",
  "result": {
    "capabilities": {
      "readFile": { "supported": true, "description": "Read a file from disk" },
      "writeFile": { "supported": true, "description": "Write a file to disk" },
      "listDir": { "supported": true, "description": "List directory contents" }
    },
    "serverName": "simple-mcp-fileserver",
    "version": "1.0.0",
    "mcp": "filesystem"
  },
  "id": 1
}
```

### readFile

Read file content. Supports text, base64, and Data URL encodings. For images, returns additional multimodal-friendly fields so clients can route the content into model inputs (not just thumbnails).

**Request (text)**:
```json
{
  "jsonrpc": "2.0",
  "method": "readFile",
  "params": { "path": "/path/to/file.txt" },
  "id": 2
}
```

**Response (text)**:
```json
{
  "jsonrpc": "2.0",
  "result": "file content...",
  "id": 2
}
```

**Request (binary, base64)**:
```json
{
  "jsonrpc": "2.0",
  "method": "readFile",
  "params": { "path": "/path/to/image.png", "encoding": "base64" },
  "id": 22
}
```

**Response (binary, base64)**:
```json
{
  "jsonrpc": "2.0",
  "result": {
    "content": "iVBORw0KGgo...",
    "encoding": "base64",
    "mimeType": "image/png",
    "byteLength": 12345,
    "uri": "http://localhost:8090/file?path=/abs/path/to/image.png",
    "contentParts": [
      { "type": "image_url", "url": "http://localhost:8090/file?path=/abs/path/to/image.png" },
      { "type": "image_base64", "data": "iVBORw0KGgo...", "mimeType": "image/png" },
      { "type": "image_data_url", "dataUrl": "data:image/png;base64,iVBORw0KGgo..." }
    ]
  },
  "id": 22
}
```

**Request (binary, Data URL)**:
```json
{
  "jsonrpc": "2.0",
  "method": "readFile",
  "params": { "path": "/path/to/image.png", "encoding": "dataurl" },
  "id": 23
}
```

**Response (binary, Data URL)**:
```json
{
  "jsonrpc": "2.0",
  "result": {
    "content": "data:image/png;base64,iVBORw0KGgo...",
    "encoding": "dataurl",
    "mimeType": "image/png",
    "byteLength": 12345,
    "uri": "http://localhost:8090/file?path=/abs/path/to/image.png",
    "contentParts": [
      { "type": "image_url", "url": "http://localhost:8090/file?path=/abs/path/to/image.png" },
      { "type": "image_base64", "data": "iVBORw0KGgo...", "mimeType": "image/png" },
      { "type": "image_data_url", "dataUrl": "data:image/png;base64,iVBORw0KGgo..." }
    ]
  },
  "id": 23
}
```

### writeFile

Write file content.

**Request**:
```json
{
  "jsonrpc": "2.0",
  "method": "writeFile",
  "params": { 
    "path": "/path/to/file.txt",
    "content": "content to write"
  },
  "id": 3
}
```

**Response**:
```json
{
  "jsonrpc": "2.0",
  "result": "ok",
  "id": 3
}
```

### listDir

List directory contents.

**Request**:
```json
{
  "jsonrpc": "2.0",
  "method": "listDir",
  "params": { "path": "/path/to/directory" },
  "id": 4
}
```

**Response**:
```json
{
  "jsonrpc": "2.0",
  "result": ["file1.txt", "file2.js", "subdirectory"],
  "id": 4
}
```

## Health Check

The server provides a simple health check endpoint:

```bash
curl http://localhost:8090/health
# Returns: ok
```

## Serving Files Directly

For LLMs that support `image_url` or want to fetch files via HTTP, the server exposes a direct file endpoint:

```bash
curl "http://localhost:8090/file?path=/absolute/path/to/image.png" --output image.png
```

This sets the correct `Content-Type` based on the file extension.

### Image vs. Text/Binary Behavior

- Text files: returns a UTF-8 string as before.
- Non-image binaries (e.g., zip, pdf): return `{ content, encoding: "base64", mimeType, byteLength }` or data URL if requested.
- Images (png/jpg/webp and others): include additional `uri` and `contentParts` fields to enable multimodal routing in MCP clients while keeping backward compatibility.

### Errors and Limits

- Missing file: JSON-RPC error with code `-32004`.
- File too large: error with code `-32010` and limit metadata.
- Invalid parameters or outside `ROOT_DIR`: error with code `-32602`.

## Troubleshooting

### Common Issues

1. **Initialization Failure**:
   - Ensure the server is running
   - Check if the port is in use
   - Verify the `/health` endpoint returns `ok`

2. **Port Conflicts**:
   - Use `lsof -i :<port>` to check port usage
   - Start the service with a different port

3. **Permission Issues**:
   - Ensure the server has permission to access requested file paths

## Manual verification

Below are example cURL snippets to exercise the image behavior. Replace paths and ports as needed.

1. LM Studio (or any MCP client using HTTP JSON-RPC):

```bash
curl -s http://localhost:8090/mcp -H 'Content-Type: application/json' -d '{
  "jsonrpc":"2.0",
  "method":"readFile",
  "params": { "path": "/absolute/path/to/cat.png" },
  "id": 10
}' | jq '.'
```

Expected: `result` contains `mimeType: "image/png"`, `content` (base64 or data URL), and `contentParts` with an `image_url`. LM Studio should feed the `image_url` or base64 to the model input when the tool output is wired into prompts.

2. Claude Desktop / Node/Python reference runtimes:

Use the `uri` in `contentParts[0].url` as an image input argument, or pass the data URL directly where supported. For example, a follow-up tool or prompt can include:

```json
{
  "type": "image",
  "source": { "type": "url", "url": "http://localhost:8090/file?path=/absolute/path/to/cat.png" }
}
```

Expected: The model consumes the image, not just displays a thumbnail.

## Security Considerations

This server provides direct access to your file system. Consider these security measures:

- Run the server only on trusted networks
- Limit the directories that can be accessed
- Consider implementing authentication for production use
- Monitor server logs for suspicious activity

## Potential Future Enhancements

This MCP server could be extended with additional features:

1. **Authentication & Authorization**: Add user authentication and path-based permissions
2. **File Watching**: Implement methods to watch files for changes
3. **Advanced File Operations**: Add support for file copying, moving, and deletion
4. **Metadata Operations**: Add methods to get and set file metadata
5. **Search Capabilities**: Implement file content search functionality
6. **Streaming Support**: Add streaming for large file operations
7. **Compression**: Support for compressed file operations
8. **Versioning**: Add simple file versioning capabilities
9. **Batched Operations**: Support for executing multiple operations in a single request
10. **Event Notifications**: Implement WebSocket support for file system event notifications

## Contributing

Pull Requests and Issues are welcome! Some areas where contributions would be particularly valuable:

- Additional file operations
- Enhanced error handling
- Performance optimizations
- Security improvements
- Documentation enhancements

## License

MIT