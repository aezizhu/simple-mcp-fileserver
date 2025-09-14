/**
 * Cache Service
 * 
 * Enterprise-grade caching service with support for both in-memory and Redis caching.
 * Provides high-performance data caching with TTL, tagging, and invalidation capabilities.
 * 
 * @author aezizhu
 * @version 1.0.0
 */

import { injectable } from 'inversify';
import NodeCache from 'node-cache';
import { createClient, RedisClientType } from 'redis';
import { CacheConfig, CacheOptions } from '@/types/mcp';

@injectable()
export class CacheService {
  private config: CacheConfig;
  private memoryCache?: NodeCache;
  private redisClient?: RedisClientType;
  private isInitialized = false;
  private readonly keyPrefix = 'mcp:cache:';

  constructor() {
    // Default configuration - will be updated during initialization
    this.config = {
      enabled: true,
      type: 'memory',
      ttl: 300, // 5 minutes
      maxSize: 1000,
    };
  }

  /**
   * Initialize cache service with configuration
   */
  public async initialize(config?: CacheConfig): Promise<void> {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    if (!this.config.enabled) {
      console.log('Cache service disabled');
      return;
    }

    try {
      if (this.config.type === 'redis') {
        await this.initializeRedis();
      } else {
        this.initializeMemoryCache();
      }
      
      this.isInitialized = true;
      console.log(`Cache service initialized: ${this.config.type}`);
    } catch (error) {
      console.error('Failed to initialize cache service:', error);
      // Fallback to memory cache
      this.config.type = 'memory';
      this.initializeMemoryCache();
      this.isInitialized = true;
    }
  }

  /**
   * Initialize Redis cache
   */
  private async initializeRedis(): Promise<void> {
    if (!this.config.redis) {
      throw new Error('Redis configuration not provided');
    }

    this.redisClient = createClient({
      socket: {
        host: this.config.redis.host,
        port: this.config.redis.port,
      },
      password: this.config.redis.password,
      database: this.config.redis.db,
    });

    this.redisClient.on('error', (error) => {
      console.error('Redis cache error:', error);
    });

    this.redisClient.on('connect', () => {
      console.log('Redis cache connected');
    });

    this.redisClient.on('disconnect', () => {
      console.warn('Redis cache disconnected');
    });

    await this.redisClient.connect();
  }

  /**
   * Initialize memory cache
   */
  private initializeMemoryCache(): void {
    this.memoryCache = new NodeCache({
      stdTTL: this.config.ttl,
      maxKeys: this.config.maxSize,
      checkperiod: 120, // Check for expired keys every 2 minutes
      useClones: false, // Better performance, but be careful with object mutations
    });

    this.memoryCache.on('expired', (key, value) => {
      console.debug(`Cache key expired: ${key}`);
    });

    this.memoryCache.on('del', (key, value) => {
      console.debug(`Cache key deleted: ${key}`);
    });
  }

  /**
   * Get value from cache
   */
  public async get<T = any>(key: string): Promise<T | null> {
    if (!this.isInitialized || !this.config.enabled) {
      return null;
    }

    const fullKey = this.keyPrefix + key;

    try {
      if (this.config.type === 'redis' && this.redisClient) {
        const value = await this.redisClient.get(fullKey);
        return value ? JSON.parse(value) : null;
      } else if (this.memoryCache) {
        return this.memoryCache.get<T>(fullKey) || null;
      }
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
    }

    return null;
  }

  /**
   * Set value in cache
   */
  public async set(
    key: string,
    value: any,
    options: CacheOptions = {}
  ): Promise<boolean> {
    if (!this.isInitialized || !this.config.enabled) {
      return false;
    }

    const fullKey = this.keyPrefix + key;
    const ttl = options.ttl || this.config.ttl;

    try {
      if (this.config.type === 'redis' && this.redisClient) {
        const serializedValue = JSON.stringify(value);
        await this.redisClient.setEx(fullKey, ttl, serializedValue);
        
        // Handle tags for Redis
        if (options.tags && options.tags.length > 0) {
          await this.setTags(key, options.tags);
        }
        
        return true;
      } else if (this.memoryCache) {
        this.memoryCache.set(fullKey, value, ttl);
        
        // Handle tags for memory cache
        if (options.tags && options.tags.length > 0) {
          await this.setTags(key, options.tags);
        }
        
        return true;
      }
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
    }

    return false;
  }

  /**
   * Delete value from cache
   */
  public async del(key: string): Promise<boolean> {
    if (!this.isInitialized || !this.config.enabled) {
      return false;
    }

    const fullKey = this.keyPrefix + key;

    try {
      if (this.config.type === 'redis' && this.redisClient) {
        const result = await this.redisClient.del(fullKey);
        await this.removeTags(key);
        return result > 0;
      } else if (this.memoryCache) {
        const result = this.memoryCache.del(fullKey);
        await this.removeTags(key);
        return result > 0;
      }
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
    }

    return false;
  }

  /**
   * Check if key exists in cache
   */
  public async has(key: string): Promise<boolean> {
    if (!this.isInitialized || !this.config.enabled) {
      return false;
    }

    const fullKey = this.keyPrefix + key;

    try {
      if (this.config.type === 'redis' && this.redisClient) {
        const exists = await this.redisClient.exists(fullKey);
        return exists === 1;
      } else if (this.memoryCache) {
        return this.memoryCache.has(fullKey);
      }
    } catch (error) {
      console.error(`Cache has error for key ${key}:`, error);
    }

    return false;
  }

  /**
   * Get multiple values from cache
   */
  public async mget<T = any>(keys: string[]): Promise<(T | null)[]> {
    if (!this.isInitialized || !this.config.enabled) {
      return keys.map(() => null);
    }

    const fullKeys = keys.map(key => this.keyPrefix + key);

    try {
      if (this.config.type === 'redis' && this.redisClient) {
        const values = await this.redisClient.mGet(fullKeys);
        return values.map(value => value ? JSON.parse(value) : null);
      } else if (this.memoryCache) {
        return fullKeys.map(key => this.memoryCache!.get<T>(key) || null);
      }
    } catch (error) {
      console.error('Cache mget error:', error);
    }

    return keys.map(() => null);
  }

  /**
   * Set multiple values in cache
   */
  public async mset(
    entries: Array<{ key: string; value: any; options?: CacheOptions }>
  ): Promise<boolean> {
    if (!this.isInitialized || !this.config.enabled) {
      return false;
    }

    try {
      const promises = entries.map(entry => 
        this.set(entry.key, entry.value, entry.options)
      );
      
      const results = await Promise.all(promises);
      return results.every(result => result === true);
    } catch (error) {
      console.error('Cache mset error:', error);
      return false;
    }
  }

  /**
   * Invalidate cache by tags
   */
  public async invalidateByTags(tags: string[]): Promise<number> {
    if (!this.isInitialized || !this.config.enabled) {
      return 0;
    }

    let deletedCount = 0;

    try {
      for (const tag of tags) {
        const keys = await this.getKeysByTag(tag);
        for (const key of keys) {
          const deleted = await this.del(key);
          if (deleted) deletedCount++;
        }
        await this.deleteTag(tag);
      }
    } catch (error) {
      console.error('Cache invalidate by tags error:', error);
    }

    return deletedCount;
  }

  /**
   * Clear all cache
   */
  public async clear(): Promise<boolean> {
    if (!this.isInitialized || !this.config.enabled) {
      return false;
    }

    try {
      if (this.config.type === 'redis' && this.redisClient) {
        await this.redisClient.flushDb();
        return true;
      } else if (this.memoryCache) {
        this.memoryCache.flushAll();
        return true;
      }
    } catch (error) {
      console.error('Cache clear error:', error);
    }

    return false;
  }

  /**
   * Get cache statistics
   */
  public async getStats(): Promise<{
    type: string;
    enabled: boolean;
    keys: number;
    hits?: number;
    misses?: number;
    memory_usage?: string;
  }> {
    const stats = {
      type: this.config.type,
      enabled: this.config.enabled && this.isInitialized,
      keys: 0,
      hits: undefined as number | undefined,
      misses: undefined as number | undefined,
      memory_usage: undefined as string | undefined,
    };

    if (!this.isInitialized || !this.config.enabled) {
      return stats;
    }

    try {
      if (this.config.type === 'redis' && this.redisClient) {
        const info = await this.redisClient.info('keyspace');
        const dbMatch = info.match(/db\d+:keys=(\d+)/);
        stats.keys = dbMatch ? parseInt(dbMatch[1], 10) : 0;
      } else if (this.memoryCache) {
        const cacheStats = this.memoryCache.getStats();
        stats.keys = cacheStats.keys;
        stats.hits = cacheStats.hits;
        stats.misses = cacheStats.misses;
        
        // Estimate memory usage
        const memoryUsage = process.memoryUsage();
        stats.memory_usage = `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`;
      }
    } catch (error) {
      console.error('Cache stats error:', error);
    }

    return stats;
  }

  /**
   * Check if cache service is healthy
   */
  public async isHealthy(): Promise<boolean> {
    if (!this.config.enabled) {
      return true; // Disabled cache is considered healthy
    }

    if (!this.isInitialized) {
      return false;
    }

    try {
      if (this.config.type === 'redis' && this.redisClient) {
        await this.redisClient.ping();
        return true;
      } else if (this.memoryCache) {
        // Memory cache is always healthy if initialized
        return true;
      }
    } catch (error) {
      console.error('Cache health check failed:', error);
      return false;
    }

    return false;
  }

  /**
   * Set tags for a cache key
   */
  private async setTags(key: string, tags: string[]): Promise<void> {
    for (const tag of tags) {
      const tagKey = `${this.keyPrefix}tag:${tag}`;
      
      if (this.config.type === 'redis' && this.redisClient) {
        await this.redisClient.sAdd(tagKey, key);
      } else if (this.memoryCache) {
        const existingKeys = this.memoryCache.get<string[]>(tagKey) || [];
        if (!existingKeys.includes(key)) {
          existingKeys.push(key);
          this.memoryCache.set(tagKey, existingKeys, 0); // No TTL for tag mappings
        }
      }
    }
  }

  /**
   * Remove tags for a cache key
   */
  private async removeTags(key: string): Promise<void> {
    // This is a simplified implementation
    // In a production system, you might want to maintain a reverse mapping
    // of keys to tags for more efficient cleanup
  }

  /**
   * Get keys by tag
   */
  private async getKeysByTag(tag: string): Promise<string[]> {
    const tagKey = `${this.keyPrefix}tag:${tag}`;
    
    try {
      if (this.config.type === 'redis' && this.redisClient) {
        return await this.redisClient.sMembers(tagKey);
      } else if (this.memoryCache) {
        return this.memoryCache.get<string[]>(tagKey) || [];
      }
    } catch (error) {
      console.error(`Error getting keys for tag ${tag}:`, error);
    }
    
    return [];
  }

  /**
   * Delete tag mapping
   */
  private async deleteTag(tag: string): Promise<void> {
    const tagKey = `${this.keyPrefix}tag:${tag}`;
    
    try {
      if (this.config.type === 'redis' && this.redisClient) {
        await this.redisClient.del(tagKey);
      } else if (this.memoryCache) {
        this.memoryCache.del(tagKey);
      }
    } catch (error) {
      console.error(`Error deleting tag ${tag}:`, error);
    }
  }

  /**
   * Shutdown cache service
   */
  public async shutdown(): Promise<void> {
    try {
      if (this.redisClient) {
        await this.redisClient.quit();
      }
      
      if (this.memoryCache) {
        this.memoryCache.flushAll();
      }
      
      this.isInitialized = false;
      console.log('Cache service shutdown completed');
    } catch (error) {
      console.error('Cache service shutdown error:', error);
    }
  }
}
