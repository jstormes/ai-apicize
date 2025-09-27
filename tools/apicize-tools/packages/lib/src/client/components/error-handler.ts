/**
 * Error Handler - Responsible for handling and transforming HTTP client errors
 */

// Result type imports handled via infrastructure/errors
import {
  ApicizeError,
  ApicizeErrorCode,
  ApicizeNetworkError,
  ErrorSeverity,
} from '../../infrastructure/errors';
import { HttpRequest, ExecutionContext } from '../../domain/execution/execution-domain';

/**
 * Error handler configuration
 */
export interface ErrorHandlerConfig {
  enableRetry?: boolean;
  maxRetryAttempts?: number;
  retryDelayMs?: number;
  retryOnStatus?: number[];
  retryOnNetworkError?: boolean;
  retryOnTimeout?: boolean;
  retryBackoffMultiplier?: number;
  enableCircuitBreaker?: boolean;
  circuitBreakerThreshold?: number;
}

/**
 * Error classification
 */
export enum ErrorClassification {
  NETWORK = 'network',
  TIMEOUT = 'timeout',
  ABORT = 'abort',
  HTTP_CLIENT = 'http_client',
  HTTP_SERVER = 'http_server',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  VALIDATION = 'validation',
  UNKNOWN = 'unknown',
}

/**
 * Error context information
 */
export interface ErrorContext {
  request: HttpRequest;
  executionContext?: ExecutionContext;
  attempt?: number;
  previousErrors?: ApicizeError[];
  timestamp: Date;
  duration?: number;
}

/**
 * Error handler implementation
 */
export class ApicizeErrorHandler {
  private config: ErrorHandlerConfig;
  private circuitBreakerStates = new Map<
    string,
    {
      failures: number;
      lastFailure: Date;
      state: 'closed' | 'open' | 'half-open';
    }
  >();

  constructor(config: ErrorHandlerConfig = {}) {
    this.config = {
      enableRetry: true,
      maxRetryAttempts: 3,
      retryDelayMs: 1000,
      retryOnStatus: [429, 500, 502, 503, 504],
      retryOnNetworkError: true,
      retryOnTimeout: true,
      retryBackoffMultiplier: 2,
      enableCircuitBreaker: false,
      circuitBreakerThreshold: 5,
      ...config,
    };
  }

  /**
   * Handle network errors
   */
  handleNetworkError(
    error: Error,
    request: HttpRequest,
    context?: ExecutionContext
  ): ApicizeNetworkError {
    const classification = this.classifyNetworkError(error);
    const errorContext = this.buildErrorContext(request, context);

    return new ApicizeNetworkError(
      ApicizeErrorCode.NETWORK_ERROR,
      this.buildNetworkErrorMessage(error, classification),
      {
        url: request.url.toString(),
        method: request.method,
        cause: error,
        retryable: this.isNetworkErrorRetryable(classification),
        severity: this.getErrorSeverity(classification),
        context: {
          ...errorContext,
          classification,
          networkError: {
            name: error.name,
            message: error.message,
            code: (error as any).code,
            errno: (error as any).errno,
            syscall: (error as any).syscall,
          },
        },
        suggestions: this.getNetworkErrorSuggestions(classification, error),
      }
    );
  }

  /**
   * Handle timeout errors
   */
  handleTimeoutError(
    timeout: number,
    request: HttpRequest,
    context?: ExecutionContext
  ): ApicizeNetworkError {
    const errorContext = this.buildErrorContext(request, context);

    return new ApicizeNetworkError(
      ApicizeErrorCode.TIMEOUT_ERROR,
      `Request timed out after ${timeout}ms`,
      {
        url: request.url.toString(),
        method: request.method,
        retryable: this.config.retryOnTimeout ?? false,
        severity: ErrorSeverity.MEDIUM,
        context: {
          ...errorContext,
          timeout,
          classification: ErrorClassification.TIMEOUT,
        },
        suggestions: [
          'Increase the timeout value',
          'Check network connectivity',
          'Verify the server is responding',
          'Consider using a different endpoint',
        ],
      }
    );
  }

  /**
   * Handle abort errors
   */
  handleAbortError(
    request: HttpRequest,
    context?: ExecutionContext,
    reason?: string
  ): ApicizeNetworkError {
    const errorContext = this.buildErrorContext(request, context);

    return new ApicizeNetworkError(ApicizeErrorCode.ABORT_ERROR, reason || 'Request was aborted', {
      url: request.url.toString(),
      method: request.method,
      retryable: false,
      severity: ErrorSeverity.LOW,
      context: {
        ...errorContext,
        classification: ErrorClassification.ABORT,
        abortReason: reason,
      },
      suggestions: [
        'Check if the request was intentionally cancelled',
        'Verify timeout settings are appropriate',
        'Consider implementing retry logic',
      ],
    });
  }

  /**
   * Handle HTTP errors
   */
  handleHttpError(
    response: Response,
    request: HttpRequest,
    context?: ExecutionContext
  ): ApicizeNetworkError {
    const classification = this.classifyHttpError(response.status);
    const errorContext = this.buildErrorContext(request, context);

    return new ApicizeNetworkError(
      ApicizeErrorCode.HTTP_ERROR,
      `HTTP ${response.status} ${response.statusText}`,
      {
        url: request.url.toString(),
        method: request.method,
        status: response.status,
        retryable: this.isHttpErrorRetryable(response.status),
        severity: this.getHttpErrorSeverity(response.status),
        context: {
          ...errorContext,
          classification,
          httpStatus: response.status,
          httpStatusText: response.statusText,
          responseHeaders: Object.fromEntries(response.headers.entries()),
        },
        suggestions: this.getHttpErrorSuggestions(response.status),
      }
    );
  }

  /**
   * Determine if error is retryable
   */
  isRetryable(error: ApicizeError, attempt: number = 1): boolean {
    if (!this.config.enableRetry || attempt >= this.config.maxRetryAttempts!) {
      return false;
    }

    if (error instanceof ApicizeNetworkError) {
      // Check circuit breaker
      if (this.config.enableCircuitBreaker) {
        const key = this.getCircuitBreakerKey(error);
        if (this.isCircuitOpen(key)) {
          return false;
        }
      }

      // Check if error type is retryable
      if (error.code === ApicizeErrorCode.TIMEOUT_ERROR && this.config.retryOnTimeout) {
        return true;
      }

      if (error.code === ApicizeErrorCode.NETWORK_ERROR && this.config.retryOnNetworkError) {
        return true;
      }

      if (error.code === ApicizeErrorCode.HTTP_ERROR && error.context?.status) {
        const status = error.context.status as number;
        return this.config.retryOnStatus!.includes(status);
      }
    }

    return error.retryable;
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  calculateRetryDelay(attempt: number): number {
    const baseDelay = this.config.retryDelayMs!;
    const multiplier = this.config.retryBackoffMultiplier!;

    return Math.min(
      baseDelay * Math.pow(multiplier, attempt - 1),
      30000 // Max 30 seconds
    );
  }

  /**
   * Record error for circuit breaker
   */
  recordError(error: ApicizeError): void {
    if (!this.config.enableCircuitBreaker) {
      return;
    }

    const key = this.getCircuitBreakerKey(error);
    const state = this.circuitBreakerStates.get(key) || {
      failures: 0,
      lastFailure: new Date(),
      state: 'closed' as const,
    };

    state.failures++;
    state.lastFailure = new Date();

    if (state.failures >= this.config.circuitBreakerThreshold!) {
      state.state = 'open';
    }

    this.circuitBreakerStates.set(key, state);
  }

  /**
   * Record successful request for circuit breaker
   */
  recordSuccess(request: HttpRequest): void {
    if (!this.config.enableCircuitBreaker) {
      return;
    }

    const key = this.getCircuitBreakerKeyFromRequest(request);
    const state = this.circuitBreakerStates.get(key);

    if (state) {
      if (state.state === 'half-open') {
        state.state = 'closed';
        state.failures = 0;
      } else if (state.state === 'closed') {
        state.failures = Math.max(0, state.failures - 1);
      }
      this.circuitBreakerStates.set(key, state);
    }
  }

  /**
   * Get circuit breaker state
   */
  getCircuitBreakerState(key: string): 'closed' | 'open' | 'half-open' {
    const state = this.circuitBreakerStates.get(key);
    if (!state) {
      return 'closed';
    }

    // Check if circuit should move to half-open
    if (state.state === 'open') {
      const timeSinceLastFailure = Date.now() - state.lastFailure.getTime();
      if (timeSinceLastFailure > 60000) {
        // 1 minute
        state.state = 'half-open';
        this.circuitBreakerStates.set(key, state);
      }
    }

    return state.state;
  }

  /**
   * Transform generic error to Apicize error
   */
  transformError(error: unknown, request: HttpRequest, context?: ExecutionContext): ApicizeError {
    if (error instanceof ApicizeError) {
      return error;
    }

    if (error instanceof Error) {
      // Check for specific error types
      if (error.name === 'AbortError') {
        return this.handleAbortError(request, context, error.message);
      }

      if (error.name === 'TimeoutError') {
        return this.handleTimeoutError(request.timeout || 30000, request, context);
      }

      if (error.message.includes('network') || error.message.includes('fetch')) {
        return this.handleNetworkError(error, request, context);
      }

      // Generic error transformation
      return new ApicizeError(ApicizeErrorCode.INTERNAL_ERROR, error.message, {
        cause: error,
        context: this.buildErrorContext(request, context),
        severity: ErrorSeverity.MEDIUM,
      });
    }

    // Unknown error type
    return new ApicizeError(ApicizeErrorCode.UNKNOWN, String(error), {
      context: {
        ...this.buildErrorContext(request, context),
        originalError: error,
      },
      severity: ErrorSeverity.LOW,
    });
  }

  // Private helper methods

  private classifyNetworkError(error: Error): ErrorClassification {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    if (name === 'aborterror' || message.includes('abort')) {
      return ErrorClassification.ABORT;
    }

    if (name === 'timeouterror' || message.includes('timeout')) {
      return ErrorClassification.TIMEOUT;
    }

    if (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('connection') ||
      message.includes('dns')
    ) {
      return ErrorClassification.NETWORK;
    }

    return ErrorClassification.UNKNOWN;
  }

  private classifyHttpError(status: number): ErrorClassification {
    if (status === 401) {
      return ErrorClassification.AUTHENTICATION;
    }

    if (status === 403) {
      return ErrorClassification.AUTHORIZATION;
    }

    if (status >= 400 && status < 500) {
      return ErrorClassification.HTTP_CLIENT;
    }

    if (status >= 500) {
      return ErrorClassification.HTTP_SERVER;
    }

    return ErrorClassification.UNKNOWN;
  }

  private buildNetworkErrorMessage(error: Error, classification: ErrorClassification): string {
    switch (classification) {
      case ErrorClassification.TIMEOUT:
        return 'Network request timed out';
      case ErrorClassification.ABORT:
        return 'Network request was aborted';
      case ErrorClassification.NETWORK:
        return `Network error: ${error.message}`;
      default:
        return `Request failed: ${error.message}`;
    }
  }

  private isNetworkErrorRetryable(classification: ErrorClassification): boolean {
    switch (classification) {
      case ErrorClassification.TIMEOUT:
        return this.config.retryOnTimeout!;
      case ErrorClassification.NETWORK:
        return this.config.retryOnNetworkError!;
      case ErrorClassification.ABORT:
        return false;
      default:
        return false;
    }
  }

  private isHttpErrorRetryable(status: number): boolean {
    return this.config.retryOnStatus!.includes(status);
  }

  private getErrorSeverity(classification: ErrorClassification): ErrorSeverity {
    switch (classification) {
      case ErrorClassification.AUTHENTICATION:
      case ErrorClassification.AUTHORIZATION:
        return ErrorSeverity.HIGH;
      case ErrorClassification.TIMEOUT:
      case ErrorClassification.NETWORK:
        return ErrorSeverity.MEDIUM;
      case ErrorClassification.ABORT:
        return ErrorSeverity.LOW;
      default:
        return ErrorSeverity.MEDIUM;
    }
  }

  private getHttpErrorSeverity(status: number): ErrorSeverity {
    if (status >= 500) {
      return ErrorSeverity.HIGH;
    }
    if (status === 429 || status === 503) {
      return ErrorSeverity.MEDIUM;
    }
    if (status >= 400) {
      return ErrorSeverity.MEDIUM;
    }
    return ErrorSeverity.LOW;
  }

  private getNetworkErrorSuggestions(classification: ErrorClassification, _error: Error): string[] {
    const suggestions = ['Check network connectivity', 'Verify the URL is correct'];

    switch (classification) {
      case ErrorClassification.TIMEOUT:
        suggestions.push('Increase the timeout value', 'Check server response times');
        break;
      case ErrorClassification.NETWORK:
        suggestions.push('Check if the server is accessible', 'Verify DNS resolution');
        break;
      case ErrorClassification.ABORT:
        suggestions.push('Check if the request was intentionally cancelled');
        break;
    }

    return suggestions;
  }

  private getHttpErrorSuggestions(status: number): string[] {
    const suggestions: string[] = [];

    switch (status) {
      case 400:
        suggestions.push('Check request parameters', 'Verify request format');
        break;
      case 401:
        suggestions.push('Provide valid authentication credentials', 'Check API key or token');
        break;
      case 403:
        suggestions.push('Check user permissions', 'Verify authorization scope');
        break;
      case 404:
        suggestions.push('Verify the endpoint URL is correct', 'Check API documentation');
        break;
      case 429:
        suggestions.push('Reduce request rate', 'Implement rate limiting', 'Wait before retrying');
        break;
      case 500:
        suggestions.push('Contact the service provider', 'Try again later', 'Check service status');
        break;
      case 502:
      case 503:
      case 504:
        suggestions.push('Retry the request', 'Check service availability', 'Try again later');
        break;
    }

    return suggestions;
  }

  private buildErrorContext(
    request: HttpRequest,
    context?: ExecutionContext
  ): Record<string, unknown> {
    return {
      timestamp: new Date().toISOString(),
      url: request.url.toString(),
      method: request.method,
      timeout: request.timeout,
      executionId: context?.executionId,
      requestId: context?.requestId,
      environment: context?.environment,
    };
  }

  private getCircuitBreakerKey(error: ApicizeError): string {
    const url = (error.context?.url as string) || 'unknown';
    try {
      const urlObj = new URL(url);
      return `${urlObj.protocol}//${urlObj.host}`;
    } catch {
      return url;
    }
  }

  private getCircuitBreakerKeyFromRequest(request: HttpRequest): string {
    return `${request.url.protocol}//${request.url.host}`;
  }

  private isCircuitOpen(key: string): boolean {
    return this.getCircuitBreakerState(key) === 'open';
  }

  /**
   * Create a copy with different configuration
   */
  withConfig(newConfig: Partial<ErrorHandlerConfig>): ApicizeErrorHandler {
    return new ApicizeErrorHandler({ ...this.config, ...newConfig });
  }

  /**
   * Get current configuration
   */
  getConfig(): ErrorHandlerConfig {
    return { ...this.config };
  }

  /**
   * Reset circuit breaker states
   */
  resetCircuitBreakers(): void {
    this.circuitBreakerStates.clear();
  }
}
