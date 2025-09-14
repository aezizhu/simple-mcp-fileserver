#!/usr/bin/env node

/**
 * MCP FileBridge - Entry Point
 * 
 * Smart MCP server that bridges LLMs to files and images with zero hallucination.
 * Perfect for Claude, GPT-4V, and all vision-enabled AI models.
 * 
 * @author aezizhu
 * @version 1.0.0
 */

import 'reflect-metadata';
import { MCPEnterpriseServer } from '@/core/server';
import { ServerConfig } from '@/types/mcp';

/**
 * Main application entry point
 */
async function main(): Promise<void> {
  console.log('🌉 Starting MCP FileBridge...\n');

  try {
    // Load configuration from environment
    const config: Partial<ServerConfig> = {
      server: {
        host: process.env.HOST || 'localhost',
        port: parseInt(process.env.PORT || '3000', 10),
        cors: {
          enabled: process.env.CORS_ENABLED !== 'false',
          origin: process.env.CORS_ORIGIN ? 
            process.env.CORS_ORIGIN.split(',') : 
            true,
          methods: ['GET', 'POST', 'OPTIONS'],
          allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
          credentials: process.env.CORS_CREDENTIALS === 'true',
        },
        rateLimit: {
          enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
          windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
          maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
          message: 'Too many requests from this IP, please try again later.',
        },
        security: {
          helmet: process.env.HELMET_ENABLED !== 'false',
          authentication: {
            enabled: process.env.AUTH_ENABLED === 'true',
            jwt: {
              secret: process.env.JWT_SECRET || 'change-me-in-production',
              expiresIn: process.env.JWT_EXPIRES_IN || '24h',
            },
          },
          authorization: {
            enabled: process.env.AUTHZ_ENABLED === 'true',
            roles: ['admin', 'user', 'readonly'],
          },
        },
      },
      cache: {
        enabled: process.env.CACHE_ENABLED !== 'false',
        type: (process.env.CACHE_TYPE as 'memory' | 'redis') || 'memory',
        ttl: parseInt(process.env.CACHE_TTL || '300', 10),
        maxSize: parseInt(process.env.CACHE_MAX_SIZE || '1000', 10),
        redis: process.env.REDIS_HOST ? {
          host: process.env.REDIS_HOST,
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
          password: process.env.REDIS_PASSWORD,
          db: parseInt(process.env.REDIS_DB || '0', 10),
        } : undefined,
      },
      monitoring: {
        enabled: process.env.MONITORING_ENABLED !== 'false',
        metrics: {
          enabled: process.env.METRICS_ENABLED !== 'false',
          endpoint: process.env.METRICS_ENDPOINT || '/metrics',
        },
        health: {
          enabled: process.env.HEALTH_ENABLED !== 'false',
          endpoint: process.env.HEALTH_ENDPOINT || '/health',
        },
        tracing: {
          enabled: process.env.TRACING_ENABLED === 'true',
          serviceName: process.env.TRACING_SERVICE_NAME || 'mcp-filebridge',
        },
      },
    };

    // Create and start server
    const server = new MCPEnterpriseServer(config);
    await server.start();

    // Handle graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
      try {
        await server.stop();
        console.log('✅ MCP FileBridge stopped gracefully');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('💥 Uncaught Exception:', error);
      process.exit(1);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });

  } catch (error) {
    console.error('❌ Failed to start MCP FileBridge:', error);
    process.exit(1);
  }
}

// Start the application
if (require.main === module) {
  main().catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}

export { MCPEnterpriseServer } from '@/core/server';
export * from '@/types/mcp';
