# simple-mcp-fileserver

A minimal MCP (Model Context Protocol) server for file system operations.

## Features
- Read file content (`readFile` method)
- Write or overwrite file content (`writeFile` method)
- List files in a directory (`listDir` method)
- JSON-RPC 2.0 protocol, designed for integration with AI agents (Windsurf, Claude, Codeium, etc.)

## Usage

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the server:
   ```bash
   npm start
   ```
3. The server listens on port 8090 by default.

## Example JSON-RPC Request

```
POST /mcp
{
  "jsonrpc": "2.0",
  "method": "readFile",
  "params": { "path": "./somefile.txt" },
  "id": 1
}
```

## License
MIT
