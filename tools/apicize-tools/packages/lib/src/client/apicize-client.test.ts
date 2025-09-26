import {
  ApicizeClient,
  ClientConfig,
  RequestOptions,
  ApicizeRequestError,
  ApicizeTimeoutError,
  ApicizeNetworkError,
} from './apicize-client';
import { RequestConfig, BodyType, HttpMethod, NameValuePair } from '../types';

// Mock fetch globally for testing
const originalFetch = global.fetch;

interface MockFetchOptions {
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  body?: string;
  delay?: number;
  shouldReject?: boolean;
  redirected?: boolean;
  url?: string;
}

function mockFetch(options: MockFetchOptions = {}) {
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

  global.fetch = jest.fn().mockImplementation((_, init) => {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        if (shouldReject) {
          reject(new Error('Network error'));
          return;
        }

        const mockHeaders = new Headers(headers);
        const mockResponse = {
          status,
          statusText,
          headers: mockHeaders,
          redirected,
          url,
          text: jest.fn().mockResolvedValue(body),
          json: jest.fn().mockImplementation(() => {
            try {
              return Promise.resolve(JSON.parse(body));
            } catch {
              return Promise.reject(new Error('Invalid JSON'));
            }
          }),
        };

        resolve(mockResponse as any);
      }, delay);

      // Handle AbortController signal
      if (init?.signal) {
        const signal = init.signal as AbortSignal;
        if (signal.aborted) {
          clearTimeout(timeoutId);
          reject(new Error('AbortError'));
          return;
        }

        const abortHandler = () => {
          clearTimeout(timeoutId);
          const error = new Error('AbortError');
          error.name = 'AbortError';
          reject(error);
        };

        signal.addEventListener('abort', abortHandler, { once: true });
      }
    });
  });
}

function restoreFetch() {
  global.fetch = originalFetch;
}

describe('ApicizeClient', () => {
  let client: ApicizeClient;

  beforeEach(() => {
    client = new ApicizeClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    restoreFetch();
  });

  describe('Constructor and Configuration', () => {
    it('should create client with default configuration', () => {
      const client = new ApicizeClient();
      const config = client.getConfig();

      expect(config.defaultTimeout).toBe(30000);
      expect(config.maxRedirects).toBe(10);
      expect(config.userAgent).toBe('Apicize-Client/1.0.0');
      expect(config.acceptInvalidCerts).toBe(false);
      expect(config.keepAlive).toBe(true);
    });

    it('should create client with custom configuration', () => {
      const customConfig: ClientConfig = {
        defaultTimeout: 5000,
        maxRedirects: 5,
        userAgent: 'Custom-Agent/1.0.0',
        acceptInvalidCerts: true,
        keepAlive: false,
      };

      const client = new ApicizeClient(customConfig);
      const config = client.getConfig();

      expect(config.defaultTimeout).toBe(5000);
      expect(config.maxRedirects).toBe(5);
      expect(config.userAgent).toBe('Custom-Agent/1.0.0');
      expect(config.acceptInvalidCerts).toBe(true);
      expect(config.keepAlive).toBe(false);
    });

    it('should create client with modified configuration', () => {
      const client = new ApicizeClient();
      const newClient = client.withConfig({ defaultTimeout: 15000 });

      expect(client.getConfig().defaultTimeout).toBe(30000);
      expect(newClient.getConfig().defaultTimeout).toBe(15000);
    });
  });

  describe('Basic HTTP Requests', () => {
    it('should execute GET request successfully', async () => {
      mockFetch({
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        body: '{"message": "success"}',
      });

      const requestConfig: RequestConfig = {
        url: 'https://api.example.com/test',
        method: HttpMethod.GET,
      };

      const response = await client.execute(requestConfig);

      expect(response.status).toBe(200);
      expect(response.statusText).toBe('OK');
      expect(response.body.type).toBe(BodyType.JSON);
      expect(response.body.data).toEqual({ message: 'success' });
      expect(response.timing?.total).toBeGreaterThan(0);
    });

    it('should execute POST request with JSON body', async () => {
      mockFetch({
        status: 201,
        statusText: 'Created',
        headers: { 'content-type': 'application/json' },
        body: '{"id": 123}',
      });

      const requestConfig: RequestConfig = {
        url: 'https://api.example.com/users',
        method: HttpMethod.POST,
        body: {
          type: BodyType.JSON,
          data: { name: 'John Doe', email: 'john@example.com' },
        },
      };

      const response = await client.execute(requestConfig);

      expect(response.status).toBe(201);
      expect(response.body.data).toEqual({ id: 123 });
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/users',
        expect.objectContaining({
          method: 'POST',
          body: '{"name":"John Doe","email":"john@example.com"}',
        })
      );
    });

    it('should execute PUT request with text body', async () => {
      mockFetch({
        status: 200,
        headers: { 'content-type': 'text/plain' },
        body: 'Updated successfully',
      });

      const requestConfig: RequestConfig = {
        url: 'https://api.example.com/users/123',
        method: HttpMethod.PUT,
        body: {
          type: BodyType.Text,
          data: 'Updated user data',
        },
      };

      const response = await client.execute(requestConfig);

      expect(response.status).toBe(200);
      expect(response.body.type).toBe(BodyType.Text);
      expect(response.body.data).toBe('Updated successfully');
    });

    it('should execute DELETE request', async () => {
      mockFetch({
        status: 204,
        statusText: 'No Content',
        body: '',
      });

      const requestConfig: RequestConfig = {
        url: 'https://api.example.com/users/123',
        method: HttpMethod.DELETE,
      };

      const response = await client.execute(requestConfig);

      expect(response.status).toBe(204);
      expect(response.statusText).toBe('No Content');
    });
  });

  describe('Headers Handling', () => {
    it('should handle array-style headers', async () => {
      mockFetch();

      const headers: NameValuePair[] = [
        { name: 'Authorization', value: 'Bearer token123' },
        { name: 'Content-Type', value: 'application/json' },
        { name: 'X-Custom', value: 'custom-value', disabled: true },
      ];

      const requestConfig: RequestConfig = {
        url: 'https://api.example.com/test',
        method: HttpMethod.GET,
        headers,
      };

      await client.execute(requestConfig);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer token123',
            'Content-Type': 'application/json',
            'User-Agent': 'Apicize-Client/1.0.0',
          }),
        })
      );

      // Disabled header should not be included
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0][1];
      expect(fetchCall.headers['X-Custom']).toBeUndefined();
    });

    it('should handle object-style headers', async () => {
      mockFetch();

      const headers = {
        Authorization: 'Bearer token123',
        'Content-Type': 'application/json',
      };

      const requestConfig: RequestConfig = {
        url: 'https://api.example.com/test',
        method: HttpMethod.GET,
        headers,
      };

      await client.execute(requestConfig);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          headers: expect.objectContaining(headers),
        })
      );
    });

    it('should extract response headers correctly', async () => {
      mockFetch({
        headers: {
          'content-type': 'application/json',
          'x-rate-limit': '100',
          'set-cookie': 'session=abc123',
        },
      });

      const requestConfig: RequestConfig = {
        url: 'https://api.example.com/test',
        method: HttpMethod.GET,
      };

      const response = await client.execute(requestConfig);

      expect(response.headers['content-type']).toBe('application/json');
      expect(response.headers['x-rate-limit']).toBe('100');
      expect(response.headers['set-cookie']).toBe('session=abc123');
    });
  });

  describe('Body Types', () => {
    it('should handle None body type', async () => {
      mockFetch();

      const requestConfig: RequestConfig = {
        url: 'https://api.example.com/test',
        method: HttpMethod.GET,
        body: {
          type: BodyType.None,
        },
      };

      await client.execute(requestConfig);

      // Verify body is not set (undefined bodies are not included in RequestInit)
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0][1];
      expect(fetchCall.body).toBeUndefined();
    });

    it('should handle JSON body type', async () => {
      mockFetch();

      const requestConfig: RequestConfig = {
        url: 'https://api.example.com/test',
        method: HttpMethod.POST,
        body: {
          type: BodyType.JSON,
          data: { key: 'value', nested: { prop: 123 } },
        },
      };

      await client.execute(requestConfig);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          body: '{"key":"value","nested":{"prop":123}}',
        })
      );
    });

    it('should handle Text body type', async () => {
      mockFetch();

      const requestConfig: RequestConfig = {
        url: 'https://api.example.com/test',
        method: HttpMethod.POST,
        body: {
          type: BodyType.Text,
          data: 'Plain text content',
        },
      };

      await client.execute(requestConfig);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          body: 'Plain text content',
        })
      );
    });

    it('should handle XML body type', async () => {
      mockFetch();

      const requestConfig: RequestConfig = {
        url: 'https://api.example.com/test',
        method: HttpMethod.POST,
        body: {
          type: BodyType.XML,
          data: '<root><item>value</item></root>',
        },
      };

      await client.execute(requestConfig);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          body: '<root><item>value</item></root>',
        })
      );
    });

    it('should handle Form body type', async () => {
      mockFetch();

      const requestConfig: RequestConfig = {
        url: 'https://api.example.com/test',
        method: HttpMethod.POST,
        body: {
          type: BodyType.Form,
          data: [
            { name: 'username', value: 'john' },
            { name: 'password', value: 'secret' },
            { name: 'disabled', value: 'ignore', disabled: true },
          ],
        },
      };

      await client.execute(requestConfig);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0][1];
      expect(fetchCall.body).toBeInstanceOf(URLSearchParams);

      const formData = fetchCall.body as URLSearchParams;
      expect(formData.get('username')).toBe('john');
      expect(formData.get('password')).toBe('secret');
      expect(formData.get('disabled')).toBeNull(); // Disabled field should not be included
    });

    it('should handle Raw body type', async () => {
      mockFetch();

      const rawData = new Uint8Array([1, 2, 3, 4, 5]);
      const requestConfig: RequestConfig = {
        url: 'https://api.example.com/test',
        method: HttpMethod.POST,
        body: {
          type: BodyType.Raw,
          data: rawData,
        },
      };

      await client.execute(requestConfig);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          body: rawData,
        })
      );
    });

    it('should handle string body directly', async () => {
      mockFetch();

      const requestConfig: RequestConfig = {
        url: 'https://api.example.com/test',
        method: HttpMethod.POST,
        body: 'Direct string body',
      };

      await client.execute(requestConfig);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          body: 'Direct string body',
        })
      );
    });

    it('should handle plain object body (convert to JSON)', async () => {
      mockFetch();

      const requestConfig: RequestConfig = {
        url: 'https://api.example.com/test',
        method: HttpMethod.POST,
        body: { key: 'value' },
      };

      await client.execute(requestConfig);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          body: '{"key":"value"}',
        })
      );
    });
  });

  describe('Response Body Processing', () => {
    it('should detect JSON response body', async () => {
      mockFetch({
        headers: { 'content-type': 'application/json' },
        body: '{"message": "success", "code": 200}',
      });

      const requestConfig: RequestConfig = {
        url: 'https://api.example.com/test',
        method: HttpMethod.GET,
      };

      const response = await client.execute(requestConfig);

      expect(response.body.type).toBe(BodyType.JSON);
      expect(response.body.data).toEqual({ message: 'success', code: 200 });
      expect(response.body.text).toBe('{"message": "success", "code": 200}');
      expect(response.body.size).toBeGreaterThan(30); // Allow for minor variations in JSON formatting
    });

    it('should detect XML response body', async () => {
      mockFetch({
        headers: { 'content-type': 'application/xml' },
        body: '<root><message>success</message></root>',
      });

      const requestConfig: RequestConfig = {
        url: 'https://api.example.com/test',
        method: HttpMethod.GET,
      };

      const response = await client.execute(requestConfig);

      expect(response.body.type).toBe(BodyType.XML);
      expect(response.body.data).toBe('<root><message>success</message></root>');
    });

    it('should handle malformed JSON as text', async () => {
      mockFetch({
        headers: { 'content-type': 'application/json' },
        body: '{invalid json}',
      });

      const requestConfig: RequestConfig = {
        url: 'https://api.example.com/test',
        method: HttpMethod.GET,
      };

      const response = await client.execute(requestConfig);

      expect(response.body.type).toBe(BodyType.Text);
      expect(response.body.data).toBe('{invalid json}');
    });

    it('should handle form-encoded response', async () => {
      mockFetch({
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: 'key1=value1&key2=value2',
      });

      const requestConfig: RequestConfig = {
        url: 'https://api.example.com/test',
        method: HttpMethod.GET,
      };

      const response = await client.execute(requestConfig);

      expect(response.body.type).toBe(BodyType.Form);
      expect(response.body.data).toBe('key1=value1&key2=value2');
    });

    it('should default to text for unknown content types', async () => {
      mockFetch({
        headers: { 'content-type': 'application/octet-stream' },
        body: 'Binary-like content',
      });

      const requestConfig: RequestConfig = {
        url: 'https://api.example.com/test',
        method: HttpMethod.GET,
      };

      const response = await client.execute(requestConfig);

      expect(response.body.type).toBe(BodyType.Text);
      expect(response.body.data).toBe('Binary-like content');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      mockFetch({ shouldReject: true });

      const requestConfig: RequestConfig = {
        url: 'https://api.example.com/test',
        method: HttpMethod.GET,
      };

      await expect(client.execute(requestConfig)).rejects.toThrow(ApicizeNetworkError);
    });

    it('should handle timeout errors', async () => {
      const client = new ApicizeClient({ defaultTimeout: 100 });
      mockFetch({ delay: 200 });

      const requestConfig: RequestConfig = {
        url: 'https://api.example.com/test',
        method: HttpMethod.GET,
      };

      await expect(client.execute(requestConfig)).rejects.toThrow(ApicizeTimeoutError);
    });

    it('should handle invalid URLs', async () => {
      const requestConfig: RequestConfig = {
        url: 'invalid-url',
        method: HttpMethod.GET,
      };

      await expect(client.execute(requestConfig)).rejects.toThrow(ApicizeRequestError);
    });

    it('should handle timeout with custom options', async () => {
      mockFetch({ delay: 200 });

      const requestConfig: RequestConfig = {
        url: 'https://api.example.com/test',
        method: HttpMethod.GET,
      };

      const options: RequestOptions = {
        timeout: 100,
      };

      await expect(client.execute(requestConfig, options)).rejects.toThrow(ApicizeTimeoutError);
    });

    it('should handle unsupported body types', async () => {
      const requestConfig: RequestConfig = {
        url: 'https://api.example.com/test',
        method: HttpMethod.POST,
        body: {
          type: 'UnsupportedType' as any,
          data: 'test',
        },
      };

      await expect(client.execute(requestConfig)).rejects.toThrow(ApicizeRequestError);
    });
  });

  describe('Request Options', () => {
    it('should use custom timeout from options', async () => {
      mockFetch({ delay: 50 });

      const requestConfig: RequestConfig = {
        url: 'https://api.example.com/test',
        method: HttpMethod.GET,
      };

      const options: RequestOptions = {
        timeout: 100,
      };

      const response = await client.execute(requestConfig, options);
      expect(response.status).toBe(200);
    });

    it('should handle redirects', async () => {
      mockFetch({
        redirected: true,
        url: 'https://api.example.com/redirected',
      });

      const requestConfig: RequestConfig = {
        url: 'https://api.example.com/test',
        method: HttpMethod.GET,
      };

      const response = await client.execute(requestConfig);

      expect(response.redirects).toBeDefined();
      expect(response.redirects).toHaveLength(1);
      expect(response.redirects![0].url).toBe('https://api.example.com/redirected');
    });

    it('should pass fetch options correctly', async () => {
      mockFetch();

      const requestConfig: RequestConfig = {
        url: 'https://api.example.com/test',
        method: HttpMethod.GET,
      };

      const options: RequestOptions = {
        mode: 'cors',
        referrer: 'https://example.com',
        referrerPolicy: 'origin',
      };

      await client.execute(requestConfig, options);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          mode: 'cors',
          referrer: 'https://example.com',
          referrerPolicy: 'origin',
        })
      );
    });
  });

  describe('Timing Information', () => {
    it('should include timing information in response', async () => {
      const startTime = Date.now();
      mockFetch({ delay: 50 });

      const requestConfig: RequestConfig = {
        url: 'https://api.example.com/test',
        method: HttpMethod.GET,
      };

      const response = await client.execute(requestConfig);

      expect(response.timing).toBeDefined();
      expect(response.timing!.started).toBeGreaterThanOrEqual(startTime);
      expect(response.timing!.total).toBeGreaterThan(40); // At least the delay time
    });
  });

  describe('HTTP Methods Support', () => {
    const methods = [
      HttpMethod.GET,
      HttpMethod.POST,
      HttpMethod.PUT,
      HttpMethod.DELETE,
      HttpMethod.PATCH,
      HttpMethod.HEAD,
      HttpMethod.OPTIONS,
    ];

    methods.forEach(method => {
      it(`should support ${method} method`, async () => {
        mockFetch();

        const requestConfig: RequestConfig = {
          url: 'https://api.example.com/test',
          method,
        };

        const response = await client.execute(requestConfig);

        expect(response.status).toBe(200);
        expect(global.fetch).toHaveBeenCalledWith(
          'https://api.example.com/test',
          expect.objectContaining({
            method: method.toUpperCase(),
          })
        );
      });
    });
  });
});
