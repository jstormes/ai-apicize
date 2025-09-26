import { ApicizeClient } from './apicize-client';
import { IntegratedApicizeClient } from './integrated-client';
import { ConfigManager } from '../config/config-manager';
import { VariableEngine } from '../variables/variable-engine';
import { RequestConfig, HttpMethod, BodyType } from '../types';

// Simple mock for fetch
const originalFetch = global.fetch;

function mockBasicFetch() {
  global.fetch = jest.fn().mockResolvedValue({
    status: 200,
    statusText: 'OK',
    headers: new Headers({ 'content-type': 'application/json' }),
    text: jest.fn().mockResolvedValue('{"success": true}'),
    redirected: false,
    url: 'https://api.example.com/test',
  });
}

function restoreFetch() {
  global.fetch = originalFetch;
}

describe('Simple HTTP Client Tests', () => {
  afterEach(() => {
    restoreFetch();
  });

  describe('ApicizeClient Basic Functionality', () => {
    it('should create a client with default config', () => {
      const client = new ApicizeClient();
      const config = client.getConfig();

      expect(config.defaultTimeout).toBe(30000);
      expect(config.userAgent).toBe('Apicize-Client/1.0.0');
    });

    it('should execute a simple GET request', async () => {
      mockBasicFetch();

      const client = new ApicizeClient();
      const requestConfig: RequestConfig = {
        url: 'https://api.example.com/test',
        method: HttpMethod.GET,
      };

      const response = await client.execute(requestConfig);

      expect(response.status).toBe(200);
      expect(response.body.type).toBe(BodyType.JSON);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('should execute a POST request with JSON body', async () => {
      mockBasicFetch();

      const client = new ApicizeClient();
      const requestConfig: RequestConfig = {
        url: 'https://api.example.com/users',
        method: HttpMethod.POST,
        body: {
          type: BodyType.JSON,
          data: { name: 'John', email: 'john@example.com' },
        },
      };

      const response = await client.execute(requestConfig);

      expect(response.status).toBe(200);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/users',
        expect.objectContaining({
          method: 'POST',
          body: '{"name":"John","email":"john@example.com"}',
        })
      );
    });
  });

  describe('IntegratedApicizeClient Basic Functionality', () => {
    it('should create an integrated client', () => {
      const configManager = new ConfigManager();
      const variableEngine = new VariableEngine();
      const client = new IntegratedApicizeClient(configManager, variableEngine);

      expect(client.getConfigManager()).toBe(configManager);
      expect(client.getVariableEngine()).toBe(variableEngine);
    });

    it('should substitute variables in URL', async () => {
      mockBasicFetch();

      const configManager = new ConfigManager();
      const variableEngine = new VariableEngine();
      const client = new IntegratedApicizeClient(configManager, variableEngine);

      variableEngine.setOutputs({
        baseUrl: 'https://api.example.com',
        endpoint: 'users',
      });

      const requestConfig: RequestConfig = {
        url: '{{baseUrl}}/{{endpoint}}',
        method: HttpMethod.GET,
      };

      await client.execute(requestConfig);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/users',
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('should substitute variables in string body', async () => {
      mockBasicFetch();

      const configManager = new ConfigManager();
      const variableEngine = new VariableEngine();
      const client = new IntegratedApicizeClient(configManager, variableEngine);

      variableEngine.setOutputs({
        message: 'test content',
      });

      const requestConfig: RequestConfig = {
        url: 'https://api.example.com/test',
        method: HttpMethod.POST,
        body: 'Message: {{message}}',
      };

      await client.execute(requestConfig);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          method: 'POST',
          body: 'Message: test content',
        })
      );
    });
  });
});
