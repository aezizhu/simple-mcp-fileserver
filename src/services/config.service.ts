/**
 * Configuration Service
 * 
 * Enterprise-grade configuration management with environment variable support,
 * validation, and hot-reloading capabilities.
 * 
 * @author aezizhu
 * @version 1.0.0
 */

import { injectable } from 'inversify';
import { readFileSync, existsSync, watchFile } from 'fs';
import { join } from 'path';
import Joi from 'joi';
import { ServerConfig, LogLevel } from '@/types/mcp';

@injectable()
export class ConfigService {
  private config: ServerConfig;
  private readonly configPath: string;
  private readonly schema: Joi.ObjectSchema;

  constructor() {
    this.configPath = this.getConfigPath();
    this.schema = this.createValidationSchema();
    this.config = this.loadConfig();
    this.setupHotReload();
  }

  /**
   * Get the complete configuration
   */
  public getConfig(overrides?: Partial<ServerConfig>): ServerConfig {
    if (overrides) {
      return this.mergeConfig(this.config, overrides);
    }
    return { ...this.config };
  }

  /**
   * Get a specific configuration section
   */
  public get<T extends keyof ServerConfig>(section: T): ServerConfig[T] {
    return this.config[section];
  }

  /**
   * Update configuration at runtime
   */
  public updateConfig(updates: Partial<ServerConfig>): void {
    const newConfig = this.mergeConfig(this.config, updates);
    const { error } = this.schema.validate(newConfig);
    
    if (error) {
      throw new Error(`Configuration validation failed: ${error.message}`);
    }
    
    this.config = newConfig;
  }

  /**
   * Reload configuration from file
   */
  public reloadConfig(): void {
    try {
      this.config = this.loadConfig();
      console.log('Configuration reloaded successfully');
    } catch (error) {
      console.error('Failed to reload configuration:', error);
    }
  }

  /**
   * Load configuration from file and environment
   */
  private loadConfig(): ServerConfig {
    const defaultConfig = this.getDefaultConfig();
    let fileConfig = {};
    
    // Load from configuration file if exists
    if (existsSync(this.configPath)) {
      try {
        const configContent = readFileSync(this.configPath, 'utf-8');
        fileConfig = JSON.parse(this.interpolateEnvironmentVariables(configContent));
      } catch (error) {
        console.warn(`Failed to load config file ${this.configPath}:`, error);
      }
    }
    
    // Merge configurations: default < file < environment
    const envConfig = this.getEnvironmentConfig();
    const mergedConfig = this.mergeConfig(defaultConfig, fileConfig, envConfig);
    
    // Validate final configuration
    const { error, value } = this.schema.validate(mergedConfig);
    if (error) {
      throw new Error(`Configuration validation failed: ${error.message}`);
    }
    
    return value;
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): ServerConfig {
    return {
      server: {
        host: 'localhost',
        port: 3000,
        cors: {
          enabled: true,
          origin: true,
          methods: ['GET', 'POST', 'OPTIONS'],
          allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
          credentials: false,
        },
        rateLimit: {
          enabled: true,
          windowMs: 15 * 60 * 1000, // 15 minutes
          maxRequests: 100,
          message: 'Too many requests from this IP',
        },
        security: {
          helmet: true,
          authentication: {
            enabled: false,
            jwt: {
              secret: 'change-me-in-production',
              expiresIn: '24h',
            },
          },
          authorization: {
            enabled: false,
            roles: ['admin', 'user', 'readonly'],
          },
        },
      },
      logging: {
        level: LogLevel.INFO,
        format: 'json',
        transports: [
          {
            type: 'console',
            options: {
              colorize: true,
              timestamp: true,
            },
          },
        ],
      },
      cache: {
        enabled: true,
        type: 'memory',
        ttl: 300, // 5 minutes
        maxSize: 1000,
      },
      plugins: {
        enabled: true,
        directory: './plugins',
        autoload: true,
        plugins: {},
      },
      monitoring: {
        enabled: true,
        metrics: {
          enabled: true,
          endpoint: '/metrics',
        },
        health: {
          enabled: true,
          endpoint: '/health',
        },
        tracing: {
          enabled: false,
          serviceName: 'mcp-enterprise-server',
        },
      },
    };
  }

  /**
   * Get configuration from environment variables
   */
  private getEnvironmentConfig(): Partial<ServerConfig> {
    const env = process.env;
    
    return {
      server: {
        host: env.HOST || undefined,
        port: env.PORT ? parseInt(env.PORT, 10) : undefined,
        security: {
          authentication: {
            jwt: {
              secret: env.JWT_SECRET || undefined,
              expiresIn: env.JWT_EXPIRES_IN || undefined,
            },
          },
        },
      },
      logging: {
        level: env.LOG_LEVEL as LogLevel || undefined,
      },
      cache: {
        enabled: env.CACHE_ENABLED ? env.CACHE_ENABLED === 'true' : undefined,
        type: env.CACHE_TYPE as 'memory' | 'redis' || undefined,
        ttl: env.CACHE_TTL ? parseInt(env.CACHE_TTL, 10) : undefined,
        redis: env.REDIS_HOST ? {
          host: env.REDIS_HOST,
          port: env.REDIS_PORT ? parseInt(env.REDIS_PORT, 10) : 6379,
          password: env.REDIS_PASSWORD || undefined,
          db: env.REDIS_DB ? parseInt(env.REDIS_DB, 10) : 0,
        } : undefined,
      },
      database: env.DATABASE_URL ? {
        type: env.DATABASE_TYPE as 'mongodb' | 'postgresql' | 'mysql' || 'mongodb',
        url: env.DATABASE_URL,
        options: {},
      } : undefined,
    };
  }

  /**
   * Get configuration file path based on environment
   */
  private getConfigPath(): string {
    const env = process.env.NODE_ENV || 'development';
    const configDir = process.env.CONFIG_DIR || './config';
    return join(process.cwd(), configDir, `${env}.json`);
  }

  /**
   * Create Joi validation schema
   */
  private createValidationSchema(): Joi.ObjectSchema {
    return Joi.object({
      server: Joi.object({
        host: Joi.string().hostname().required(),
        port: Joi.number().port().required(),
        cors: Joi.object({
          enabled: Joi.boolean().required(),
          origin: Joi.alternatives().try(
            Joi.boolean(),
            Joi.string(),
            Joi.array().items(Joi.string())
          ).required(),
          methods: Joi.array().items(Joi.string()).required(),
          allowedHeaders: Joi.array().items(Joi.string()).required(),
          credentials: Joi.boolean().required(),
        }).required(),
        rateLimit: Joi.object({
          enabled: Joi.boolean().required(),
          windowMs: Joi.number().positive().required(),
          maxRequests: Joi.number().positive().required(),
          message: Joi.string().required(),
        }).required(),
        security: Joi.object({
          helmet: Joi.boolean().required(),
          authentication: Joi.object({
            enabled: Joi.boolean().required(),
            jwt: Joi.object({
              secret: Joi.string().min(32).required(),
              expiresIn: Joi.string().required(),
            }).required(),
          }).required(),
          authorization: Joi.object({
            enabled: Joi.boolean().required(),
            roles: Joi.array().items(Joi.string()).required(),
          }).required(),
        }).required(),
      }).required(),
      logging: Joi.object({
        level: Joi.string().valid(...Object.values(LogLevel)).required(),
        format: Joi.string().valid('json', 'simple').required(),
        transports: Joi.array().items(
          Joi.object({
            type: Joi.string().valid('console', 'file', 'http').required(),
            options: Joi.object().required(),
          })
        ).required(),
      }).required(),
      cache: Joi.object({
        enabled: Joi.boolean().required(),
        type: Joi.string().valid('memory', 'redis').required(),
        ttl: Joi.number().positive().required(),
        maxSize: Joi.number().positive().optional(),
        redis: Joi.object({
          host: Joi.string().required(),
          port: Joi.number().port().required(),
          password: Joi.string().optional(),
          db: Joi.number().min(0).required(),
        }).optional(),
      }).required(),
      database: Joi.object({
        type: Joi.string().valid('mongodb', 'postgresql', 'mysql').required(),
        url: Joi.string().uri().required(),
        options: Joi.object().required(),
      }).optional(),
      plugins: Joi.object({
        enabled: Joi.boolean().required(),
        directory: Joi.string().required(),
        autoload: Joi.boolean().required(),
        plugins: Joi.object().pattern(
          Joi.string(),
          Joi.object({
            enabled: Joi.boolean().required(),
            config: Joi.object().required(),
          })
        ).required(),
      }).required(),
      monitoring: Joi.object({
        enabled: Joi.boolean().required(),
        metrics: Joi.object({
          enabled: Joi.boolean().required(),
          endpoint: Joi.string().required(),
        }).required(),
        health: Joi.object({
          enabled: Joi.boolean().required(),
          endpoint: Joi.string().required(),
        }).required(),
        tracing: Joi.object({
          enabled: Joi.boolean().required(),
          serviceName: Joi.string().required(),
        }).required(),
      }).required(),
    });
  }

  /**
   * Merge multiple configuration objects
   */
  private mergeConfig(...configs: Array<Partial<ServerConfig>>): ServerConfig {
    return configs.reduce((merged, config) => {
      return this.deepMerge(merged, config);
    }, {} as ServerConfig);
  }

  /**
   * Deep merge two objects
   */
  private deepMerge(target: any, source: any): any {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] !== undefined) {
        if (this.isObject(source[key]) && this.isObject(target[key])) {
          result[key] = this.deepMerge(target[key], source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }
    
    return result;
  }

  /**
   * Check if value is an object
   */
  private isObject(value: any): boolean {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  /**
   * Interpolate environment variables in configuration string
   */
  private interpolateEnvironmentVariables(configString: string): string {
    return configString.replace(/\$\{([^}]+)\}/g, (match, varName) => {
      const value = process.env[varName];
      if (value === undefined) {
        console.warn(`Environment variable ${varName} not found, using placeholder`);
        return match;
      }
      return value;
    });
  }

  /**
   * Setup hot reload for configuration file
   */
  private setupHotReload(): void {
    if (existsSync(this.configPath)) {
      watchFile(this.configPath, { interval: 5000 }, () => {
        console.log('Configuration file changed, reloading...');
        this.reloadConfig();
      });
    }
  }
}
