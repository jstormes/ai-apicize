/**
 * Test builders for creating complex test data with fluent interfaces
 * Part of Phase 3: Testing Improvements
 */

import { ApicizeWorkbook, BodyType, HttpMethod, AuthorizationType, NameValuePair } from '../types';

/**
 * Builder for creating workbook test data
 */
export class WorkbookBuilder {
  private workbook: Partial<ApicizeWorkbook> = {
    version: 1.0,
    requests: [],
    scenarios: [],
    authorizations: [],
    certificates: [],
    proxies: [],
    data: [],
  };

  /**
   * Set workbook version
   */
  withVersion(version: number): this {
    this.workbook.version = version;
    return this;
  }

  /**
   * Add a request to the workbook
   */
  withRequest(request: any): this {
    if (!this.workbook.requests) this.workbook.requests = [];
    this.workbook.requests.push(request);
    return this;
  }

  /**
   * Add multiple requests
   */
  withRequests(requests: any[]): this {
    if (!this.workbook.requests) this.workbook.requests = [];
    this.workbook.requests.push(...requests);
    return this;
  }

  /**
   * Add a scenario to the workbook
   */
  withScenario(scenario: any): this {
    if (!this.workbook.scenarios) this.workbook.scenarios = [];
    this.workbook.scenarios.push(scenario);
    return this;
  }

  /**
   * Add authorization configuration
   */
  withAuthorization(auth: any): this {
    if (!this.workbook.authorizations) this.workbook.authorizations = [];
    this.workbook.authorizations.push(auth);
    return this;
  }

  /**
   * Add data source
   */
  withDataSource(data: any): this {
    if (!this.workbook.data) this.workbook.data = [];
    this.workbook.data.push(data);
    return this;
  }

  /**
   * Set defaults
   */
  withDefaults(defaults: any): this {
    this.workbook.defaults = defaults;
    return this;
  }

  /**
   * Build the workbook
   */
  build(): ApicizeWorkbook {
    return this.workbook as ApicizeWorkbook;
  }

  /**
   * Create a minimal valid workbook
   */
  static minimal(): WorkbookBuilder {
    return new WorkbookBuilder().withVersion(1.0);
  }

  /**
   * Create a workbook with common test scenarios
   */
  static withTestScenarios(): WorkbookBuilder {
    return new WorkbookBuilder()
      .withVersion(1.0)
      .withScenario({
        id: 'test-scenario-1',
        name: 'Development',
        variables: [
          { name: 'baseUrl', value: 'http://localhost:3000', type: 'TEXT' },
          { name: 'apiKey', value: 'test-key-123', type: 'TEXT' },
        ],
      })
      .withScenario({
        id: 'test-scenario-2',
        name: 'Production',
        variables: [
          { name: 'baseUrl', value: 'https://api.example.com', type: 'TEXT' },
          { name: 'apiKey', value: 'prod-key-456', type: 'TEXT' },
        ],
      });
  }
}

/**
 * Builder for creating request test data
 */
export class RequestBuilder {
  private request: any = {
    id: this.generateId(),
    name: 'Test Request',
    url: 'https://api.example.com/test',
    method: 'GET',
  };

  private generateId(): string {
    return `test-req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Set request ID
   */
  withId(id: string): this {
    this.request.id = id;
    return this;
  }

  /**
   * Set request name
   */
  withName(name: string): this {
    this.request.name = name;
    return this;
  }

  /**
   * Set request URL
   */
  withUrl(url: string): this {
    this.request.url = url;
    return this;
  }

  /**
   * Set HTTP method
   */
  withMethod(method: HttpMethod): this {
    this.request.method = method;
    return this;
  }

  /**
   * Add headers
   */
  withHeaders(headers: NameValuePair[]): this {
    this.request.headers = headers;
    return this;
  }

  /**
   * Add a single header
   */
  withHeader(name: string, value: string): this {
    if (!this.request.headers) this.request.headers = [];
    this.request.headers.push({ name, value });
    return this;
  }

  /**
   * Set request body
   */
  withBody(type: BodyType, data?: any): this {
    this.request.body = { type, data };
    return this;
  }

  /**
   * Set JSON body
   */
  withJsonBody(data: any): this {
    return this.withBody(BodyType.JSON, data);
  }

  /**
   * Set text body
   */
  withTextBody(text: string): this {
    return this.withBody(BodyType.Text, text);
  }

  /**
   * Set form body
   */
  withFormBody(params: NameValuePair[]): this {
    return this.withBody(BodyType.Form, params);
  }

  /**
   * Add query string parameters
   */
  withQueryParams(params: NameValuePair[]): this {
    this.request.queryStringParams = params;
    return this;
  }

  /**
   * Add a single query parameter
   */
  withQueryParam(name: string, value: string): this {
    if (!this.request.queryStringParams) this.request.queryStringParams = [];
    this.request.queryStringParams.push({ name, value });
    return this;
  }

  /**
   * Set timeout
   */
  withTimeout(timeout: number): this {
    this.request.timeout = timeout;
    return this;
  }

  /**
   * Add test code
   */
  withTest(testCode: string): this {
    this.request.test = testCode;
    return this;
  }

  /**
   * Build the request
   */
  build(): any {
    return { ...this.request };
  }

  /**
   * Create a basic GET request
   */
  static get(url?: string): RequestBuilder {
    return new RequestBuilder()
      .withMethod(HttpMethod.GET)
      .withUrl(url || 'https://api.example.com/test');
  }

  /**
   * Create a POST request with JSON body
   */
  static postJson(url?: string, data?: any): RequestBuilder {
    return new RequestBuilder()
      .withMethod(HttpMethod.POST)
      .withUrl(url || 'https://api.example.com/test')
      .withJsonBody(data || { test: 'data' })
      .withHeader('Content-Type', 'application/json');
  }

  /**
   * Create a PUT request
   */
  static put(url?: string): RequestBuilder {
    return new RequestBuilder()
      .withMethod(HttpMethod.PUT)
      .withUrl(url || 'https://api.example.com/test');
  }

  /**
   * Create a DELETE request
   */
  static delete(url?: string): RequestBuilder {
    return new RequestBuilder()
      .withMethod(HttpMethod.DELETE)
      .withUrl(url || 'https://api.example.com/test');
  }
}

/**
 * Builder for creating request groups
 */
export class RequestGroupBuilder {
  private group: any = {
    id: this.generateId(),
    name: 'Test Group',
    children: [],
  };

  private generateId(): string {
    return `test-group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Set group ID
   */
  withId(id: string): this {
    this.group.id = id;
    return this;
  }

  /**
   * Set group name
   */
  withName(name: string): this {
    this.group.name = name;
    return this;
  }

  /**
   * Add a child (request or group)
   */
  withChild(child: any): this {
    this.group.children.push(child);
    return this;
  }

  /**
   * Add multiple children
   */
  withChildren(children: any[]): this {
    this.group.children.push(...children);
    return this;
  }

  /**
   * Set execution mode
   */
  withExecution(execution: 'SEQUENTIAL' | 'CONCURRENT'): this {
    this.group.execution = execution;
    return this;
  }

  /**
   * Set number of runs
   */
  withRuns(runs: number): this {
    this.group.runs = runs;
    return this;
  }

  /**
   * Set selected scenario
   */
  withSelectedScenario(id: string, name: string): this {
    this.group.selectedScenario = { id, name };
    return this;
  }

  /**
   * Build the group
   */
  build(): any {
    return { ...this.group };
  }

  /**
   * Create a CRUD operations group
   */
  static crud(baseUrl: string = 'https://api.example.com'): RequestGroupBuilder {
    return new RequestGroupBuilder()
      .withName('CRUD Operations')
      .withExecution('SEQUENTIAL')
      .withChild(RequestBuilder.postJson(`${baseUrl}/items`, { name: 'Test Item' }).build())
      .withChild(RequestBuilder.get(`${baseUrl}/items/{{itemId}}`).build())
      .withChild(RequestBuilder.put(`${baseUrl}/items/{{itemId}}`).build())
      .withChild(RequestBuilder.delete(`${baseUrl}/items/{{itemId}}`).build());
  }
}

/**
 * Builder for creating authorization configurations
 */
export class AuthorizationBuilder {
  private auth: any = {
    id: this.generateId(),
    name: 'Test Auth',
    type: AuthorizationType.Basic,
  };

  private generateId(): string {
    return `test-auth-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Set authorization ID
   */
  withId(id: string): this {
    this.auth.id = id;
    return this;
  }

  /**
   * Set authorization name
   */
  withName(name: string): this {
    this.auth.name = name;
    return this;
  }

  /**
   * Set authorization type
   */
  withType(type: AuthorizationType): this {
    this.auth.type = type;
    return this;
  }

  /**
   * Configure as Basic auth
   */
  asBasic(username: string, password: string): this {
    this.auth.type = AuthorizationType.Basic;
    this.auth.username = username;
    this.auth.password = password;
    return this;
  }

  /**
   * Configure as API Key auth
   */
  asApiKey(header: string, value: string): this {
    this.auth.type = AuthorizationType.ApiKey;
    this.auth.header = header;
    this.auth.value = value;
    return this;
  }

  /**
   * Configure as OAuth2 Client Credentials
   */
  asOAuth2Client(accessTokenUrl: string, clientId: string, clientSecret: string): this {
    this.auth.type = AuthorizationType.OAuth2Client;
    this.auth.accessTokenUrl = accessTokenUrl;
    this.auth.clientId = clientId;
    this.auth.clientSecret = clientSecret;
    return this;
  }

  /**
   * Build the authorization
   */
  build(): any {
    return { ...this.auth };
  }

  /**
   * Create basic auth configuration
   */
  static basic(username: string = 'testuser', password: string = 'testpass'): AuthorizationBuilder {
    return new AuthorizationBuilder().asBasic(username, password);
  }

  /**
   * Create API key configuration
   */
  static apiKey(
    header: string = 'X-API-Key',
    value: string = 'test-key-123'
  ): AuthorizationBuilder {
    return new AuthorizationBuilder().asApiKey(header, value);
  }
}

/**
 * Builder for creating scenario configurations
 */
export class ScenarioBuilder {
  private scenario: any = {
    id: this.generateId(),
    name: 'Test Scenario',
    variables: [],
  };

  private generateId(): string {
    return `test-scenario-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Set scenario ID
   */
  withId(id: string): this {
    this.scenario.id = id;
    return this;
  }

  /**
   * Set scenario name
   */
  withName(name: string): this {
    this.scenario.name = name;
    return this;
  }

  /**
   * Add a variable
   */
  withVariable(name: string, value: string, type: string = 'TEXT'): this {
    this.scenario.variables.push({ name, value, type });
    return this;
  }

  /**
   * Add multiple variables
   */
  withVariables(variables: Array<{ name: string; value: string; type?: string }>): this {
    for (const variable of variables) {
      this.withVariable(variable.name, variable.value, variable.type || 'TEXT');
    }
    return this;
  }

  /**
   * Build the scenario
   */
  build(): any {
    return { ...this.scenario };
  }

  /**
   * Create a development scenario
   */
  static development(): ScenarioBuilder {
    return new ScenarioBuilder()
      .withName('Development')
      .withVariable('baseUrl', 'http://localhost:3000')
      .withVariable('apiKey', 'dev-key-123')
      .withVariable('timeout', '5000');
  }

  /**
   * Create a production scenario
   */
  static production(): ScenarioBuilder {
    return new ScenarioBuilder()
      .withName('Production')
      .withVariable('baseUrl', 'https://api.example.com')
      .withVariable('apiKey', 'prod-key-456')
      .withVariable('timeout', '30000');
  }
}

/**
 * Main test data factory that combines all builders
 */
export class TestDataFactory {
  /**
   * Create a complete test workbook with common patterns
   */
  static createTestWorkbook(): ApicizeWorkbook {
    const basicAuth = AuthorizationBuilder.basic().build();
    const apiKeyAuth = AuthorizationBuilder.apiKey().build();

    const devScenario = ScenarioBuilder.development().build();

    const getUserRequest = RequestBuilder.get('{{baseUrl}}/users/{{userId}}')
      .withHeader('Authorization', 'Bearer {{apiKey}}')
      .withTest('expect(response.status).toBe(200);')
      .build();

    const createUserRequest = RequestBuilder.postJson('{{baseUrl}}/users')
      .withJsonBody({ name: '{{userName}}', email: '{{userEmail}}' })
      .withHeader('Authorization', 'Bearer {{apiKey}}')
      .withTest('expect(response.status).toBe(201);\noutput("userId", response.body.data.id);')
      .build();

    const crudGroup = RequestGroupBuilder.crud('{{baseUrl}}')
      .withName('User Management')
      .withChild(createUserRequest)
      .withChild(getUserRequest)
      .build();

    return WorkbookBuilder.withTestScenarios()
      .withAuthorization(basicAuth)
      .withAuthorization(apiKeyAuth)
      .withRequest(crudGroup)
      .withDefaults({
        selectedScenario: { id: devScenario.id, name: devScenario.name },
        selectedAuthorization: { id: basicAuth.id, name: basicAuth.name },
      })
      .build();
  }

  /**
   * Create a minimal workbook for testing
   */
  static createMinimalWorkbook(): ApicizeWorkbook {
    return WorkbookBuilder.minimal().build();
  }

  /**
   * Create an invalid workbook for error testing
   */
  static createInvalidWorkbook(): any {
    return {
      version: '1.0', // Should be number
      requests: 'not-an-array', // Should be array
    };
  }
}
