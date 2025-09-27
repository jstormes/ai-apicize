/**
 * Async utilities for Phase 4: Performance & Reliability improvements
 * Provides proper error boundaries, timeout patterns, cancellation support,
 * and resource cleanup patterns for async operations
 */

import { ApicizeError, ApicizeErrorCode } from './errors';
import { Result, success, failure } from './result';
import {
  Timer,
  defaultTimer,
  AbortControllerFactory,
  defaultAbortControllerFactory,
  AbortControllerLike
} from './timer';

/**
 * Timeout configuration
 */
export interface TimeoutConfig {
  timeout: number;
  message?: string;
  signal?: AbortSignal;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffFactor: number;
  retryIf?: (error: Error) => boolean;
  onRetry?: (attempt: number, error: Error) => void;
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
  halfOpenMaxCalls: number;
}

/**
 * Circuit breaker states
 */
export enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open',
}

/**
 * Resource cleanup interface
 */
export interface Disposable {
  dispose(): Promise<void> | void;
}

/**
 * Resource with timeout
 */
export interface TimedResource<T> extends Disposable {
  value: T;
  timeoutId?: NodeJS.Timeout;
}

/**
 * Circuit breaker implementation
 */
export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private lastFailureTime?: number;
  private halfOpenCallCount = 0;

  constructor(private config: CircuitBreakerConfig) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitBreakerState.HALF_OPEN;
        this.halfOpenCallCount = 0;
      } else {
        throw new ApicizeError(ApicizeErrorCode.CIRCUIT_BREAKER_OPEN, 'Circuit breaker is open');
      }
    }

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      if (this.halfOpenCallCount >= this.config.halfOpenMaxCalls) {
        throw new ApicizeError(
          ApicizeErrorCode.CIRCUIT_BREAKER_OPEN,
          'Circuit breaker half-open call limit exceeded'
        );
      }
      this.halfOpenCallCount++;
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private shouldAttemptReset(): boolean {
    return (
      this.lastFailureTime !== undefined &&
      Date.now() - this.lastFailureTime >= this.config.resetTimeout
    );
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = CircuitBreakerState.CLOSED;
    this.halfOpenCallCount = 0;
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (
      this.failureCount >= this.config.failureThreshold ||
      this.state === CircuitBreakerState.HALF_OPEN
    ) {
      this.state = CircuitBreakerState.OPEN;
    }
  }

  getState(): CircuitBreakerState {
    return this.state;
  }

  getMetrics() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      halfOpenCallCount: this.halfOpenCallCount,
    };
  }
}

/**
 * Resource manager for automatic cleanup
 */
export class ResourceManager {
  private resources: Set<Disposable> = new Set();
  private disposed = false;

  /**
   * Register resource for cleanup
   */
  register<T extends Disposable>(resource: T): T {
    if (this.disposed) {
      throw new Error('ResourceManager has been disposed');
    }
    this.resources.add(resource);
    return resource;
  }

  /**
   * Unregister resource
   */
  unregister(resource: Disposable): void {
    this.resources.delete(resource);
  }

  /**
   * Create a managed resource with timeout
   */
  createTimedResource<T>(value: T, timeoutMs: number, onTimeout?: () => void): TimedResource<T> {
    const resource: TimedResource<T> = {
      value,
      timeoutId: setTimeout(() => {
        onTimeout?.();
        this.unregister(resource);
        resource.dispose();
      }, timeoutMs),
      dispose: async () => {
        if (resource.timeoutId) {
          clearTimeout(resource.timeoutId);
          resource.timeoutId = undefined;
        }
      },
    };

    return this.register(resource);
  }

  /**
   * Dispose all resources
   */
  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    const promises: Promise<void>[] = [];

    for (const resource of this.resources) {
      try {
        const result = resource.dispose();
        if (result instanceof Promise) {
          promises.push(result);
        }
      } catch (error) {
        // Log error but continue cleanup
        console.error('Error disposing resource:', error);
      }
    }

    await Promise.allSettled(promises);
    this.resources.clear();
  }
}

/**
 * Async operation utilities with dependency injection for better testability
 */
export class AsyncOperations {
  constructor(
    private timer: Timer = defaultTimer,
    private abortControllerFactory: AbortControllerFactory = defaultAbortControllerFactory
  ) {}

  /**
   * Execute operation with timeout
   */
  async withTimeout<T>(
    operation: () => Promise<T>,
    config: TimeoutConfig
  ): Promise<Result<T, ApicizeError>> {
    const controller = this.abortControllerFactory.create();

    // Combine signals if one was provided
    let finalSignal = controller.signal;
    if (config.signal) {
      const combinedController = this.abortControllerFactory.create();
      const signals = [controller.signal, config.signal];

      signals.forEach(s => {
        if (!s.aborted) {
          s.addEventListener('abort', () => combinedController.abort(), { once: true });
        }
      });

      finalSignal = combinedController.signal;
    }

    // Check if already aborted
    if (finalSignal.aborted) {
      return failure(
        new ApicizeError(
          ApicizeErrorCode.OPERATION_CANCELLED,
          'Operation was cancelled before execution'
        )
      );
    }

    // Create timeout promise that rejects
    const timeoutPromise = new Promise<T>((_, reject) => {
      const timeoutId = this.timer.setTimeout(() => {
        controller.abort();
        reject(new ApicizeError(
          ApicizeErrorCode.TIMEOUT,
          config.message || `Operation timed out after ${config.timeout}ms`
        ));
      }, config.timeout);

      // Clear timeout if operation completes or is aborted
      finalSignal.addEventListener('abort', () => {
        this.timer.clearTimeout(timeoutId);
      }, { once: true });
    });

    // Race the operation against the timeout
    try {
      const result = await Promise.race([
        operation(),
        timeoutPromise
      ]);

      return success(result);
    } catch (error) {
      if (error instanceof ApicizeError) {
        return failure(error);
      }

      if (error instanceof Error && error.name === 'AbortError') {
        return failure(
          new ApicizeError(
            config.signal?.aborted
              ? ApicizeErrorCode.OPERATION_CANCELLED
              : ApicizeErrorCode.TIMEOUT,
            config.message || `Operation timed out after ${config.timeout}ms`
          )
        );
      }

      return failure(
        new ApicizeError(ApicizeErrorCode.EXECUTION_ERROR, String(error))
      );
    }
  }

  /**
   * Static method for backward compatibility
   */
  static async withTimeout<T>(
    operation: () => Promise<T>,
    config: TimeoutConfig
  ): Promise<Result<T, ApicizeError>> {
    const instance = new AsyncOperations();
    return instance.withTimeout(operation, config);
  }

  /**
   * Execute operation with retry logic
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    config: RetryConfig
  ): Promise<Result<T, ApicizeError>> {
    let lastError: Error = new Error('No attempts made');
    let delay = config.initialDelay;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        const result = await operation();
        return success(result);
      } catch (error) {
        lastError = error as Error;

        // Check if we should retry
        if (attempt < config.maxAttempts && (!config.retryIf || config.retryIf(lastError))) {
          config.onRetry?.(attempt, lastError);

          // Wait before retry using injected timer
          await this.timer.delay(delay);

          // Calculate next delay with exponential backoff
          delay = Math.min(delay * config.backoffFactor, config.maxDelay);
        } else {
          break;
        }
      }
    }

    return failure(
      lastError instanceof ApicizeError
        ? lastError
        : new ApicizeError(
            ApicizeErrorCode.EXECUTION_ERROR,
            `Operation failed after ${config.maxAttempts} attempts: ${lastError.message}`
          )
    );
  }

  /**
   * Static method for backward compatibility
   */
  static async withRetry<T>(
    operation: () => Promise<T>,
    config: RetryConfig
  ): Promise<Result<T, ApicizeError>> {
    const instance = new AsyncOperations();
    return instance.withRetry(operation, config);
  }

  /**
   * Execute operation with circuit breaker
   */
  async withCircuitBreaker<T>(
    operation: () => Promise<T>,
    circuitBreaker: CircuitBreaker
  ): Promise<Result<T, ApicizeError>> {
    try {
      const result = await circuitBreaker.execute(operation);
      return success(result);
    } catch (error) {
      return failure(
        error instanceof ApicizeError
          ? error
          : new ApicizeError(ApicizeErrorCode.EXECUTION_ERROR, String(error))
      );
    }
  }

  /**
   * Static method for backward compatibility
   */
  static async withCircuitBreaker<T>(
    operation: () => Promise<T>,
    circuitBreaker: CircuitBreaker
  ): Promise<Result<T, ApicizeError>> {
    const instance = new AsyncOperations();
    return instance.withCircuitBreaker(operation, circuitBreaker);
  }

  /**
   * Execute operations with resource management
   */
  async withResourceManagement<T>(
    operation: (resourceManager: ResourceManager) => Promise<T>
  ): Promise<Result<T, ApicizeError>> {
    const resourceManager = new ResourceManager();

    try {
      const result = await operation(resourceManager);
      return success(result);
    } catch (error) {
      return failure(
        error instanceof ApicizeError
          ? error
          : new ApicizeError(ApicizeErrorCode.EXECUTION_ERROR, String(error))
      );
    } finally {
      await resourceManager.dispose();
    }
  }

  /**
   * Static method for backward compatibility
   */
  static async withResourceManagement<T>(
    operation: (resourceManager: ResourceManager) => Promise<T>
  ): Promise<Result<T, ApicizeError>> {
    const instance = new AsyncOperations();
    return instance.withResourceManagement(operation);
  }

  /**
   * Create an async error boundary
   */
  static createErrorBoundary<T>(
    fallback: (error: ApicizeError) => T | Promise<T>
  ): (operation: () => Promise<T>) => Promise<T> {
    return async (operation: () => Promise<T>): Promise<T> => {
      try {
        return await operation();
      } catch (error) {
        const apicizeError =
          error instanceof ApicizeError
            ? error
            : new ApicizeError(ApicizeErrorCode.EXECUTION_ERROR, String(error));

        return fallback(apicizeError);
      }
    };
  }

  /**
   * Execute operations in parallel with error handling
   */
  async parallel<T>(
    operations: Array<() => Promise<T>>,
    options: {
      maxConcurrency?: number;
      stopOnFirstError?: boolean;
      timeout?: number;
    } = {}
  ): Promise<Result<T[], ApicizeError[]>> {
    const { maxConcurrency = operations.length, stopOnFirstError = false, timeout } = options;

    const results: T[] = [];
    const errors: ApicizeError[] = [];
    const executing: Promise<void>[] = [];
    let index = 0;

    const executeNext = async (): Promise<void> => {
      const currentIndex = index++;
      if (currentIndex >= operations.length) {
        return;
      }

      try {
        const operation = operations[currentIndex];
        const operationPromise = timeout
          ? this.withTimeout(operation, { timeout })
          : Promise.resolve(operation()).then(success);

        const result = await operationPromise;

        if (result.isSuccess()) {
          results[currentIndex] = result.data;
        } else {
          errors.push(result.error);
          if (stopOnFirstError) {
            throw result.error;
          }
        }
      } catch (error) {
        const apicizeError =
          error instanceof ApicizeError
            ? error
            : new ApicizeError(ApicizeErrorCode.EXECUTION_ERROR, String(error));
        errors.push(apicizeError);

        if (stopOnFirstError) {
          throw apicizeError;
        }
      }

      // Continue with next operation
      if (index < operations.length) {
        await executeNext();
      }
    };

    try {
      // Start initial batch of operations
      for (let i = 0; i < Math.min(maxConcurrency, operations.length); i++) {
        executing.push(executeNext());
      }

      await Promise.all(executing);

      if (errors.length > 0 && results.length === 0) {
        return failure(errors);
      }

      return success(results);
    } catch (error) {
      return failure([
        error instanceof ApicizeError
          ? error
          : new ApicizeError(ApicizeErrorCode.EXECUTION_ERROR, String(error)),
      ]);
    }
  }

  /**
   * Static method for backward compatibility
   */
  static async parallel<T>(
    operations: Array<() => Promise<T>>,
    options: {
      maxConcurrency?: number;
      stopOnFirstError?: boolean;
      timeout?: number;
    } = {}
  ): Promise<Result<T[], ApicizeError[]>> {
    const instance = new AsyncOperations();
    return instance.parallel(operations, options);
  }

  /**
   * Delay execution
   */
  delay(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new Error('Aborted'));
        return;
      }

      const timeoutId = this.timer.setTimeout(() => {
        resolve();
      }, ms);

      if (signal) {
        signal.addEventListener('abort', () => {
          this.timer.clearTimeout(timeoutId);
          reject(new Error('Aborted'));
        }, { once: true });
      }
    });
  }

  /**
   * Static delay method for backward compatibility
   */
  static delay(ms: number, signal?: AbortSignal): Promise<void> {
    const instance = new AsyncOperations();
    return instance.delay(ms, signal);
  }
}

/**
 * Default AsyncOperations instance
 */
export const defaultAsyncOperations = new AsyncOperations();

/**
 * Default configurations
 */
export const DEFAULT_TIMEOUT_CONFIG: TimeoutConfig = {
  timeout: 30000,
  message: 'Operation timed out',
};

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2,
};

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeout: 60000,
  monitoringPeriod: 10000,
  halfOpenMaxCalls: 3,
};
