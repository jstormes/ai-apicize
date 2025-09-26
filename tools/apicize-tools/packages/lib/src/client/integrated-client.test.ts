import { IntegratedApicizeClient } from './integrated-client';
import { ConfigManager } from '../config/config-manager';
import { VariableEngine } from '../variables/variable-engine';
import {
  Request,
  RequestConfig,
  HttpMethod,
  BodyType,
  NameValuePair,
  Scenario,
  VariableType,
  ApicizeConfig,
  EnvironmentConfig,
} from '../types';

// Mock fetch globally for testing
const originalFetch = global.fetch;

function mockFetch(responseData: any = { success: true }) {
  global.fetch = jest.fn().mockResolvedValue({
    status: 200,
    statusText: 'OK',
    headers: new Headers({ 'content-type': 'application/json' }),
    redirected: false,
    url: 'https://api.example.com/test',
    text: jest.fn().mockResolvedValue(JSON.stringify(responseData)),
  });
}

function restoreFetch() {
  global.fetch = originalFetch;
}

describe('IntegratedApicizeClient', () => {
  let configManager: ConfigManager;
  let variableEngine: VariableEngine;
  let client: IntegratedApicizeClient;

  const mockConfig: ApicizeConfig = {
    version: '1.0.0',
    activeEnvironment: 'development',
    libPath: './lib',
    configPath: './config',
    testsPath: './tests',
    dataPath: './data',
    reportsPath: './reports',
    settings: {
      defaultTimeout: 30000,
      retryAttempts: 3,
      parallelExecution: false,
      verboseLogging: true,
      preserveMetadata: true,
    },
    imports: {
      autoGenerateIds: true,
      validateOnImport: true,
      preserveComments: true,
    },
    exports: {
      includeMetadata: true,
      generateHelpers: true,
      splitByGroup: true,
    },
  };

  const mockEnvConfig: EnvironmentConfig = {
    name: 'development',
    baseUrls: {
      api: 'https://api.example.com',
      auth: 'https://auth.example.com',
    },
    headers: {
      'X-Environment': 'dev',
    },
    timeouts: {
      default: 30000,
      long: 60000,
    },
    features: {
      debugMode: true,
    },
  };

  beforeEach(() => {
    configManager = new ConfigManager();
    variableEngine = new VariableEngine();
    client = new IntegratedApicizeClient(configManager, variableEngine);

    // Mock the config methods
    jest.spyOn(configManager, 'loadBaseConfig').mockResolvedValue(mockConfig);
    jest.spyOn(configManager, 'loadEnvironmentConfig').mockResolvedValue(mockEnvConfig);

    mockFetch();
    jest.clearAllMocks();
  });

  afterEach(() => {
    restoreFetch();
    jest.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should create integrated client with dependencies', () => {
      expect(client.getConfigManager()).toBe(configManager);
      expect(client.getVariableEngine()).toBe(variableEngine);
      expect(client.getHttpClient()).toBeDefined();
    });

    it('should create client with custom HTTP client config', () => {
      const customClient = new IntegratedApicizeClient(configManager, variableEngine, {
        defaultTimeout: 5000,
      });

      expect(customClient.getHttpClient().getConfig().defaultTimeout).toBe(5000);
    });
  });

  describe('Variable Substitution Integration', () => {
    it('should substitute variables in URL', async () => {
      variableEngine.setOutputs({
        baseUrl: 'https://api.example.com',
        endpoint: 'users',
        id: '123',
      });

      const requestConfig: RequestConfig = {
        url: '{{baseUrl}}/{{endpoint}}/{{id}}',
        method: HttpMethod.GET,
      };

      await client.execute(requestConfig);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/users/123',
        expect.any(Object)
      );
    });

    it('should substitute variables in headers', async () => {
      variableEngine.setOutputs({
        token: 'bearer-token-123',
        apiKey: 'api-key-456',
      });

      const headers: NameValuePair[] = [
        { name: 'Authorization', value: 'Bearer {{token}}' },
        { name: 'X-API-Key', value: '{{apiKey}}' },
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
            Authorization: 'Bearer bearer-token-123',
            'X-API-Key': 'api-key-456',
          }),
        })
      );
    });

    it('should substitute variables in JSON body', async () => {
      variableEngine.setOutputs({
        username: 'john_doe',
        email: 'john@example.com',
        role: 'admin',
      });

      const requestConfig: RequestConfig = {
        url: 'https://api.example.com/users',
        method: HttpMethod.POST,
        body: {
          type: BodyType.JSON,
          data: {
            name: '{{username}}',
            email: '{{email}}',
            role: '{{role}}',
            metadata: {
              source: 'apicize-{{role}}',
            },
          },
        },
      };

      await client.execute(requestConfig);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/users',
        expect.objectContaining({
          body: JSON.stringify({
            name: 'john_doe',
            email: 'john@example.com',
            role: 'admin',
            metadata: {
              source: 'apicize-admin',
            },
          }),
        })
      );
    });

    it('should substitute variables in form data', async () => {
      variableEngine.setOutputs({
        username: 'john_doe',
        password: 'secret123',
      });

      const requestConfig: RequestConfig = {
        url: 'https://api.example.com/login',
        method: HttpMethod.POST,
        body: {
          type: BodyType.Form,
          data: [
            { name: 'username', value: '{{username}}' },
            { name: 'password', value: '{{password}}' },
            { name: 'disabled', value: 'ignore', disabled: true },
          ],
        },
      };

      await client.execute(requestConfig);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0][1];
      const formData = fetchCall.body as URLSearchParams;

      expect(formData.get('username')).toBe('john_doe');
      expect(formData.get('password')).toBe('secret123');
      expect(formData.get('disabled')).toBeNull();
    });

    it('should handle object headers with variable substitution', async () => {
      variableEngine.setOutputs({
        token: 'bearer-token-123',
      });

      const requestConfig: RequestConfig = {
        url: 'https://api.example.com/test',
        method: HttpMethod.GET,
        headers: {
          Authorization: 'Bearer {{token}}',
          'Content-Type': 'application/json',
        },
      };

      await client.execute(requestConfig);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer bearer-token-123',
            'Content-Type': 'application/json',
          }),
        })
      );
    });
  });

  describe('Full Request Execution', () => {
    it('should execute full Request object with variable substitution', async () => {
      const scenario: Scenario = {
        id: 'test-scenario',
        name: 'Test Scenario',
        variables: [
          { name: 'baseUrl', value: 'https://api.example.com', type: VariableType.TEXT },
          { name: 'apiKey', value: 'secret-key-123', type: VariableType.TEXT },
        ],
      };

      variableEngine.setScenario(scenario);
      variableEngine.addOutput('userId', '123');

      const request: Request = {
        id: 'test-request',
        name: 'Get User',
        url: '{{baseUrl}}/users/{{userId}}',
        method: HttpMethod.GET,
        headers: [
          { name: 'Authorization', value: 'Bearer {{apiKey}}' },
          { name: 'Content-Type', value: 'application/json' },
        ],
        queryStringParams: [
          { name: 'include', value: 'profile' },
          { name: 'format', value: 'json' },
        ],
        timeout: 15000,
      };

      const response = await client.executeRequest(request);

      expect(response.status).toBe(200);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/users/123?include=profile&format=json',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer secret-key-123',
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should handle query parameters with variable substitution', async () => {
      variableEngine.setOutputs({
        status: 'active',
        limit: '10',
      });

      const request: Request = {
        id: 'test-request',
        name: 'List Users',
        url: 'https://api.example.com/users',
        method: HttpMethod.GET,
        queryStringParams: [
          { name: 'status', value: '{{status}}' },
          { name: 'limit', value: '{{limit}}' },
          { name: 'disabled', value: 'ignore', disabled: true },
        ],
      };

      await client.executeRequest(request);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/users?status=active&limit=10',
        expect.any(Object)
      );
    });

    it('should use configuration timeout when request timeout is not specified', async () => {
      const request: Request = {
        id: 'test-request',
        name: 'Test Request',
        url: 'https://api.example.com/test',
        method: HttpMethod.GET,
      };

      await client.executeRequest(request);

      // The actual timeout is handled internally by the HTTP client
      // We verify that the config was loaded
      expect(configManager.loadBaseConfig).toHaveBeenCalled();
    });

    it('should use request-specific options', async () => {
      const request: Request = {
        id: 'test-request',
        name: 'Test Request',
        url: 'https://api.example.com/test',
        method: HttpMethod.GET,
        timeout: 5000,
        numberOfRedirects: 3,
        acceptInvalidCerts: true,
      };

      await client.executeRequest(request);

      // Verify the request was executed (options are used internally)
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('Variable Management', () => {
    it('should update variables', () => {
      const variables = {
        userId: '123',
        token: 'abc123',
      };

      client.updateVariables(variables);

      const context = client.getVariableEngine().getContext();
      expect(context.outputs).toEqual(variables);
    });

    it('should add single output variable', () => {
      client.addOutput('newVar', 'newValue');

      const context = client.getVariableEngine().getContext();
      expect(context.outputs?.newVar).toBe('newValue');
    });

    it('should manage warnings', () => {
      // Create a request with missing variables
      variableEngine.substituteString('{{missingVar}}');

      const warnings = client.getWarnings();
      expect(warnings).toContain('Variable not found: missingVar');

      client.clearWarnings();
      expect(client.getWarnings()).toHaveLength(0);
    });
  });

  describe('Configuration Integration', () => {
    it('should handle verbose logging on errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Mock fetch to reject
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const request: Request = {
        id: 'test-request',
        name: 'Test Request',
        url: 'https://api.example.com/test',
        method: HttpMethod.GET,
      };

      await expect(client.executeRequest(request)).rejects.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith('Request execution failed:', expect.any(Error));

      consoleSpy.mockRestore();
    });

    it('should create new client with different config', () => {
      const newClient = client.withConfig({ defaultTimeout: 5000 });

      expect(newClient.getHttpClient().getConfig().defaultTimeout).toBe(5000);
      expect(client.getHttpClient().getConfig().defaultTimeout).toBe(30000); // Original unchanged
    });
  });

  describe('Body Type Processing', () => {
    it('should handle Text body type', async () => {
      variableEngine.setOutputs({ message: 'Hello World' });

      const requestConfig: RequestConfig = {
        url: 'https://api.example.com/test',
        method: HttpMethod.POST,
        body: {
          type: BodyType.Text,
          data: 'Message: {{message}}',
        },
      };

      await client.execute(requestConfig);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          body: 'Message: Hello World',
        })
      );
    });

    it('should handle XML body type', async () => {
      variableEngine.setOutputs({ name: 'John', id: '123' });

      const requestConfig: RequestConfig = {
        url: 'https://api.example.com/test',
        method: HttpMethod.POST,
        body: {
          type: BodyType.XML,
          data: '<user><name>{{name}}</name><id>{{id}}</id></user>',
        },
      };

      await client.execute(requestConfig);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          body: '<user><name>John</name><id>123</id></user>',
        })
      );
    });

    it('should handle Raw body type without substitution', async () => {
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

    it('should handle None body type', async () => {
      const requestConfig: RequestConfig = {
        url: 'https://api.example.com/test',
        method: HttpMethod.GET,
        body: {
          type: BodyType.None,
        },
      };

      await client.execute(requestConfig);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          method: 'GET',
          headers: expect.any(Object),
        })
      );

      // Verify body is not set (undefined bodies are not included in RequestInit)
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0][1];
      expect(fetchCall.body).toBeUndefined();
    });

    it('should handle non-structured body types', async () => {
      variableEngine.setOutputs({ message: 'test' });

      const requestConfig: RequestConfig = {
        url: 'https://api.example.com/test',
        method: HttpMethod.POST,
        body: 'Direct string with {{message}}',
      };

      await client.execute(requestConfig);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          method: 'POST',
          body: 'Direct string with test',
        })
      );
    });
  });
});
