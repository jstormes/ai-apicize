/**
 * Fluent Request Builder - Phase 5 Developer Experience Enhancement
 *
 * Provides a fluent interface for building HTTP requests with method chaining
 * and type-safe configuration.
 */

import { RequestConfig, HttpMethod, BodyType, NameValuePair, ExecutionMode } from '../types';
import { ApicizeClient } from '../client/apicize-client';

export interface IFluentRequestBuilder {
  url(url: string): IFluentRequestBuilder;
  method(method: HttpMethod): IFluentRequestBuilder;
  get(): IFluentRequestBuilder;
  post(): IFluentRequestBuilder;
  put(): IFluentRequestBuilder;
  patch(): IFluentRequestBuilder;
  delete(): IFluentRequestBuilder;
  head(): IFluentRequestBuilder;
  options(): IFluentRequestBuilder;
  header(name: string, value: string): IFluentRequestBuilder;
  headers(headers: Record<string, string> | NameValuePair[]): IFluentRequestBuilder;
  timeout(milliseconds: number): IFluentRequestBuilder;
  redirects(count: number): IFluentRequestBuilder;
  body(content: string): IFluentRequestBuilder;
  json(data: object): IFluentRequestBuilder;
  xml(content: string): IFluentRequestBuilder;
  form(data: Record<string, string> | NameValuePair[]): IFluentRequestBuilder;
  raw(data: Uint8Array): IFluentRequestBuilder;
  query(name: string, value: string): IFluentRequestBuilder;
  queries(params: Record<string, string> | NameValuePair[]): IFluentRequestBuilder;
  keepAlive(enabled?: boolean): IFluentRequestBuilder;
  acceptInvalidCerts(enabled?: boolean): IFluentRequestBuilder;
  mode(mode: 'cors' | 'no-cors' | 'same-origin'): IFluentRequestBuilder;
  referrer(referrer: string): IFluentRequestBuilder;
  referrerPolicy(policy: string): IFluentRequestBuilder;
  duplex(duplex: string): IFluentRequestBuilder;
  runs(count: number): IFluentRequestBuilder;
  concurrent(): IFluentRequestBuilder;
  sequential(): IFluentRequestBuilder;
  execute(): Promise<any>;
  build(): RequestConfig;
}

/**
 * Fluent Request Builder Implementation
 *
 * Example usage:
 * ```typescript
 * const response = await RequestBuilder.create()
 *   .url('https://api.example.com/users')
 *   .post()
 *   .json({ name: 'John', email: 'john@example.com' })
 *   .header('Authorization', 'Bearer token')
 *   .timeout(5000)
 *   .execute();
 * ```
 */
export class RequestBuilder implements IFluentRequestBuilder {
  private config: Partial<RequestConfig> = {};
  private client?: ApicizeClient;

  private constructor(client?: ApicizeClient) {
    this.client = client;
  }

  /**
   * Creates a new fluent request builder
   * @param client Optional ApicizeClient instance for execution
   */
  static create(client?: ApicizeClient): RequestBuilder {
    return new RequestBuilder(client);
  }

  /**
   * Sets the request URL
   */
  url(url: string): RequestBuilder {
    this.config.url = url;
    return this;
  }

  /**
   * Sets the HTTP method
   */
  method(method: HttpMethod): RequestBuilder {
    this.config.method = method;
    return this;
  }

  /**
   * Sets method to GET
   */
  get(): RequestBuilder {
    return this.method(HttpMethod.GET);
  }

  /**
   * Sets method to POST
   */
  post(): RequestBuilder {
    return this.method(HttpMethod.POST);
  }

  /**
   * Sets method to PUT
   */
  put(): RequestBuilder {
    return this.method(HttpMethod.PUT);
  }

  /**
   * Sets method to PATCH
   */
  patch(): RequestBuilder {
    return this.method(HttpMethod.PATCH);
  }

  /**
   * Sets method to DELETE
   */
  delete(): RequestBuilder {
    return this.method(HttpMethod.DELETE);
  }

  /**
   * Sets method to HEAD
   */
  head(): RequestBuilder {
    return this.method(HttpMethod.HEAD);
  }

  /**
   * Sets method to OPTIONS
   */
  options(): RequestBuilder {
    return this.method(HttpMethod.OPTIONS);
  }

  /**
   * Adds a single header
   */
  header(name: string, value: string): RequestBuilder {
    if (!this.config.headers) {
      this.config.headers = [];
    }

    // Convert to NameValuePair format
    const headers = Array.isArray(this.config.headers)
      ? this.config.headers
      : Object.entries(this.config.headers).map(([n, v]) => ({ name: n, value: v }));

    headers.push({ name, value });
    this.config.headers = headers;
    return this;
  }

  /**
   * Sets multiple headers
   */
  headers(headers: Record<string, string> | NameValuePair[]): RequestBuilder {
    if (Array.isArray(headers)) {
      this.config.headers = [...headers];
    } else {
      this.config.headers = Object.entries(headers).map(([name, value]) => ({ name, value }));
    }
    return this;
  }

  /**
   * Sets request timeout in milliseconds
   */
  timeout(milliseconds: number): RequestBuilder {
    this.config.timeout = milliseconds;
    return this;
  }

  /**
   * Sets maximum number of redirects to follow
   */
  redirects(count: number): RequestBuilder {
    this.config.numberOfRedirects = count;
    return this;
  }

  /**
   * Sets text body content
   */
  body(content: string): RequestBuilder {
    this.config.body = {
      type: BodyType.Text,
      data: content,
    };
    return this;
  }

  /**
   * Sets JSON body content
   */
  json(data: object): RequestBuilder {
    this.config.body = {
      type: BodyType.JSON,
      data: data,
    };
    return this;
  }

  /**
   * Sets XML body content
   */
  xml(content: string): RequestBuilder {
    this.config.body = {
      type: BodyType.XML,
      data: content,
    };
    return this;
  }

  /**
   * Sets form data body
   */
  form(data: Record<string, string> | NameValuePair[]): RequestBuilder {
    const formData = Array.isArray(data)
      ? data
      : Object.entries(data).map(([name, value]) => ({ name, value }));

    this.config.body = {
      type: BodyType.Form,
      data: formData,
    };
    return this;
  }

  /**
   * Sets raw binary body content
   */
  raw(data: Uint8Array): RequestBuilder {
    this.config.body = {
      type: BodyType.Raw,
      data: data,
    };
    return this;
  }

  /**
   * Adds a single query parameter
   */
  query(name: string, value: string): RequestBuilder {
    if (!this.config.queryStringParams) {
      this.config.queryStringParams = [];
    }
    this.config.queryStringParams.push({ name, value });
    return this;
  }

  /**
   * Sets multiple query parameters
   */
  queries(params: Record<string, string> | NameValuePair[]): RequestBuilder {
    if (Array.isArray(params)) {
      this.config.queryStringParams = [...params];
    } else {
      this.config.queryStringParams = Object.entries(params).map(([name, value]) => ({
        name,
        value,
      }));
    }
    return this;
  }

  /**
   * Enables or disables keep-alive
   */
  keepAlive(enabled = true): RequestBuilder {
    this.config.keepAlive = enabled;
    return this;
  }

  /**
   * Enables or disables accepting invalid certificates
   */
  acceptInvalidCerts(enabled = true): RequestBuilder {
    this.config.acceptInvalidCerts = enabled;
    return this;
  }

  /**
   * Sets the CORS mode
   */
  mode(mode: 'cors' | 'no-cors' | 'same-origin'): RequestBuilder {
    this.config.mode = mode;
    return this;
  }

  /**
   * Sets the referrer
   */
  referrer(referrer: string): RequestBuilder {
    this.config.referrer = referrer;
    return this;
  }

  /**
   * Sets the referrer policy
   */
  referrerPolicy(policy: string): RequestBuilder {
    this.config.referrerPolicy = policy;
    return this;
  }

  /**
   * Sets the duplex mode
   */
  duplex(duplex: string): RequestBuilder {
    this.config.duplex = duplex;
    return this;
  }

  /**
   * Sets the number of times to run the request
   */
  runs(count: number): RequestBuilder {
    this.config.runs = count;
    return this;
  }

  /**
   * Sets execution mode to concurrent for multiple runs
   */
  concurrent(): RequestBuilder {
    this.config.multiRunExecution = ExecutionMode.CONCURRENT;
    return this;
  }

  /**
   * Sets execution mode to sequential for multiple runs
   */
  sequential(): RequestBuilder {
    this.config.multiRunExecution = ExecutionMode.SEQUENTIAL;
    return this;
  }

  /**
   * Executes the request using the provided client
   * @throws Error if no client was provided or no URL is set
   */
  async execute(): Promise<any> {
    if (!this.client) {
      throw new Error(
        'No ApicizeClient provided. Use RequestBuilder.create(client) or call build() instead.'
      );
    }

    const request = this.build();
    return await this.client.execute(request);
  }

  /**
   * Builds and returns the request configuration
   * @throws Error if required fields are missing
   */
  build(): RequestConfig {
    if (!this.config.url) {
      throw new Error('URL is required. Call url() before building.');
    }

    if (!this.config.method) {
      throw new Error(
        'HTTP method is required. Call method() or a method shortcut (get(), post(), etc.) before building.'
      );
    }

    // Set defaults
    const request: RequestConfig = {
      url: this.config.url,
      method: this.config.method,
      headers: this.config.headers || [],
      body: this.config.body || { type: BodyType.None },
      queryStringParams: this.config.queryStringParams || [],
      timeout: this.config.timeout || 30000,
      numberOfRedirects: this.config.numberOfRedirects || 10,
      runs: this.config.runs || 1,
      multiRunExecution: this.config.multiRunExecution || ExecutionMode.SEQUENTIAL,
      keepAlive: this.config.keepAlive || false,
      acceptInvalidCerts: this.config.acceptInvalidCerts || false,
      mode: this.config.mode,
      referrer: this.config.referrer,
      referrerPolicy: this.config.referrerPolicy,
      duplex: this.config.duplex,
    };

    return request;
  }

  /**
   * Clones the current builder state
   */
  clone(): RequestBuilder {
    const cloned = new RequestBuilder(this.client);
    cloned.config = JSON.parse(JSON.stringify(this.config));
    return cloned;
  }

  /**
   * Resets the builder to initial state
   */
  reset(): RequestBuilder {
    this.config = {};
    return this;
  }
}

export default RequestBuilder;
