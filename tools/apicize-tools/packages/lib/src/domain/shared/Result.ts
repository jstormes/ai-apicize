import { DomainError } from './DomainError';

/**
 * Result type for operations that can fail
 * Provides a type-safe way to handle success and failure cases
 */
export type Result<T, E extends DomainError = DomainError> =
  | { success: true; data: T; error?: never }
  | { success: false; data?: never; error: E };

/**
 * Utility functions for working with Result types
 */
export namespace Result {
  /**
   * Creates a successful result
   */
  export function ok<T>(data: T): Result<T, never> {
    return { success: true, data };
  }

  /**
   * Creates a failed result
   */
  export function fail<E extends DomainError>(error: E): Result<never, E> {
    return { success: false, error };
  }

  /**
   * Type guard for successful results
   */
  export function isOk<T, E extends DomainError>(
    result: Result<T, E>
  ): result is { success: true; data: T } {
    return result.success;
  }

  /**
   * Type guard for failed results
   */
  export function isFail<T, E extends DomainError>(
    result: Result<T, E>
  ): result is { success: false; error: E } {
    return !result.success;
  }

  /**
   * Maps the data of a successful result
   */
  export function map<T, U, E extends DomainError>(
    result: Result<T, E>,
    fn: (data: T) => U
  ): Result<U, E> {
    return isOk(result) ? ok(fn(result.data)) : result;
  }

  /**
   * Maps the error of a failed result
   */
  export function mapError<T, E extends DomainError, F extends DomainError>(
    result: Result<T, E>,
    fn: (error: E) => F
  ): Result<T, F> {
    return isFail(result) ? fail(fn(result.error)) : result;
  }

  /**
   * Chains operations that return Results
   */
  export function chain<T, U, E extends DomainError>(
    result: Result<T, E>,
    fn: (data: T) => Result<U, E>
  ): Result<U, E> {
    return isOk(result) ? fn(result.data) : result;
  }

  /**
   * Combines multiple Results into a single Result
   */
  export function combine<T extends readonly unknown[], E extends DomainError>(
    results: { [K in keyof T]: Result<T[K], E> }
  ): Result<T, E> {
    const data = [] as unknown as T;

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (isFail(result)) {
        return result;
      }
      (data as unknown[])[i] = result.data;
    }

    return ok(data);
  }

  /**
   * Executes a function that might throw and wraps it in a Result
   */
  export function tryExecute<T, E extends DomainError>(
    fn: () => T,
    errorMapper: (error: unknown) => E
  ): Result<T, E> {
    try {
      return ok(fn());
    } catch (error) {
      return fail(errorMapper(error));
    }
  }

  /**
   * Executes an async function that might throw and wraps it in a Result
   */
  export async function tryExecuteAsync<T, E extends DomainError>(
    fn: () => Promise<T>,
    errorMapper: (error: unknown) => E
  ): Promise<Result<T, E>> {
    try {
      const data = await fn();
      return ok(data);
    } catch (error) {
      return fail(errorMapper(error));
    }
  }
}