/**
 * Logger Service
 * 
 * Enterprise-grade logging service with structured logging, multiple transports,
 * and performance optimization.
 * 
 * @author aezizhu
 * @version 1.0.0
 */

import { injectable, inject } from 'inversify';
import winston, { Logger as WinstonLogger, format, transports } from 'winston';
import { LogLevel, LoggingConfig, Logger } from '@/types/mcp';

@injectable()
export class LoggerService {
  private readonly loggers: Map<string, Logger> = new Map();
  private readonly config: LoggingConfig;
  private readonly rootLogger: WinstonLogger;

  constructor() {
    // Get logging configuration (will be injected properly in DI setup)
    this.config = this.getDefaultLoggingConfig();
    this.rootLogger = this.createWinstonLogger('root');
  }

  /**
   * Get a logger instance for a specific module
   */
  public getLogger(module: string): Logger {
    if (!this.loggers.has(module)) {
      const winstonLogger = this.createWinstonLogger(module);
      const logger = this.createLoggerWrapper(winstonLogger, module);
      this.loggers.set(module, logger);
    }
    
    return this.loggers.get(module)!;
  }

  /**
   * Create Winston logger instance
   */
  private createWinstonLogger(module: string): WinstonLogger {
    const logFormat = this.createLogFormat();
    const logTransports = this.createTransports();

    return winston.createLogger({
      level: this.config.level,
      format: logFormat,
      defaultMeta: {
        service: 'mcp-enterprise-server',
        module,
        pid: process.pid,
        hostname: require('os').hostname(),
      },
      transports: logTransports,
      exitOnError: false,
      silent: process.env.NODE_ENV === 'test',
    });
  }

  /**
   * Create log format based on configuration
   */
  private createLogFormat() {
    const baseFormat = [
      format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
      format.errors({ stack: true }),
      format.metadata({
        fillExcept: ['message', 'level', 'timestamp', 'label'],
      }),
    ];

    if (this.config.format === 'json') {
      return format.combine(
        ...baseFormat,
        format.json()
      );
    } else {
      return format.combine(
        ...baseFormat,
        format.colorize({ all: true }),
        format.printf(this.createSimpleFormatter())
      );
    }
  }

  /**
   * Create simple log formatter
   */
  private createSimpleFormatter() {
    return (info: any) => {
      const { timestamp, level, message, module, metadata } = info;
      let log = `${timestamp} [${level}] [${module}] ${message}`;
      
      if (metadata && Object.keys(metadata).length > 0) {
        log += ` ${JSON.stringify(metadata)}`;
      }
      
      return log;
    };
  }

  /**
   * Create transport instances based on configuration
   */
  private createTransports(): winston.transport[] {
    return this.config.transports.map(transportConfig => {
      switch (transportConfig.type) {
        case 'console':
          return new transports.Console({
            handleExceptions: true,
            handleRejections: true,
            ...transportConfig.options,
          });
        
        case 'file':
          return new transports.File({
            handleExceptions: true,
            handleRejections: true,
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5,
            tailable: true,
            ...transportConfig.options,
          });
        
        case 'http':
          return new transports.Http({
            ...transportConfig.options,
          });
        
        default:
          throw new Error(`Unsupported transport type: ${transportConfig.type}`);
      }
    });
  }

  /**
   * Create logger wrapper that implements our Logger interface
   */
  private createLoggerWrapper(winstonLogger: WinstonLogger, module: string): Logger {
    return {
      debug: (message: string, meta?: Record<string, unknown>) => {
        winstonLogger.debug(message, { ...meta, module });
      },
      
      info: (message: string, meta?: Record<string, unknown>) => {
        winstonLogger.info(message, { ...meta, module });
      },
      
      warn: (message: string, meta?: Record<string, unknown>) => {
        winstonLogger.warn(message, { ...meta, module });
      },
      
      error: (message: string, error?: Error, meta?: Record<string, unknown>) => {
        const errorMeta = error ? {
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
        } : {};
        
        winstonLogger.error(message, {
          ...errorMeta,
          ...meta,
          module,
        });
      },
    };
  }

  /**
   * Get default logging configuration
   */
  private getDefaultLoggingConfig(): LoggingConfig {
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    return {
      level: (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO,
      format: isDevelopment ? 'simple' : 'json',
      transports: [
        {
          type: 'console',
          options: {
            colorize: isDevelopment,
            timestamp: true,
          },
        },
        ...(process.env.LOG_FILE ? [{
          type: 'file' as const,
          options: {
            filename: process.env.LOG_FILE,
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5,
          },
        }] : []),
      ],
    };
  }

  /**
   * Update logging configuration at runtime
   */
  public updateConfig(newConfig: LoggingConfig): void {
    // Clear existing loggers to force recreation with new config
    this.loggers.clear();
    
    // Update root logger
    this.rootLogger.configure({
      level: newConfig.level,
      format: this.createLogFormat(),
      transports: this.createTransports(),
    });
  }

  /**
   * Get logging statistics
   */
  public getStats(): {
    activeLoggers: number;
    logLevel: string;
    transports: string[];
  } {
    return {
      activeLoggers: this.loggers.size,
      logLevel: this.config.level,
      transports: this.config.transports.map(t => t.type),
    };
  }

  /**
   * Flush all log transports
   */
  public async flush(): Promise<void> {
    const flushPromises = Array.from(this.loggers.values()).map(logger => {
      return new Promise<void>((resolve) => {
        // Winston doesn't have a direct flush method, so we use end event
        const winstonLogger = (logger as any)._winstonLogger;
        if (winstonLogger && typeof winstonLogger.end === 'function') {
          winstonLogger.end(resolve);
        } else {
          resolve();
        }
      });
    });
    
    await Promise.all(flushPromises);
  }

  /**
   * Shutdown logging service
   */
  public async shutdown(): Promise<void> {
    await this.flush();
    this.loggers.clear();
    
    // Close root logger
    return new Promise<void>((resolve) => {
      this.rootLogger.end(resolve);
    });
  }
}
