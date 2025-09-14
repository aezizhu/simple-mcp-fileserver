/**
 * Model Context Protocol (MCP) Type Definitions
 * 
 * Enterprise-grade TypeScript definitions for MCP specification compliance
 * Follows MCP 2024-11-05 specification with strict typing
 * 
 * @author aezizhu
 * @version 1.0.0
 */

export interface JsonRpcRequest {
  readonly jsonrpc: '2.0';
  readonly method: string;
  readonly params?: Record<string, unknown> | unknown[];
  readonly id: string | number | null;
}

export interface JsonRpcResponse<T = unknown> {
  readonly jsonrpc: '2.0';
  readonly id: string | number | null;
  readonly result?: T;
  readonly error?: JsonRpcError;
}

export interface JsonRpcError {
  readonly code: number;
  readonly message: string;
  readonly data?: unknown;
}

export interface JsonRpcNotification {
  readonly jsonrpc: '2.0';
  readonly method: string;
  readonly params?: Record<string, unknown> | unknown[];
}

// MCP Protocol Version
export const MCP_PROTOCOL_VERSION = '2024-11-05' as const;

// Standard JSON-RPC Error Codes
export enum JsonRpcErrorCode {
  PARSE_ERROR = -32700,
  INVALID_REQUEST = -32600,
  METHOD_NOT_FOUND = -32601,
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,
  SERVER_ERROR_START = -32099,
  SERVER_ERROR_END = -32000,
}

// MCP Specific Error Codes
export enum McpErrorCode {
  TOOL_NOT_FOUND = -32001,
  RESOURCE_NOT_FOUND = -32002,
  PERMISSION_DENIED = -32003,
  RATE_LIMITED = -32004,
  VALIDATION_ERROR = -32005,
  PROCESSING_ERROR = -32006,
}

// Server Information
export interface ServerInfo {
  readonly name: string;
  readonly version: string;
  readonly description?: string;
  readonly author?: string;
  readonly license?: string;
  readonly homepage?: string;
}

// Capabilities
export interface ServerCapabilities {
  readonly tools?: ToolsCapability;
  readonly resources?: ResourcesCapability;
  readonly prompts?: PromptsCapability;
  readonly logging?: LoggingCapability;
}

export interface ToolsCapability {
  readonly listChanged?: boolean;
}

export interface ResourcesCapability {
  readonly subscribe?: boolean;
  readonly listChanged?: boolean;
}

export interface PromptsCapability {
  readonly listChanged?: boolean;
}

export interface LoggingCapability {
  readonly level?: LogLevel;
}

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  NOTICE = 'notice',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
  ALERT = 'alert',
  EMERGENCY = 'emergency',
}

// Initialize Request/Response
export interface InitializeRequest extends JsonRpcRequest {
  readonly method: 'initialize';
  readonly params: {
    readonly protocolVersion: string;
    readonly capabilities: ClientCapabilities;
    readonly clientInfo: ClientInfo;
  };
}

export interface InitializeResponse extends JsonRpcResponse {
  readonly result: {
    readonly protocolVersion: string;
    readonly capabilities: ServerCapabilities;
    readonly serverInfo: ServerInfo;
    readonly instructions?: string;
  };
}

export interface ClientCapabilities {
  readonly experimental?: Record<string, unknown>;
  readonly sampling?: SamplingCapability;
}

export interface SamplingCapability {
  readonly maxTokens?: number;
  readonly temperature?: number;
}

export interface ClientInfo {
  readonly name: string;
  readonly version: string;
}

// Tool Definitions
export interface Tool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: JsonSchema;
}

export interface JsonSchema {
  readonly type: string;
  readonly properties?: Record<string, JsonSchemaProperty>;
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean;
  readonly items?: JsonSchema;
  readonly enum?: readonly unknown[];
  readonly const?: unknown;
  readonly oneOf?: readonly JsonSchema[];
  readonly anyOf?: readonly JsonSchema[];
  readonly allOf?: readonly JsonSchema[];
  readonly not?: JsonSchema;
  readonly if?: JsonSchema;
  readonly then?: JsonSchema;
  readonly else?: JsonSchema;
  readonly format?: string;
  readonly pattern?: string;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly exclusiveMinimum?: number;
  readonly exclusiveMaximum?: number;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly minItems?: number;
  readonly maxItems?: number;
  readonly uniqueItems?: boolean;
  readonly minProperties?: number;
  readonly maxProperties?: number;
  readonly multipleOf?: number;
  readonly title?: string;
  readonly description?: string;
  readonly default?: unknown;
  readonly examples?: readonly unknown[];
}

export interface JsonSchemaProperty extends JsonSchema {
  readonly description?: string;
}

// Tool Execution
export interface ToolCallRequest extends JsonRpcRequest {
  readonly method: 'tools/call';
  readonly params: {
    readonly name: string;
    readonly arguments?: Record<string, unknown>;
  };
}

export interface ToolCallResponse extends JsonRpcResponse {
  readonly result: {
    readonly content: readonly Content[];
    readonly isError?: boolean;
  };
}

export interface Content {
  readonly type: ContentType;
  readonly text?: string;
  readonly data?: string;
  readonly mimeType?: string;
}

export enum ContentType {
  TEXT = 'text',
  IMAGE = 'image',
  RESOURCE = 'resource',
}

// Resource Definitions
export interface Resource {
  readonly uri: string;
  readonly name: string;
  readonly description?: string;
  readonly mimeType?: string;
}

export interface ResourceReadRequest extends JsonRpcRequest {
  readonly method: 'resources/read';
  readonly params: {
    readonly uri: string;
  };
}

export interface ResourceReadResponse extends JsonRpcResponse {
  readonly result: {
    readonly contents: readonly ResourceContent[];
  };
}

export interface ResourceContent {
  readonly uri: string;
  readonly mimeType?: string;
  readonly text?: string;
  readonly blob?: string;
}

// Logging
export interface LoggingMessageNotification extends JsonRpcNotification {
  readonly method: 'notifications/message';
  readonly params: {
    readonly level: LogLevel;
    readonly data: unknown;
    readonly logger?: string;
  };
}

// Progress Notifications
export interface ProgressNotification extends JsonRpcNotification {
  readonly method: 'notifications/progress';
  readonly params: {
    readonly progressToken: string | number;
    readonly progress: number;
    readonly total?: number;
  };
}

// Custom Types for Enterprise Features
export interface User {
  readonly id: string;
  readonly username: string;
  readonly roles: string[];
  readonly permissions: string[];
}

export interface Role {
  readonly name: string;
  readonly permissions: string[];
}

export interface Permission {
  readonly name: string;
  readonly description?: string;
}

export interface SecurityContext {
  readonly userId?: string;
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
  readonly sessionId: string;
  readonly ipAddress: string;
  readonly userAgent?: string;
}

export interface RequestMetrics {
  readonly requestId: string;
  readonly timestamp: Date;
  readonly method: string;
  readonly duration?: number;
  readonly success: boolean;
  readonly errorCode?: number;
  readonly userId?: string;
}

export interface CacheOptions {
  readonly ttl?: number;
  readonly key?: string;
  readonly tags?: readonly string[];
  readonly invalidateOn?: readonly string[];
}

export interface RateLimitOptions {
  readonly windowMs: number;
  readonly maxRequests: number;
  readonly keyGenerator?: (req: unknown) => string;
  readonly skipSuccessfulRequests?: boolean;
  readonly skipFailedRequests?: boolean;
}

export interface PluginManifest {
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly author: string;
  readonly main: string;
  readonly dependencies?: Record<string, string>;
  readonly mcpVersion: string;
  readonly capabilities: readonly string[];
  readonly configuration?: JsonSchema;
}

export interface PluginContext {
  readonly logger: Logger;
  readonly config: Record<string, unknown>;
  readonly services: ServiceRegistry;
  readonly events: EventEmitter;
}

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, error?: Error, meta?: Record<string, unknown>): void;
}

export interface ServiceRegistry {
  get<T>(name: string): T;
  register<T>(name: string, service: T): void;
  unregister(name: string): void;
}

export interface EventEmitter {
  on(event: string, listener: (...args: unknown[]) => void): void;
  emit(event: string, ...args: unknown[]): void;
  off(event: string, listener: (...args: unknown[]) => void): void;
}

// Image Analysis Types
export interface ImageAnalysisOptions {
  readonly includeOcr?: boolean;
  readonly includeExif?: boolean;
  readonly returnBase64?: boolean;
  readonly maxDimension?: number;
  readonly quality?: number;
  readonly format?: 'jpeg' | 'png' | 'webp';
}

export interface ImageMetadata {
  readonly width: number;
  readonly height: number;
  readonly format: string;
  readonly channels: number;
  readonly depth: string;
  readonly density?: number;
  readonly hasAlpha: boolean;
  readonly colorSpace: string;
  readonly compression?: string;
  readonly orientation?: number;
}

export interface ImageAnalysisResult {
  readonly fileInfo: {
    readonly path: string;
    readonly filename: string;
    readonly sizeBytes: number;
    readonly format: string;
    readonly mimeType: string;
    readonly created: string;
    readonly modified: string;
  };
  readonly technicalProperties: ImageMetadata;
  readonly exifMetadata?: Record<string, unknown>;
  readonly ocrResults?: {
    readonly extractedText: string;
    readonly confidence: number;
    readonly language: string;
    readonly blocks?: readonly TextBlock[];
  };
  readonly base64Data?: {
    readonly dataUrl: string;
    readonly sizeBytes: number;
    readonly resized: boolean;
    readonly maxDimensionApplied: number;
  };
  readonly analysisTimestamp: string;
  readonly serverInfo: {
    readonly analyzer: string;
    readonly version: string;
    readonly note: string;
  };
}

export interface TextBlock {
  readonly text: string;
  readonly confidence: number;
  readonly bbox: {
    readonly x0: number;
    readonly y0: number;
    readonly x1: number;
    readonly y1: number;
  };
}

// Configuration Types
export interface ServerConfig {
  readonly server: {
    readonly host: string;
    readonly port: number;
    readonly cors: CorsConfig;
    readonly rateLimit: RateLimitConfig;
    readonly security: SecurityConfig;
  };
  readonly logging: LoggingConfig;
  readonly cache: CacheConfig;
  readonly database?: DatabaseConfig;
  readonly plugins: PluginConfig;
  readonly monitoring: MonitoringConfig;
}

export interface CorsConfig {
  readonly enabled: boolean;
  readonly origin: string | readonly string[] | boolean;
  readonly methods: readonly string[];
  readonly allowedHeaders: readonly string[];
  readonly credentials: boolean;
}

export interface RateLimitConfig {
  readonly enabled: boolean;
  readonly windowMs: number;
  readonly maxRequests: number;
  readonly message: string;
}

export interface SecurityConfig {
  readonly helmet: boolean;
  readonly authentication: {
    readonly enabled: boolean;
    readonly jwt: {
      readonly secret: string;
      readonly expiresIn: string;
    };
  };
  readonly authorization: {
    readonly enabled: boolean;
    readonly roles: readonly string[];
  };
}

export interface LoggingConfig {
  readonly level: LogLevel;
  readonly format: 'json' | 'simple';
  readonly transports: readonly LogTransportConfig[];
}

export interface LogTransportConfig {
  readonly type: 'console' | 'file' | 'http';
  readonly options: Record<string, unknown>;
}

export interface CacheConfig {
  readonly enabled: boolean;
  readonly type: 'memory' | 'redis';
  readonly ttl: number;
  readonly maxSize?: number;
  readonly redis?: {
    readonly host: string;
    readonly port: number;
    readonly password?: string;
    readonly db: number;
  };
}

export interface DatabaseConfig {
  readonly type: 'mongodb' | 'postgresql' | 'mysql';
  readonly url: string;
  readonly options: Record<string, unknown>;
}

export interface PluginConfig {
  readonly enabled: boolean;
  readonly directory: string;
  readonly autoload: boolean;
  readonly plugins: Record<string, PluginInstanceConfig>;
}

export interface PluginInstanceConfig {
  readonly enabled: boolean;
  readonly config: Record<string, unknown>;
}

export interface MonitoringConfig {
  readonly enabled: boolean;
  readonly metrics: {
    readonly enabled: boolean;
    readonly endpoint: string;
  };
  readonly health: {
    readonly enabled: boolean;
    readonly endpoint: string;
  };
  readonly tracing: {
    readonly enabled: boolean;
    readonly serviceName: string;
  };
}
