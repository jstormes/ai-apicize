/**
 * Execution domain bounded context
 * Contains all request execution-related domain models, interfaces, and business logic
 */

import { Request, RequestConfig, ApicizeResponse, HttpMethod } from '../../types';
import { Result } from '../../infrastructure/result';
import { ApicizeError } from '../../infrastructure/errors';
import { Url, HttpHeaders, RequestBodyValue, QueryParameters } from '../value-objects';

/**
 * Execution context for requests
 */
export interface ExecutionContext {
  readonly requestId: string;
  readonly executionId: string;
  readonly startTime: Date;
  readonly variables: Record<string, unknown>;
  readonly outputs: Record<string, unknown>;
  readonly environment: string;
  readonly timeout?: number;
  readonly retryAttempts?: number;
}

/**
 * Execution options
 */
export interface ExecutionOptions {
  readonly timeout?: number;
  readonly retryAttempts?: number;
  readonly retryDelay?: number;
  readonly followRedirects?: boolean;
  readonly maxRedirects?: number;
  readonly validateCertificates?: boolean;
  readonly enableTelemetry?: boolean;
  readonly abortSignal?: AbortSignal;
}

/**
 * Request builder interface
 */
export interface RequestBuilder {
  /**
   * Build HTTP request from config
   */
  buildRequest(config: RequestConfig, context: ExecutionContext): Result<HttpRequest, ApicizeError>;

  /**
   * Build URL with variable substitution
   */
  buildUrl(url: string, context: ExecutionContext): Result<Url, ApicizeError>;

  /**
   * Build headers
   */
  buildHeaders(headers: any, context: ExecutionContext): Result<HttpHeaders, ApicizeError>;

  /**
   * Build request body
   */
  buildBody(body: any, context: ExecutionContext): Result<RequestBodyValue, ApicizeError>;

  /**
   * Build query parameters
   */
  buildQueryParameters(
    params: any,
    context: ExecutionContext
  ): Result<QueryParameters, ApicizeError>;
}

/**
 * HTTP request representation
 */
export interface HttpRequest {
  readonly url: Url;
  readonly method: HttpMethod;
  readonly headers: HttpHeaders;
  readonly body: RequestBodyValue;
  readonly queryParams: QueryParameters;
  readonly timeout?: number;
  readonly metadata: Record<string, unknown>;
}

/**
 * Response processor interface
 */
export interface ResponseProcessor {
  /**
   * Process raw HTTP response
   */
  processResponse(
    response: Response,
    request: HttpRequest,
    context: ExecutionContext
  ): Promise<Result<ProcessedResponse, ApicizeError>>;

  /**
   * Extract response body
   */
  extractBody(response: Response): Promise<Result<any, ApicizeError>>;

  /**
   * Extract response headers
   */
  extractHeaders(response: Response): Result<HttpHeaders, ApicizeError>;

  /**
   * Calculate response timing
   */
  calculateTiming(startTime: number, endTime: number): ResponseTiming;
}

/**
 * Processed response
 */
export interface ProcessedResponse extends ApicizeResponse {
  readonly executionId: string;
  readonly requestId: string;
  readonly processingTime: number;
}

/**
 * Response timing information
 */
export interface ResponseTiming {
  readonly started: number;
  readonly dns?: number;
  readonly tcp?: number;
  readonly tls?: number;
  readonly request?: number;
  readonly firstByte?: number;
  readonly download?: number;
  readonly total: number;
}

/**
 * Redirect handler interface
 */
export interface RedirectHandler {
  /**
   * Handle redirect response
   */
  handleRedirect(
    response: Response,
    request: HttpRequest,
    redirectCount: number,
    maxRedirects: number
  ): Result<HttpRequest | null, ApicizeError>;

  /**
   * Check if response is a redirect
   */
  isRedirect(response: Response): boolean;

  /**
   * Get redirect URL
   */
  getRedirectUrl(response: Response, currentUrl: Url): Result<Url, ApicizeError>;

  /**
   * Determine redirect method
   */
  getRedirectMethod(originalMethod: HttpMethod, statusCode: number): HttpMethod;
}

/**
 * Error handler interface
 */
export interface ErrorHandler {
  /**
   * Handle network errors
   */
  handleNetworkError(error: Error, request: HttpRequest, context: ExecutionContext): ApicizeError;

  /**
   * Handle timeout errors
   */
  handleTimeoutError(
    timeout: number,
    request: HttpRequest,
    context: ExecutionContext
  ): ApicizeError;

  /**
   * Handle abort errors
   */
  handleAbortError(request: HttpRequest, context: ExecutionContext): ApicizeError;

  /**
   * Handle HTTP errors
   */
  handleHttpError(
    response: Response,
    request: HttpRequest,
    context: ExecutionContext
  ): ApicizeError;

  /**
   * Determine if error is retryable
   */
  isRetryable(error: ApicizeError): boolean;
}

/**
 * HTTP client interface
 */
export interface HttpClient {
  /**
   * Execute HTTP request
   */
  execute(
    request: HttpRequest,
    options?: ExecutionOptions
  ): Promise<Result<ProcessedResponse, ApicizeError>>;

  /**
   * Execute with retry logic
   */
  executeWithRetry(
    request: HttpRequest,
    options?: ExecutionOptions
  ): Promise<Result<ProcessedResponse, ApicizeError>>;

  /**
   * Get client statistics
   */
  getStats(): {
    requestsExecuted: number;
    averageResponseTime: number;
    errorRate: number;
    retryCount: number;
  };
}

/**
 * Execution engine interface
 */
export interface ExecutionEngine {
  /**
   * Execute a single request
   */
  executeRequest(
    request: Request,
    context: ExecutionContext,
    options?: ExecutionOptions
  ): Promise<Result<ProcessedResponse, ApicizeError>>;

  /**
   * Execute multiple requests
   */
  executeRequests(
    requests: Request[],
    context: ExecutionContext,
    options?: ExecutionOptions
  ): Promise<Result<ProcessedResponse[], ApicizeError>>;

  /**
   * Execute with variable substitution
   */
  executeWithVariables(
    config: RequestConfig,
    variables: Record<string, unknown>,
    options?: ExecutionOptions
  ): Promise<Result<ProcessedResponse, ApicizeError>>;
}

/**
 * Variable substitution engine interface
 */
export interface VariableSubstitutionEngine {
  /**
   * Substitute variables in string
   */
  substitute(template: string, variables: Record<string, unknown>): Result<string, ApicizeError>;

  /**
   * Substitute variables in object
   */
  substituteObject<T>(obj: T, variables: Record<string, unknown>): Result<T, ApicizeError>;

  /**
   * Extract variable names from template
   */
  extractVariables(template: string): string[];

  /**
   * Validate variable references
   */
  validateReferences(template: string, availableVariables: string[]): Result<boolean, ApicizeError>;
}

/**
 * Execution repository interface
 */
export interface ExecutionRepository {
  /**
   * Store execution result
   */
  storeResult(executionId: string, result: ProcessedResponse): Promise<Result<void, ApicizeError>>;

  /**
   * Retrieve execution result
   */
  getResult(executionId: string): Promise<Result<ProcessedResponse | null, ApicizeError>>;

  /**
   * Store execution context
   */
  storeContext(context: ExecutionContext): Promise<Result<void, ApicizeError>>;

  /**
   * Get execution history
   */
  getHistory(requestId: string, limit?: number): Promise<Result<ProcessedResponse[], ApicizeError>>;

  /**
   * Clear execution data
   */
  clear(olderThan?: Date): Promise<Result<void, ApicizeError>>;
}

/**
 * Execution service interface
 */
export interface ExecutionService {
  /**
   * Execute request with full context
   */
  execute(
    request: Request | RequestConfig,
    context?: Partial<ExecutionContext>,
    options?: ExecutionOptions
  ): Promise<Result<ProcessedResponse, ApicizeError>>;

  /**
   * Execute batch of requests
   */
  executeBatch(
    requests: Array<Request | RequestConfig>,
    context?: Partial<ExecutionContext>,
    options?: ExecutionOptions
  ): Promise<Result<ProcessedResponse[], ApicizeError>>;

  /**
   * Create execution context
   */
  createContext(options?: Partial<ExecutionContext>): ExecutionContext;

  /**
   * Validate request before execution
   */
  validateRequest(request: Request | RequestConfig): Result<boolean, ApicizeError>;
}

/**
 * Execution domain events
 */
export enum ExecutionDomainEvent {
  EXECUTION_STARTED = 'execution.started',
  EXECUTION_COMPLETED = 'execution.completed',
  EXECUTION_FAILED = 'execution.failed',
  EXECUTION_RETRIED = 'execution.retried',
  EXECUTION_ABORTED = 'execution.aborted',
  REQUEST_BUILT = 'request.built',
  RESPONSE_PROCESSED = 'response.processed',
  VARIABLES_SUBSTITUTED = 'variables.substituted',
  REDIRECT_FOLLOWED = 'redirect.followed',
}

/**
 * Execution domain event data
 */
export interface ExecutionDomainEventData {
  type: ExecutionDomainEvent;
  timestamp: Date;
  executionId: string;
  requestId?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  duration?: number;
  success?: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Request lifecycle hooks
 */
export interface RequestLifecycleHooks {
  /**
   * Before request is built
   */
  beforeBuild?(config: RequestConfig, context: ExecutionContext): Promise<void>;

  /**
   * After request is built
   */
  afterBuild?(request: HttpRequest, context: ExecutionContext): Promise<void>;

  /**
   * Before request is sent
   */
  beforeSend?(request: HttpRequest, context: ExecutionContext): Promise<void>;

  /**
   * After response is received
   */
  afterReceive?(response: Response, request: HttpRequest, context: ExecutionContext): Promise<void>;

  /**
   * After response is processed
   */
  afterProcess?(response: ProcessedResponse, context: ExecutionContext): Promise<void>;

  /**
   * On execution error
   */
  onError?(error: ApicizeError, context: ExecutionContext): Promise<void>;
}

/**
 * Performance monitor interface
 */
export interface PerformanceMonitor {
  /**
   * Start monitoring execution
   */
  startMonitoring(executionId: string): void;

  /**
   * Record timing metric
   */
  recordTiming(executionId: string, phase: string, duration: number): void;

  /**
   * Record counter metric
   */
  recordCounter(metric: string, value: number, tags?: Record<string, string>): void;

  /**
   * End monitoring
   */
  endMonitoring(executionId: string): void;

  /**
   * Get performance metrics
   */
  getMetrics(executionId: string): Record<string, number>;
}

/**
 * Circuit breaker interface
 */
export interface CircuitBreaker {
  /**
   * Execute with circuit breaker protection
   */
  execute<T>(
    operation: () => Promise<Result<T, ApicizeError>>,
    key: string
  ): Promise<Result<T, ApicizeError>>;

  /**
   * Get circuit breaker state
   */
  getState(key: string): 'CLOSED' | 'OPEN' | 'HALF_OPEN';

  /**
   * Reset circuit breaker
   */
  reset(key: string): void;

  /**
   * Get failure statistics
   */
  getStats(key: string): {
    failureCount: number;
    successCount: number;
    failureRate: number;
    lastFailureTime?: Date;
  };
}
