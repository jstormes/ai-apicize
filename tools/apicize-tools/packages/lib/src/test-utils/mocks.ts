import { jest } from '@jest/globals';

export interface MockFetchOptions {
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  body?: any;
  delay?: number;
  shouldReject?: boolean;
  redirected?: boolean;
  url?: string;
}

export interface MockResponse<T = any> extends Partial<Response> {
  ok: boolean;
  json: jest.MockedFunction<() => Promise<T>>;
  text: jest.MockedFunction<() => Promise<string>>;
  status: number;
  statusText: string;
}

/**
 * Creates a properly typed mock response object
 */
export function createMockResponse<T = any>(
  data: T,
  ok: boolean = true,
  status?: number
): MockResponse<T> {
  const responseStatus = status ?? (ok ? 200 : 400);
  const responseStatusText = ok ? 'OK' : 'Bad Request';

  return {
    ok,
    status: responseStatus,
    statusText: responseStatusText,
    headers: new Headers(),
    redirected: false,
    url: '',
    json: jest.fn<() => Promise<T>>().mockImplementation(() => {
      if (typeof data === 'string') {
        try {
          return Promise.resolve(JSON.parse(data) as T);
        } catch {
          return Promise.reject(new Error('Invalid JSON'));
        }
      }
      return Promise.resolve(data);
    }),
    text: jest.fn<() => Promise<string>>().mockImplementation(() => {
      if (typeof data === 'string') {
        return Promise.resolve(data);
      }
      return Promise.resolve(JSON.stringify(data));
    }),
    blob: jest.fn<() => Promise<Blob>>().mockResolvedValue(new Blob([])),
    arrayBuffer: jest.fn<() => Promise<ArrayBuffer>>().mockResolvedValue(new ArrayBuffer(0)),
    formData: jest.fn<() => Promise<FormData>>().mockResolvedValue(new FormData()),
    clone: jest.fn<() => Response>(),
    body: null,
    bodyUsed: false,
    type: 'basic' as any,
  };
}

/**
 * Creates a mock fetch implementation with configurable behavior
 */
export function createMockFetch(options: MockFetchOptions = {}) {
  const {
    status = 200,
    statusText = 'OK',
    headers = {},
    body = '{"success": true}',
    delay = 0,
    shouldReject = false,
    redirected = false,
    url = 'https://api.example.com/test',
  } = options;

  return jest.fn().mockImplementation((...args: any[]) => {
    const [_requestUrl, init] = args;
    return new Promise((resolve, reject) => {
      let timeoutId: NodeJS.Timeout | undefined;

      const executeResponse = () => {
        if (shouldReject) {
          reject(new Error('Network error'));
          return;
        }

        const mockHeaders = new Headers(headers);
        const mockResponse = createMockResponse(body, status >= 200 && status < 300, status);

        // Override specific properties
        Object.assign(mockResponse, {
          status,
          statusText,
          headers: mockHeaders,
          redirected,
          url,
        });

        resolve(mockResponse as any);
      };

      if (delay > 0) {
        timeoutId = setTimeout(executeResponse, delay);
      } else {
        executeResponse();
      }

      // Handle AbortController signal if provided
      if (init?.signal) {
        const signal = init.signal as AbortSignal;

        if (signal.aborted) {
          if (timeoutId) clearTimeout(timeoutId);
          const error = new Error('AbortError');
          error.name = 'AbortError';
          reject(error);
          return;
        }

        const abortHandler = () => {
          if (timeoutId) clearTimeout(timeoutId);
          const error = new Error('AbortError');
          error.name = 'AbortError';
          reject(error);
        };

        signal.addEventListener('abort', abortHandler, { once: true });
      }
    });
  });
}

/**
 * Sets up fetch mock with common patterns
 */
export class FetchMockBuilder {
  private mockFetch: jest.MockedFunction<typeof fetch>;
  private responses: Map<string | RegExp, MockFetchOptions> = new Map();
  private defaultOptions: MockFetchOptions = {};

  constructor() {
    this.mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
    global.fetch = this.mockFetch;
  }

  /**
   * Set default options for all requests
   */
  withDefaults(options: MockFetchOptions): this {
    this.defaultOptions = options;
    return this;
  }

  /**
   * Mock a specific URL pattern with custom options
   */
  whenUrl(pattern: string | RegExp, options: MockFetchOptions): this {
    this.responses.set(pattern, options);
    this.updateMockImplementation();
    return this;
  }

  /**
   * Mock successful JSON response
   */
  mockJsonResponse(url: string | RegExp, data: any, status = 200): this {
    return this.whenUrl(url, {
      status,
      body: data,
      headers: { 'content-type': 'application/json' },
    });
  }

  /**
   * Mock error response
   */
  mockErrorResponse(url: string | RegExp, message: string, status = 500): this {
    return this.whenUrl(url, {
      status,
      statusText: message,
      body: { error: message },
    });
  }

  /**
   * Mock network failure
   */
  mockNetworkError(url: string | RegExp): this {
    return this.whenUrl(url, { shouldReject: true });
  }

  /**
   * Get the mock fetch function
   */
  getMock(): jest.MockedFunction<typeof fetch> {
    return this.mockFetch;
  }

  /**
   * Reset all mocks
   */
  reset(): void {
    this.responses.clear();
    this.mockFetch.mockClear();
  }

  /**
   * Restore original fetch
   */
  restore(): void {
    if ('fetch' in global) {
      delete (global as any).fetch;
    }
  }

  private updateMockImplementation(): void {
    this.mockFetch.mockImplementation((...args: any[]) => {
      const [url, init] = args;
      const urlString = typeof url === 'string' ? url : url.toString();

      // Find matching pattern
      for (const [pattern, options] of this.responses) {
        const matches = typeof pattern === 'string'
          ? urlString === pattern
          : pattern.test(urlString);

        if (matches) {
          const mergedOptions = { ...this.defaultOptions, ...options };
          return createMockFetch(mergedOptions)(url as any, init) as any;
        }
      }

      // Use default options if no pattern matches
      return createMockFetch(this.defaultOptions)(url as any, init) as any;
    });
  }
}

/**
 * Utility to save and restore the original fetch
 */
export class FetchMockManager {
  private originalFetch: typeof fetch | undefined;

  save(): void {
    this.originalFetch = global.fetch;
  }

  restore(): void {
    if (this.originalFetch) {
      global.fetch = this.originalFetch;
    }
  }

  mock(options?: MockFetchOptions): jest.MockedFunction<typeof fetch> {
    const mockFn = createMockFetch(options) as jest.MockedFunction<typeof fetch>;
    global.fetch = mockFn;
    return mockFn;
  }
}

/**
 * Create a delay promise for testing async behavior
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create an abortable fetch mock for testing cancellation
 */
export function createAbortableFetch(delay: number = 100) {
  const controller = new AbortController();
  const mockFetch = createMockFetch({ delay });

  return {
    fetch: mockFetch,
    controller,
    abort: () => controller.abort(),
  };
}