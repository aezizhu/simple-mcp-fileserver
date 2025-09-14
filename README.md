# MCP FileBridge 🌉

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)

> **🚀 Smart MCP server that bridges LLMs to files and images with zero hallucination. Perfect for Claude, GPT-4V, and all vision-enabled AI models.**

## 🚀 Features

### Core Capabilities
- **🔒 Enterprise Security**: JWT authentication, role-based access control, rate limiting
- **📊 Advanced Monitoring**: Prometheus metrics, health checks, distributed tracing
- **🔌 Plugin Architecture**: Extensible plugin system with hot-reloading
- **⚡ High Performance**: Redis caching, connection pooling, optimized processing
- **🖼️ Multimodal Processing**: Advanced image analysis, OCR, EXIF metadata extraction
- **📝 Comprehensive Logging**: Structured logging with multiple transports
- **🐳 Production Ready**: Docker support, Kubernetes manifests, CI/CD pipelines

### Technical Excellence
- **TypeScript First**: Full type safety with strict compiler settings
- **Dependency Injection**: Inversify.js for clean architecture
- **Validation**: Joi/Zod schemas for request validation
- **Testing**: Comprehensive test suite with Vitest and Playwright
- **Documentation**: Auto-generated API docs with TypeDoc
- **Code Quality**: ESLint, Prettier, Husky pre-commit hooks

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Installation](#installation)
- [Configuration](#configuration)
- [API Documentation](#api-documentation)
- [Plugin Development](#plugin-development)
- [Deployment](#deployment)
- [Monitoring](#monitoring)
- [Security](#security)
- [Contributing](#contributing)
- [License](#license)

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm 9+
- Redis (optional, for caching)
- MongoDB (optional, for persistence)

### Installation

```bash
# Clone the repository
git clone https://github.com/aezizhu/mcp-filebridge.git
cd mcp-filebridge

# Install dependencies
npm install

# Build the project
npm run build

# Start the server
npm start
```

### Docker Quick Start

```bash
# Build and run with Docker
npm run docker:build
npm run docker:run

# Or use Docker Compose
docker-compose up -d
```

### Basic Usage

```bash
# Health check
curl http://localhost:3000/health

# MCP Initialize
curl -X POST http://localhost:3000/mcp \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {
        "name": "test-client",
        "version": "1.0.0"
      }
    },
    "id": 1
  }'
```

## ⚙️ Configuration

### Environment Variables

```bash
# Server Configuration
NODE_ENV=production
HOST=0.0.0.0
PORT=3000

# Security
JWT_SECRET=your-super-secret-key
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Cache Configuration
CACHE_TYPE=redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# Database (Optional)
DATABASE_TYPE=mongodb
DATABASE_URL=mongodb://localhost:27017/mcp-server

# Monitoring
METRICS_ENABLED=true
TRACING_ENABLED=true
LOG_LEVEL=info
```

### Configuration File

Create `config/production.json`:

```json
{
  "server": {
    "host": "0.0.0.0",
    "port": 3000,
    "cors": {
      "enabled": true,
      "origin": ["https://yourdomain.com"],
      "methods": ["GET", "POST", "OPTIONS"],
      "allowedHeaders": ["Content-Type", "Authorization"],
      "credentials": true
    },
    "rateLimit": {
      "enabled": true,
      "windowMs": 900000,
      "maxRequests": 100,
      "message": "Too many requests"
    },
    "security": {
      "helmet": true,
      "authentication": {
        "enabled": true,
        "jwt": {
          "secret": "${JWT_SECRET}",
          "expiresIn": "24h"
        }
      }
    }
  },
  "logging": {
    "level": "info",
    "format": "json",
    "transports": [
      {
        "type": "console",
        "options": {}
      },
      {
        "type": "file",
        "options": {
          "filename": "logs/app.log",
          "maxsize": 10485760,
          "maxFiles": 5
        }
      }
    ]
  },
  "cache": {
    "enabled": true,
    "type": "redis",
    "ttl": 300,
    "redis": {
      "host": "${REDIS_HOST}",
      "port": "${REDIS_PORT}",
      "password": "${REDIS_PASSWORD}",
      "db": 0
    }
  },
  "monitoring": {
    "enabled": true,
    "metrics": {
      "enabled": true,
      "endpoint": "/metrics"
    },
    "health": {
      "enabled": true,
      "endpoint": "/health"
    }
  }
}
```

## 📚 API Documentation

### MCP Protocol Methods

#### Initialize
Establishes connection and negotiates capabilities.

```json
{
  "jsonrpc": "2.0",
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": {
      "name": "client-name",
      "version": "1.0.0"
    }
  },
  "id": 1
}
```

#### Tools

##### List Tools
```json
{
  "jsonrpc": "2.0",
  "method": "tools/list",
  "id": 2
}
```

##### Execute Tool
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "analyze_image",
    "arguments": {
      "path": "/path/to/image.jpg",
      "include_ocr": true,
      "return_base64": true
    }
  },
  "id": 3
}
```

### Available Tools

#### File Operations
- **`read_file`**: Read text or binary files
- **`write_file`**: Write content to files
- **`list_directory`**: List directory contents with metadata

#### Image Analysis
- **`analyze_image`**: Technical image analysis without hallucination
  - Extracts metadata (dimensions, format, EXIF)
  - OCR text extraction with Tesseract.js
  - Base64 encoding for LLM vision analysis
  - Supports: JPEG, PNG, GIF, BMP, WebP, TIFF, SVG

#### Network Operations
- **`download_image`**: Download images from URLs
- **`fetch_url`**: Fetch content from web URLs

#### System Operations
- **`get_server_info`**: Server status and statistics
- **`health_check`**: Comprehensive health assessment

### Response Format

All responses follow JSON-RPC 2.0 specification:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Response content here"
      }
    ]
  }
}
```

Error responses:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32603,
    "message": "Internal error",
    "data": {
      "timestamp": "2024-01-01T00:00:00.000Z",
      "server": "@aezizhu/mcp-enterprise-server"
    }
  }
}
```

## 🔌 Plugin Development

### Creating a Plugin

```typescript
// plugins/my-plugin/index.ts
import { Plugin, PluginContext, Tool } from '@aezizhu/mcp-enterprise-server';

export default class MyPlugin implements Plugin {
  name = 'my-plugin';
  version = '1.0.0';
  
  async initialize(context: PluginContext): Promise<void> {
    context.logger.info('MyPlugin initialized');
    
    // Register tools
    context.toolRegistry.register({
      name: 'my_tool',
      description: 'My custom tool',
      inputSchema: {
        type: 'object',
        properties: {
          input: { type: 'string' }
        },
        required: ['input']
      },
      handler: this.handleMyTool.bind(this)
    });
  }
  
  private async handleMyTool(args: { input: string }): Promise<any> {
    return {
      content: [{
        type: 'text',
        text: `Processed: ${args.input}`
      }]
    };
  }
}
```

### Plugin Manifest

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "My custom MCP plugin",
  "author": "Your Name",
  "main": "dist/index.js",
  "mcpVersion": "2024-11-05",
  "capabilities": ["tools", "resources"],
  "configuration": {
    "type": "object",
    "properties": {
      "apiKey": { "type": "string" },
      "endpoint": { "type": "string" }
    }
  }
}
```

## 🐳 Deployment

### Docker

```dockerfile
# Dockerfile included in repository
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Kubernetes

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-enterprise-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: mcp-enterprise-server
  template:
    metadata:
      labels:
        app: mcp-enterprise-server
    spec:
      containers:
      - name: mcp-server
        image: aezizhu/mcp-enterprise-server:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: REDIS_HOST
          value: "redis-service"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

### Docker Compose

```yaml
version: '3.8'
services:
  mcp-server:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - REDIS_HOST=redis
      - DATABASE_URL=mongodb://mongodb:27017/mcp
    depends_on:
      - redis
      - mongodb
    restart: unless-stopped
    
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped
    
  mongodb:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
    restart: unless-stopped
    
  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
    restart: unless-stopped

volumes:
  redis_data:
  mongodb_data:
```

## 📊 Monitoring

### Metrics

The server exposes Prometheus metrics at `/metrics`:

- **Request metrics**: `mcp_requests_total`, `mcp_request_duration_seconds`
- **Tool metrics**: `mcp_tool_executions_total`, `mcp_tool_duration_seconds`
- **System metrics**: `mcp_memory_usage_bytes`, `mcp_cpu_usage_percent`
- **Cache metrics**: `mcp_cache_hits_total`, `mcp_cache_misses_total`

### Health Checks

Health endpoint at `/health` provides:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 86400000,
  "version": "1.0.0",
  "services": {
    "cache": true,
    "plugins": true,
    "tools": true,
    "resources": true
  },
  "metrics": {
    "requests_per_second": 10.5,
    "average_response_time": 150,
    "memory_usage_mb": 256,
    "cpu_usage_percent": 15.2
  }
}
```

### Grafana Dashboard

Import the included Grafana dashboard from `monitoring/grafana-dashboard.json` for comprehensive monitoring visualization.

## 🔒 Security

### Authentication

JWT-based authentication with configurable expiration:

```bash
# Get token
curl -X POST http://localhost:3000/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"username": "admin", "password": "password"}'

# Use token
curl -X POST http://localhost:3000/mcp \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc": "2.0", "method": "tools/list", "id": 1}'
```

### Authorization

Role-based access control (RBAC):

```json
{
  "roles": {
    "admin": ["*"],
    "user": ["tools:read", "tools:execute", "resources:read"],
    "readonly": ["tools:read", "resources:read"]
  }
}
```

### Security Headers

Automatic security headers via Helmet.js:
- Content Security Policy
- HSTS
- X-Frame-Options
- X-Content-Type-Options
- Referrer Policy

### Rate Limiting

Configurable rate limiting per IP/user:
- Default: 100 requests per 15 minutes
- Customizable per endpoint
- Redis-backed for distributed deployments

## 🧪 Testing

### Unit Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Integration Tests

```bash
# Run integration tests
npm run test:integration
```

### E2E Tests

```bash
# Run end-to-end tests
npm run test:e2e
```

### Performance Testing

```bash
# Run benchmarks
npm run benchmark
```

## 🔧 Development

### Setup Development Environment

```bash
# Install dependencies
npm install

# Start development server with hot reload
npm run start:dev

# Run type checking
npm run typecheck

# Lint code
npm run lint

# Format code
npm run format
```

### Project Structure

```
src/
├── core/                 # Core server components
│   ├── server.ts        # Main server class
│   ├── tool-registry.ts # Tool management
│   └── resource-registry.ts
├── services/            # Business logic services
│   ├── config.service.ts
│   ├── logger.service.ts
│   ├── metrics.service.ts
│   └── cache.service.ts
├── middleware/          # Express middleware
│   ├── auth.middleware.ts
│   ├── validation.middleware.ts
│   └── error-handler.ts
├── plugins/            # Plugin system
│   ├── base-plugin.ts
│   └── plugin-manager.ts
├── tools/              # Built-in tools
│   ├── file-tools.ts
│   ├── image-tools.ts
│   └── system-tools.ts
├── types/              # TypeScript definitions
│   └── mcp.ts
└── utils/              # Utility functions
    ├── validation.ts
    └── helpers.ts
```

## 📈 Performance

### Benchmarks

- **Throughput**: 1000+ requests/second
- **Latency**: <100ms average response time
- **Memory**: <512MB under load
- **Concurrent connections**: 10,000+

### Optimization Features

- **Connection pooling**: Reuse database connections
- **Response caching**: Redis-backed caching layer
- **Compression**: Gzip compression for responses
- **Streaming**: Large file streaming support
- **Clustering**: Multi-process support

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make changes and add tests
4. Run the validation suite: `npm run validate`
5. Commit changes: `git commit -m 'Add amazing feature'`
6. Push to branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Code Standards

- **TypeScript**: Strict mode enabled
- **ESLint**: Airbnb configuration with security rules
- **Prettier**: Consistent code formatting
- **Conventional Commits**: Semantic commit messages
- **Test Coverage**: Minimum 80% coverage required

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Model Context Protocol](https://github.com/modelcontextprotocol) specification
- [OpenAI](https://openai.com) for vision model inspiration
- [Anthropic](https://anthropic.com) for Claude integration patterns
- Open source community for excellent libraries

## 📞 Support

- **Documentation**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/aezizhu/mcp-enterprise-server/issues)
- **Discussions**: [GitHub Discussions](https://github.com/aezizhu/mcp-enterprise-server/discussions)
- **Email**: aezizhu@example.com

---

**Built with ❤️ by aezizhu - Enterprise-grade MCP server for production environments**
