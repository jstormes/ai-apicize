/**
 * Tests for async utilities - Phase 4 improvements
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  AsyncOperations,
  CircuitBreaker,
  ResourceManager,
  CircuitBreakerState,
  DEFAULT_RETRY_CONFIG,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
} from './async-utilities';
import { ApicizeErrorCode } from './errors';
import { MockTimer, MockAbortControllerFactory } from './timer';

describe('AsyncOperations', () => {
  let asyncOperations: AsyncOperations;
  let mockTimer: MockTimer;
  let mockAbortControllerFactory: MockAbortControllerFactory;

  beforeEach(() => {
    mockTimer = new MockTimer();
    mockAbortControllerFactory = new MockAbortControllerFactory();
    asyncOperations = new AsyncOperations(mockTimer, mockAbortControllerFactory);
  });

  afterEach(() => {
    mockTimer.reset();
  });

  describe('withTimeout', () => {
    it('should resolve when operation completes within timeout', async () => {
      const operation = () => Promise.resolve('success');
      const resultPromise = asyncOperations.withTimeout(operation, { timeout: 1000 });

      // The operation completes immediately, no need to advance timer
      const result = await resultPromise;

      expect(result.isSuccess()).toBe(true);
      if (result.isSuccess()) {
        expect(result.data).toBe('success');
      }
    });

    it('should timeout when operation takes too long', async () => {
      let operationResolve: (value: string) => void;
      const operation = () => new Promise<string>(resolve => {
        operationResolve = resolve;
        // Schedule the operation to complete after 2000ms using the mock timer
        mockTimer.setTimeout(() => resolve('success'), 2000);
      });

      const resultPromise = asyncOperations.withTimeout(operation, { timeout: 1000 });

      // Advance time by 1000ms to trigger timeout (before operation completes at 2000ms)
      mockTimer.advance(1000);

      const result = await resultPromise;

      expect(result.isFailure()).toBe(true);
      if (result.isFailure()) {
        expect(result.error.code).toBe(ApicizeErrorCode.TIMEOUT);
      }
    });

    it('should handle operation errors', async () => {
      const operation = () => Promise.reject(new Error('operation failed'));
      const result = await asyncOperations.withTimeout(operation, { timeout: 1000 });

      expect(result.isFailure()).toBe(true);
      if (result.isFailure()) {
        expect(result.error.code).toBe(ApicizeErrorCode.EXECUTION_ERROR);
      }
    });

    it('should handle abort signal', async () => {
      const controller = mockAbortControllerFactory.create();

      // Create an operation that would normally take a long time
      const operation = () => new Promise<string>((resolve, reject) => {
        mockTimer.setTimeout(() => resolve('success'), 5000);

        // Listen for abort signal and reject with AbortError
        controller.signal.addEventListener('abort', () => {
          const error = new Error('Operation was aborted');
          error.name = 'AbortError';
          reject(error);
        });
      });

      const resultPromise = asyncOperations.withTimeout(operation, {
        timeout: 10000, // Long timeout so abort signal fires first
        signal: controller.signal,
      });

      // Abort immediately
      controller.abort();

      const result = await resultPromise;

      expect(result.isFailure()).toBe(true);
      if (result.isFailure()) {
        expect(result.error.code).toBe(ApicizeErrorCode.OPERATION_CANCELLED);
      }
    }, 1000);
  });

  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const result = await asyncOperations.withRetry(operation, DEFAULT_RETRY_CONFIG);

      expect(result.isSuccess()).toBe(true);
      if (result.isSuccess()) {
        expect(result.data).toBe('success');
      }
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('success');

      // Start the retry operation in the background
      const resultPromise = asyncOperations.withRetry(operation, DEFAULT_RETRY_CONFIG);

      // Advance time step by step to trigger delays between retries
      // First attempt fails immediately, then waits initialDelay
      await new Promise(resolve => setTimeout(resolve, 1)); // Let first attempt start
      mockTimer.advance(DEFAULT_RETRY_CONFIG.initialDelay);

      // Second attempt fails, waits for backoff delay
      await new Promise(resolve => setTimeout(resolve, 1)); // Let second attempt start
      mockTimer.advance(DEFAULT_RETRY_CONFIG.initialDelay * DEFAULT_RETRY_CONFIG.backoffFactor);

      // Third attempt should succeed
      const result = await resultPromise;

      expect(result.isSuccess()).toBe(true);
      if (result.isSuccess()) {
        expect(result.data).toBe('success');
      }
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should fail after max attempts', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('always fails'));

      // Start the retry operation
      const retryPromise = asyncOperations.withRetry(operation, {
        ...DEFAULT_RETRY_CONFIG,
        maxAttempts: 2,
        initialDelay: 100, // Shorter delay for test
      });

      // Let first attempt fail and wait for delay
      await new Promise(resolve => setTimeout(resolve, 1));
      mockTimer.advance(100);

      const result = await retryPromise;

      expect(result.isFailure()).toBe(true);
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should call onRetry callback', async () => {
      const onRetry = jest.fn();
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');

      // Start the retry operation
      const retryPromise = asyncOperations.withRetry(operation, {
        ...DEFAULT_RETRY_CONFIG,
        onRetry,
        initialDelay: 100, // Shorter delay for test
      });

      // Let first attempt fail and wait for delay
      await new Promise(resolve => setTimeout(resolve, 1));
      mockTimer.advance(100);

      await retryPromise;

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
    });

    it('should use retryIf condition', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('non-retryable'));
      const retryIf = jest.fn().mockReturnValue(false);

      const result = await asyncOperations.withRetry(operation, {
        ...DEFAULT_RETRY_CONFIG,
        retryIf,
      });

      expect(result.isFailure()).toBe(true);
      expect(operation).toHaveBeenCalledTimes(1);
      expect(retryIf).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('parallel', () => {
    it('should execute operations in parallel', async () => {
      const operations = [
        () => Promise.resolve(1),
        () => Promise.resolve(2),
        () => Promise.resolve(3),
      ];

      const result = await asyncOperations.parallel(operations);

      expect(result.isSuccess()).toBe(true);
      if (result.isSuccess()) {
        expect(result.data).toEqual([1, 2, 3]);
      }
    });

    it('should handle mixed success and failure', async () => {
      const operations = [
        () => Promise.resolve(1),
        () => Promise.reject(new Error('failed')),
        () => Promise.resolve(3),
      ];

      const result = await asyncOperations.parallel(operations);

      expect(result.isSuccess()).toBe(true);
      if (result.isSuccess()) {
        expect(result.data).toEqual([1, undefined, 3]);
      }
    });

    it('should stop on first error when configured', async () => {
      const operations = [
        () => Promise.resolve(1),
        () => Promise.reject(new Error('failed')),
        () => Promise.resolve(3),
      ];

      const result = await asyncOperations.parallel(operations, {
        stopOnFirstError: true,
      });

      expect(result.isFailure()).toBe(true);
    });

    it('should respect max concurrency', async () => {
      let concurrent = 0;
      let maxConcurrent = 0;

      const operations = Array(5)
        .fill(0)
        .map(() => async () => {
          concurrent++;
          maxConcurrent = Math.max(maxConcurrent, concurrent);
          await new Promise(resolve => setTimeout(resolve, 10));
          concurrent--;
          return 'done';
        });

      await asyncOperations.parallel(operations, { maxConcurrency: 2 });

      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });
  });

  describe('delay', () => {
    it('should delay execution', async () => {
      const delayPromise = asyncOperations.delay(100);

      // Use mock timer to advance time
      mockTimer.advance(100);
      await delayPromise;

      expect(mockTimer.getPendingTimeouts()).toBe(0);
    });

    it('should handle abort signal', async () => {
      const controller = mockAbortControllerFactory.create();
      const delayPromise = asyncOperations.delay(1000, controller.signal);

      controller.abort();

      await expect(delayPromise).rejects.toThrow('Aborted');
    });
  });
});

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker(DEFAULT_CIRCUIT_BREAKER_CONFIG);
  });

  it('should start in closed state', () => {
    expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
  });

  it('should open after failure threshold', async () => {
    const failingOperation = () => Promise.reject(new Error('fail'));

    // Exceed failure threshold
    for (let i = 0; i < DEFAULT_CIRCUIT_BREAKER_CONFIG.failureThreshold; i++) {
      try {
        await circuitBreaker.execute(failingOperation);
      } catch {
        // Expected to fail
      }
    }

    expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
  });

  it('should reject requests when open', async () => {
    const operation = () => Promise.resolve('success');

    // Force open state
    for (let i = 0; i < DEFAULT_CIRCUIT_BREAKER_CONFIG.failureThreshold; i++) {
      try {
        await circuitBreaker.execute(() => Promise.reject(new Error('fail')));
      } catch {
        // Expected to fail
      }
    }

    await expect(circuitBreaker.execute(operation)).rejects.toThrow();
    expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
  });

  it('should transition to half-open after reset timeout', async () => {
    jest.useFakeTimers();

    // Force open state
    for (let i = 0; i < DEFAULT_CIRCUIT_BREAKER_CONFIG.failureThreshold; i++) {
      try {
        await circuitBreaker.execute(() => Promise.reject(new Error('fail')));
      } catch {
        // Expected to fail
      }
    }

    expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);

    // Mock time passage
    jest.advanceTimersByTime(DEFAULT_CIRCUIT_BREAKER_CONFIG.resetTimeout + 1000);

    const operation = () => Promise.resolve('success');
    const result = await circuitBreaker.execute(operation);

    expect(result).toBe('success');
    expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);

    jest.useRealTimers();
  });

  it('should provide metrics', () => {
    const metrics = circuitBreaker.getMetrics();

    expect(metrics).toHaveProperty('state');
    expect(metrics).toHaveProperty('failureCount');
    expect(metrics).toHaveProperty('lastFailureTime');
    expect(metrics).toHaveProperty('halfOpenCallCount');
  });
});

describe('ResourceManager', () => {
  let resourceManager: ResourceManager;

  beforeEach(() => {
    resourceManager = new ResourceManager();
  });

  afterEach(async () => {
    await resourceManager.dispose();
  });

  it('should register and dispose resources', async () => {
    const dispose = jest.fn();
    const resource = { dispose };

    resourceManager.register(resource);
    await resourceManager.dispose();

    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('should create timed resources', async () => {
    jest.useFakeTimers();

    const onTimeout = jest.fn();
    const resource = resourceManager.createTimedResource('value', 1000, onTimeout);

    expect(resource.value).toBe('value');
    expect(resource.timeoutId).toBeDefined();

    jest.advanceTimersByTime(1000);

    expect(onTimeout).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });

  it('should handle resource disposal errors gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const resource = {
      dispose: () => {
        throw new Error('disposal error');
      },
    };

    resourceManager.register(resource);
    await resourceManager.dispose(); // Should not throw

    expect(consoleSpy).toHaveBeenCalledWith('Error disposing resource:', expect.any(Error));
    consoleSpy.mockRestore();
  });

  it('should prevent operations after disposal', () => {
    resourceManager.dispose();

    expect(() => resourceManager.register({ dispose: () => {} })).toThrow();
  });
});

describe('Integration tests', () => {
  let asyncOperations: AsyncOperations;
  let mockTimer: MockTimer;
  let mockAbortControllerFactory: MockAbortControllerFactory;

  beforeEach(() => {
    mockTimer = new MockTimer();
    mockAbortControllerFactory = new MockAbortControllerFactory();
    asyncOperations = new AsyncOperations(mockTimer, mockAbortControllerFactory);
  });

  afterEach(() => {
    mockTimer.reset();
  });

  it('should combine timeout, retry, and circuit breaker', async () => {
    const circuitBreaker = new CircuitBreaker({
      ...DEFAULT_CIRCUIT_BREAKER_CONFIG,
      failureThreshold: 2,
    });

    let attempts = 0;
    const operation = () => {
      attempts++;
      if (attempts <= 3) {
        return Promise.reject(new Error('fail'));
      }
      return Promise.resolve('success');
    };

    // First, use retry with timeout
    const retryPromise = asyncOperations.withRetry(
      async () => {
        const result = await asyncOperations.withTimeout(operation, { timeout: 1000 });
        if (result.isFailure()) {
          throw result.error;
        }
        return result.data;
      },
      {
        maxAttempts: 5,
        initialDelay: 10,
        maxDelay: 100,
        backoffFactor: 1.5,
      }
    );

    // Let first attempts fail and advance time for retries
    await new Promise(resolve => setTimeout(resolve, 1)); // Let first attempt fail
    mockTimer.advance(10); // First delay
    await new Promise(resolve => setTimeout(resolve, 1)); // Let second attempt fail
    mockTimer.advance(15); // Second delay (10 * 1.5)
    await new Promise(resolve => setTimeout(resolve, 1)); // Let third attempt fail
    mockTimer.advance(23); // Third delay (15 * 1.5)

    const retryResult = await retryPromise;

    expect(retryResult.isSuccess()).toBe(true);
    expect(attempts).toBe(4);

    // Then, use circuit breaker
    const circuitBreakerResult = await asyncOperations.withCircuitBreaker(
      () => Promise.resolve('circuit-breaker-success'),
      circuitBreaker
    );

    expect(circuitBreakerResult.isSuccess()).toBe(true);
    if (circuitBreakerResult.isSuccess()) {
      expect(circuitBreakerResult.data).toBe('circuit-breaker-success');
    }
  });

  it('should work with resource management', async () => {
    const result = await asyncOperations.withResourceManagement(async resourceManager => {
      const resource1 = resourceManager.register({
        dispose: jest.fn(),
      });

      const resource2 = resourceManager.createTimedResource('test', 5000);

      return { resource1, resource2 };
    });

    expect(result.isSuccess()).toBe(true);
    if (result.isSuccess()) {
      expect(result.data.resource1).toBeDefined();
      expect(result.data.resource2.value).toBe('test');
    }
  });
});
