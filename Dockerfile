# MCP FileBridge - Production Docker Image
# Multi-stage build for optimal image size and security

# Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    librsvg-dev

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production --ignore-scripts

# Copy source code
COPY src/ ./src/

# Build application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Create non-root user
RUN addgroup -g 1001 -S mcp && \
    adduser -S mcp -u 1001

# Install runtime dependencies
RUN apk add --no-cache \
    cairo \
    jpeg \
    pango \
    giflib \
    librsvg \
    ttf-dejavu \
    fontconfig \
    dumb-init

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production --ignore-scripts && \
    npm cache clean --force

# Copy built application
COPY --from=builder /app/dist ./dist

# Copy additional files
COPY README.md LICENSE ./

# Create necessary directories
RUN mkdir -p logs temp && \
    chown -R mcp:mcp /app

# Switch to non-root user
USER mcp

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Set environment variables
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "dist/index.js"]

# Labels for metadata
LABEL maintainer="aezizhu <aezizhu@example.com>"
LABEL description="Smart MCP server that bridges LLMs to files and images with zero hallucination"
LABEL version="1.0.0"
LABEL org.opencontainers.image.title="MCP FileBridge"
LABEL org.opencontainers.image.description="Smart MCP server for LLM file and image processing"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.authors="aezizhu"
LABEL org.opencontainers.image.url="https://github.com/aezizhu/mcp-filebridge"
LABEL org.opencontainers.image.source="https://github.com/aezizhu/mcp-filebridge"
LABEL org.opencontainers.image.licenses="MIT"
