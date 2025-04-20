# Simple MCP FileServer

A lightweight Model Context Protocol (MCP) file system server for AI agents (like Codeium, Claude, Windsurf, etc.) to interact with the local file system.

## Features

- **File Operations**:
  - Read file content (`readFile` method)
  - Write or overwrite file content (`writeFile` method)
  - List directory contents (`listDir` method)
- **MCP Protocol Compatibility**:
  - Full JSON-RPC 2.0 protocol compatibility
  - Supports `initialize` method with capability reporting
  - Detailed error handling and logging
- **CORS Support**: Built-in cross-origin support for web client integration
- **Health Check**: Provides a `/health` endpoint for monitoring and probing

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

## Usage

### Method 1: Direct Launch

```bash
node simple-mcp-fileserver.js
```

With custom port:
```bash
PORT=9000 node simple-mcp-fileserver.js
```

### Method 2: Configure in MCP Orchestrator

Add to `.codeium/windsurf/mcp_config.json`:

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

Read file content.

**Request**:
```json
{
  "jsonrpc": "2.0",
  "method": "readFile",
  "params": { "path": "/path/to/file.txt" },
  "id": 2
}
```

**Response**:
```json
{
  "jsonrpc": "2.0",
  "result": "file content...",
  "id": 2
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

## Contributing

Pull Requests and Issues are welcome!

## License

MIT