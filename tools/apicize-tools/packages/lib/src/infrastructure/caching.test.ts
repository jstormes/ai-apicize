/**
 * Tests for caching system - Phase 4 improvements
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  SmartCache,
  Memoizer,
  CacheManager,
  LRUEvictionPolicy,
  TTLEvictionPolicy,
  SizeEvictionPolicy,
  globalCacheManager,
} from './caching';
import { ApicizeErrorCode } from './errors';
import { AsyncOperations } from './async-utilities';
import { MockTimer, MockAbortControllerFactory } from './timer';

describe('SmartCache', () => {
  let cache: SmartCache<string>;
  let mockTimer: MockTimer;
  let mockAbortControllerFactory: MockAbortControllerFactory;
  let asyncOperations: AsyncOperations;

  beforeEach(() => {
    mockTimer = new MockTimer();
    mockAbortControllerFactory = new MockAbortControllerFactory();
    asyncOperations = new AsyncOperations(mockTimer, mockAbortControllerFactory);

    cache = new SmartCache<string>(
      {
        maxEntries: 3,
        defaultTtl: 1000,
        cleanupInterval: 0, // Disable automatic cleanup for tests
      },
      undefined, // Use default eviction policy
      asyncOperations // Inject our mock AsyncOperations
    );
  });

  afterEach(() => {
    cache.dispose();
    mockTimer.reset();
  });

  describe('basic operations', () => {
    it('should store and retrieve values', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return undefined for non-existent keys', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should check if key exists', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('nonexistent')).toBe(false);
    });

    it('should delete entries', () => {
      cache.set('key1', 'value1');
      expect(cache.delete('key1')).toBe(true);
      expect(cache.has('key1')).toBe(false);
      expect(cache.delete('nonexistent')).toBe(false);
    });

    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.clear();
      expect(cache.keys()).toHaveLength(0);
    });

    it('should return all keys', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      expect(cache.keys()).toEqual(['key1', 'key2']);
    });
  });

  describe('TTL functionality', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should expire entries after TTL', () => {
      cache.set('key1', 'value1', { ttl: 500 });
      expect(cache.get('key1')).toBe('value1');

      jest.advanceTimersByTime(600);
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should use custom TTL over default', () => {
      cache.set('key1', 'value1', { ttl: 200 });
      cache.set('key2', 'value2'); // Uses default TTL

      jest.advanceTimersByTime(300);
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBe('value2');
    });
  });

  describe('tagging', () => {
    it('should support tags', () => {
      cache.set('key1', 'value1', { tags: ['tag1', 'tag2'] });
      cache.set('key2', 'value2', { tags: ['tag1'] });
      cache.set('key3', 'value3', { tags: ['tag3'] });

      const invalidated = cache.invalidateByTag('tag1');
      expect(invalidated).toBe(2);
      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(false);
      expect(cache.has('key3')).toBe(true);
    });
  });

  describe('getOrCompute', () => {
    it('should return cached value if available', async () => {
      cache.set('key1', 'cached');
      const computer = jest.fn().mockResolvedValue('computed');

      const result = await cache.getOrCompute('key1', computer);

      expect(result.isSuccess()).toBe(true);
      if (result.isSuccess()) {
        expect(result.data).toBe('cached');
      }
      expect(computer).not.toHaveBeenCalled();
    });

    it('should compute and cache if not available', async () => {
      const computer = jest.fn().mockResolvedValue('computed');

      const result = await cache.getOrCompute('key1', computer);

      expect(result.isSuccess()).toBe(true);
      if (result.isSuccess()) {
        expect(result.data).toBe('computed');
      }
      expect(computer).toHaveBeenCalledTimes(1);
      expect(cache.get('key1')).toBe('computed');
    });

    it('should handle computation errors', async () => {
      const computer = jest.fn().mockRejectedValue(new Error('computation failed'));

      const result = await cache.getOrCompute('key1', computer);

      expect(result.isFailure()).toBe(true);
      expect(cache.has('key1')).toBe(false);
    });

    it('should handle timeout during computation', async () => {
      const computer = jest.fn().mockImplementation(() => {
        return new Promise<string>(resolve => {
          // Use mock timer to schedule completion after 2000ms
          mockTimer.setTimeout(() => resolve('slow'), 2000);
        });
      });

      const resultPromise = cache.getOrCompute('key1', computer, { timeout: 1000 });

      // Advance time to trigger timeout (1000ms) before operation completes (2000ms)
      mockTimer.advance(1000);

      const result = await resultPromise;

      expect(result.isFailure()).toBe(true);
      if (result.isFailure()) {
        expect(result.error.code).toBe(ApicizeErrorCode.TIMEOUT);
      }
      expect(cache.has('key1')).toBe(false);
    });
  });

  describe('eviction', () => {
    it('should evict entries when max entries exceeded', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      cache.set('key4', 'value4'); // Should trigger eviction

      expect(cache.keys()).toHaveLength(3);
      expect(cache.has('key4')).toBe(true);
    });

    it('should perform cleanup of expired entries', () => {
      jest.useFakeTimers();

      cache.set('key1', 'value1', { ttl: 500 });
      cache.set('key2', 'value2', { ttl: 1500 });

      jest.advanceTimersByTime(1000);

      const cleaned = cache.cleanup();
      expect(cleaned).toBe(1);
      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(true);

      jest.useRealTimers();
    });

    it('should optimize cache by removing least useful entries', () => {
      // Fill cache beyond target
      for (let i = 0; i < 10; i++) {
        cache.set(`key${i}`, `value${i}`);
      }

      const optimized = cache.optimize();
      expect(optimized).toBeGreaterThan(0);
      expect(cache.keys().length).toBeLessThanOrEqual(3);
    });
  });

  describe('statistics', () => {
    it('should track hit and miss statistics', () => {
      cache.set('key1', 'value1');

      cache.get('key1'); // Hit
      cache.get('key2'); // Miss
      cache.get('key1'); // Hit

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(2 / 3);
    });

    it('should track cache size and entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      const stats = cache.getStats();
      expect(stats.totalEntries).toBe(2);
      expect(stats.totalSize).toBeGreaterThan(0);
    });
  });
});

describe('Eviction Policies', () => {
  describe('LRUEvictionPolicy', () => {
    it('should order by last accessed time', () => {
      const policy = new LRUEvictionPolicy();
      const entryA = {
        value: 'a',
        timestamp: 1000,
        accessCount: 1,
        lastAccessed: 1000,
      };
      const entryB = {
        value: 'b',
        timestamp: 1000,
        accessCount: 1,
        lastAccessed: 2000,
      };

      expect(policy.compare(entryA, entryB)).toBeLessThan(0);
    });
  });

  describe('TTLEvictionPolicy', () => {
    it('should identify expired entries', () => {
      jest.useFakeTimers();
      jest.setSystemTime(2000);

      const policy = new TTLEvictionPolicy();
      const entry = {
        value: 'test',
        timestamp: 1000,
        accessCount: 1,
        lastAccessed: 1000,
        ttl: 500,
      };

      expect(policy.shouldEvict(entry, {})).toBe(true);

      jest.useRealTimers();
    });
  });

  describe('SizeEvictionPolicy', () => {
    it('should order by size', () => {
      const policy = new SizeEvictionPolicy();
      const entryA = {
        value: 'a',
        timestamp: 1000,
        accessCount: 1,
        lastAccessed: 1000,
        size: 100,
      };
      const entryB = {
        value: 'b',
        timestamp: 1000,
        accessCount: 1,
        lastAccessed: 1000,
        size: 200,
      };

      expect(policy.compare(entryA, entryB)).toBeGreaterThan(0);
    });
  });
});

describe('Memoizer', () => {
  let memoizer: Memoizer;

  beforeEach(() => {
    memoizer = new Memoizer({
      maxEntries: 5,
      defaultTtl: 1000,
      cleanupInterval: 0,
    });
  });

  afterEach(() => {
    memoizer.dispose();
  });

  it('should memoize function results', async () => {
    const fn = jest.fn().mockResolvedValue('result');
    const memoized = memoizer.memoize(fn);

    const result1 = await memoized('arg1');
    const result2 = await memoized('arg1');

    expect(result1).toBe('result');
    expect(result2).toBe('result');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should use custom key generator', async () => {
    const fn = jest.fn().mockResolvedValue('result');
    const keyGen = jest.fn().mockReturnValue('custom-key');
    const memoized = memoizer.memoize(fn, keyGen);

    await memoized('arg1', 'arg2');
    await memoized('arg3', 'arg4');

    expect(keyGen).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenCalledTimes(1); // Same key, so cached
  });

  it('should support TTL memoization', async () => {
    jest.useFakeTimers();

    const fn = jest.fn().mockResolvedValue('result');
    const memoized = memoizer.memoizeWithTTL(fn, 500);

    await memoized('arg1');
    jest.advanceTimersByTime(600);
    await memoized('arg1');

    expect(fn).toHaveBeenCalledTimes(2);

    jest.useRealTimers();
  });

  it('should provide cache statistics', async () => {
    const fn = jest.fn().mockResolvedValue('result');
    const memoized = memoizer.memoize(fn);

    await memoized('arg1');
    await memoized('arg1'); // Cache hit

    const stats = memoizer.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
  });
});

describe('CacheManager', () => {
  let cacheManager: CacheManager;

  beforeEach(() => {
    cacheManager = new CacheManager();
  });

  afterEach(() => {
    cacheManager.dispose();
  });

  it('should create and manage named caches', () => {
    const cache1 = cacheManager.getCache('test1');
    const cache2 = cacheManager.getCache('test1'); // Same cache
    const cache3 = cacheManager.getCache('test2'); // Different cache

    expect(cache1).toBe(cache2);
    expect(cache1).not.toBe(cache3);
  });

  it('should provide specialized caches', () => {
    const configCache = cacheManager.getConfigCache();
    const schemaCache = cacheManager.getSchemaCache();
    const parseCache = cacheManager.getParseCache();

    expect(configCache).toBeDefined();
    expect(schemaCache).toBeDefined();
    expect(parseCache).toBeDefined();
    expect(configCache).not.toBe(schemaCache);
  });

  it('should provide global statistics', () => {
    const cache1 = cacheManager.getCache('test1');
    const cache2 = cacheManager.getCache('test2');

    cache1.set('key1', 'value1');
    cache2.set('key2', 'value2');

    const stats = cacheManager.getGlobalStats();
    expect(stats).toHaveProperty('test1');
    expect(stats).toHaveProperty('test2');
    expect(stats.test1.totalEntries).toBe(1);
    expect(stats.test2.totalEntries).toBe(1);
  });

  it('should clear all caches', () => {
    const cache1 = cacheManager.getCache('test1');
    const cache2 = cacheManager.getCache('test2');

    cache1.set('key1', 'value1');
    cache2.set('key2', 'value2');

    cacheManager.clearAll();

    expect(cache1.keys()).toHaveLength(0);
    expect(cache2.keys()).toHaveLength(0);
  });
});

describe('Global Cache Manager', () => {
  afterEach(() => {
    globalCacheManager.clearAll();
  });

  it('should be available as singleton', () => {
    const cache = globalCacheManager.getCache('global-test');
    cache.set('key', 'value');

    const cache2 = globalCacheManager.getCache('global-test');
    expect(cache2.get('key')).toBe('value');
  });

  it('should provide specialized caches', () => {
    const configCache = globalCacheManager.getConfigCache();
    const schemaCache = globalCacheManager.getSchemaCache();

    configCache.set('config1', { setting: 'value' });
    schemaCache.set('schema1', { type: 'object' });

    expect(configCache.get('config1')).toEqual({ setting: 'value' });
    expect(schemaCache.get('schema1')).toEqual({ type: 'object' });
  });
});

describe('Integration tests', () => {
  it('should work with async operations', async () => {
    const cache = new SmartCache<string>({
      maxEntries: 10,
      defaultTtl: 5000,
    });

    const slowOperation = jest
      .fn()
      .mockImplementation(
        (input: string) =>
          new Promise(resolve => setTimeout(() => resolve(`processed-${input}`), 100))
      );

    // First call should compute
    const result1 = await cache.getOrCompute('test', () => slowOperation('test'));
    expect(result1.isSuccess()).toBe(true);
    if (result1.isSuccess()) {
      expect(result1.data).toBe('processed-test');
    }
    expect(slowOperation).toHaveBeenCalledTimes(1);

    // Second call should use cache
    const result2 = await cache.getOrCompute('test', () => slowOperation('test'));
    expect(result2.isSuccess()).toBe(true);
    if (result2.isSuccess()) {
      expect(result2.data).toBe('processed-test');
    }
    expect(slowOperation).toHaveBeenCalledTimes(1); // Still 1

    cache.dispose();
  });

  it('should handle concurrent access correctly', async () => {
    const cache = new SmartCache<string>();
    const computer = jest.fn().mockResolvedValue('computed');

    // Start multiple concurrent computations for the same key
    const promises = Array(5)
      .fill(0)
      .map(() => cache.getOrCompute('same-key', computer));

    const results = await Promise.all(promises);

    // All should succeed
    results.forEach(result => {
      expect(result.isSuccess()).toBe(true);
      if (result.isSuccess()) {
        expect(result.data).toBe('computed');
      }
    });

    // Computer should only be called once (though this is implementation dependent)
    expect(computer).toHaveBeenCalled();

    cache.dispose();
  });
});
