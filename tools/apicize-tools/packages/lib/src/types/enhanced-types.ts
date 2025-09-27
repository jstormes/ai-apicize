/**
 * Enhanced TypeScript Types - Phase 5 Developer Experience Enhancement
 *
 * Provides advanced generic types, utility types, and type guards
 * for better type safety and developer experience.
 */

import { RequestConfig, BodyType, HttpMethod, NameValuePair } from '../types';

/**
 * Generic Response Type with better type inference
 */
export interface TypedResponse<
  TBody = unknown,
  THeaders extends Record<string, string> = Record<string, string>,
> {
  status: number;
  statusText: string;
  headers: THeaders;
  body: ResponseBody<TBody>;
  url: string;
  redirected: boolean;
  redirects?: RedirectInfo[];
  timing: TimingInfo;
}

/**
 * Strongly typed response body based on content type
 */
export type ResponseBody<T = unknown> =
  | { type: BodyType.JSON; data: T }
  | { type: BodyType.Text; data: string }
  | { type: BodyType.XML; data: string }
  | { type: BodyType.Form; data: NameValuePair[] }
  | { type: BodyType.Raw; data: Uint8Array }
  | { type: BodyType.None; data: undefined };

/**
 * Generic request configuration with better type constraints
 */
export interface TypedRequestConfig<TBody = unknown> extends Omit<RequestConfig, 'body'> {
  body?: RequestBody<TBody>;
}

/**
 * Strongly typed request body
 */
export type RequestBody<T = unknown> =
  | { type: BodyType.JSON; data: T }
  | { type: BodyType.Text; data: string }
  | { type: BodyType.XML; data: string }
  | { type: BodyType.Form; data: NameValuePair[] | Record<string, string> }
  | { type: BodyType.Raw; data: Uint8Array }
  | { type: BodyType.None };

/**
 * Utility type for extracting body type from a response
 */
export type ExtractBodyType<T> = T extends TypedResponse<infer U> ? U : unknown;

/**
 * Utility type for creating type-safe API clients
 */
export type ApiEndpoint<TRequest = unknown, TResponse = unknown> = {
  method: HttpMethod;
  path: string;
  requestType?: TRequest;
  responseType?: TResponse;
};

/**
 * Generic API client interface with type safety
 */
export interface TypedApiClient {
  request<TRequest, TResponse>(
    endpoint: ApiEndpoint<TRequest, TResponse>,
    data?: TRequest
  ): Promise<TypedResponse<TResponse>>;
}

/**
 * Advanced conditional types for HTTP methods
 */
export type HttpMethodWithBody = HttpMethod.POST | HttpMethod.PUT | HttpMethod.PATCH;
export type HttpMethodWithoutBody =
  | HttpMethod.GET
  | HttpMethod.DELETE
  | HttpMethod.HEAD
  | HttpMethod.OPTIONS;

/**
 * Conditional request config based on HTTP method
 */
export type ConditionalRequestConfig<
  TMethod extends HttpMethod,
  TBody = unknown,
> = TMethod extends HttpMethodWithBody
  ? TypedRequestConfig<TBody> & { method: TMethod }
  : TypedRequestConfig<never> & { method: TMethod; body?: { type: BodyType.None } };

/**
 * Type guard for checking if a method requires a body
 */
export function requiresBody(method: HttpMethod): method is HttpMethodWithBody {
  return [HttpMethod.POST, HttpMethod.PUT, HttpMethod.PATCH].includes(method);
}

/**
 * Type guard for JSON response bodies
 */
export function isJsonResponse<T>(
  response: TypedResponse
): response is TypedResponse<T> & { body: { type: BodyType.JSON; data: T } } {
  return response.body.type === BodyType.JSON;
}

/**
 * Type guard for text response bodies
 */
export function isTextResponse(
  response: TypedResponse
): response is TypedResponse<string> & { body: { type: BodyType.Text; data: string } } {
  return response.body.type === BodyType.Text;
}

/**
 * Type guard for XML response bodies
 */
export function isXmlResponse(
  response: TypedResponse
): response is TypedResponse<string> & { body: { type: BodyType.XML; data: string } } {
  return response.body.type === BodyType.XML;
}

/**
 * Type guard for form response bodies
 */
export function isFormResponse(response: TypedResponse): response is TypedResponse<
  NameValuePair[]
> & {
  body: { type: BodyType.Form; data: NameValuePair[] };
} {
  return response.body.type === BodyType.Form;
}

/**
 * Type guard for raw response bodies
 */
export function isRawResponse(
  response: TypedResponse
): response is TypedResponse<Uint8Array> & { body: { type: BodyType.Raw; data: Uint8Array } } {
  return response.body.type === BodyType.Raw;
}

/**
 * Type guard for empty response bodies
 */
export function isEmptyResponse(
  response: TypedResponse
): response is TypedResponse<undefined> & { body: { type: BodyType.None; data: undefined } } {
  return response.body.type === BodyType.None;
}

/**
 * Generic error type with better error information
 */
export interface TypedError<TContext = unknown> extends Error {
  code: string;
  context?: TContext;
  cause?: Error;
  timestamp: Date;
  requestId?: string;
}

/**
 * Result type for operations that can fail
 */
export type Result<T, E = TypedError> =
  | { success: true; data: T; error?: never }
  | { success: false; data?: never; error: E };

/**
 * Type helpers for Result type
 */
export namespace ResultHelpers {
  export function ok<T>(data: T): Result<T, never> {
    return { success: true, data };
  }

  export function err<E>(error: E): Result<never, E> {
    return { success: false, error };
  }

  export function isOk<T, E>(result: Result<T, E>): result is { success: true; data: T } {
    return result.success;
  }

  export function isErr<T, E>(result: Result<T, E>): result is { success: false; error: E } {
    return !result.success;
  }

  export function map<T, U, E>(result: Result<T, E>, fn: (data: T) => U): Result<U, E> {
    return isOk(result) ? ok(fn(result.data)) : result;
  }

  export function mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
    return isErr(result) ? err(fn(result.error)) : result;
  }

  export function chain<T, U, E>(
    result: Result<T, E>,
    fn: (data: T) => Result<U, E>
  ): Result<U, E> {
    return isOk(result) ? fn(result.data) : result;
  }
}

/**
 * Promise-based Result type
 */
export type AsyncResult<T, E = TypedError> = Promise<Result<T, E>>;

/**
 * Generic configuration type with validation
 */
export interface ValidatedConfig<T> {
  data: T;
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  path: string;
  message: string;
  value?: unknown;
}

export interface ValidationWarning {
  path: string;
  message: string;
  value?: unknown;
}

/**
 * Type for configuration schemas with validation rules
 */
export interface ConfigSchema<T> {
  validate(data: unknown): ValidatedConfig<T>;
  validatePartial(data: Partial<T>): ValidationError[];
  getDefault(): T;
}

/**
 * Type-safe event emitter interface
 */
export interface TypedEventEmitter<TEvents extends Record<string, unknown[]>> {
  on<K extends keyof TEvents>(event: K, listener: (...args: TEvents[K]) => void): this;
  off<K extends keyof TEvents>(event: K, listener: (...args: TEvents[K]) => void): this;
  emit<K extends keyof TEvents>(event: K, ...args: TEvents[K]): boolean;
  once<K extends keyof TEvents>(event: K, listener: (...args: TEvents[K]) => void): this;
  removeAllListeners<K extends keyof TEvents>(event?: K): this;
  listenerCount<K extends keyof TEvents>(event: K): number;
}

/**
 * Type for middleware functions with proper typing
 */
export type Middleware<TRequest, TResponse> = (
  request: TRequest,
  next: (modifiedRequest?: TRequest) => Promise<TResponse>
) => Promise<TResponse>;

/**
 * Generic cache interface with TTL support
 */
export interface TypedCache<K, V> {
  get(key: K): V | undefined;
  set(key: K, value: V, ttl?: number): void;
  has(key: K): boolean;
  delete(key: K): boolean;
  clear(): void;
  size(): number;
  keys(): K[];
  values(): V[];
  entries(): [K, V][];
}

/**
 * Type for plugin interfaces
 */
export interface Plugin<TConfig = unknown> {
  name: string;
  version: string;
  init(config: TConfig): Promise<void> | void;
  destroy(): Promise<void> | void;
}

/**
 * Type for dependency injection container
 */
export interface Container {
  register<T>(token: string | symbol, value: T): void;
  registerFactory<T>(token: string | symbol, factory: () => T): void;
  resolve<T>(token: string | symbol): T;
  has(token: string | symbol): boolean;
}

/**
 * Type for logging interfaces with structured data
 */
export interface StructuredLogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, error?: Error, meta?: Record<string, unknown>): void;
  child(meta: Record<string, unknown>): StructuredLogger;
}

/**
 * Additional timing information
 */
export interface TimingInfo {
  start: number;
  end: number;
  duration: number;
  phases?: {
    dns?: number;
    tcp?: number;
    tls?: number;
    request?: number;
    response?: number;
  };
}

/**
 * Redirect information
 */
export interface RedirectInfo {
  url: string;
  status: number;
  statusText: string;
}

/**
 * Type-safe environment variable configuration
 */
export interface EnvironmentConfig {
  NODE_ENV: 'development' | 'production' | 'test' | 'staging';
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
  API_BASE_URL: string;
  AUTH_BASE_URL: string;
  TIMEOUT_MS: number;
  MAX_RETRIES: number;
}

/**
 * Utility type for making specific properties optional
 */
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Utility type for making specific properties required
 */
export type RequiredFields<T, K extends keyof T> = T & globalThis.Required<Pick<T, K>>;

/**
 * Deep readonly utility type
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends (infer U)[]
    ? readonly DeepReadonly<U>[]
    : T[P] extends object
      ? DeepReadonly<T[P]>
      : T[P];
};

/**
 * Extract type from Promise
 */
export type Awaited<T> = T extends Promise<infer U> ? U : T;

/**
 * Extract function parameters
 */
export type Parameters<T extends (...args: any) => any> = T extends (...args: infer P) => any
  ? P
  : never;

/**
 * Extract function return type
 */
export type ReturnType<T extends (...args: any) => any> = T extends (...args: any) => infer R
  ? R
  : any;
