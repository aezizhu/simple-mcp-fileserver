# Simple MCP FileServer

一个轻量级的 MCP (Model Context Protocol) 文件系统服务器，用于 AI 代理（如 Codeium、Claude、Windsurf 等）与本地文件系统的交互。

## 功能特点

- **文件操作**：
  - 读取文件内容 (`readFile` 方法)
  - 写入或覆盖文件内容 (`writeFile` 方法)
  - 列出目录内容 (`listDir` 方法)
- **MCP 协议兼容**：
  - 完全兼容 JSON-RPC 2.0 协议
  - 支持 `initialize` 方法，返回服务能力
  - 详细的错误处理和日志
- **跨域支持**：内置 CORS 支持，便于 Web 客户端集成
- **健康检查**：提供 `/health` 端点，方便监控和探测

## 安装

1. 克隆仓库：
   ```bash
   git clone https://github.com/yourusername/simple-mcp-fileserver.git
   cd simple-mcp-fileserver
   ```

2. 安装依赖：
   ```bash
   npm install
   ```

## 配置

服务器配置非常灵活，支持以下环境变量：

- `PORT` 或 `MCP_PORT`：指定服务器监听端口（默认：8090）

## 使用方法

### 方法一：直接启动

```bash
node simple-mcp-fileserver.js
```

自定义端口：
```bash
PORT=9000 node simple-mcp-fileserver.js
```

### 方法二：在 MCP Orchestrator 中配置

在 `.codeium/windsurf/mcp_config.json` 中添加：

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

### 方法三：使用官方 MCP 文件系统服务器

如果你遇到兼容性问题，也可以使用官方 MCP 文件系统服务器：

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

## API 参考

### initialize

初始化连接并获取服务器能力。

**请求**：
```json
{
  "jsonrpc": "2.0",
  "method": "initialize",
  "params": {},
  "id": 1
}
```

**响应**：
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

读取文件内容。

**请求**：
```json
{
  "jsonrpc": "2.0",
  "method": "readFile",
  "params": { "path": "/path/to/file.txt" },
  "id": 2
}
```

**响应**：
```json
{
  "jsonrpc": "2.0",
  "result": "文件内容...",
  "id": 2
}
```

### writeFile

写入文件内容。

**请求**：
```json
{
  "jsonrpc": "2.0",
  "method": "writeFile",
  "params": { 
    "path": "/path/to/file.txt",
    "content": "要写入的内容"
  },
  "id": 3
}
```

**响应**：
```json
{
  "jsonrpc": "2.0",
  "result": "ok",
  "id": 3
}
```

### listDir

列出目录内容。

**请求**：
```json
{
  "jsonrpc": "2.0",
  "method": "listDir",
  "params": { "path": "/path/to/directory" },
  "id": 4
}
```

**响应**：
```json
{
  "jsonrpc": "2.0",
  "result": ["file1.txt", "file2.js", "subdirectory"],
  "id": 4
}
```

## 健康检查

服务器提供了一个简单的健康检查端点：

```bash
curl http://localhost:8090/health
# 返回: ok
```

## 故障排除

### 常见问题

1. **初始化失败**：
   - 确保服务器正在运行
   - 检查端口是否被占用
   - 验证 `/health` 端点是否返回 `ok`

2. **端口冲突**：
   - 使用 `lsof -i :<端口>` 检查端口占用
   - 使用不同端口启动服务

3. **权限问题**：
   - 确保服务器有权限访问请求的文件路径

## 贡献

欢迎提交 Pull Request 和 Issue！

## 许可证

MIT
