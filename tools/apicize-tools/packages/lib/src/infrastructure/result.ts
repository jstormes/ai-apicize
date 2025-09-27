/**
 * Result pattern for operations that can fail
 * Provides a type-safe way to handle success and error cases
 */

import { ApicizeError, toApicizeError } from './errors';

/**
 * Result type representing either success with data or failure with error
 */
export type Result<T, E = ApicizeError> = Success<T> | Failure<E>;

/**
 * Success result containing data
 */
export class Success<T> {
  readonly success = true;
  readonly failure = false;

  constructor(public readonly data: T) {}

  /**
   * Map the success value to a new type
   */
  map<U>(fn: (data: T) => U): Result<U, never> {
    return new Success(fn(this.data));
  }

  /**
   * Flat map the success value to a new result
   */
  flatMap<U, E>(fn: (data: T) => Result<U, E>): Result<U, E> {
    return fn(this.data);
  }

  /**
   * Get the data or throw if this is a failure (won't happen for Success)
   */
  unwrap(): T {
    return this.data;
  }

  /**
   * Get the data or return the default value (returns data for Success)
   */
  unwrapOr(_defaultValue: T): T {
    return this.data;
  }

  /**
   * Check if this is a success result
   */
  isSuccess(): this is Success<T> {
    return true;
  }

  /**
   * Check if this is a failure result
   */
  isFailure(): this is never {
    return false;
  }
}

/**
 * Failure result containing error
 */
export class Failure<E = ApicizeError> {
  readonly success = false;
  readonly failure = true;

  constructor(public readonly error: E) {}

  /**
   * Map the success value (no-op for Failure)
   */
  map<U>(_fn: (data: never) => U): Result<U, E> {
    return this as any;
  }

  /**
   * Flat map the success value (no-op for Failure)
   */
  flatMap<U, F>(_fn: (data: never) => Result<U, F>): Result<U, E> {
    return this as any;
  }

  /**
   * Get the data or throw the error
   */
  unwrap(): never {
    if (this.error instanceof Error) {
      throw this.error;
    }
    throw new Error(String(this.error));
  }

  /**
   * Get the data or return the default value
   */
  unwrapOr<T>(defaultValue: T): T {
    return defaultValue;
  }

  /**
   * Check if this is a success result
   */
  isSuccess(): this is never {
    return false;
  }

  /**
   * Check if this is a failure result
   */
  isFailure(): this is Failure<E> {
    return true;
  }
}

/**
 * Create a success result
 */
export function success<T>(data: T): Success<T> {
  return new Success(data);
}

/**
 * Create a failure result
 */
export function failure<E = ApicizeError>(error: E): Failure<E> {
  return new Failure(error);
}

/**
 * Create a result from a throwing function
 */
export function fromThrowable<T>(fn: () => T): Result<T, ApicizeError> {
  try {
    return success(fn());
  } catch (error) {
    return failure(toApicizeError(error));
  }
}

/**
 * Create a result from a Promise
 */
export async function fromPromise<T>(promise: Promise<T>): Promise<Result<T, ApicizeError>> {
  try {
    const data = await promise;
    return success(data);
  } catch (error) {
    return failure(toApicizeError(error));
  }
}

/**
 * Combine multiple results into a single result
 * Returns success with array of all data if all are successful
 * Returns failure with first error encountered
 */
export function combine<T>(results: Array<Result<T, ApicizeError>>): Result<T[], ApicizeError> {
  const data: T[] = [];

  for (const result of results) {
    if (result.isFailure()) {
      return result as any;
    }
    data.push(result.data);
  }

  return success(data);
}

/**
 * Combine multiple results and collect all errors
 * Returns success with array of all data if all are successful
 * Returns failure with combined error messages if any fail
 */
export function combineWithAllErrors<T>(
  results: Array<Result<T, ApicizeError>>
): Result<T[], ApicizeError> {
  const data: T[] = [];
  const errors: ApicizeError[] = [];

  for (const result of results) {
    if (result.isFailure()) {
      errors.push(result.error);
    } else {
      data.push(result.data);
    }
  }

  if (errors.length > 0) {
    const combinedMessage = errors.map(e => e.message).join('; ');
    return failure(
      new ApicizeError(errors[0].code, `Multiple errors occurred: ${combinedMessage}`, {
        severity: errors[0].severity,
        context: { errorCount: errors.length, errors: errors.map(e => e.toJSON()) },
      })
    );
  }

  return success(data);
}

/**
 * Filter results to only successful ones
 */
export function filterSuccessful<T>(results: Array<Result<T, any>>): T[] {
  return results
    .filter((result): result is Success<T> => result.isSuccess())
    .map(result => result.data);
}

/**
 * Filter results to only failed ones
 */
export function filterFailed<E>(results: Array<Result<any, E>>): E[] {
  return results
    .filter((result): result is Failure<E> => result.isFailure())
    .map(result => result.error);
}

/**
 * Partition results into successful and failed arrays
 */
export function partition<T, E>(
  results: Array<Result<T, E>>
): {
  successful: T[];
  failed: E[];
} {
  const successful: T[] = [];
  const failed: E[] = [];

  for (const result of results) {
    if (result.isSuccess()) {
      successful.push(result.data);
    } else {
      failed.push(result.error);
    }
  }

  return { successful, failed };
}

/**
 * Utility type guard to check if a result is successful
 */
export function isSuccess<T, E>(result: Result<T, E>): result is Success<T> {
  return result.isSuccess();
}

/**
 * Utility type guard to check if a result is a failure
 */
export function isFailure<T, E>(result: Result<T, E>): result is Failure<E> {
  return result.isFailure();
}

/**
 * Execute an async operation and return a Result
 */
export async function attempt<T>(operation: () => Promise<T>): Promise<Result<T, ApicizeError>> {
  return fromPromise(operation());
}

/**
 * Execute a sync operation and return a Result
 */
export function attemptSync<T>(operation: () => T): Result<T, ApicizeError> {
  return fromThrowable(operation);
}

/**
 * Retry an operation that returns a Result
 */
export async function retry<T>(
  operation: () => Promise<Result<T, ApicizeError>>,
  maxAttempts: number = 3,
  delayMs: number = 1000
): Promise<Result<T, ApicizeError>> {
  let lastResult: Result<T, ApicizeError>;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    lastResult = await operation();

    if (lastResult.isSuccess()) {
      return lastResult;
    }

    // Don't retry if the error is not retryable
    if (lastResult.error instanceof ApicizeError && !lastResult.error.retryable) {
      return lastResult;
    }

    // Wait before retrying (except on last attempt)
    if (attempt < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return lastResult!;
}

/**
 * Execute operations in sequence, stopping at first failure
 */
export async function sequence<T>(
  operations: Array<() => Promise<Result<T, ApicizeError>>>
): Promise<Result<T[], ApicizeError>> {
  const results: T[] = [];

  for (const operation of operations) {
    const result = await operation();
    if (result.isFailure()) {
      return result as any;
    }
    results.push(result.data);
  }

  return success(results);
}

/**
 * Execute operations in parallel and combine results
 */
export async function parallel<T>(
  operations: Array<() => Promise<Result<T, ApicizeError>>>
): Promise<Result<T[], ApicizeError>> {
  const promises = operations.map(op => op());
  const results = await Promise.all(promises);
  return combine(results);
}
