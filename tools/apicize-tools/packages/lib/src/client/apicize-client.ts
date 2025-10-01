import {
  ApicizeResponse,
  RequestBody,
  RequestConfig,
  NameValuePair,
  BodyType,
  ApicizeResponseHeaders,
  ApicizeResponseBody,
  isBodyTypeJSON,
  isBodyTypeText,
  isBodyTypeForm,
  isBodyTypeXML,
  isBodyTypeRaw,
} from '../types';

// RequestInit is available globally via @types/node in Node.js 18+

/**
 * HTTP Client configuration options
 */
export interface ClientConfig {
  defaultTimeout?: number;
  maxRedirects?: number;
  userAgent?: string;
  acceptInvalidCerts?: boolean;
  keepAlive?: boolean;
}

/**
 * Request execution options
 */
export interface RequestOptions {
  timeout?: number | undefined;
  maxRedirects?: number | undefined;
  acceptInvalidCerts?: boolean | undefined;
  keepAlive?: boolean | undefined;
  mode?: RequestInit['mode'] | undefined;
  referrer?: string | undefined;
  referrerPolicy?: string | undefined;
}

/**
 * Error types for HTTP client
 */
export class ApicizeRequestError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'ApicizeRequestError';
  }
}

export class ApicizeTimeoutError extends ApicizeRequestError {
  constructor(timeout: number) {
    super(`Request timed out after ${timeout}ms`, undefined, 'TIMEOUT');
    this.name = 'ApicizeTimeoutError';
  }
}

export class ApicizeNetworkError extends ApicizeRequestError {
  constructor(message: string, cause?: Error) {
    super(`Network error: ${message}`, cause, 'NETWORK_ERROR');
    this.name = 'ApicizeNetworkError';
  }
}

/**
 * ApicizeClient - HTTP client for executing API requests using native fetch
 */
export class ApicizeClient {
  private config: ClientConfig;

  constructor(config: ClientConfig = {}) {
    this.config = {
      defaultTimeout: 30000,
      maxRedirects: 10,
      userAgent: 'Apicize-Client/1.0.0',
      acceptInvalidCerts: false,
      keepAlive: true,
      ...config,
    };
  }

  /**
   * Execute an HTTP request
   */
  async execute(
    requestConfig: RequestConfig,
    options: RequestOptions = {}
  ): Promise<ApicizeResponse> {
    const started = Date.now();
    const redirects: Array<{ url: string; status: number }> = [];

    try {
      // Merge options with client defaults
      const finalOptions: RequestOptions = {
        timeout: options.timeout ?? this.config.defaultTimeout!,
        maxRedirects: options.maxRedirects ?? this.config.maxRedirects!,
        acceptInvalidCerts: options.acceptInvalidCerts ?? this.config.acceptInvalidCerts!,
        keepAlive: options.keepAlive ?? this.config.keepAlive!,
        mode: options.mode,
        referrer: options.referrer,
        referrerPolicy: options.referrerPolicy,
      };

      // Build the request
      const { url, fetchOptions } = await this.buildRequest(requestConfig, finalOptions);

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, finalOptions.timeout);

      try {
        // Execute the request
        const fetchResponse = await fetch(url, {
          ...fetchOptions,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Track redirects
        if (fetchResponse.redirected) {
          // Note: fetch API doesn't provide redirect chain details
          // This is a limitation of the native fetch API
          redirects.push({
            url: fetchResponse.url,
            status: fetchResponse.status,
          });
        }

        // Process the response
        const response = await this.processResponse(fetchResponse, started);
        if (redirects.length > 0) {
          response.redirects = redirects;
        }

        return response;
      } catch (error) {
        clearTimeout(timeoutId);

        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            throw new ApicizeTimeoutError(finalOptions.timeout!);
          }
          throw new ApicizeNetworkError(error.message, error);
        }
        throw new ApicizeRequestError('Unknown error occurred', error as Error);
      }
    } catch (error) {
      if (error instanceof ApicizeRequestError) {
        throw error;
      }
      throw new ApicizeRequestError('Failed to execute request', error as Error);
    }
  }

  /**
   * Build fetch request options from RequestConfig
   */
  private async buildRequest(
    requestConfig: RequestConfig,
    options: RequestOptions
  ): Promise<{ url: string; fetchOptions: RequestInit }> {
    const url = this.buildUrl(requestConfig.url);
    const headers = this.buildHeaders(requestConfig.headers);
    const body = await this.buildBody(requestConfig.body);

    const fetchOptions: RequestInit = {
      method: requestConfig.method.toUpperCase(),
      headers,
    };

    // Add body only if it's not undefined
    if (body !== undefined) {
      fetchOptions.body = body;
    }

    // Add optional properties only if they are defined
    if (options.mode !== undefined) {
      fetchOptions.mode = options.mode;
    }
    if (options.referrer !== undefined) {
      fetchOptions.referrer = options.referrer;
    }
    if (typeof options.referrerPolicy === 'string') {
      (fetchOptions as any).referrerPolicy = options.referrerPolicy;
    }

    return { url, fetchOptions };
  }

  /**
   * Build the final URL
   */
  private buildUrl(url: string): string {
    try {
      new URL(url);
      return url;
    } catch {
      throw new ApicizeRequestError(`Invalid URL: ${url}`);
    }
  }

  /**
   * Build headers object for fetch
   */
  private buildHeaders(headers?: NameValuePair[] | Record<string, string>): Record<string, string> {
    const result: Record<string, string> = {
      'User-Agent': this.config.userAgent!,
    };

    if (Array.isArray(headers)) {
      headers.forEach(header => {
        if (!header.disabled) {
          result[header.name] = header.value;
        }
      });
    } else if (headers && typeof headers === 'object') {
      Object.assign(result, headers);
    }

    return result;
  }

  /**
   * Build request body for fetch
   */
  private async buildBody(
    body?: RequestBody | string | Buffer | Record<string, unknown>
  ): Promise<string | URLSearchParams | Uint8Array | undefined> {
    if (!body) {
      return undefined;
    }

    // Handle string body
    if (typeof body === 'string') {
      return body;
    }

    // Handle Buffer body
    if (Buffer.isBuffer(body)) {
      return body;
    }

    // Handle plain object body (convert to JSON)
    if (typeof body === 'object' && !('type' in body)) {
      return JSON.stringify(body);
    }

    // Handle RequestBody types
    const requestBody = body as RequestBody;

    switch (requestBody.type) {
      case BodyType.None:
        return undefined;

      case BodyType.Text:
        if (isBodyTypeText(requestBody)) {
          return requestBody.data;
        }
        break;

      case BodyType.JSON:
        if (isBodyTypeJSON(requestBody)) {
          return JSON.stringify(requestBody.data);
        }
        break;

      case BodyType.XML:
        if (isBodyTypeXML(requestBody)) {
          return requestBody.data;
        }
        break;

      case BodyType.Form:
        if (isBodyTypeForm(requestBody)) {
          const formData = new URLSearchParams();
          requestBody.data.forEach(pair => {
            if (!pair.disabled) {
              formData.append(pair.name, pair.value);
            }
          });
          return formData;
        }
        break;

      case BodyType.Raw:
        if (isBodyTypeRaw(requestBody)) {
          return requestBody.data;
        }
        break;

      default:
        throw new ApicizeRequestError(`Unsupported body type: ${(requestBody as any).type}`);
    }

    throw new ApicizeRequestError('Invalid body configuration');
  }

  /**
   * Process fetch response into ApicizeResponse
   */
  private async processResponse(
    fetchResponse: Response,
    startTime: number
  ): Promise<ApicizeResponse> {
    const headers = this.extractHeaders(fetchResponse.headers);
    const body = await this.extractBody(fetchResponse);
    const total = Date.now() - startTime;

    return {
      status: fetchResponse.status,
      statusText: fetchResponse.statusText,
      headers,
      body,
      timing: {
        started: startTime,
        total,
      },
    };
  }

  /**
   * Extract headers from fetch response
   */
  private extractHeaders(fetchHeaders: Headers): ApicizeResponseHeaders {
    const headers: ApicizeResponseHeaders = {};

    fetchHeaders.forEach((value, name) => {
      // Handle multiple headers with same name
      if (headers[name]) {
        if (Array.isArray(headers[name])) {
          (headers[name] as string[]).push(value);
        } else {
          headers[name] = [headers[name] as string, value];
        }
      } else {
        headers[name] = value;
      }
    });

    return headers;
  }

  /**
   * Extract body from fetch response
   */
  private async extractBody(fetchResponse: Response): Promise<ApicizeResponseBody> {
    const contentType = fetchResponse.headers.get('content-type') || '';
    let bodyType: BodyType;
    let data: unknown;
    let text: string;

    try {
      // Get response text first
      text = await fetchResponse.text();

      // Determine body type based on content-type
      if (contentType.includes('application/json')) {
        bodyType = BodyType.JSON;
        try {
          data = text ? JSON.parse(text) : null;
        } catch {
          // If JSON parsing fails, treat as text
          bodyType = BodyType.Text;
          data = text;
        }
      } else if (contentType.includes('application/xml') || contentType.includes('text/xml')) {
        bodyType = BodyType.XML;
        data = text;
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        bodyType = BodyType.Form;
        data = text;
      } else {
        bodyType = BodyType.Text;
        data = text;
      }

      return {
        type: bodyType,
        data,
        text,
        size: text.length,
      };
    } catch (error) {
      // If we can't read the body, return empty
      return {
        type: BodyType.None,
        data: undefined,
        text: '',
        size: 0,
      };
    }
  }

  /**
   * Create a new client with different configuration
   */
  withConfig(config: Partial<ClientConfig>): ApicizeClient {
    return new ApicizeClient({ ...this.config, ...config });
  }

  /**
   * Get current client configuration
   */
  getConfig(): ClientConfig {
    return { ...this.config };
  }
}
