/**
 * Enterprise MCP Server Core
 * 
 * High-performance, scalable Model Context Protocol server implementation
 * with enterprise-grade features including monitoring, security, and extensibility.
 * 
 * @author aezizhu
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import { Container } from 'inversify';
import express, { Express, Request, Response } from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcErrorCode,
  McpErrorCode,
  ServerInfo,
  ServerCapabilities,
  ServerConfig,
  SecurityContext,
  RequestMetrics,
  Logger,
} from '@/types/mcp';

import { ConfigService } from '@/services/config.service';
import { LoggerService } from '@/services/logger.service';
import { MetricsService } from '@/services/metrics.service';
import { CacheService } from '@/services/cache.service';
import { SecurityService } from '@/services/security.service';
import { PluginManager } from '@/services/plugin-manager.service';
import { ToolRegistry } from '@/core/tool-registry';
import { ResourceRegistry } from '@/core/resource-registry';
import { RequestValidator } from '@/middleware/request-validator';
import { ErrorHandler } from '@/middleware/error-handler';
import { RequestLogger } from '@/middleware/request-logger';
import { SecurityMiddleware } from '@/middleware/security.middleware';

export class MCPEnterpriseServer extends EventEmitter {
  private readonly container: Container;
  private readonly app: Express;
  private readonly config: ServerConfig;
  private readonly logger: Logger;
  private readonly metrics: MetricsService;
  private readonly cache: CacheService;
  private readonly security: SecurityService;
  private readonly pluginManager: PluginManager;
  private readonly toolRegistry: ToolRegistry;
  private readonly resourceRegistry: ResourceRegistry;
  
  private server?: import('http').Server;
  private isInitialized = false;
  private readonly startTime = Date.now();

  constructor(config?: Partial<ServerConfig>) {
    super();
    
    // Initialize dependency injection container
    this.container = new Container();
    this.setupDependencies();
    
    // Get services from container
    const configService = this.container.get<ConfigService>('ConfigService');
    this.config = configService.getConfig(config);
    this.logger = this.container.get<LoggerService>('LoggerService').getLogger('MCPServer');
    this.metrics = this.container.get<MetricsService>('MetricsService');
    this.cache = this.container.get<CacheService>('CacheService');
    this.security = this.container.get<SecurityService>('SecurityService');
    this.pluginManager = this.container.get<PluginManager>('PluginManager');
    
    // Initialize registries
    this.toolRegistry = new ToolRegistry(this.logger, this.metrics);
    this.resourceRegistry = new ResourceRegistry(this.logger, this.metrics);
    
    // Setup Express application
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
    
    this.logger.info('MCP Enterprise Server initialized', {
      version: this.getServerInfo().version,
      config: this.sanitizeConfig(this.config),
    });
  }

  /**
   * Setup dependency injection bindings
   */
  private setupDependencies(): void {
    this.container.bind<ConfigService>('ConfigService').to(ConfigService).inSingletonScope();
    this.container.bind<LoggerService>('LoggerService').to(LoggerService).inSingletonScope();
    this.container.bind<MetricsService>('MetricsService').to(MetricsService).inSingletonScope();
    this.container.bind<CacheService>('CacheService').to(CacheService).inSingletonScope();
    this.container.bind<SecurityService>('SecurityService').to(SecurityService).inSingletonScope();
    this.container.bind<PluginManager>('PluginManager').to(PluginManager).inSingletonScope();
  }

  /**
   * Setup Express middleware stack
   */
  private setupMiddleware(): void {
    // Security middleware
    if (this.config.server.security.helmet) {
      this.app.use(helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
          },
        },
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true,
        },
      }));
    }

    // CORS
    if (this.config.server.cors.enabled) {
      this.app.use(cors({
        origin: this.config.server.cors.origin as any,
        methods: this.config.server.cors.methods as any,
        allowedHeaders: this.config.server.cors.allowedHeaders as any,
        credentials: this.config.server.cors.credentials,
      }));
    }

    // Compression
    this.app.use(compression());

    // Rate limiting
    if (this.config.server.rateLimit.enabled) {
      this.app.use(rateLimit({
        windowMs: this.config.server.rateLimit.windowMs,
        max: this.config.server.rateLimit.maxRequests,
        message: this.config.server.rateLimit.message,
        standardHeaders: true,
        legacyHeaders: false,
      }));
    }

    // Body parsing
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    // Custom middleware
    this.app.use(RequestLogger.create(this.logger));
    this.app.use(SecurityMiddleware.create(this.security));
    this.app.use(RequestValidator.create());
  }

  /**
   * Setup Express routes
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', this.handleHealthCheck.bind(this));
    
    // Metrics endpoint (if enabled)
    if (this.config.monitoring.metrics.enabled) {
      this.app.get(this.config.monitoring.metrics.endpoint, this.handleMetrics.bind(this));
    }

    // Main MCP endpoint
    this.app.post('/mcp', this.handleMcpRequest.bind(this));
    
    // Plugin endpoints
    this.app.use('/plugins', this.pluginManager.getRouter());

    // Catch-all for undefined routes
    this.app.all('*', (req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found`,
        timestamp: new Date().toISOString(),
      });
    });
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    this.app.use(ErrorHandler.create(this.logger, this.metrics));
  }

  /**
   * Handle health check requests
   */
  private async handleHealthCheck(_req: Request, res: Response): Promise<void> {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: Date.now() - this.startTime,
        version: this.getServerInfo().version,
        services: {
          cache: await this.cache.isHealthy(),
          plugins: this.pluginManager.getHealthStatus(),
          tools: this.toolRegistry.getHealthStatus(),
          resources: this.resourceRegistry.getHealthStatus(),
        },
        metrics: await this.metrics.getHealthMetrics(),
      };

      const isHealthy = Object.values(health.services).every(status => status === true);
      
      res.status(isHealthy ? 200 : 503).json(health);
    } catch (error) {
      this.logger.error('Health check failed', error as Error);
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
      });
    }
  }

  /**
   * Handle metrics requests
   */
  private async handleMetrics(_req: Request, res: Response): Promise<void> {
    try {
      const metrics = await this.metrics.getMetrics();
      res.set('Content-Type', 'text/plain');
      res.send(metrics);
    } catch (error) {
      this.logger.error('Metrics endpoint failed', error as Error);
      res.status(500).json({ error: 'Metrics unavailable' });
    }
  }

  /**
   * Handle MCP JSON-RPC requests
   */
  private async handleMcpRequest(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const requestId = req.headers['x-request-id'] as string || this.generateRequestId();
    
    try {
      const request = req.body as JsonRpcRequest;
      const securityContext = this.extractSecurityContext(req);
      
      // Validate JSON-RPC format
      this.validateJsonRpcRequest(request);
      
      // Process request
      const response = await this.processRequest(request, securityContext, requestId);
      
      // Record metrics
      const duration = Date.now() - startTime;
      this.recordRequestMetrics({
        requestId,
        timestamp: new Date(),
        method: request.method,
        duration,
        success: !response.error,
        errorCode: response.error?.code || undefined,
        userId: securityContext.userId,
      });

      res.json(response);
      
    } catch (error) {
      this.logger.error('MCP request processing failed', error as Error, { requestId });
      
      const errorResponse = this.createErrorResponse(
        null,
        JsonRpcErrorCode.INTERNAL_ERROR,
        'Internal server error'
      );
      
      const duration = Date.now() - startTime;
      this.recordRequestMetrics({
        requestId,
        timestamp: new Date(),
        method: 'unknown',
        duration,
        success: false,
        errorCode: JsonRpcErrorCode.INTERNAL_ERROR,
        userId: undefined,
      });

      res.status(500).json(errorResponse);
    }
  }

  /**
   * Process MCP request with full enterprise features
   */
  private async processRequest(
    request: JsonRpcRequest,
    securityContext: SecurityContext,
    requestId: string
  ): Promise<JsonRpcResponse> {
    const { method, params, id } = request;
    
    this.logger.debug('Processing MCP request', {
      requestId,
      method,
      userId: securityContext.userId,
      sessionId: securityContext.sessionId,
    });

    // Check cache first (for cacheable methods)
    const cacheKey = this.generateCacheKey(method, params);
    if (this.isCacheableMethod(method)) {
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        this.logger.debug('Returning cached response', { requestId, method });
        return cached as JsonRpcResponse;
      }
    }

    let response: JsonRpcResponse;

    try {
      switch (method) {
        case 'initialize':
          response = await this.handleInitialize(params, id);
          break;
        
        case 'tools/list':
          response = await this.handleToolsList(id, securityContext);
          break;
        
        case 'tools/call':
          response = await this.handleToolCall(params, id, securityContext, requestId);
          break;
        
        case 'resources/list':
          response = await this.handleResourcesList(id, securityContext);
          break;
        
        case 'resources/read':
          response = await this.handleResourceRead(params, id, securityContext, requestId);
          break;
        
        case 'ping':
          response = this.handlePing(id);
          break;
        
        default:
          // Check if any plugins can handle this method
          response = await this.pluginManager.handleMethod(method, params, id, securityContext);
          if (!response) {
            response = this.createErrorResponse(id, JsonRpcErrorCode.METHOD_NOT_FOUND, `Method not found: ${method}`);
          }
          break;
      }

      // Cache successful responses
      if (this.isCacheableMethod(method) && !response.error) {
        await this.cache.set(cacheKey, response, { ttl: 300 }); // 5 minutes default TTL
      }

      return response;
      
    } catch (error) {
      this.logger.error('Request processing error', error as Error, { requestId, method });
      return this.createErrorResponse(id, JsonRpcErrorCode.INTERNAL_ERROR, 'Request processing failed');
    }
  }

  /**
   * Handle initialize request
   */
  private async handleInitialize(_params: unknown, id: string | number | null): Promise<JsonRpcResponse> {
    // TODO: Validate client capabilities and negotiate protocol version
    
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: this.getServerCapabilities(),
        serverInfo: this.getServerInfo(),
        instructions: 'MCP FileBridge - Smart file and image bridge for LLMs. Use tools for accurate file reading and image analysis without hallucination.',
      },
    };
  }

  /**
   * Handle tools list request
   */
  private async handleToolsList(
    id: string | number | null,
    securityContext: SecurityContext
  ): Promise<JsonRpcResponse> {
    try {
      const tools = await this.toolRegistry.getAvailableTools(securityContext);
      
      return {
        jsonrpc: '2.0',
        id,
        result: { tools },
      };
    } catch (error) {
      this.logger.error('Tools list failed', error as Error);
      return this.createErrorResponse(id, McpErrorCode.PROCESSING_ERROR, 'Failed to list tools');
    }
  }

  /**
   * Handle tool call request
   */
  private async handleToolCall(
    params: unknown,
    id: string | number | null,
    securityContext: SecurityContext,
    requestId: string
  ): Promise<JsonRpcResponse> {
    try {
      const { name, arguments: args } = params as { name: string; arguments?: Record<string, unknown> };
      
      // Security check
      if (!this.security.canExecuteTool(securityContext, name)) {
        return this.createErrorResponse(id, McpErrorCode.PERMISSION_DENIED, `Access denied for tool: ${name}`);
      }

      const result = await this.toolRegistry.executeTool(name, args || {}, securityContext, requestId);
      
      return {
        jsonrpc: '2.0',
        id,
        result,
      };
    } catch (error) {
      this.logger.error('Tool execution failed', error as Error, { requestId });
      return this.createErrorResponse(id, McpErrorCode.PROCESSING_ERROR, 'Tool execution failed');
    }
  }

  /**
   * Handle resources list request
   */
  private async handleResourcesList(
    id: string | number | null,
    securityContext: SecurityContext
  ): Promise<JsonRpcResponse> {
    try {
      const resources = await this.resourceRegistry.getAvailableResources(securityContext);
      
      return {
        jsonrpc: '2.0',
        id,
        result: { resources },
      };
    } catch (error) {
      this.logger.error('Resources list failed', error as Error);
      return this.createErrorResponse(id, McpErrorCode.PROCESSING_ERROR, 'Failed to list resources');
    }
  }

  /**
   * Handle resource read request
   */
  private async handleResourceRead(
    params: unknown,
    id: string | number | null,
    securityContext: SecurityContext,
    requestId: string
  ): Promise<JsonRpcResponse> {
    try {
      const { uri } = params as { uri: string };
      
      // Security check
      if (!this.security.canAccessResource(securityContext, uri)) {
        return this.createErrorResponse(id, McpErrorCode.PERMISSION_DENIED, `Access denied for resource: ${uri}`);
      }

      const contents = await this.resourceRegistry.readResource(uri, securityContext, requestId);
      
      return {
        jsonrpc: '2.0',
        id,
        result: { contents },
      };
    } catch (error) {
      this.logger.error('Resource read failed', error as Error, { requestId });
      return this.createErrorResponse(id, McpErrorCode.PROCESSING_ERROR, 'Resource read failed');
    }
  }

  /**
   * Handle ping request
   */
  private handlePing(id: string | number | null): JsonRpcResponse {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        status: 'pong',
        timestamp: new Date().toISOString(),
        uptime: Date.now() - this.startTime,
        version: this.getServerInfo().version,
      },
    };
  }

  /**
   * Get server information
   */
  private getServerInfo(): ServerInfo {
    return {
      name: '@aezizhu/mcp-filebridge',
      version: '1.0.0',
      description: 'Smart MCP server that bridges LLMs to files and images with zero hallucination',
      author: 'aezizhu',
      license: 'MIT',
      homepage: 'https://github.com/aezizhu/mcp-filebridge',
    };
  }

  /**
   * Get server capabilities
   */
  private getServerCapabilities(): ServerCapabilities {
    return {
      tools: {
        listChanged: true,
      },
      resources: {
        subscribe: false,
        listChanged: true,
      },
      logging: {
        level: this.config.logging.level,
      },
    };
  }

  /**
   * Validate JSON-RPC request format
   */
  private validateJsonRpcRequest(request: JsonRpcRequest): void {
    if (!request || typeof request !== 'object') {
      throw new Error('Invalid request format');
    }
    
    if (request.jsonrpc !== '2.0') {
      throw new Error('Invalid JSON-RPC version');
    }
    
    if (!request.method || typeof request.method !== 'string') {
      throw new Error('Invalid or missing method');
    }
  }

  /**
   * Extract security context from request
   */
  private extractSecurityContext(req: Request): SecurityContext {
    // TODO: Implement proper authentication and authorization
    return {
      userId: req.headers['x-user-id'] as string,
      roles: ['user'], // Default role
      permissions: ['read', 'write'], // Default permissions
      sessionId: req.headers['x-session-id'] as string || this.generateSessionId(),
      ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.headers['user-agent'] || undefined,
    };
  }

  /**
   * Create standardized error response
   */
  private createErrorResponse(
    id: string | number | null,
    code: number,
    message: string,
    data?: unknown
  ): JsonRpcResponse {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code,
        message,
        data: {
          timestamp: new Date().toISOString(),
          server: this.getServerInfo().name,
          ...(data as object),
        },
      },
    };
  }

  /**
   * Record request metrics
   */
  private recordRequestMetrics(metrics: RequestMetrics): void {
    this.metrics.recordRequest(metrics);
    this.emit('request', metrics);
  }

  /**
   * Generate cache key for request
   */
  private generateCacheKey(method: string, params: unknown): string {
    const paramsHash = this.hashObject(params);
    return `mcp:${method}:${paramsHash}`;
  }

  /**
   * Check if method is cacheable
   */
  private isCacheableMethod(method: string): boolean {
    const cacheableMethods = ['tools/list', 'resources/list'];
    return cacheableMethods.includes(method);
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Hash object for cache key generation
   */
  private hashObject(obj: unknown): string {
    const str = JSON.stringify(obj, Object.keys(obj || {}).sort());
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Sanitize config for logging (remove sensitive data)
   */
  private sanitizeConfig(config: ServerConfig): Partial<ServerConfig> {
    const sanitized = JSON.parse(JSON.stringify(config));
    if (sanitized.server?.security?.authentication?.jwt) {
      sanitized.server.security.authentication.jwt.secret = '[REDACTED]';
    }
    if (sanitized.cache?.redis?.password) {
      sanitized.cache.redis.password = '[REDACTED]';
    }
    return sanitized;
  }

  /**
   * Start the server
   */
  public async start(): Promise<void> {
    try {
      // Initialize services
      await this.cache.initialize();
      await this.pluginManager.initialize();
      await this.toolRegistry.initialize();
      await this.resourceRegistry.initialize();
      
      // Start HTTP server
      this.server = this.app.listen(this.config.server.port, this.config.server.host, () => {
        this.isInitialized = true;
        
        this.logger.info('MCP Enterprise Server started', {
          host: this.config.server.host,
          port: this.config.server.port,
          version: this.getServerInfo().version,
          uptime: Date.now() - this.startTime,
        });
        
        this.emit('started');
      });

      // Setup graceful shutdown
      this.setupGracefulShutdown();
      
    } catch (error) {
      this.logger.error('Failed to start server', error as Error);
      throw error;
    }
  }

  /**
   * Stop the server gracefully
   */
  public async stop(): Promise<void> {
    if (!this.server) {
      return;
    }

    this.logger.info('Stopping MCP Enterprise Server...');

    return new Promise((resolve, reject) => {
      this.server!.close(async (error) => {
        if (error) {
          this.logger.error('Error stopping server', error);
          reject(error);
          return;
        }

        try {
          // Cleanup services
          await this.pluginManager.shutdown();
          await this.cache.shutdown();
          await this.metrics.shutdown();
          
          this.isInitialized = false;
          this.logger.info('MCP Enterprise Server stopped gracefully');
          this.emit('stopped');
          resolve();
        } catch (cleanupError) {
          this.logger.error('Error during cleanup', cleanupError as Error);
          reject(cleanupError);
        }
      });
    });
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      this.logger.info(`Received ${signal}, shutting down gracefully...`);
      try {
        await this.stop();
        process.exit(0);
      } catch (error) {
        this.logger.error('Error during shutdown', error as Error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught Exception', error);
      process.exit(1);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled Rejection', new Error(String(reason)), { promise });
      process.exit(1);
    });
  }

  /**
   * Get server status
   */
  public getStatus(): {
    isInitialized: boolean;
    uptime: number;
    version: string;
  } {
    return {
      isInitialized: this.isInitialized,
      uptime: Date.now() - this.startTime,
      version: this.getServerInfo().version,
    };
  }
}
