/**
 * Value objects for complex data structures
 * Provides encapsulation, validation, and behavior for core domain concepts
 */

import {
  NameValuePair,
  BodyType,
  HttpMethod,
  RequestBody,
  isBodyTypeJSON,
  isBodyTypeText,
  isBodyTypeForm,
  isBodyTypeXML,
  isBodyTypeRaw,
  isBodyTypeNone,
} from '../types';
import { ApicizeValidationError } from '../infrastructure/errors';

/**
 * URL value object with validation and parsing
 */
export class Url {
  private readonly _value: string;
  private readonly _parsed: URL;

  constructor(value: string) {
    if (!value || typeof value !== 'string') {
      throw new ApicizeValidationError('URL cannot be empty', {
        field: 'url',
        value,
        rule: 'must be a non-empty string',
      });
    }

    try {
      this._parsed = new URL(value);
      this._value = value;
    } catch (error) {
      throw new ApicizeValidationError(`Invalid URL format: ${value}`, {
        field: 'url',
        value,
        rule: 'must be a valid URL format',
        cause: error as Error,
      });
    }
  }

  get value(): string {
    return this._value;
  }

  get protocol(): string {
    return this._parsed.protocol;
  }

  get host(): string {
    return this._parsed.host;
  }

  get pathname(): string {
    return this._parsed.pathname;
  }

  get search(): string {
    return this._parsed.search;
  }

  get origin(): string {
    return this._parsed.origin;
  }

  /**
   * Check if URL is secure (HTTPS)
   */
  isSecure(): boolean {
    return this.protocol === 'https:';
  }

  /**
   * Check if URL is local
   */
  isLocal(): boolean {
    return (
      this.host === 'localhost' || this.host.startsWith('127.') || this.host.startsWith('192.168.')
    );
  }

  /**
   * Create a new URL with modified path
   */
  withPath(path: string): Url {
    const newUrl = new URL(this._value);
    newUrl.pathname = path;
    return new Url(newUrl.toString());
  }

  /**
   * Create a new URL with query parameters
   */
  withQuery(params: Record<string, string>): Url {
    const newUrl = new URL(this._value);
    Object.entries(params).forEach(([key, value]) => {
      newUrl.searchParams.set(key, value);
    });
    return new Url(newUrl.toString());
  }

  toString(): string {
    return this._value;
  }

  equals(other: Url): boolean {
    return this._value === other._value;
  }
}

/**
 * HTTP Headers value object with case-insensitive operations
 */
export class HttpHeaders {
  private readonly headers: Map<string, string[]>;

  constructor(headers?: NameValuePair[] | Record<string, string> | HttpHeaders) {
    this.headers = new Map();

    if (headers instanceof HttpHeaders) {
      headers.headers.forEach((values, key) => {
        this.headers.set(key, [...values]);
      });
    } else if (Array.isArray(headers)) {
      headers.forEach(header => {
        if (!header.disabled) {
          this.add(header.name, header.value);
        }
      });
    } else if (headers && typeof headers === 'object') {
      Object.entries(headers).forEach(([name, value]) => {
        this.set(name, value);
      });
    }
  }

  /**
   * Set header value (replaces existing)
   */
  set(name: string, value: string): void {
    const normalizedName = this.normalizeName(name);
    this.headers.set(normalizedName, [value]);
  }

  /**
   * Add header value (appends to existing)
   */
  add(name: string, value: string): void {
    const normalizedName = this.normalizeName(name);
    const existing = this.headers.get(normalizedName) || [];
    this.headers.set(normalizedName, [...existing, value]);
  }

  /**
   * Get header value(s)
   */
  get(name: string): string | string[] | undefined {
    const normalizedName = this.normalizeName(name);
    const values = this.headers.get(normalizedName);
    if (!values || values.length === 0) return undefined;
    return values.length === 1 ? values[0] : values;
  }

  /**
   * Get first header value
   */
  getFirst(name: string): string | undefined {
    const normalizedName = this.normalizeName(name);
    const values = this.headers.get(normalizedName);
    return values && values.length > 0 ? values[0] : undefined;
  }

  /**
   * Check if header exists
   */
  has(name: string): boolean {
    return this.headers.has(this.normalizeName(name));
  }

  /**
   * Remove header
   */
  delete(name: string): void {
    this.headers.delete(this.normalizeName(name));
  }

  /**
   * Get all headers as NameValuePair array
   */
  toNameValuePairs(): NameValuePair[] {
    const pairs: NameValuePair[] = [];
    this.headers.forEach((values, name) => {
      values.forEach(value => {
        pairs.push({ name, value });
      });
    });
    return pairs;
  }

  /**
   * Get all headers as Record
   */
  toRecord(): Record<string, string> {
    const record: Record<string, string> = {};
    this.headers.forEach((values, name) => {
      record[name] = values.join(', ');
    });
    return record;
  }

  /**
   * Get content type
   */
  getContentType(): string | undefined {
    return this.getFirst('content-type');
  }

  /**
   * Set content type
   */
  setContentType(contentType: string): void {
    this.set('content-type', contentType);
  }

  /**
   * Check if content type matches
   */
  hasContentType(pattern: string): boolean {
    const contentType = this.getContentType();
    return contentType ? contentType.includes(pattern) : false;
  }

  private normalizeName(name: string): string {
    return name.toLowerCase();
  }

  clone(): HttpHeaders {
    return new HttpHeaders(this);
  }
}

/**
 * Request body value object with validation and serialization
 */
export class RequestBodyValue {
  private readonly _body: RequestBody;

  constructor(body: RequestBody) {
    this.validateBody(body);
    this._body = { ...body };
  }

  get type(): BodyType {
    return this._body.type;
  }

  get body(): RequestBody {
    return { ...this._body };
  }

  /**
   * Check if body is empty
   */
  isEmpty(): boolean {
    return this.type === BodyType.None || !this._body.data;
  }

  /**
   * Check if body is JSON
   */
  isJson(): boolean {
    return this.type === BodyType.JSON;
  }

  /**
   * Check if body is text-based
   */
  isTextBased(): boolean {
    return [BodyType.Text, BodyType.XML, BodyType.JSON].includes(this.type);
  }

  /**
   * Get serialized body for HTTP request
   */
  serialize(): string | URLSearchParams | Uint8Array | undefined {
    switch (this.type) {
      case BodyType.None:
        return undefined;

      case BodyType.Text:
        if (isBodyTypeText(this._body)) {
          return this._body.data;
        }
        break;

      case BodyType.JSON:
        if (isBodyTypeJSON(this._body)) {
          return JSON.stringify(this._body.data);
        }
        break;

      case BodyType.XML:
        if (isBodyTypeXML(this._body)) {
          return this._body.data;
        }
        break;

      case BodyType.Form:
        if (isBodyTypeForm(this._body)) {
          const formData = new URLSearchParams();
          this._body.data.forEach(pair => {
            if (!pair.disabled) {
              formData.append(pair.name, pair.value);
            }
          });
          return formData;
        }
        break;

      case BodyType.Raw:
        if (isBodyTypeRaw(this._body)) {
          return this._body.data;
        }
        break;
    }

    throw new ApicizeValidationError(`Invalid body configuration for type: ${this.type}`, {
      field: 'body',
      value: this._body,
      rule: 'body data must match the specified type',
    });
  }

  /**
   * Get appropriate content type for this body
   */
  getContentType(): string | undefined {
    switch (this.type) {
      case BodyType.JSON:
        return 'application/json';
      case BodyType.XML:
        return 'application/xml';
      case BodyType.Form:
        return 'application/x-www-form-urlencoded';
      case BodyType.Text:
        return 'text/plain';
      default:
        return undefined;
    }
  }

  /**
   * Get body size estimate
   */
  getSize(): number {
    const serialized = this.serialize();
    if (!serialized) return 0;

    if (typeof serialized === 'string') {
      return new Blob([serialized]).size;
    } else if (serialized instanceof URLSearchParams) {
      return new Blob([serialized.toString()]).size;
    } else if (serialized instanceof Uint8Array) {
      return serialized.length;
    }

    return 0;
  }

  private validateBody(body: RequestBody): void {
    if (!body || !body.type) {
      throw new ApicizeValidationError('Body must have a valid type', {
        field: 'body.type',
        value: body,
        rule: 'must be a valid BodyType',
      });
    }

    // Validate data matches type
    switch (body.type) {
      case BodyType.JSON:
        if (!isBodyTypeJSON(body)) {
          throw new ApicizeValidationError('JSON body must have object data', {
            field: 'body.data',
            value: (body as any).data,
            rule: 'must be an object for JSON body type',
          });
        }
        break;

      case BodyType.Text:
      case BodyType.XML:
        if (!isBodyTypeText(body) && !isBodyTypeXML(body)) {
          throw new ApicizeValidationError('Text/XML body must have string data', {
            field: 'body.data',
            value: (body as any).data,
            rule: 'must be a string for Text/XML body type',
          });
        }
        break;

      case BodyType.Form:
        if (!isBodyTypeForm(body)) {
          throw new ApicizeValidationError('Form body must have array data', {
            field: 'body.data',
            value: (body as any).data,
            rule: 'must be an array of NameValuePair for Form body type',
          });
        }
        break;

      case BodyType.Raw:
        if (!isBodyTypeRaw(body)) {
          throw new ApicizeValidationError('Raw body must have Uint8Array data', {
            field: 'body.data',
            value: (body as any).data,
            rule: 'must be a Uint8Array for Raw body type',
          });
        }
        break;

      case BodyType.None:
        if (!isBodyTypeNone(body)) {
          throw new ApicizeValidationError('None body must not have data', {
            field: 'body.data',
            value: (body as any).data,
            rule: 'must be undefined for None body type',
          });
        }
        break;
    }
  }

  static none(): RequestBodyValue {
    return new RequestBodyValue({ type: BodyType.None });
  }

  static text(data: string): RequestBodyValue {
    return new RequestBodyValue({ type: BodyType.Text, data });
  }

  static json(data: Record<string, unknown>): RequestBodyValue {
    return new RequestBodyValue({ type: BodyType.JSON, data });
  }

  static xml(data: string): RequestBodyValue {
    return new RequestBodyValue({ type: BodyType.XML, data });
  }

  static form(data: NameValuePair[]): RequestBodyValue {
    return new RequestBodyValue({ type: BodyType.Form, data });
  }

  static raw(data: Uint8Array): RequestBodyValue {
    return new RequestBodyValue({ type: BodyType.Raw, data });
  }
}

/**
 * HTTP Method value object with validation
 */
export class HttpMethodValue {
  private readonly _method: HttpMethod;

  constructor(method: string | HttpMethod) {
    const normalizedMethod = method.toUpperCase();

    if (!Object.values(HttpMethod).includes(normalizedMethod as HttpMethod)) {
      throw new ApicizeValidationError(`Unsupported HTTP method: ${method}`, {
        field: 'method',
        value: method,
        rule: 'must be a valid HTTP method',
      });
    }

    this._method = normalizedMethod as HttpMethod;
  }

  get value(): HttpMethod {
    return this._method;
  }

  /**
   * Check if method supports request body
   */
  supportsBody(): boolean {
    return [HttpMethod.POST, HttpMethod.PUT, HttpMethod.PATCH].includes(this._method);
  }

  /**
   * Check if method is safe (read-only)
   */
  isSafe(): boolean {
    return [HttpMethod.GET, HttpMethod.HEAD, HttpMethod.OPTIONS].includes(this._method);
  }

  /**
   * Check if method is idempotent
   */
  isIdempotent(): boolean {
    return [
      HttpMethod.GET,
      HttpMethod.HEAD,
      HttpMethod.PUT,
      HttpMethod.DELETE,
      HttpMethod.OPTIONS,
    ].includes(this._method);
  }

  toString(): string {
    return this._method;
  }

  equals(other: HttpMethodValue): boolean {
    return this._method === other._method;
  }
}

/**
 * Query parameters value object
 */
export class QueryParameters {
  private readonly params: Map<string, string[]>;

  constructor(params?: NameValuePair[] | Record<string, string> | URLSearchParams) {
    this.params = new Map();

    if (Array.isArray(params)) {
      params.forEach(param => {
        if (!param.disabled) {
          this.add(param.name, param.value);
        }
      });
    } else if (params instanceof URLSearchParams) {
      params.forEach((value, name) => {
        this.add(name, value);
      });
    } else if (params && typeof params === 'object') {
      Object.entries(params).forEach(([name, value]) => {
        this.set(name, value);
      });
    }
  }

  /**
   * Set parameter value (replaces existing)
   */
  set(name: string, value: string): void {
    this.params.set(name, [value]);
  }

  /**
   * Add parameter value (appends to existing)
   */
  add(name: string, value: string): void {
    const existing = this.params.get(name) || [];
    this.params.set(name, [...existing, value]);
  }

  /**
   * Get parameter value(s)
   */
  get(name: string): string | string[] | undefined {
    const values = this.params.get(name);
    if (!values || values.length === 0) return undefined;
    return values.length === 1 ? values[0] : values;
  }

  /**
   * Check if parameter exists
   */
  has(name: string): boolean {
    return this.params.has(name);
  }

  /**
   * Remove parameter
   */
  delete(name: string): void {
    this.params.delete(name);
  }

  /**
   * Convert to URL search string
   */
  toString(): string {
    const searchParams = new URLSearchParams();
    this.params.forEach((values, name) => {
      values.forEach(value => searchParams.append(name, value));
    });
    return searchParams.toString();
  }

  /**
   * Convert to NameValuePair array
   */
  toNameValuePairs(): NameValuePair[] {
    const pairs: NameValuePair[] = [];
    this.params.forEach((values, name) => {
      values.forEach(value => {
        pairs.push({ name, value });
      });
    });
    return pairs;
  }

  /**
   * Check if empty
   */
  isEmpty(): boolean {
    return this.params.size === 0;
  }

  clone(): QueryParameters {
    const newParams = new QueryParameters();
    this.params.forEach((values, name) => {
      values.forEach(value => newParams.add(name, value));
    });
    return newParams;
  }
}
