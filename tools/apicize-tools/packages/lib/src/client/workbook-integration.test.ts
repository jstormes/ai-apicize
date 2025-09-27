import { IntegratedApicizeClient } from './integrated-client';
import { ConfigManager } from '../config/config-manager';
import { VariableEngine } from '../variables/variable-engine';
import { validateApicizeFile } from '../validation/validator';
import {
  ApicizeWorkbook,
  Request,
  RequestGroup,
  RequestConfig,
  HttpMethod,
  BodyType,
  ApiKeyAuthorization,
  BasicAuthorization,
} from '../types';
import * as fs from 'fs';
import * as path from 'path';

// Mock fetch for testing
const originalFetch = global.fetch;

function mockFetchForIntegration() {
  global.fetch = jest.fn().mockImplementation((url, options) => {
    // Mock different responses based on URL patterns
    if (typeof url === 'string') {
      if (url.includes('sample-api.apicize.com/quote')) {
        if (options?.method === 'POST') {
          // Mock create response
          return Promise.resolve({
            status: 200,
            statusText: 'OK',
            headers: new Headers({ 'content-type': 'application/json' }),
            text: () =>
              Promise.resolve(
                '{"id": "test-id-123", "author": "Test Author", "quote": "Test Quote"}'
              ),
            redirected: false,
            url: url as string,
          });
        } else if (options?.method === 'GET') {
          // Mock get response
          return Promise.resolve({
            status: 200,
            statusText: 'OK',
            headers: new Headers({ 'content-type': 'application/json' }),
            text: () =>
              Promise.resolve(
                '{"id": "test-id-123", "author": "Test Author", "quote": "Updated Quote"}'
              ),
            redirected: false,
            url: url as string,
          });
        }
      } else if (url.includes('httpbin.org/bearer')) {
        // Mock authentication test
        return Promise.resolve({
          status: 200,
          statusText: 'OK',
          headers: new Headers({ 'content-type': 'application/json' }),
          text: () => Promise.resolve('{"authenticated": true, "token": "test-token-123"}'),
          redirected: false,
          url: url as string,
        });
      }
    }

    // Default mock response
    return Promise.resolve({
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'application/json' }),
      text: () => Promise.resolve('{"success": true}'),
      redirected: false,
      url: url as string,
    });
  });
}

function restoreFetch() {
  global.fetch = originalFetch;
}

describe('Workbook Integration Tests', () => {
  let configManager: ConfigManager;
  let variableEngine: VariableEngine;
  let client: IntegratedApicizeClient;

  beforeEach(() => {
    mockFetchForIntegration();
    configManager = new ConfigManager();
    variableEngine = new VariableEngine();
    client = new IntegratedApicizeClient(configManager, variableEngine);
  });

  afterEach(() => {
    restoreFetch();
    // Clear any lingering warnings from variable engine
    variableEngine.clearWarnings();
  });

  describe('Demo Workbook Integration', () => {
    let demoWorkbook: ApicizeWorkbook;

    beforeEach(() => {
      // Load the demo workbook
      const workbookPath = path.join(__dirname, '../../../examples/workbooks/demo.apicize');

      // Check if file exists first
      if (!fs.existsSync(workbookPath)) {
        throw new Error(`Demo workbook not found at: ${workbookPath}`);
      }

      const workbookContent = fs.readFileSync(workbookPath, 'utf-8');

      // Parse JSON with error handling
      try {
        demoWorkbook = JSON.parse(workbookContent);
      } catch (error) {
        throw new Error(`Failed to parse demo workbook JSON: ${error}`);
      }

      // Validate the workbook structure
      expect(() => validateApicizeFile(demoWorkbook)).not.toThrow();

      // Ensure workbook has expected structure
      expect(demoWorkbook).toHaveProperty('version');
      expect(demoWorkbook).toHaveProperty('requests');
      expect(Array.isArray(demoWorkbook.requests)).toBe(true);
    });

    it('should load and validate demo workbook', () => {
      expect(demoWorkbook.version).toBe(1.0);
      expect(demoWorkbook.requests).toBeDefined();
      expect(demoWorkbook.scenarios).toBeDefined();
      expect(Array.isArray(demoWorkbook.requests)).toBe(true);
    });

    it('should extract individual request from nested structure', () => {
      // Navigate the hierarchical structure to find the "Create quote" request
      expect(demoWorkbook.requests.length).toBeGreaterThan(0);

      const crudGroup = demoWorkbook.requests[0] as RequestGroup;
      expect(crudGroup).toBeDefined();
      expect(crudGroup.name).toBe('CRUD Operations');
      expect(crudGroup.children).toBeDefined();
      expect(Array.isArray(crudGroup.children)).toBe(true);
      expect(crudGroup.children!.length).toBeGreaterThan(0);

      const authorGroup = crudGroup.children![0] as RequestGroup;
      expect(authorGroup).toBeDefined();
      expect(authorGroup.name).toBe('Author #1');
      expect(authorGroup.children).toBeDefined();
      expect(Array.isArray(authorGroup.children)).toBe(true);
      expect(authorGroup.children!.length).toBeGreaterThan(0);

      const createRequest = authorGroup.children![0] as Request;
      expect(createRequest).toBeDefined();
      expect(createRequest.name).toBe('Create quote');
      expect(createRequest.url).toBe('https://sample-api.apicize.com/quote/');
      expect(createRequest.method).toBe('POST');

      // Verify it's actually a request, not a group
      expect('url' in createRequest).toBe(true);
      expect('method' in createRequest).toBe(true);
    });

    it('should execute request with variable substitution from scenario', async () => {
      // Verify scenarios exist
      expect(demoWorkbook.scenarios).toBeDefined();
      expect(Array.isArray(demoWorkbook.scenarios)).toBe(true);
      expect(demoWorkbook.scenarios!.length).toBeGreaterThan(0);

      // Set up scenario variables
      const scenario = demoWorkbook.scenarios![0];
      expect(scenario).toBeDefined();
      expect(scenario.id).toBeDefined();
      expect(scenario.name).toBeDefined();

      variableEngine.setScenario(scenario);

      // Extract the "Create quote" request
      const crudGroup = demoWorkbook.requests[0] as RequestGroup;
      const authorGroup = crudGroup.children![0] as RequestGroup;
      const createRequest = authorGroup.children![0] as Request;

      // Convert Request to RequestConfig for execution
      const requestConfig: RequestConfig = {
        url: createRequest.url,
        method: createRequest.method as HttpMethod,
        ...(createRequest.headers && { headers: createRequest.headers }),
        ...(createRequest.body && { body: createRequest.body }),
        ...(createRequest.timeout && { timeout: createRequest.timeout }),
      };

      // Execute the request
      const response = await client.execute(requestConfig);

      // Verify response
      expect(response.status).toBe(200);
      expect(response.body.type).toBe(BodyType.JSON);

      // Verify fetch was called with substituted variables
      expect(global.fetch).toHaveBeenCalledWith(
        'https://sample-api.apicize.com/quote/',
        expect.objectContaining({
          method: 'POST',
        })
      );

      // Verify the body contains substituted values
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const fetchOptions = fetchCall[1];
      expect(fetchOptions.body).toContain('Samuel Clemmons'); // Author from demo scenario
    });

    it('should handle chained requests with output variables', async () => {
      // Set up scenario variables
      const scenario = demoWorkbook.scenarios![0];
      variableEngine.setScenario(scenario);

      // Simulate output from create request
      variableEngine.addOutput('id', 'test-id-123');

      // Extract the "Get original quote" request
      const crudGroup = demoWorkbook.requests[0] as RequestGroup;
      const authorGroup = crudGroup.children![0] as RequestGroup;
      const getRequest = authorGroup.children![1] as Request;

      const requestConfig: RequestConfig = {
        url: getRequest.url,
        method: getRequest.method as HttpMethod,
        ...(getRequest.timeout && { timeout: getRequest.timeout }),
      };

      // Execute the request
      const response = await client.execute(requestConfig);

      // Verify response
      expect(response.status).toBe(200);

      // Verify URL had variable substitution
      expect(global.fetch).toHaveBeenCalledWith(
        'https://sample-api.apicize.com/quote/test-id-123',
        expect.objectContaining({
          method: 'GET',
        })
      );
    });
  });

  describe('Authentication Workbook Integration', () => {
    let authWorkbook: ApicizeWorkbook;

    beforeEach(() => {
      // Load the authentication workbook
      const workbookPath = path.join(
        __dirname,
        '../../../examples/workbooks/with-authentication.apicize'
      );

      // Check if file exists first
      if (!fs.existsSync(workbookPath)) {
        throw new Error(`Authentication workbook not found at: ${workbookPath}`);
      }

      const workbookContent = fs.readFileSync(workbookPath, 'utf-8');

      // Parse JSON with error handling
      try {
        authWorkbook = JSON.parse(workbookContent);
      } catch (error) {
        throw new Error(`Failed to parse authentication workbook JSON: ${error}`);
      }

      // Validate the workbook structure
      expect(() => validateApicizeFile(authWorkbook)).not.toThrow();

      // Ensure workbook has expected structure
      expect(authWorkbook).toHaveProperty('version');
      expect(authWorkbook).toHaveProperty('requests');
      expect(Array.isArray(authWorkbook.requests)).toBe(true);
    });

    it('should load and validate authentication workbook', () => {
      expect(authWorkbook.version).toBe(1.0);
      expect(authWorkbook.requests).toBeDefined();
      expect(authWorkbook.authorizations).toBeDefined();
      expect(authWorkbook.scenarios).toBeDefined();
    });

    it('should execute authenticated request with scenario variables', async () => {
      // Set up scenario variables
      const scenario = authWorkbook.scenarios![0];
      variableEngine.setScenario(scenario);

      // Extract the protected endpoint request
      const protectedRequest = authWorkbook.requests[0] as Request;

      const requestConfig: RequestConfig = {
        url: protectedRequest.url,
        method: protectedRequest.method as HttpMethod,
        ...(protectedRequest.headers && { headers: protectedRequest.headers }),
        ...(protectedRequest.timeout && { timeout: protectedRequest.timeout }),
      };

      // Execute the request
      const response = await client.execute(requestConfig);

      // Verify response
      expect(response.status).toBe(200);
      expect(response.body.type).toBe(BodyType.JSON);

      // Verify the request was made to the correct endpoint
      expect(global.fetch).toHaveBeenCalledWith(
        'https://httpbin.org/bearer',
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('should validate authorization configurations', () => {
      const bearerAuth = authWorkbook.authorizations![0] as ApiKeyAuthorization;
      expect(bearerAuth.type).toBe('ApiKey');
      expect(bearerAuth.header).toBe('Authorization');
      expect(bearerAuth.value).toBe('Bearer {{token}}');

      const basicAuth = authWorkbook.authorizations![1] as BasicAuthorization;
      expect(basicAuth.type).toBe('Basic');
      expect(basicAuth.username).toBe('{{username}}');
      expect(basicAuth.password).toBe('{{password}}');
    });
  });

  describe('Request Groups Workbook Integration', () => {
    let requestGroupsWorkbook: ApicizeWorkbook;

    beforeEach(() => {
      // Load the request groups workbook
      const workbookPath = path.join(
        __dirname,
        '../../../examples/workbooks/request-groups.apicize'
      );

      // Check if file exists first
      if (!fs.existsSync(workbookPath)) {
        throw new Error(`Request groups workbook not found at: ${workbookPath}`);
      }

      const workbookContent = fs.readFileSync(workbookPath, 'utf-8');

      // Parse JSON with error handling
      try {
        requestGroupsWorkbook = JSON.parse(workbookContent);
      } catch (error) {
        throw new Error(`Failed to parse request groups workbook JSON: ${error}`);
      }

      // Validate the workbook structure
      expect(() => validateApicizeFile(requestGroupsWorkbook)).not.toThrow();

      // Ensure workbook has expected structure
      expect(requestGroupsWorkbook).toHaveProperty('version');
      expect(requestGroupsWorkbook).toHaveProperty('requests');
      expect(Array.isArray(requestGroupsWorkbook.requests)).toBe(true);
    });

    it('should handle nested request group structures', () => {
      expect(requestGroupsWorkbook.requests).toBeDefined();
      expect(Array.isArray(requestGroupsWorkbook.requests)).toBe(true);

      // Should have hierarchical structure
      const firstGroup = requestGroupsWorkbook.requests[0] as RequestGroup;
      expect(firstGroup.children).toBeDefined();
      expect(Array.isArray(firstGroup.children)).toBe(true);
    });
  });

  describe('HTTP Client Feature Coverage', () => {
    it('should handle all HTTP methods from workbooks', async () => {
      const methods: HttpMethod[] = [
        HttpMethod.GET,
        HttpMethod.POST,
        HttpMethod.PUT,
        HttpMethod.DELETE,
        HttpMethod.PATCH,
      ];

      for (const method of methods) {
        const requestConfig: RequestConfig = {
          url: 'https://httpbin.org/anything',
          method,
        };

        const response = await client.execute(requestConfig);
        expect(response.status).toBe(200);
      }
    });

    it('should handle different body types from workbooks', async () => {
      const bodyTypes = [
        { type: BodyType.JSON, data: { test: 'value' } },
        { type: BodyType.Text, data: 'test text' },
        { type: BodyType.XML, data: '<test>value</test>' },
        { type: BodyType.Form, data: [{ name: 'field', value: 'value' }] },
      ];

      for (const body of bodyTypes) {
        const requestConfig: RequestConfig = {
          url: 'https://httpbin.org/post',
          method: HttpMethod.POST,
          body,
        };

        const response = await client.execute(requestConfig);
        expect(response.status).toBe(200);
      }
    });
  });
});
