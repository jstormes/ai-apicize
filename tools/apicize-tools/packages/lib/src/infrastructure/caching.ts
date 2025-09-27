/**
 * Smart caching system for Phase 4: Performance & Reliability improvements
 * Provides intelligent caching for parsed configs, schemas, and expensive operations
 */

import { ApicizeError, ApicizeErrorCode } from './errors';
import { Result, success, failure } from './result';
import { AsyncOperations, TimeoutConfig, defaultAsyncOperations } from './async-utilities';

/**
 * Cache entry with metadata
 */
export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
  ttl?: number;
  size?: number;
  tags?: Set<string>;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  totalEntries: number;
  totalSize: number;
  hitRate: number;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  maxSize?: number;
  maxEntries?: number;
  defaultTtl?: number;
  cleanupInterval?: number;
  enableMetrics?: boolean;
  enableLRU?: boolean;
  compressionThreshold?: number;
}

/**
 * Eviction policy interface
 */
export interface EvictionPolicy<T> {
  shouldEvict(entry: CacheEntry<T>, config: CacheConfig): boolean;
  compare(a: CacheEntry<T>, b: CacheEntry<T>): number;
}

/**
 * LRU (Least Recently Used) eviction policy
 */
export class LRUEvictionPolicy<T> implements EvictionPolicy<T> {
  shouldEvict(entry: CacheEntry<T>, config: CacheConfig): boolean {
    if (config.defaultTtl && entry.ttl) {
      return Date.now() - entry.timestamp > entry.ttl;
    }
    return false;
  }

  compare(a: CacheEntry<T>, b: CacheEntry<T>): number {
    return a.lastAccessed - b.lastAccessed;
  }
}

/**
 * TTL (Time To Live) eviction policy
 */
export class TTLEvictionPolicy<T> implements EvictionPolicy<T> {
  shouldEvict(entry: CacheEntry<T>, config: CacheConfig): boolean {
    const ttl = entry.ttl || config.defaultTtl || Infinity;
    return Date.now() - entry.timestamp > ttl;
  }

  compare(a: CacheEntry<T>, b: CacheEntry<T>): number {
    const aTtl = a.ttl || Infinity;
    const bTtl = b.ttl || Infinity;
    return a.timestamp + aTtl - (b.timestamp + bTtl);
  }
}

/**
 * Size-based eviction policy
 */
export class SizeEvictionPolicy<T> implements EvictionPolicy<T> {
  shouldEvict(entry: CacheEntry<T>, config: CacheConfig): boolean {
    return config.maxSize !== undefined && (entry.size || 0) > config.maxSize;
  }

  compare(a: CacheEntry<T>, b: CacheEntry<T>): number {
    return (b.size || 0) - (a.size || 0); // Largest first
  }
}

/**
 * Multi-level cache implementation
 */
export class SmartCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private config: Required<CacheConfig>;
  private evictionPolicy: EvictionPolicy<T>;
  private stats: CacheStats;
  private cleanupTimer?: NodeJS.Timeout;
  private asyncOperations: AsyncOperations;

  constructor(
    config: CacheConfig = {},
    evictionPolicy?: EvictionPolicy<T>,
    asyncOperations?: AsyncOperations
  ) {
    this.config = {
      maxSize: 100 * 1024 * 1024, // 100MB
      maxEntries: 1000,
      defaultTtl: 60 * 60 * 1000, // 1 hour
      cleanupInterval: 5 * 60 * 1000, // 5 minutes
      enableMetrics: true,
      enableLRU: true,
      compressionThreshold: 1024, // 1KB
      ...config,
    };

    this.evictionPolicy = evictionPolicy || new LRUEvictionPolicy<T>();
    this.asyncOperations = asyncOperations || defaultAsyncOperations;
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalEntries: 0,
      totalSize: 0,
      hitRate: 0,
    };

    if (this.config.cleanupInterval > 0) {
      this.startCleanupTimer();
    }
  }

  /**
   * Get value from cache
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return undefined;
    }

    // Check if expired
    if (this.evictionPolicy.shouldEvict(entry, this.config)) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.evictions++;
      this.updateStats();
      return undefined;
    }

    // Update access info
    entry.accessCount++;
    entry.lastAccessed = Date.now();

    this.stats.hits++;
    this.updateHitRate();

    return entry.value;
  }

  /**
   * Set value in cache
   */
  set(key: string, value: T, options: { ttl?: number; tags?: string[] } = {}): void {
    // Calculate size if needed
    const size = this.config.maxSize ? this.calculateSize(value) : undefined;

    // Check if we need to make space
    if (this.shouldEvictForSpace(size)) {
      this.evictEntries();
    }

    const entry: CacheEntry<T> = {
      value,
      timestamp: Date.now(),
      accessCount: 1,
      lastAccessed: Date.now(),
      ttl: options.ttl,
      size,
      tags: options.tags ? new Set(options.tags) : undefined,
    };

    this.cache.set(key, entry);
    this.updateStats();
  }

  /**
   * Get or compute value
   */
  async getOrCompute<K extends string>(
    key: K,
    computer: () => Promise<T>,
    options: { ttl?: number; tags?: string[]; timeout?: number } = {}
  ): Promise<Result<T, ApicizeError>> {
    // Try to get from cache first
    const cached = this.get(key);
    if (cached !== undefined) {
      return success(cached);
    }

    try {
      // Compute the value
      let result: T;
      if (options.timeout) {
        const timeoutConfig: TimeoutConfig = {
          timeout: options.timeout,
          message: `Cache computation timed out for key: ${key}`,
        };
        const computeResult = await this.asyncOperations.withTimeout(computer, timeoutConfig);
        if (computeResult.isFailure()) {
          return computeResult as any;
        }
        result = computeResult.data;
      } else {
        result = await computer();
      }

      // Store in cache
      this.set(key, result, options);
      return success(result);
    } catch (error) {
      return failure(
        error instanceof ApicizeError
          ? error
          : new ApicizeError(
              ApicizeErrorCode.EXECUTION_ERROR,
              `Failed to compute cache value for key: ${key}`
            )
      );
    }
  }

  /**
   * Check if key exists in cache (without updating access stats)
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    // Check if expired
    if (this.evictionPolicy.shouldEvict(entry, this.config)) {
      this.cache.delete(key);
      this.stats.evictions++;
      this.updateStats();
      return false;
    }

    return true;
  }

  /**
   * Delete entry from cache
   */
  delete(key: string): boolean {
    const result = this.cache.delete(key);
    if (result) {
      this.updateStats();
    }
    return result;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
    this.updateStats();
  }

  /**
   * Get all keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Invalidate entries by tag
   */
  invalidateByTag(tag: string): number {
    let invalidated = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags?.has(tag)) {
        this.cache.delete(key);
        invalidated++;
      }
    }
    this.updateStats();
    return invalidated;
  }

  /**
   * Cleanup expired entries
   */
  cleanup(): number {
    let cleaned = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (this.evictionPolicy.shouldEvict(entry, this.config)) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      this.stats.evictions += cleaned;
      this.updateStats();
    }
    return cleaned;
  }

  /**
   * Optimize cache by removing least useful entries
   */
  optimize(): number {
    const targetSize = Math.floor(this.config.maxEntries * 0.8);
    if (this.cache.size <= targetSize) {
      return 0;
    }

    const entries = Array.from(this.cache.entries());
    entries.sort(([, a], [, b]) => this.evictionPolicy.compare(a, b));

    const toRemove = entries.slice(0, this.cache.size - targetSize);
    for (const [key] of toRemove) {
      this.cache.delete(key);
    }

    this.stats.evictions += toRemove.length;
    this.updateStats();
    return toRemove.length;
  }

  /**
   * Dispose cache and cleanup resources
   */
  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.clear();
  }

  // Private methods

  private calculateSize(value: T): number {
    try {
      return JSON.stringify(value).length * 2; // Rough estimate (UTF-16)
    } catch {
      return 1024; // Default size if can't serialize
    }
  }

  private shouldEvictForSpace(newEntrySize?: number): boolean {
    const wouldExceedEntries = this.cache.size >= this.config.maxEntries;
    const wouldExceedSize =
      newEntrySize && this.stats.totalSize + newEntrySize > this.config.maxSize;
    return wouldExceedEntries || !!wouldExceedSize;
  }

  private evictEntries(): void {
    // Remove expired entries first
    this.cleanup();

    // If still need space, use eviction policy
    if (this.cache.size >= this.config.maxEntries) {
      this.optimize();
    }
  }

  private updateStats(): void {
    this.stats.totalEntries = this.cache.size;
    this.stats.totalSize = Array.from(this.cache.values()).reduce(
      (total, entry) => total + (entry.size || 0),
      0
    );
    this.updateHitRate();
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }
}

/**
 * Memoization decorator for expensive operations
 */
export class Memoizer {
  private cache = new SmartCache<any>();

  constructor(private config: CacheConfig = {}) {
    this.cache = new SmartCache(config);
  }

  /**
   * Memoize a function
   */
  memoize<TArgs extends any[], TReturn>(
    fn: (...args: TArgs) => TReturn | Promise<TReturn>,
    keyGenerator?: (...args: TArgs) => string
  ): (...args: TArgs) => Promise<TReturn> {
    return async (...args: TArgs): Promise<TReturn> => {
      const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);

      // Try cache first
      const cached = this.cache.get(key);
      if (cached !== undefined) {
        return cached;
      }

      // Compute and cache
      const result = await fn(...args);
      this.cache.set(key, result);
      return result;
    };
  }

  /**
   * Memoize with custom TTL
   */
  memoizeWithTTL<TArgs extends any[], TReturn>(
    fn: (...args: TArgs) => TReturn | Promise<TReturn>,
    ttl: number,
    keyGenerator?: (...args: TArgs) => string
  ): (...args: TArgs) => Promise<TReturn> {
    return async (...args: TArgs): Promise<TReturn> => {
      const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);

      const result = await this.cache.getOrCompute(key, () => Promise.resolve(fn(...args)), {
        ttl,
      });

      if (result.isFailure()) {
        throw result.error;
      }

      return result.data;
    };
  }

  /**
   * Clear memoization cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return this.cache.getStats();
  }

  /**
   * Dispose memoizer
   */
  dispose(): void {
    this.cache.dispose();
  }
}

/**
 * Global cache manager for different cache types
 */
export class CacheManager {
  private caches = new Map<string, SmartCache<any>>();

  /**
   * Get or create a named cache
   */
  getCache<T>(name: string, config?: CacheConfig): SmartCache<T> {
    if (!this.caches.has(name)) {
      this.caches.set(name, new SmartCache<T>(config));
    }
    return this.caches.get(name)!;
  }

  /**
   * Create a specialized cache for configs
   */
  getConfigCache(): SmartCache<any> {
    return this.getCache('configs', {
      maxEntries: 100,
      defaultTtl: 30 * 60 * 1000, // 30 minutes
      enableLRU: true,
    });
  }

  /**
   * Create a specialized cache for schemas
   */
  getSchemaCache(): SmartCache<any> {
    return this.getCache('schemas', {
      maxEntries: 50,
      defaultTtl: 60 * 60 * 1000, // 1 hour
      enableLRU: true,
    });
  }

  /**
   * Create a specialized cache for parsed data
   */
  getParseCache(): SmartCache<any> {
    return this.getCache('parsed', {
      maxEntries: 200,
      defaultTtl: 15 * 60 * 1000, // 15 minutes
      enableLRU: true,
    });
  }

  /**
   * Get aggregate statistics from all caches
   */
  getGlobalStats(): Record<string, CacheStats> {
    const stats: Record<string, CacheStats> = {};
    for (const [name, cache] of this.caches.entries()) {
      stats[name] = cache.getStats();
    }
    return stats;
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    for (const cache of this.caches.values()) {
      cache.clear();
    }
  }

  /**
   * Dispose all caches
   */
  dispose(): void {
    for (const cache of this.caches.values()) {
      cache.dispose();
    }
    this.caches.clear();
  }
}

// Global cache manager instance
export const globalCacheManager = new CacheManager();
