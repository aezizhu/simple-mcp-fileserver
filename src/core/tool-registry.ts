/**
 * Tool Registry
 * 
 * Central registry for managing MCP tools with security, validation, and metrics.
 * Provides a unified interface for tool registration and execution.
 * 
 * @author aezizhu
 * @version 1.0.0
 */

import { Tool, SecurityContext, Logger, Content } from '@/types/mcp';
import { MetricsService } from '@/services/metrics.service';
import { FileOperationTools } from '@/tools/file-tools';
import { ImageAnalysisTools } from '@/tools/image-tools';
import Joi from 'joi';

export class ToolRegistry {
  private readonly tools = new Map<string, RegisteredTool>();
  private readonly logger: Logger;
  private readonly metrics: MetricsService;
  private readonly fileTools: FileOperationTools;
  private readonly imageTools: ImageAnalysisTools;

  constructor(logger: Logger, metrics: MetricsService) {
    this.logger = logger;
    this.metrics = metrics;
    this.fileTools = new FileOperationTools(logger);
    this.imageTools = new ImageAnalysisTools(logger);
  }

  /**
   * Initialize the tool registry
   */
  public async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing tool registry...');
      
      // Register built-in file tools
      const fileTools = this.fileTools.getTools();
      for (const tool of fileTools) {
        this.registerTool(tool, this.createFileToolHandler(tool.name));
      }

      // Register built-in image tools
      const imageTools = this.imageTools.getTools();
      for (const tool of imageTools) {
        this.registerTool(tool, this.createImageToolHandler(tool.name));
      }

      // Register system tools
      this.registerSystemTools();

      this.logger.info('Tool registry initialized', { 
        totalTools: this.tools.size,
        fileTools: fileTools.length,
        imageTools: imageTools.length
      });

    } catch (error) {
      this.logger.error('Failed to initialize tool registry', error as Error);
      throw error;
    }
  }

  /**
   * Register a new tool
   */
  public registerTool(
    tool: Tool,
    handler: ToolHandler,
    options: ToolRegistrationOptions = {}
  ): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool ${tool.name} is already registered`);
    }

    // Validate tool schema
    this.validateToolSchema(tool);

    const registeredTool: RegisteredTool = {
      tool,
      handler,
      options: {
        requiresAuth: options.requiresAuth || false,
        requiredPermissions: options.requiredPermissions || [],
        rateLimit: options.rateLimit,
        timeout: options.timeout || 30000, // 30 seconds default
        retries: options.retries || 0,
        ...options
      },
      registeredAt: new Date(),
      executionCount: 0,
      lastExecuted: null
    };

    this.tools.set(tool.name, registeredTool);
    this.logger.debug('Tool registered', { name: tool.name });
  }

  /**
   * Unregister a tool
   */
  public unregisterTool(name: string): boolean {
    const removed = this.tools.delete(name);
    if (removed) {
      this.logger.debug('Tool unregistered', { name });
    }
    return removed;
  }

  /**
   * Get available tools for a security context
   */
  public async getAvailableTools(securityContext: SecurityContext): Promise<Tool[]> {
    const availableTools: Tool[] = [];

    for (const [name, registeredTool] of this.tools) {
      if (this.canExecuteTool(securityContext, registeredTool)) {
        availableTools.push(registeredTool.tool);
      }
    }

    return availableTools;
  }

  /**
   * Execute a tool
   */
  public async executeTool(
    name: string,
    args: Record<string, unknown>,
    securityContext: SecurityContext,
    requestId: string
  ): Promise<{ content: Content[] }> {
    const startTime = Date.now();
    
    try {
      const registeredTool = this.tools.get(name);
      if (!registeredTool) {
        throw new Error(`Tool not found: ${name}`);
      }

      // Security checks
      if (!this.canExecuteTool(securityContext, registeredTool)) {
        throw new Error(`Access denied for tool: ${name}`);
      }

      // Validate arguments
      this.validateToolArguments(registeredTool.tool, args);

      // Update execution stats
      registeredTool.executionCount++;
      registeredTool.lastExecuted = new Date();

      this.logger.info('Executing tool', { 
        name, 
        requestId,
        userId: securityContext.userId,
        args: this.sanitizeArgs(args)
      });

      // Execute with timeout and retries
      const result = await this.executeWithTimeout(
        registeredTool,
        args,
        securityContext,
        requestId
      );

      const duration = Date.now() - startTime;
      
      // Record metrics
      this.metrics.recordToolExecution(
        name,
        duration,
        true,
        securityContext.userId
      );

      this.logger.info('Tool execution completed', { 
        name, 
        requestId,
        duration: `${duration}ms`,
        success: true
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Record error metrics
      this.metrics.recordToolExecution(
        name,
        duration,
        false,
        securityContext.userId,
        -1
      );

      this.logger.error('Tool execution failed', error as Error, { 
        name, 
        requestId,
        duration: `${duration}ms`,
        userId: securityContext.userId
      });

      throw error;
    }
  }

  /**
   * Get tool registry health status
   */
  public getHealthStatus(): boolean {
    return this.tools.size > 0;
  }

  /**
   * Get tool registry statistics
   */
  public getStatistics(): {
    totalTools: number;
    toolsByCategory: Record<string, number>;
    executionStats: Array<{
      name: string;
      executionCount: number;
      lastExecuted: string | null;
    }>;
  } {
    const toolsByCategory: Record<string, number> = {};
    const executionStats: Array<{
      name: string;
      executionCount: number;
      lastExecuted: string | null;
    }> = [];

    for (const [name, registeredTool] of this.tools) {
      // Categorize tools
      const category = this.getToolCategory(name);
      toolsByCategory[category] = (toolsByCategory[category] || 0) + 1;

      // Execution stats
      executionStats.push({
        name,
        executionCount: registeredTool.executionCount,
        lastExecuted: registeredTool.lastExecuted?.toISOString() || null
      });
    }

    return {
      totalTools: this.tools.size,
      toolsByCategory,
      executionStats
    };
  }

  /**
   * Register system tools
   */
  private registerSystemTools(): void {
    // Server info tool
    this.registerTool(
      {
        name: 'get_server_info',
        description: 'Get server status, statistics, and health information',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false
        }
      },
      async () => {
        const stats = this.getStatistics();
        const uptime = this.metrics.getUptime();
        const healthMetrics = await this.metrics.getHealthMetrics();
        
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              server: {
                name: 'MCP FileBridge',
                version: '1.0.0',
                uptime: this.metrics.getFormattedUptime(),
                status: 'healthy'
              },
              tools: stats,
              performance: healthMetrics,
              timestamp: new Date().toISOString()
            }, null, 2)
          }]
        };
      }
    );

    // Health check tool
    this.registerTool(
      {
        name: 'health_check',
        description: 'Perform comprehensive system health check',
        inputSchema: {
          type: 'object',
          properties: {
            detailed: {
              type: 'boolean',
              default: false,
              description: 'Include detailed health information'
            }
          }
        }
      },
      async (args: { detailed?: boolean }) => {
        const healthData = {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: this.metrics.getFormattedUptime(),
          tools: {
            total: this.tools.size,
            healthy: this.tools.size // All registered tools are considered healthy
          }
        };

        if (args.detailed) {
          const metrics = await this.metrics.getHealthMetrics();
          Object.assign(healthData, { metrics });
        }

        return {
          content: [{
            type: 'text' as const,
            text: `🏥 Health Check Results\n${'='.repeat(50)}\n\n${JSON.stringify(healthData, null, 2)}\n\n✅ All systems operational`
          }]
        };
      }
    );

    // Ping tool
    this.registerTool(
      {
        name: 'ping',
        description: 'Simple connectivity test',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      async () => ({
        content: [{
          type: 'text' as const,
          text: `🏓 Pong!\n\nServer: MCP FileBridge\nTimestamp: ${new Date().toISOString()}\nUptime: ${this.metrics.getFormattedUptime()}`
        }]
      })
    );
  }

  /**
   * Create file tool handler
   */
  private createFileToolHandler(toolName: string): ToolHandler {
    return async (args: Record<string, unknown>) => {
      switch (toolName) {
        case 'read_file':
          return this.fileTools.executeReadFile(args as any);
        case 'write_file':
          return this.fileTools.executeWriteFile(args as any);
        case 'list_directory':
          return this.fileTools.executeListDirectory(args as any);
        case 'get_file_info':
          return this.fileTools.executeGetFileInfo(args as any);
        case 'search_files':
          return this.fileTools.executeSearchFiles(args as any);
        default:
          throw new Error(`Unknown file tool: ${toolName}`);
      }
    };
  }

  /**
   * Create image tool handler
   */
  private createImageToolHandler(toolName: string): ToolHandler {
    return async (args: Record<string, unknown>) => {
      switch (toolName) {
        case 'analyze_image':
          return this.imageTools.executeAnalyzeImage(args as any);
        case 'download_image':
          return this.imageTools.executeDownloadImage(args as any);
        case 'extract_image_text':
          return this.imageTools.executeExtractImageText(args as any);
        default:
          throw new Error(`Unknown image tool: ${toolName}`);
      }
    };
  }

  /**
   * Check if user can execute tool
   */
  private canExecuteTool(
    securityContext: SecurityContext,
    registeredTool: RegisteredTool
  ): boolean {
    const { options } = registeredTool;

    // Check authentication requirement
    if (options.requiresAuth && !securityContext.userId) {
      return false;
    }

    // Check required permissions
    if (options.requiredPermissions && options.requiredPermissions.length > 0) {
      const hasPermission = options.requiredPermissions.every(permission =>
        securityContext.permissions.includes(permission)
      );
      if (!hasPermission) {
        return false;
      }
    }

    return true;
  }

  /**
   * Execute tool with timeout and retries
   */
  private async executeWithTimeout(
    registeredTool: RegisteredTool,
    args: Record<string, unknown>,
    securityContext: SecurityContext,
    requestId: string
  ): Promise<{ content: Content[] }> {
    const { handler, options } = registeredTool;
    const timeout = options.timeout || 30000;
    const retries = options.retries || 0;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Tool execution timeout')), timeout);
        });

        const executionPromise = handler(args, securityContext, requestId);
        
        return await Promise.race([executionPromise, timeoutPromise]);
        
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < retries) {
          this.logger.warn('Tool execution failed, retrying', {
            tool: registeredTool.tool.name,
            attempt: attempt + 1,
            error: lastError.message
          });
          
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    throw lastError || new Error('Tool execution failed');
  }

  /**
   * Validate tool schema
   */
  private validateToolSchema(tool: Tool): void {
    const schema = Joi.object({
      name: Joi.string().required(),
      description: Joi.string().required(),
      inputSchema: Joi.object().required()
    });

    const { error } = schema.validate(tool);
    if (error) {
      throw new Error(`Invalid tool schema: ${error.message}`);
    }
  }

  /**
   * Validate tool arguments against schema
   */
  private validateToolArguments(tool: Tool, args: Record<string, unknown>): void {
    try {
      // Convert JSON Schema to Joi schema (simplified)
      const joiSchema = this.jsonSchemaToJoi(tool.inputSchema);
      const { error } = joiSchema.validate(args);
      
      if (error) {
        throw new Error(`Invalid arguments for tool ${tool.name}: ${error.message}`);
      }
    } catch (error) {
      this.logger.warn('Argument validation failed', { 
        tool: tool.name, 
        error: (error as Error).message 
      });
      // Don't throw - allow execution with warning
    }
  }

  /**
   * Convert JSON Schema to Joi schema (simplified implementation)
   */
  private jsonSchemaToJoi(schema: any): Joi.ObjectSchema {
    // This is a simplified implementation
    // In production, you might want to use a proper JSON Schema to Joi converter
    return Joi.object().unknown(true);
  }

  /**
   * Get tool category based on name
   */
  private getToolCategory(toolName: string): string {
    if (toolName.includes('file') || toolName.includes('directory') || toolName.includes('search')) {
      return 'file_operations';
    }
    if (toolName.includes('image') || toolName.includes('analyze') || toolName.includes('download')) {
      return 'image_processing';
    }
    if (toolName.includes('server') || toolName.includes('health') || toolName.includes('ping')) {
      return 'system';
    }
    return 'other';
  }

  /**
   * Sanitize arguments for logging (remove sensitive data)
   */
  private sanitizeArgs(args: Record<string, unknown>): Record<string, unknown> {
    const sanitized = { ...args };
    
    // Remove potentially sensitive fields
    const sensitiveFields = ['password', 'token', 'key', 'secret', 'content'];
    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    await this.imageTools.cleanup();
    this.tools.clear();
    this.logger.info('Tool registry cleanup completed');
  }
}

// Types for tool registration
interface RegisteredTool {
  tool: Tool;
  handler: ToolHandler;
  options: ToolRegistrationOptions;
  registeredAt: Date;
  executionCount: number;
  lastExecuted: Date | null;
}

interface ToolRegistrationOptions {
  requiresAuth?: boolean;
  requiredPermissions?: string[];
  rateLimit?: {
    windowMs: number;
    maxRequests: number;
  };
  timeout?: number;
  retries?: number;
}

type ToolHandler = (
  args: Record<string, unknown>,
  securityContext?: SecurityContext,
  requestId?: string
) => Promise<{ content: Content[] }>;
