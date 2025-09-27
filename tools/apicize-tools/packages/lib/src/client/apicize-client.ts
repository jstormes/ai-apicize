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
 * Abstraction for fetch-like HTTP client
 */
export interface HttpClient {
  fetch(url: string, init?: RequestInit): Promise<Response>;
}

/**
 * Default HTTP client using native fetch
 */
export class DefaultHttpClient implements HttpClient {
  async fetch(url: string, init?: RequestInit): Promise<Response> {
    return fetch(url, init);
  }
}

/**
 * Abstraction for abort controller creation
 */
export interface AbortControllerFactory {
  create(): AbortController;
}

/**
 * Default abort controller factory
 */
export class DefaultAbortControllerFactory implements AbortControllerFactory {
  create(): AbortController {
    return new AbortController();
  }
}

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
  signal?: AbortSignal | undefined;
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
  constructor(timeout: number, method?: string, url?: string) {
    const methodPart = method ? ` ${method}` : '';
    const urlPart = url ? ` to ${url}` : '';
    super(`Request${methodPart}${urlPart} timed out after ${timeout}ms`, undefined, 'TIMEOUT');
    this.name = 'ApicizeTimeoutError';
  }
}

export class ApicizeNetworkError extends ApicizeRequestError {
  constructor(message: string, cause?: Error, url?: string) {
    const urlPart = url ? ` (${url})` : '';
    super(`Network error: ${message}${urlPart}`, cause, 'NETWORK_ERROR');
    this.name = 'ApicizeNetworkError';
  }
}

export class ApicizeAbortError extends ApicizeRequestError {
  constructor(reason: string = 'Request was aborted') {
    super(reason, undefined, 'ABORT_ERROR');
    this.name = 'ApicizeAbortError';
  }
}

/**
 * ApicizeClient - HTTP client for executing API requests using native fetch
 */
export class ApicizeClient {
  private config: ClientConfig;
  private httpClient: HttpClient;
  private abortControllerFactory: AbortControllerFactory;

  constructor(
    config: ClientConfig = {},
    httpClient: HttpClient = new DefaultHttpClient(),
    abortControllerFactory: AbortControllerFactory = new DefaultAbortControllerFactory()
  ) {
    this.config = {
      defaultTimeout: 30000,
      maxRedirects: 10,
      userAgent: 'Apicize-Client/1.0.0',
      acceptInvalidCerts: false,
      keepAlive: true,
      ...config,
    };
    this.httpClient = httpClient;
    this.abortControllerFactory = abortControllerFactory;
  }

  /**
   * Execute an HTTP request
   */
  async execute(
    requestConfig: RequestConfig,
    options: RequestOptions = {}
  ): Promise<ApicizeResponse> {
    const redirects: Array<{ url: string; status: number }> = [];

    try {
      // Merge options with client defaults, prioritizing requestConfig values
      const finalOptions: RequestOptions = {
        timeout: requestConfig.timeout ?? options.timeout ?? this.config.defaultTimeout!,
        maxRedirects: options.maxRedirects ?? this.config.maxRedirects!,
        acceptInvalidCerts: options.acceptInvalidCerts ?? this.config.acceptInvalidCerts!,
        keepAlive: options.keepAlive ?? this.config.keepAlive!,
        mode: options.mode,
        referrer: options.referrer,
        referrerPolicy: options.referrerPolicy,
        signal: options.signal,
      };

      // Build the request
      const { url, fetchOptions } = await this.buildRequest(requestConfig, finalOptions);

      // Execute with manual redirect handling and proper abort management
      const response = await this.executeWithRedirects(
        url,
        fetchOptions,
        finalOptions,
        requestConfig,
        redirects,
        0,
        Date.now()
      );

      return response;
    } catch (error) {
      if (error instanceof ApicizeRequestError) {
        throw error;
      }
      throw new ApicizeRequestError('Failed to execute request', error as Error);
    }
  }

  /**
   * Execute request with manual redirect handling and proper abort management
   */
  private async executeWithRedirects(
    url: string,
    fetchOptions: RequestInit,
    finalOptions: RequestOptions,
    requestConfig: RequestConfig,
    redirects: Array<{ url: string; status: number }>,
    redirectCount: number = 0,
    started: number = Date.now()
  ): Promise<ApicizeResponse> {
    // Create abort controller - use factory for testability
    const controller = this.abortControllerFactory.create();
    let timeoutId: NodeJS.Timeout | undefined;
    let isTimeoutAbort = false;

    // Handle existing aborted signal
    if (finalOptions.signal && finalOptions.signal.aborted) {
      throw new ApicizeAbortError('Request was aborted before execution');
    }

    // Set up timeout
    if (finalOptions.timeout && finalOptions.timeout > 0) {
      timeoutId = setTimeout(() => {
        isTimeoutAbort = true;
        controller.abort();
      }, finalOptions.timeout);
    }

    try {
      // Combine signals if one was passed in
      let signal = controller.signal;
      if (finalOptions.signal) {
        // Create a combined signal that aborts if either aborts
        const combinedController = this.abortControllerFactory.create();
        const originalSignal = finalOptions.signal;

        const abortHandler = () => combinedController.abort();
        controller.signal.addEventListener('abort', abortHandler, { once: true });
        originalSignal.addEventListener('abort', abortHandler, { once: true });

        signal = combinedController.signal;
      }

      // Execute the request with manual redirect=false to handle redirects ourselves
      const fetchResponse = await this.httpClient.fetch(url, {
        ...fetchOptions,
        signal,
        redirect: 'manual', // Handle redirects manually
      });

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Handle redirects manually for 3xx status codes
      if (this.isRedirectStatus(fetchResponse.status)) {
        const location = fetchResponse.headers.get('location');

        if (!location) {
          throw new ApicizeNetworkError(
            'Redirect response missing location header',
            undefined,
            url
          );
        }

        // Track the redirect
        redirects.push({
          url: location,
          status: fetchResponse.status,
        });

        // Check redirect limit
        if (redirectCount >= finalOptions.maxRedirects!) {
          throw new ApicizeNetworkError(
            `Too many redirects (limit: ${finalOptions.maxRedirects})`,
            undefined,
            url
          );
        }

        // Follow the redirect
        const redirectUrl = new URL(location, url).toString();
        return this.executeWithRedirects(
          redirectUrl,
          {
            ...fetchOptions,
            method: this.getRedirectMethod(fetchOptions.method as string, fetchResponse.status),
          },
          finalOptions,
          requestConfig,
          redirects,
          redirectCount + 1,
          started
        );
      }

      // Handle legacy fetch behavior where native redirects occurred
      if (fetchResponse.redirected && redirects.length === 0) {
        // This happens when fetch automatically handled redirects (shouldn't happen with redirect: 'manual')
        // but we support it for backward compatibility
        redirects.push({
          url: fetchResponse.url,
          status: fetchResponse.status,
        });
      }

      // Process the final response
      const response = await this.processResponse(fetchResponse, started);
      if (redirects.length > 0) {
        response.redirects = redirects;
      }

      return response;
    } catch (error) {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          // Check if it was a timeout abort or manual abort
          if (isTimeoutAbort) {
            throw new ApicizeTimeoutError(
              finalOptions.timeout!,
              requestConfig.method,
              requestConfig.url
            );
          } else {
            throw new ApicizeAbortError('Request was cancelled');
          }
        }
        throw new ApicizeNetworkError(error.message, error, requestConfig.url);
      }
      throw new ApicizeRequestError('Unknown error occurred', error as Error);
    }
  }

  /**
   * Check if status code indicates a redirect
   */
  private isRedirectStatus(status: number): boolean {
    return status >= 300 && status < 400 && status !== 304;
  }

  /**
   * Get appropriate HTTP method for redirect
   */
  private getRedirectMethod(originalMethod: string, status: number): string {
    // For 303, always use GET
    // For 301, 302, 307, 308 preserve original method (with some exceptions)
    if (status === 303) {
      return 'GET';
    }

    // For POST/PUT/PATCH on 301/302, browsers typically change to GET
    if (
      (status === 301 || status === 302) &&
      (originalMethod === 'POST' || originalMethod === 'PUT' || originalMethod === 'PATCH')
    ) {
      return 'GET';
    }

    return originalMethod;
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

      // Check for empty body or 204 No Content status
      if (!text || text.length === 0 || fetchResponse.status === 204) {
        return {
          type: BodyType.None,
          data: undefined,
          text: '',
          size: 0,
        };
      }

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
    return new ApicizeClient(
      { ...this.config, ...config },
      this.httpClient,
      this.abortControllerFactory
    );
  }

  /**
   * Get current client configuration
   */
  getConfig(): ClientConfig {
    return { ...this.config };
  }

  /**
   * Execute a request and return the abort controller for testing purposes
   */
  async executeWithController(
    requestConfig: RequestConfig,
    options: RequestOptions = {}
  ): Promise<{ response: ApicizeResponse; controller: AbortController }> {
    const controller = this.abortControllerFactory.create();
    const response = await this.execute(requestConfig, { ...options, signal: controller.signal });
    return { response, controller };
  }
}
