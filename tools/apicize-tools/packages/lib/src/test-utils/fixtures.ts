/**
 * Fixture factories with builder pattern for test data generation
 * Part of Phase 3: Testing Improvements
 */

import { ApicizeWorkbook, RequestConfig, BodyType, HttpMethod, AuthorizationType } from '../types';

/**
 * Base fixture factory with common patterns
 */
export abstract class BaseFixtureFactory<T> {
  protected data: Partial<T> = {};

  /**
   * Build the fixture
   */
  abstract build(): T;

  /**
   * Create multiple instances
   */
  buildMany(count: number): T[] {
    return Array.from({ length: count }, () => this.build());
  }

  /**
   * Reset to empty state
   */
  reset(): this {
    this.data = {};
    return this;
  }

  /**
   * Apply a transformation function
   */
  transform(fn: (data: Partial<T>) => void): this {
    fn(this.data);
    return this;
  }
}

/**
 * HTTP response fixture factory
 */
export class ResponseFixture extends BaseFixtureFactory<Response> {
  constructor() {
    super();
    this.data = {
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      ok: true,
      redirected: false,
      url: 'https://api.example.com/test',
    };
  }

  /**
   * Set response status
   */
  withStatus(status: number, statusText?: string): this {
    this.data = {
      ...this.data,
      status,
      statusText: statusText || this.getStatusText(status),
      ok: status >= 200 && status < 300,
    };
    return this;
  }

  /**
   * Add response headers
   */
  withHeaders(headers: Record<string, string>): this {
    const headerObj = new Headers(this.data.headers);
    Object.entries(headers).forEach(([key, value]) => {
      headerObj.set(key, value);
    });
    this.data = {
      ...this.data,
      headers: headerObj,
    };
    return this;
  }

  /**
   * Set response URL
   */
  withUrl(url: string): this {
    this.data = {
      ...this.data,
      url,
    };
    return this;
  }

  /**
   * Mark as redirected
   */
  asRedirected(): this {
    this.data = {
      ...this.data,
      redirected: true,
    };
    return this;
  }

  /**
   * Set JSON body
   */
  withJsonBody(body: any): this {
    const jsonBody = JSON.stringify(body);
    this.withHeaders({ 'content-type': 'application/json' });
    (this.data as any).json = () => Promise.resolve(body);
    (this.data as any).text = () => Promise.resolve(jsonBody);
    return this;
  }

  /**
   * Set text body
   */
  withTextBody(text: string): this {
    this.withHeaders({ 'content-type': 'text/plain' });
    (this.data as any).text = () => Promise.resolve(text);
    (this.data as any).json = () => Promise.reject(new Error('Response is not JSON'));
    return this;
  }

  /**
   * Build the response
   */
  build(): Response {
    return this.data as Response;
  }

  /**
   * Create successful JSON response
   */
  static success(data: any = { success: true }): ResponseFixture {
    return new ResponseFixture().withStatus(200).withJsonBody(data);
  }

  /**
   * Create error response
   */
  static error(status: number = 500, message: string = 'Internal Server Error'): ResponseFixture {
    return new ResponseFixture().withStatus(status).withJsonBody({ error: message });
  }

  /**
   * Create not found response
   */
  static notFound(message: string = 'Not Found'): ResponseFixture {
    return new ResponseFixture().withStatus(404).withJsonBody({ error: message });
  }

  private getStatusText(status: number): string {
    const statusTexts: Record<number, string> = {
      200: 'OK',
      201: 'Created',
      204: 'No Content',
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      409: 'Conflict',
      422: 'Unprocessable Entity',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
    };
    return statusTexts[status] || 'Unknown';
  }
}

/**
 * Request configuration fixture factory
 */
export class RequestConfigFixture extends BaseFixtureFactory<RequestConfig> {
  constructor() {
    super();
    this.data = {
      url: 'https://api.example.com/test',
      method: HttpMethod.GET,
      headers: [],
    };
  }

  /**
   * Set request method
   */
  withMethod(method: HttpMethod): this {
    this.data.method = method;
    return this;
  }

  /**
   * Set request URL
   */
  withUrl(url: string): this {
    this.data.url = url;
    return this;
  }

  /**
   * Add headers
   */
  withHeaders(headers: Array<{ name: string; value: string }>): this {
    if (Array.isArray(this.data.headers)) {
      this.data.headers = [...this.data.headers, ...headers];
    } else {
      this.data.headers = headers;
    }
    return this;
  }

  /**
   * Add single header
   */
  withHeader(name: string, value: string): this {
    if (!this.data.headers) {
      this.data.headers = [];
    }
    if (Array.isArray(this.data.headers)) {
      this.data.headers.push({ name, value });
    } else {
      this.data.headers = [{ name, value }];
    }
    return this;
  }

  /**
   * Set request body
   */
  withBody(type: BodyType, data?: any): this {
    this.data.body = { type, data };
    return this;
  }

  /**
   * Set JSON body
   */
  withJsonBody(data: any): this {
    return this.withBody(BodyType.JSON, data).withHeader('Content-Type', 'application/json');
  }

  /**
   * Set timeout
   */
  withTimeout(timeout: number): this {
    this.data.timeout = timeout;
    return this;
  }

  /**
   * Build the request config
   */
  build(): RequestConfig {
    return this.data as RequestConfig;
  }

  /**
   * Create GET request
   */
  static get(url?: string): RequestConfigFixture {
    return new RequestConfigFixture()
      .withMethod(HttpMethod.GET)
      .withUrl(url || 'https://api.example.com/items');
  }

  /**
   * Create POST request with JSON
   */
  static postJson(url?: string, data?: any): RequestConfigFixture {
    return new RequestConfigFixture()
      .withMethod(HttpMethod.POST)
      .withUrl(url || 'https://api.example.com/items')
      .withJsonBody(data || { name: 'Test Item' });
  }

  /**
   * Create authenticated request
   */
  static authenticated(token?: string): RequestConfigFixture {
    return new RequestConfigFixture().withHeader(
      'Authorization',
      `Bearer ${token || 'test-token'}`
    );
  }
}

/**
 * Workbook fixture factory
 */
export class WorkbookFixture extends BaseFixtureFactory<ApicizeWorkbook> {
  constructor() {
    super();
    this.data = {
      version: 1.0,
      requests: [],
      scenarios: [],
      authorizations: [],
      certificates: [],
      proxies: [],
      data: [],
    };
  }

  /**
   * Add requests to workbook
   */
  withRequests(...requests: any[]): this {
    if (!this.data.requests) this.data.requests = [];
    this.data.requests.push(...requests);
    return this;
  }

  /**
   * Add scenarios to workbook
   */
  withScenarios(...scenarios: any[]): this {
    if (!this.data.scenarios) this.data.scenarios = [];
    this.data.scenarios.push(...scenarios);
    return this;
  }

  /**
   * Add authorization configurations
   */
  withAuthorizations(...auths: any[]): this {
    if (!this.data.authorizations) this.data.authorizations = [];
    this.data.authorizations.push(...auths);
    return this;
  }

  /**
   * Set defaults
   */
  withDefaults(defaults: any): this {
    this.data.defaults = defaults;
    return this;
  }

  /**
   * Build the workbook
   */
  build(): ApicizeWorkbook {
    return this.data as ApicizeWorkbook;
  }

  /**
   * Create minimal workbook
   */
  static minimal(): WorkbookFixture {
    return new WorkbookFixture();
  }

  /**
   * Create REST API test workbook
   */
  static restApi(): WorkbookFixture {
    const createRequest = RequestConfigFixture.postJson().build();
    const getRequest = RequestConfigFixture.get().build();
    const updateRequest = RequestConfigFixture.get().withMethod(HttpMethod.PUT).build();
    const deleteRequest = RequestConfigFixture.get().withMethod(HttpMethod.DELETE).build();

    return new WorkbookFixture()
      .withRequests(createRequest, getRequest, updateRequest, deleteRequest)
      .withScenarios(ScenarioFixture.development().build())
      .withAuthorizations(AuthorizationFixture.apiKey().build());
  }

  /**
   * Create authentication test workbook
   */
  static authFlow(): WorkbookFixture {
    const loginRequest = RequestConfigFixture.postJson('{{baseUrl}}/auth/login', {
      username: '{{username}}',
      password: '{{password}}',
    }).build();

    const authenticatedRequest = RequestConfigFixture.authenticated('{{authToken}}')
      .withUrl('{{baseUrl}}/profile')
      .build();

    return new WorkbookFixture()
      .withRequests(loginRequest, authenticatedRequest)
      .withScenarios(
        ScenarioFixture.development()
          .withVariable('username', 'testuser')
          .withVariable('password', 'testpass')
          .build()
      )
      .withAuthorizations(AuthorizationFixture.basic().build());
  }
}

/**
 * Scenario fixture factory
 */
export class ScenarioFixture extends BaseFixtureFactory<any> {
  constructor() {
    super();
    this.data = {
      id: this.generateId(),
      name: 'Test Scenario',
      variables: [],
    };
  }

  private generateId(): string {
    return `scenario-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Set scenario name
   */
  withName(name: string): this {
    this.data.name = name;
    return this;
  }

  /**
   * Add variable
   */
  withVariable(name: string, value: string, type: string = 'TEXT'): this {
    if (!this.data.variables) this.data.variables = [];
    this.data.variables.push({ name, value, type });
    return this;
  }

  /**
   * Add multiple variables
   */
  withVariables(variables: Array<{ name: string; value: string; type?: string }>): this {
    variables.forEach(v => this.withVariable(v.name, v.value, v.type));
    return this;
  }

  /**
   * Build the scenario
   */
  build(): any {
    return { ...this.data };
  }

  /**
   * Create development scenario
   */
  static development(): ScenarioFixture {
    return new ScenarioFixture()
      .withName('Development')
      .withVariable('baseUrl', 'http://localhost:3000')
      .withVariable('apiKey', 'dev-key-123')
      .withVariable('timeout', '5000');
  }

  /**
   * Create production scenario
   */
  static production(): ScenarioFixture {
    return new ScenarioFixture()
      .withName('Production')
      .withVariable('baseUrl', 'https://api.example.com')
      .withVariable('apiKey', 'prod-key-456')
      .withVariable('timeout', '30000');
  }
}

/**
 * Authorization fixture factory
 */
export class AuthorizationFixture extends BaseFixtureFactory<any> {
  constructor() {
    super();
    this.data = {
      id: this.generateId(),
      name: 'Test Auth',
      type: AuthorizationType.Basic,
    };
  }

  private generateId(): string {
    return `auth-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Set authorization name
   */
  withName(name: string): this {
    this.data.name = name;
    return this;
  }

  /**
   * Configure as Basic auth
   */
  asBasic(username: string = 'testuser', password: string = 'testpass'): this {
    this.data.type = AuthorizationType.Basic;
    this.data.username = username;
    this.data.password = password;
    return this;
  }

  /**
   * Configure as API Key auth
   */
  asApiKey(header: string = 'X-API-Key', value: string = 'test-key-123'): this {
    this.data.type = AuthorizationType.ApiKey;
    this.data.header = header;
    this.data.value = value;
    return this;
  }

  /**
   * Configure as OAuth2 Client Credentials
   */
  asOAuth2Client(accessTokenUrl: string, clientId: string, clientSecret: string): this {
    this.data.type = AuthorizationType.OAuth2Client;
    this.data.accessTokenUrl = accessTokenUrl;
    this.data.clientId = clientId;
    this.data.clientSecret = clientSecret;
    return this;
  }

  /**
   * Build the authorization
   */
  build(): any {
    return { ...this.data };
  }

  /**
   * Create basic auth
   */
  static basic(): AuthorizationFixture {
    return new AuthorizationFixture().asBasic();
  }

  /**
   * Create API key auth
   */
  static apiKey(): AuthorizationFixture {
    return new AuthorizationFixture().asApiKey();
  }

  /**
   * Create OAuth2 client credentials auth
   */
  static oauth2Client(): AuthorizationFixture {
    return new AuthorizationFixture().asOAuth2Client(
      'https://auth.example.com/token',
      'test-client-id',
      'test-client-secret'
    );
  }
}

/**
 * Error fixture factory for testing error scenarios
 */
export class ErrorFixture extends BaseFixtureFactory<Error> {
  constructor() {
    super();
    this.data = {
      name: 'Error',
      message: 'Test error',
    };
  }

  /**
   * Set error message
   */
  withMessage(message: string): this {
    this.data.message = message;
    return this;
  }

  /**
   * Set error name/type
   */
  withName(name: string): this {
    this.data.name = name;
    return this;
  }

  /**
   * Add error code
   */
  withCode(code: string | number): this {
    (this.data as any).code = code;
    return this;
  }

  /**
   * Add stack trace
   */
  withStack(stack: string): this {
    this.data.stack = stack;
    return this;
  }

  /**
   * Add cause
   */
  withCause(cause: Error): this {
    (this.data as any).cause = cause;
    return this;
  }

  /**
   * Build the error
   */
  build(): Error {
    const error = new Error(this.data.message);
    Object.assign(error, this.data);
    return error;
  }

  /**
   * Create network error
   */
  static network(): ErrorFixture {
    return new ErrorFixture()
      .withName('NetworkError')
      .withMessage('Network request failed')
      .withCode('NETWORK_ERROR');
  }

  /**
   * Create timeout error
   */
  static timeout(): ErrorFixture {
    return new ErrorFixture()
      .withName('TimeoutError')
      .withMessage('Request timeout')
      .withCode('TIMEOUT');
  }

  /**
   * Create validation error
   */
  static validation(): ErrorFixture {
    return new ErrorFixture()
      .withName('ValidationError')
      .withMessage('Validation failed')
      .withCode('VALIDATION_ERROR');
  }
}

/**
 * Test fixture suite for common testing scenarios
 */
export class FixtureSuite {
  /**
   * Create a complete REST API test suite
   */
  static restApiSuite() {
    return {
      workbook: WorkbookFixture.restApi().build(),
      requests: {
        get: RequestConfigFixture.get().build(),
        post: RequestConfigFixture.postJson().build(),
        put: RequestConfigFixture.get().withMethod(HttpMethod.PUT).build(),
        delete: RequestConfigFixture.get().withMethod(HttpMethod.DELETE).build(),
      },
      responses: {
        success: ResponseFixture.success().build(),
        created: ResponseFixture.success({ id: 123 }).withStatus(201).build(),
        notFound: ResponseFixture.notFound().build(),
        serverError: ResponseFixture.error().build(),
      },
      scenarios: {
        dev: ScenarioFixture.development().build(),
        prod: ScenarioFixture.production().build(),
      },
      auth: {
        basic: AuthorizationFixture.basic().build(),
        apiKey: AuthorizationFixture.apiKey().build(),
        oauth2: AuthorizationFixture.oauth2Client().build(),
      },
    };
  }

  /**
   * Create error testing fixtures
   */
  static errorSuite() {
    return {
      network: ErrorFixture.network().build(),
      timeout: ErrorFixture.timeout().build(),
      validation: ErrorFixture.validation().build(),
      responses: {
        badRequest: ResponseFixture.error(400, 'Bad Request').build(),
        unauthorized: ResponseFixture.error(401, 'Unauthorized').build(),
        forbidden: ResponseFixture.error(403, 'Forbidden').build(),
        notFound: ResponseFixture.notFound().build(),
        serverError: ResponseFixture.error(500, 'Internal Server Error').build(),
      },
    };
  }

  /**
   * Create authentication flow fixtures
   */
  static authSuite() {
    return {
      workbook: WorkbookFixture.authFlow().build(),
      loginRequest: RequestConfigFixture.postJson('/auth/login', {
        username: 'test',
        password: 'pass',
      }).build(),
      authenticatedRequest: RequestConfigFixture.authenticated('test-token')
        .withUrl('/profile')
        .build(),
      loginResponse: ResponseFixture.success({
        token: 'auth-token-123',
        user: { id: 1, name: 'Test User' },
      }).build(),
      profileResponse: ResponseFixture.success({
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
      }).build(),
    };
  }
}
