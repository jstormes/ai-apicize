/**
 * Request Builder - Responsible for constructing HTTP requests
 */

import { RequestConfig, NameValuePair, RequestBody } from '../../types';
import { Url, HttpHeaders, RequestBodyValue, QueryParameters } from '../../domain/value-objects';
import { Result, success, failure } from '../../infrastructure/result';
import { ApicizeError, ApicizeErrorCode } from '../../infrastructure/errors';
import { HttpRequest, ExecutionContext } from '../../domain/execution/execution-domain';

/**
 * Request builder configuration
 */
export interface RequestBuilderConfig {
  defaultUserAgent?: string;
  validateUrls?: boolean;
  maxUrlLength?: number;
  defaultTimeout?: number;
}

/**
 * Request builder implementation
 */
export class ApicizeRequestBuilder {
  private config: RequestBuilderConfig;

  constructor(config: RequestBuilderConfig = {}) {
    this.config = {
      defaultUserAgent: 'Apicize-Client/1.0.0',
      validateUrls: true,
      maxUrlLength: 2048,
      defaultTimeout: 30000,
      ...config,
    };
  }

  /**
   * Build complete HTTP request from config
   */
  async buildRequest(
    requestConfig: RequestConfig,
    context?: Partial<ExecutionContext>
  ): Promise<Result<HttpRequest, ApicizeError>> {
    try {
      // Build URL
      const urlResult = this.buildUrl(requestConfig.url);
      if (urlResult.isFailure()) {
        return urlResult as any;
      }

      // Build headers
      const headersResult = this.buildHeaders(requestConfig.headers);
      if (headersResult.isFailure()) {
        return headersResult as any;
      }

      // Build body
      const bodyResult = this.buildBody(requestConfig.body);
      if (bodyResult.isFailure()) {
        return bodyResult as any;
      }

      // Build query parameters (if any)
      const queryParams = new QueryParameters();

      // Set appropriate content type if not already set
      const headers = headersResult.data;
      const body = bodyResult.data;

      if (!body.isEmpty() && !headers.has('content-type')) {
        const contentType = body.getContentType();
        if (contentType) {
          headers.setContentType(contentType);
        }
      }

      // Set default user agent if not present
      if (!headers.has('user-agent') && this.config.defaultUserAgent) {
        headers.set('user-agent', this.config.defaultUserAgent);
      }

      const httpRequest: HttpRequest = {
        url: urlResult.data,
        method: requestConfig.method as any,
        headers,
        body,
        queryParams,
        timeout: requestConfig.timeout || this.config.defaultTimeout || 30000,
        metadata: {
          buildTime: Date.now(),
          context: context || {},
        },
      };

      return success(httpRequest);
    } catch (error) {
      return failure(
        new ApicizeError(ApicizeErrorCode.INTERNAL_ERROR, 'Failed to build HTTP request', {
          cause: error as Error,
        })
      );
    }
  }

  /**
   * Build URL from string with validation
   */
  buildUrl(urlString: string): Result<Url, ApicizeError> {
    try {
      if (!urlString || typeof urlString !== 'string') {
        return failure(
          new ApicizeError(ApicizeErrorCode.INVALID_ARGUMENT, 'URL cannot be empty or non-string', {
            context: { url: urlString },
          })
        );
      }

      if (this.config.validateUrls && urlString.length > this.config.maxUrlLength!) {
        return failure(
          new ApicizeError(
            ApicizeErrorCode.INVALID_ARGUMENT,
            `URL exceeds maximum length of ${this.config.maxUrlLength} characters`,
            { context: { url: urlString, length: urlString.length } }
          )
        );
      }

      const url = new Url(urlString);
      return success(url);
    } catch (error) {
      if (error instanceof ApicizeError) {
        return failure(error);
      }

      return failure(
        new ApicizeError(ApicizeErrorCode.INVALID_ARGUMENT, `Invalid URL format: ${urlString}`, {
          cause: error as Error,
          context: { url: urlString },
        })
      );
    }
  }

  /**
   * Build headers from various input formats
   */
  buildHeaders(
    headers?: NameValuePair[] | Record<string, string>
  ): Result<HttpHeaders, ApicizeError> {
    try {
      const httpHeaders = new HttpHeaders(headers);
      return success(httpHeaders);
    } catch (error) {
      return failure(
        new ApicizeError(ApicizeErrorCode.INVALID_ARGUMENT, 'Failed to build HTTP headers', {
          cause: error as Error,
          context: { headers },
        })
      );
    }
  }

  /**
   * Build request body with validation
   */
  buildBody(
    body?: RequestBody | string | Buffer | Record<string, unknown>
  ): Result<RequestBodyValue, ApicizeError> {
    try {
      if (!body) {
        return success(RequestBodyValue.none());
      }

      // Handle string body
      if (typeof body === 'string') {
        return success(RequestBodyValue.text(body));
      }

      // Handle Buffer body
      if (Buffer.isBuffer(body)) {
        return success(RequestBodyValue.raw(new Uint8Array(body)));
      }

      // Handle plain object body (convert to JSON)
      if (typeof body === 'object' && !('type' in body)) {
        return success(RequestBodyValue.json(body as Record<string, unknown>));
      }

      // Handle RequestBody types
      const requestBody = body as RequestBody;
      const bodyValue = new RequestBodyValue(requestBody);
      return success(bodyValue);
    } catch (error) {
      if (error instanceof ApicizeError) {
        return failure(error);
      }

      return failure(
        new ApicizeError(ApicizeErrorCode.INVALID_ARGUMENT, 'Failed to build request body', {
          cause: error as Error,
          context: { bodyType: typeof body },
        })
      );
    }
  }

  /**
   * Build query parameters
   */
  buildQueryParameters(
    params?: NameValuePair[] | Record<string, string>
  ): Result<QueryParameters, ApicizeError> {
    try {
      const queryParams = new QueryParameters(params);
      return success(queryParams);
    } catch (error) {
      return failure(
        new ApicizeError(ApicizeErrorCode.INVALID_ARGUMENT, 'Failed to build query parameters', {
          cause: error as Error,
          context: { params },
        })
      );
    }
  }

  /**
   * Validate request before building
   */
  validateRequest(config: RequestConfig): Result<boolean, ApicizeError> {
    const errors: string[] = [];

    // Validate URL
    if (!config.url) {
      errors.push('URL is required');
    }

    // Validate method
    if (!config.method) {
      errors.push('HTTP method is required');
    }

    // Validate timeout
    if (config.timeout !== undefined && (config.timeout < 0 || config.timeout > 300000)) {
      errors.push('Timeout must be between 0 and 300000ms');
    }

    if (errors.length > 0) {
      return failure(
        new ApicizeError(
          ApicizeErrorCode.VALIDATION_ERROR,
          `Request validation failed: ${errors.join(', ')}`,
          { context: { errors, config } }
        )
      );
    }

    return success(true);
  }

  /**
   * Create a copy with different configuration
   */
  withConfig(newConfig: Partial<RequestBuilderConfig>): ApicizeRequestBuilder {
    return new ApicizeRequestBuilder({ ...this.config, ...newConfig });
  }

  /**
   * Get current configuration
   */
  getConfig(): RequestBuilderConfig {
    return { ...this.config };
  }
}
