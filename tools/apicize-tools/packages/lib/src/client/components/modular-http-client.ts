/**
 * Modular HTTP Client - Orchestrates all client components
 */

import { RequestConfig } from '../../types';
import { Result, success, failure } from '../../infrastructure/result';
import { ApicizeError, ApicizeErrorCode } from '../../infrastructure/errors';
import { HttpClient as IHttpClient } from '../../infrastructure/interfaces';
import {
  HttpRequest,
  ProcessedResponse,
  ExecutionOptions,
  ExecutionContext,
} from '../../domain/execution/execution-domain';

import { ApicizeRequestBuilder, RequestBuilderConfig } from './request-builder';
import { ApicizeResponseProcessor, ResponseProcessorConfig } from './response-processor';
import { ApicizeRedirectHandler, RedirectHandlerConfig } from './redirect-handler';
import { ApicizeErrorHandler, ErrorHandlerConfig } from './error-handler';

/**
 * Modular HTTP client configuration
 */
export interface ModularHttpClientConfig {
  requestBuilder?: RequestBuilderConfig;
  responseProcessor?: ResponseProcessorConfig;
  redirectHandler?: RedirectHandlerConfig;
  errorHandler?: ErrorHandlerConfig;
  httpClient?: IHttpClient;
  enableTelemetry?: boolean;
  enablePerformanceMonitoring?: boolean;
}

/**
 * Execution statistics
 */
export interface ExecutionStats {
  requestsExecuted: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  totalResponseTime: number;
  redirectsFollowed: number;
  retriesAttempted: number;
  circuitBreakerTrips: number;
  errorsByType: Record<string, number>;
}

/**
 * Modular HTTP client implementation
 */
export class ModularHttpClient {
  private requestBuilder: ApicizeRequestBuilder;
  private responseProcessor: ApicizeResponseProcessor;
  private redirectHandler: ApicizeRedirectHandler;
  private errorHandler: ApicizeErrorHandler;
  private httpClient: IHttpClient;
  private config: ModularHttpClientConfig;
  private stats: ExecutionStats;

  constructor(config: ModularHttpClientConfig = {}) {
    this.config = config;

    // Initialize components
    this.requestBuilder = new ApicizeRequestBuilder(config.requestBuilder);
    this.responseProcessor = new ApicizeResponseProcessor(config.responseProcessor);
    this.redirectHandler = new ApicizeRedirectHandler(config.redirectHandler);
    this.errorHandler = new ApicizeErrorHandler(config.errorHandler);

    // Use provided HTTP client or create default
    this.httpClient = config.httpClient || {
      async fetch(url: string, init?: RequestInit): Promise<Response> {
        return fetch(url, init);
      },
    };

    // Initialize statistics
    this.stats = {
      requestsExecuted: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      totalResponseTime: 0,
      redirectsFollowed: 0,
      retriesAttempted: 0,
      circuitBreakerTrips: 0,
      errorsByType: {},
    };
  }

  /**
   * Execute HTTP request with all processing
   */
  async execute(
    requestConfig: RequestConfig,
    options: ExecutionOptions = {},
    context?: Partial<ExecutionContext>
  ): Promise<Result<ProcessedResponse, ApicizeError>> {
    const executionStartTime = Date.now();
    this.stats.requestsExecuted++;

    try {
      // Build execution context
      const fullContext: ExecutionContext = {
        requestId: context?.requestId || this.generateRequestId(),
        executionId: context?.executionId || this.generateExecutionId(),
        startTime: new Date(),
        variables: context?.variables || {},
        outputs: context?.outputs || {},
        environment: context?.environment || 'default',
        timeout: options.timeout || requestConfig.timeout || 30000,
        retryAttempts: options.retryAttempts || 0,
      };

      // Execute with retry logic
      const result = await this.executeWithRetry(requestConfig, options, fullContext);

      // Update statistics
      const executionTime = Date.now() - executionStartTime;
      this.updateStats(result, executionTime);

      return result;
    } catch (error) {
      this.stats.failedRequests++;
      const apicizeError = this.errorHandler.transformError(
        error,
        {} as HttpRequest,
        context as ExecutionContext
      );
      this.updateErrorStats(apicizeError);
      return failure(apicizeError);
    }
  }

  /**
   * Execute with retry logic
   */
  private async executeWithRetry(
    requestConfig: RequestConfig,
    options: ExecutionOptions,
    context: ExecutionContext,
    attempt: number = 1
  ): Promise<Result<ProcessedResponse, ApicizeError>> {
    try {
      // Build request
      const requestResult = await this.requestBuilder.buildRequest(requestConfig, context);
      if (requestResult.isFailure()) {
        return requestResult as any;
      }

      const request = requestResult.data;

      // Execute single request
      const responseResult = await this.executeSingleRequest(request, options, context);

      if (responseResult.isSuccess()) {
        // Record success for circuit breaker
        this.errorHandler.recordSuccess(request);
        return responseResult;
      }

      const error = responseResult.error;

      // Check if retry is possible
      if (this.errorHandler.isRetryable(error, attempt)) {
        this.stats.retriesAttempted++;

        // Calculate delay
        const delay = this.errorHandler.calculateRetryDelay(attempt);

        // Wait before retry
        await this.sleep(delay);

        // Retry
        return this.executeWithRetry(requestConfig, options, context, attempt + 1);
      }

      // Record error for circuit breaker
      this.errorHandler.recordError(error);
      return responseResult;
    } catch (error) {
      const apicizeError = this.errorHandler.transformError(error, {} as HttpRequest, context);
      return failure(apicizeError);
    }
  }

  /**
   * Execute single request without retry
   */
  private async executeSingleRequest(
    request: HttpRequest,
    options: ExecutionOptions,
    context: ExecutionContext,
    redirectCount: number = 0
  ): Promise<Result<ProcessedResponse, ApicizeError>> {
    const startTime = Date.now();

    try {
      // Prepare fetch options
      const fetchOptions: RequestInit = {
        method: request.method,
        headers: request.headers.toRecord(),
        redirect: 'manual', // Handle redirects manually
      };

      // Add body if present
      const serializedBody = request.body.serialize();
      if (serializedBody !== undefined) {
        fetchOptions.body = serializedBody;
      }

      // Add abort signal if provided
      if (options.abortSignal) {
        fetchOptions.signal = options.abortSignal;
      }

      // Add timeout
      const timeoutMs = request.timeout || 30000;
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

      try {
        // Combine abort signals
        if (options.abortSignal || timeoutController.signal) {
          const combinedController = new AbortController();
          const signals = [timeoutController.signal, options.abortSignal].filter(Boolean);

          signals.forEach(signal => {
            if (signal && !signal.aborted) {
              signal.addEventListener('abort', () => combinedController.abort(), { once: true });
            }
          });

          fetchOptions.signal = combinedController.signal;
        }

        // Execute HTTP request
        const response = await this.httpClient.fetch(request.url.toString(), fetchOptions);

        // Clear timeout
        clearTimeout(timeoutId);

        // Handle redirects
        if (this.redirectHandler.isRedirect(response)) {
          this.stats.redirectsFollowed++;

          const redirectResult = this.redirectHandler.handleRedirect(
            response,
            request,
            redirectCount
          );
          if (redirectResult.isFailure()) {
            return redirectResult as any;
          }

          const redirectRequest = redirectResult.data;
          if (redirectRequest) {
            return this.executeSingleRequest(redirectRequest, options, context, redirectCount + 1);
          }
        }

        // Check for HTTP errors
        if (this.responseProcessor.isErrorResponse(response)) {
          const httpError = this.errorHandler.handleHttpError(response, request, context);
          return failure(httpError);
        }

        // Process response
        const processedResult = await this.responseProcessor.processResponse(
          response,
          request,
          context,
          startTime
        );

        return processedResult;
      } catch (error) {
        clearTimeout(timeoutId);

        // Handle specific error types
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            if (timeoutController.signal.aborted) {
              const timeoutError = this.errorHandler.handleTimeoutError(
                timeoutMs,
                request,
                context
              );
              return failure(timeoutError);
            } else {
              const abortError = this.errorHandler.handleAbortError(request, context);
              return failure(abortError);
            }
          }

          const networkError = this.errorHandler.handleNetworkError(error, request, context);
          return failure(networkError);
        }

        const unknownError = this.errorHandler.transformError(error, request, context);
        return failure(unknownError);
      }
    } catch (error) {
      const transformedError = this.errorHandler.transformError(error, request, context);
      return failure(transformedError);
    }
  }

  /**
   * Execute batch of requests
   */
  async executeBatch(
    requests: RequestConfig[],
    options: ExecutionOptions = {},
    context?: Partial<ExecutionContext>
  ): Promise<Result<ProcessedResponse[], ApicizeError>> {
    try {
      const results: ProcessedResponse[] = [];
      const errors: ApicizeError[] = [];

      // Execute in parallel or sequential based on options
      if (options.retryAttempts === undefined || options.retryAttempts <= 1) {
        // Parallel execution
        const promises = requests.map(request => this.execute(request, options, context));
        const batchResults = await Promise.all(promises);

        for (const result of batchResults) {
          if (result.isSuccess()) {
            results.push(result.data);
          } else {
            errors.push(result.error);
          }
        }
      } else {
        // Sequential execution for retry scenarios
        for (const request of requests) {
          const result = await this.execute(request, options, context);
          if (result.isSuccess()) {
            results.push(result.data);
          } else {
            errors.push(result.error);
          }
        }
      }

      if (errors.length > 0 && results.length === 0) {
        // All requests failed
        return failure(
          new ApicizeError(
            ApicizeErrorCode.EXECUTION_ERROR,
            `Batch execution failed: ${errors.length} requests failed`,
            {
              context: {
                totalRequests: requests.length,
                failedRequests: errors.length,
                errors: errors.map(e => e.message),
              },
            }
          )
        );
      }

      return success(results);
    } catch (error) {
      return failure(
        this.errorHandler.transformError(error, {} as HttpRequest, context as ExecutionContext)
      );
    }
  }

  /**
   * Get execution statistics
   */
  getStats(): ExecutionStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      requestsExecuted: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      totalResponseTime: 0,
      redirectsFollowed: 0,
      retriesAttempted: 0,
      circuitBreakerTrips: 0,
      errorsByType: {},
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ModularHttpClientConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Update component configurations
    if (newConfig.requestBuilder) {
      this.requestBuilder = this.requestBuilder.withConfig(newConfig.requestBuilder);
    }
    if (newConfig.responseProcessor) {
      this.responseProcessor = this.responseProcessor.withConfig(newConfig.responseProcessor);
    }
    if (newConfig.redirectHandler) {
      this.redirectHandler = this.redirectHandler.withConfig(newConfig.redirectHandler);
    }
    if (newConfig.errorHandler) {
      this.errorHandler = this.errorHandler.withConfig(newConfig.errorHandler);
    }
  }

  /**
   * Get component configurations
   */
  getConfig(): ModularHttpClientConfig {
    return {
      ...this.config,
      requestBuilder: this.requestBuilder.getConfig(),
      responseProcessor: this.responseProcessor.getConfig(),
      redirectHandler: this.redirectHandler.getConfig(),
      errorHandler: this.errorHandler.getConfig(),
    };
  }

  // Private helper methods

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private updateStats(
    result: Result<ProcessedResponse, ApicizeError>,
    executionTime: number
  ): void {
    this.stats.totalResponseTime += executionTime;
    this.stats.averageResponseTime = this.stats.totalResponseTime / this.stats.requestsExecuted;

    if (result.isSuccess()) {
      this.stats.successfulRequests++;
    } else {
      this.stats.failedRequests++;
      this.updateErrorStats(result.error);
    }
  }

  private updateErrorStats(error: ApicizeError): void {
    const errorType = error.code;
    this.stats.errorsByType[errorType] = (this.stats.errorsByType[errorType] || 0) + 1;
  }
}
