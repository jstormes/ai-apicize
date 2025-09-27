/**
 * Response Processor - Responsible for processing HTTP responses
 */

import { ApicizeResponseBody, BodyType } from '../../types';
import { HttpHeaders } from '../../domain/value-objects';
import { Result, success, failure } from '../../infrastructure/result';
import { ApicizeError, ApicizeErrorCode } from '../../infrastructure/errors';
import {
  HttpRequest,
  ProcessedResponse,
  ResponseTiming,
  ExecutionContext,
} from '../../domain/execution/execution-domain';

/**
 * Response processor configuration
 */
export interface ResponseProcessorConfig {
  maxResponseSize?: number;
  defaultEncoding?: string;
  parseJsonResponses?: boolean;
  parseXmlResponses?: boolean;
  preserveRawResponse?: boolean;
  includeTimingDetails?: boolean;
}

/**
 * Response processor implementation
 */
export class ApicizeResponseProcessor {
  private config: ResponseProcessorConfig;

  constructor(config: ResponseProcessorConfig = {}) {
    this.config = {
      maxResponseSize: 10 * 1024 * 1024, // 10MB
      defaultEncoding: 'utf-8',
      parseJsonResponses: true,
      parseXmlResponses: true,
      preserveRawResponse: false,
      includeTimingDetails: true,
      ...config,
    };
  }

  /**
   * Process raw HTTP response into ApicizeResponse
   */
  async processResponse(
    response: Response,
    request: HttpRequest,
    context?: ExecutionContext,
    startTime?: number
  ): Promise<Result<ProcessedResponse, ApicizeError>> {
    try {
      const processingStartTime = Date.now();
      const requestStartTime = startTime || processingStartTime;

      // Extract headers
      const headersResult = this.extractHeaders(response);
      if (headersResult.isFailure()) {
        return headersResult as any;
      }

      // Extract body
      const bodyResult = await this.extractBody(response);
      if (bodyResult.isFailure()) {
        return bodyResult as any;
      }

      // Calculate timing
      const timing = this.calculateTiming(requestStartTime, Date.now());

      const processedResponse: ProcessedResponse = {
        status: response.status,
        statusText: response.statusText,
        headers: headersResult.data.toRecord(),
        body: bodyResult.data,
        timing,
        redirects: [], // Will be populated by redirect handler if needed
        executionId: context?.executionId || 'unknown',
        requestId: context?.requestId || (request.metadata.requestId as string) || 'unknown',
        processingTime: Date.now() - processingStartTime,
      };

      return success(processedResponse);
    } catch (error) {
      return failure(
        new ApicizeError(ApicizeErrorCode.INTERNAL_ERROR, 'Failed to process HTTP response', {
          cause: error as Error,
          context: {
            status: response.status,
            url: request.url.toString(),
            method: request.method,
          },
        })
      );
    }
  }

  /**
   * Extract headers from Response object
   */
  extractHeaders(response: Response): Result<HttpHeaders, ApicizeError> {
    try {
      const headers = new HttpHeaders();

      response.headers.forEach((value, name) => {
        headers.add(name, value);
      });

      return success(headers);
    } catch (error) {
      return failure(
        new ApicizeError(ApicizeErrorCode.INTERNAL_ERROR, 'Failed to extract response headers', {
          cause: error as Error,
        })
      );
    }
  }

  /**
   * Extract and process response body
   */
  async extractBody(response: Response): Promise<Result<ApicizeResponseBody, ApicizeError>> {
    try {
      const contentType = response.headers.get('content-type') || '';
      const contentLength = response.headers.get('content-length');

      // Check response size
      if (contentLength && parseInt(contentLength) > this.config.maxResponseSize!) {
        return failure(
          new ApicizeError(
            ApicizeErrorCode.INVALID_ARGUMENT,
            `Response size (${contentLength}) exceeds maximum allowed size (${this.config.maxResponseSize})`,
            { context: { contentLength, maxSize: this.config.maxResponseSize } }
          )
        );
      }

      // Handle empty responses
      if (response.status === 204 || !response.body) {
        return success({
          type: BodyType.None,
          data: undefined,
          text: '',
          size: 0,
        });
      }

      // Get response text
      let text: string;
      try {
        text = await response.text();
      } catch (error) {
        return failure(
          new ApicizeError(ApicizeErrorCode.NETWORK_ERROR, 'Failed to read response body', {
            cause: error as Error,
          })
        );
      }

      // Check actual size after reading
      if (text.length > this.config.maxResponseSize!) {
        return failure(
          new ApicizeError(
            ApicizeErrorCode.INVALID_ARGUMENT,
            `Response body size (${text.length}) exceeds maximum allowed size (${this.config.maxResponseSize})`,
            { context: { actualSize: text.length, maxSize: this.config.maxResponseSize } }
          )
        );
      }

      // Determine body type and parse accordingly
      const bodyResult = this.parseResponseBody(text, contentType);
      return bodyResult;
    } catch (error) {
      return failure(
        new ApicizeError(ApicizeErrorCode.INTERNAL_ERROR, 'Failed to extract response body', {
          cause: error as Error,
        })
      );
    }
  }

  /**
   * Parse response body based on content type
   */
  private parseResponseBody(
    text: string,
    contentType: string
  ): Result<ApicizeResponseBody, ApicizeError> {
    try {
      let bodyType: BodyType;
      let data: unknown;

      // Empty body
      if (!text || text.length === 0) {
        return success({
          type: BodyType.None,
          data: undefined,
          text: '',
          size: 0,
        });
      }

      // JSON content
      if (contentType.includes('application/json') && this.config.parseJsonResponses) {
        try {
          data = JSON.parse(text);
          bodyType = BodyType.JSON;
        } catch (parseError) {
          // If JSON parsing fails, treat as text
          data = text;
          bodyType = BodyType.Text;
        }
      }
      // XML content
      else if (
        (contentType.includes('application/xml') || contentType.includes('text/xml')) &&
        this.config.parseXmlResponses
      ) {
        data = text;
        bodyType = BodyType.XML;
      }
      // Form data
      else if (contentType.includes('application/x-www-form-urlencoded')) {
        data = text;
        bodyType = BodyType.Form;
      }
      // Default to text
      else {
        data = text;
        bodyType = BodyType.Text;
      }

      return success({
        type: bodyType,
        data,
        text,
        size: text.length,
      });
    } catch (error) {
      return failure(
        new ApicizeError(ApicizeErrorCode.PARSE_ERROR, 'Failed to parse response body', {
          cause: error as Error,
          context: { contentType, textLength: text.length },
        })
      );
    }
  }

  /**
   * Calculate response timing information
   */
  calculateTiming(startTime: number, endTime: number): ResponseTiming {
    const total = endTime - startTime;

    let timing: ResponseTiming = {
      started: startTime,
      total,
    };

    // Add detailed timing if configured and available
    if (this.config.includeTimingDetails) {
      // Note: Detailed timing (DNS, TCP, TLS) would need browser Performance API
      // or similar instrumentation which isn't available in the fetch API
      // These would be populated by more sophisticated HTTP clients
      const estimatedRequest = total * 0.1;
      const estimatedFirstByte = total * 0.8;
      const estimatedDownload = total * 0.1;

      // Create new timing object with estimates
      timing = {
        ...timing,
        request: estimatedRequest,
        firstByte: estimatedFirstByte,
        download: estimatedDownload,
      };
    }

    return timing;
  }

  /**
   * Process response for specific content types
   */
  async processSpecificContentType(
    response: Response,
    expectedContentType: string
  ): Promise<Result<any, ApicizeError>> {
    const contentType = response.headers.get('content-type') || '';

    if (!contentType.includes(expectedContentType)) {
      return failure(
        new ApicizeError(
          ApicizeErrorCode.VALIDATION_ERROR,
          `Expected content type '${expectedContentType}' but got '${contentType}'`,
          { context: { expected: expectedContentType, actual: contentType } }
        )
      );
    }

    try {
      if (expectedContentType.includes('json')) {
        const data = await response.json();
        return success(data);
      } else if (expectedContentType.includes('text')) {
        const data = await response.text();
        return success(data);
      } else {
        const data = await response.blob();
        return success(data);
      }
    } catch (error) {
      return failure(
        new ApicizeError(
          ApicizeErrorCode.PARSE_ERROR,
          `Failed to parse ${expectedContentType} response`,
          { cause: error as Error }
        )
      );
    }
  }

  /**
   * Check if response indicates an error
   */
  isErrorResponse(response: Response): boolean {
    return response.status >= 400;
  }

  /**
   * Check if response is successful
   */
  isSuccessResponse(response: Response): boolean {
    return response.status >= 200 && response.status < 300;
  }

  /**
   * Check if response is a redirect
   */
  isRedirectResponse(response: Response): boolean {
    return response.status >= 300 && response.status < 400;
  }

  /**
   * Get response size estimate
   */
  getResponseSize(response: ApicizeResponseBody): number {
    if (response.size !== undefined) {
      return response.size;
    }

    if (response.text) {
      return new Blob([response.text]).size;
    }

    if (response.data) {
      try {
        return new Blob([JSON.stringify(response.data)]).size;
      } catch {
        return 0;
      }
    }

    return 0;
  }

  /**
   * Create a copy with different configuration
   */
  withConfig(newConfig: Partial<ResponseProcessorConfig>): ApicizeResponseProcessor {
    return new ApicizeResponseProcessor({ ...this.config, ...newConfig });
  }

  /**
   * Get current configuration
   */
  getConfig(): ResponseProcessorConfig {
    return { ...this.config };
  }
}
