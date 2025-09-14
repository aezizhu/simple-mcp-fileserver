/**
 * Metrics Service
 * 
 * Enterprise-grade metrics collection and monitoring with Prometheus integration.
 * Provides comprehensive observability for production environments.
 * 
 * @author aezizhu
 * @version 1.0.0
 */

import { injectable } from 'inversify';
import { register, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import { RequestMetrics } from '@/types/mcp';

@injectable()
export class MetricsService {
  private readonly requestCounter: Counter<string>;
  private readonly requestDuration: Histogram<string>;
  private readonly toolExecutions: Counter<string>;
  private readonly toolDuration: Histogram<string>;
  private readonly activeConnections: Gauge<string>;
  private readonly memoryUsage: Gauge<string>;
  private readonly cpuUsage: Gauge<string>;
  private readonly cacheHits: Counter<string>;
  private readonly cacheMisses: Counter<string>;
  private readonly errorCounter: Counter<string>;

  private readonly startTime = Date.now();
  private cpuUsageInterval?: NodeJS.Timeout;

  constructor() {
    // Enable default system metrics
    collectDefaultMetrics({ prefix: 'mcp_' });

    // Request metrics
    this.requestCounter = new Counter({
      name: 'mcp_requests_total',
      help: 'Total number of MCP requests',
      labelNames: ['method', 'status', 'user_id'],
    });

    this.requestDuration = new Histogram({
      name: 'mcp_request_duration_seconds',
      help: 'Duration of MCP requests in seconds',
      labelNames: ['method', 'status'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
    });

    // Tool execution metrics
    this.toolExecutions = new Counter({
      name: 'mcp_tool_executions_total',
      help: 'Total number of tool executions',
      labelNames: ['tool_name', 'status', 'user_id'],
    });

    this.toolDuration = new Histogram({
      name: 'mcp_tool_duration_seconds',
      help: 'Duration of tool executions in seconds',
      labelNames: ['tool_name', 'status'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
    });

    // System metrics
    this.activeConnections = new Gauge({
      name: 'mcp_active_connections',
      help: 'Number of active connections',
    });

    this.memoryUsage = new Gauge({
      name: 'mcp_memory_usage_bytes',
      help: 'Memory usage in bytes',
      labelNames: ['type'],
    });

    this.cpuUsage = new Gauge({
      name: 'mcp_cpu_usage_percent',
      help: 'CPU usage percentage',
    });

    // Cache metrics
    this.cacheHits = new Counter({
      name: 'mcp_cache_hits_total',
      help: 'Total number of cache hits',
      labelNames: ['cache_type'],
    });

    this.cacheMisses = new Counter({
      name: 'mcp_cache_misses_total',
      help: 'Total number of cache misses',
      labelNames: ['cache_type'],
    });

    // Error metrics
    this.errorCounter = new Counter({
      name: 'mcp_errors_total',
      help: 'Total number of errors',
      labelNames: ['error_type', 'error_code'],
    });

    this.startSystemMetricsCollection();
  }

  /**
   * Record request metrics
   */
  public recordRequest(metrics: RequestMetrics): void {
    const status = metrics.success ? 'success' : 'error';
    const labels = {
      method: metrics.method,
      status,
      user_id: metrics.userId || 'anonymous',
    };

    this.requestCounter.inc(labels);
    
    if (metrics.duration !== undefined) {
      this.requestDuration
        .labels({ method: metrics.method, status })
        .observe(metrics.duration / 1000); // Convert to seconds
    }

    if (!metrics.success && metrics.errorCode) {
      this.errorCounter.inc({
        error_type: 'request_error',
        error_code: metrics.errorCode.toString(),
      });
    }
  }

  /**
   * Record tool execution metrics
   */
  public recordToolExecution(
    toolName: string,
    duration: number,
    success: boolean,
    userId?: string,
    errorCode?: number
  ): void {
    const status = success ? 'success' : 'error';
    
    this.toolExecutions.inc({
      tool_name: toolName,
      status,
      user_id: userId || 'anonymous',
    });

    this.toolDuration
      .labels({ tool_name: toolName, status })
      .observe(duration / 1000); // Convert to seconds

    if (!success && errorCode) {
      this.errorCounter.inc({
        error_type: 'tool_error',
        error_code: errorCode.toString(),
      });
    }
  }

  /**
   * Record cache metrics
   */
  public recordCacheHit(cacheType: string = 'default'): void {
    this.cacheHits.inc({ cache_type: cacheType });
  }

  public recordCacheMiss(cacheType: string = 'default'): void {
    this.cacheMisses.inc({ cache_type: cacheType });
  }

  /**
   * Update active connections count
   */
  public setActiveConnections(count: number): void {
    this.activeConnections.set(count);
  }

  /**
   * Record custom error
   */
  public recordError(errorType: string, errorCode?: string | number): void {
    this.errorCounter.inc({
      error_type: errorType,
      error_code: errorCode?.toString() || 'unknown',
    });
  }

  /**
   * Get metrics in Prometheus format
   */
  public async getMetrics(): Promise<string> {
    return register.metrics();
  }

  /**
   * Get health metrics summary
   */
  public async getHealthMetrics(): Promise<{
    uptime: number;
    requests_per_second: number;
    average_response_time: number;
    memory_usage_mb: number;
    cpu_usage_percent: number;
    error_rate: number;
  }> {
    const uptime = Date.now() - this.startTime;
    const metrics = await register.getMetricsAsJSON();
    
    // Calculate derived metrics
    const requestsTotal = this.getMetricValue(metrics, 'mcp_requests_total') || 0;
    const requestsPerSecond = requestsTotal / (uptime / 1000);
    
    const requestDurationSum = this.getMetricValue(metrics, 'mcp_request_duration_seconds', 'sum') || 0;
    const requestDurationCount = this.getMetricValue(metrics, 'mcp_request_duration_seconds', 'count') || 1;
    const averageResponseTime = (requestDurationSum / requestDurationCount) * 1000; // Convert to ms
    
    const memoryUsage = process.memoryUsage();
    const memoryUsageMb = memoryUsage.heapUsed / 1024 / 1024;
    
    const errorsTotal = this.getMetricValue(metrics, 'mcp_errors_total') || 0;
    const errorRate = requestsTotal > 0 ? (errorsTotal / requestsTotal) * 100 : 0;
    
    return {
      uptime,
      requests_per_second: Math.round(requestsPerSecond * 100) / 100,
      average_response_time: Math.round(averageResponseTime * 100) / 100,
      memory_usage_mb: Math.round(memoryUsageMb * 100) / 100,
      cpu_usage_percent: await this.getCurrentCpuUsage(),
      error_rate: Math.round(errorRate * 100) / 100,
    };
  }

  /**
   * Start collecting system metrics
   */
  private startSystemMetricsCollection(): void {
    // Update memory usage every 30 seconds
    setInterval(() => {
      const memoryUsage = process.memoryUsage();
      this.memoryUsage.labels({ type: 'heap_used' }).set(memoryUsage.heapUsed);
      this.memoryUsage.labels({ type: 'heap_total' }).set(memoryUsage.heapTotal);
      this.memoryUsage.labels({ type: 'external' }).set(memoryUsage.external);
      this.memoryUsage.labels({ type: 'rss' }).set(memoryUsage.rss);
    }, 30000);

    // Update CPU usage every 10 seconds
    this.cpuUsageInterval = setInterval(async () => {
      const cpuPercent = await this.getCurrentCpuUsage();
      this.cpuUsage.set(cpuPercent);
    }, 10000);
  }

  /**
   * Get current CPU usage percentage
   */
  private async getCurrentCpuUsage(): Promise<number> {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      const startTime = Date.now();
      
      setTimeout(() => {
        const currentUsage = process.cpuUsage(startUsage);
        const currentTime = Date.now();
        
        const elapsedTime = (currentTime - startTime) * 1000; // Convert to microseconds
        const totalUsage = currentUsage.user + currentUsage.system;
        const cpuPercent = (totalUsage / elapsedTime) * 100;
        
        resolve(Math.round(cpuPercent * 100) / 100);
      }, 100);
    });
  }

  /**
   * Get metric value from metrics array
   */
  private getMetricValue(
    metrics: any[],
    metricName: string,
    type: 'sum' | 'count' | 'value' = 'value'
  ): number | undefined {
    const metric = metrics.find(m => m.name === metricName);
    if (!metric) return undefined;

    if (metric.type === 'counter' || metric.type === 'gauge') {
      if (Array.isArray(metric.values)) {
        return metric.values.reduce((sum: number, v: any) => sum + (v.value || 0), 0);
      }
      return metric.value;
    }

    if (metric.type === 'histogram' && Array.isArray(metric.values)) {
      const sumValue = metric.values.find((v: any) => v.metricName?.endsWith('_sum'));
      const countValue = metric.values.find((v: any) => v.metricName?.endsWith('_count'));
      
      if (type === 'sum' && sumValue) return sumValue.value;
      if (type === 'count' && countValue) return countValue.value;
    }

    return undefined;
  }

  /**
   * Reset all metrics (useful for testing)
   */
  public reset(): void {
    register.clear();
  }

  /**
   * Get server uptime in milliseconds
   */
  public getUptime(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Get formatted uptime string
   */
  public getFormattedUptime(): string {
    const uptime = this.getUptime();
    const seconds = Math.floor(uptime / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Shutdown metrics service
   */
  public async shutdown(): Promise<void> {
    if (this.cpuUsageInterval) {
      clearInterval(this.cpuUsageInterval);
    }
    
    // Clear all metrics
    register.clear();
  }
}
