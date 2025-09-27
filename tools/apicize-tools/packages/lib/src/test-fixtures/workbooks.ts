import {
  ApicizeWorkbook,
  Request,
  RequestGroup,
  HttpMethod,
  BodyType,
  ExecutionMode,
  VariableType,
  AuthorizationType,
  DataType
} from '../types';

/**
 * Valid minimal workbook
 */
export const MINIMAL_WORKBOOK: ApicizeWorkbook = {
  version: 1.0,
  requests: [],
};

/**
 * Valid workbook with basic request
 */
export const BASIC_REQUEST_WORKBOOK: ApicizeWorkbook = {
  version: 1.0,
  requests: [
    {
      id: 'req-1',
      name: 'Get Users',
      url: 'https://api.example.com/users',
      method: HttpMethod.GET,
      headers: [
        { name: 'Accept', value: 'application/json' }
      ],
      timeout: 30000,
      runs: 1,
    }
  ],
};

/**
 * Valid workbook with nested request groups
 */
export const NESTED_GROUPS_WORKBOOK: ApicizeWorkbook = {
  version: 1.0,
  requests: [
    {
      id: 'group-1',
      name: 'User Management',
      children: [
        {
          id: 'req-1',
          name: 'Get Users',
          url: 'https://api.example.com/users',
          method: HttpMethod.GET,
        },
        {
          id: 'group-2',
          name: 'Admin Operations',
          children: [
            {
              id: 'req-2',
              name: 'Delete User',
              url: 'https://api.example.com/users/{{userId}}',
              method: HttpMethod.DELETE,
            }
          ],
          execution: ExecutionMode.SEQUENTIAL,
        }
      ],
      execution: ExecutionMode.CONCURRENT,
      runs: 1,
    }
  ],
};

/**
 * Valid workbook with all body types
 */
export const ALL_BODY_TYPES_WORKBOOK: ApicizeWorkbook = {
  version: 1.0,
  requests: [
    {
      id: 'req-text',
      name: 'Text Body Request',
      url: 'https://api.example.com/text',
      method: HttpMethod.POST,
      body: {
        type: BodyType.Text,
        data: 'Plain text content',
      },
    },
    {
      id: 'req-json',
      name: 'JSON Body Request',
      url: 'https://api.example.com/json',
      method: HttpMethod.POST,
      body: {
        type: BodyType.JSON,
        data: { key: 'value', nested: { prop: 'test' } },
      },
    },
    {
      id: 'req-xml',
      name: 'XML Body Request',
      url: 'https://api.example.com/xml',
      method: HttpMethod.POST,
      body: {
        type: BodyType.XML,
        data: '<root><element>value</element></root>',
      },
    },
    {
      id: 'req-form',
      name: 'Form Body Request',
      url: 'https://api.example.com/form',
      method: HttpMethod.POST,
      body: {
        type: BodyType.Form,
        data: [
          { name: 'field1', value: 'value1' },
          { name: 'field2', value: 'value2' },
        ],
      },
    },
  ],
};

/**
 * Valid workbook with scenarios
 */
export const SCENARIOS_WORKBOOK: ApicizeWorkbook = {
  version: 1.0,
  requests: [
    {
      id: 'req-1',
      name: 'API Request',
      url: '{{baseUrl}}/api/{{endpoint}}',
      method: HttpMethod.GET,
    }
  ],
  scenarios: [
    {
      id: 'scenario-dev',
      name: 'Development',
      variables: [
        {
          name: 'baseUrl',
          value: 'http://localhost:3000',
          type: VariableType.TEXT,
        },
        {
          name: 'endpoint',
          value: 'users',
          type: VariableType.TEXT,
        },
        {
          name: 'config',
          value: '{"timeout": 5000}',
          type: VariableType.JSON,
        }
      ],
    },
    {
      id: 'scenario-prod',
      name: 'Production',
      variables: [
        {
          name: 'baseUrl',
          value: 'https://api.production.com',
          type: VariableType.TEXT,
        },
        {
          name: 'endpoint',
          value: 'users',
          type: VariableType.TEXT,
        },
        {
          name: 'disabled',
          value: 'should-not-be-used',
          type: VariableType.TEXT,
          disabled: true,
        }
      ],
    }
  ],
};

/**
 * Valid workbook with authorization configurations
 */
export const AUTH_WORKBOOK: ApicizeWorkbook = {
  version: 1.0,
  requests: [],
  authorizations: [
    {
      id: 'auth-basic',
      name: 'Basic Auth',
      type: AuthorizationType.Basic,
      username: 'testuser',
      password: 'testpass',
    },
    {
      id: 'auth-apikey',
      name: 'API Key Auth',
      type: AuthorizationType.ApiKey,
      header: 'X-API-Key',
      value: 'test-api-key-123',
    },
    {
      id: 'auth-oauth2-client',
      name: 'OAuth2 Client',
      type: AuthorizationType.OAuth2Client,
      accessTokenUrl: 'https://auth.example.com/token',
      clientId: 'client-123',
      clientSecret: 'secret-456',
      scope: 'read write',
      audience: 'https://api.example.com',
    },
    {
      id: 'auth-oauth2-pkce',
      name: 'OAuth2 PKCE',
      type: AuthorizationType.OAuth2Pkce,
      authorizeUrl: 'https://auth.example.com/authorize',
      accessTokenUrl: 'https://auth.example.com/token',
      clientId: 'client-789',
      scope: 'openid profile',
    },
  ],
};

/**
 * Valid workbook with external data sources
 */
export const EXTERNAL_DATA_WORKBOOK: ApicizeWorkbook = {
  version: 1.0,
  requests: [],
  data: [
    {
      id: 'data-json',
      name: 'User Data',
      type: DataType.FILE_JSON,
      source: './data/users.json',
      validation_errors: null,
    },
    {
      id: 'data-csv',
      name: 'Test Scenarios',
      type: DataType.FILE_CSV,
      source: './data/scenarios.csv',
      validation_errors: null,
    },
  ],
};

/**
 * Valid workbook with defaults
 */
export const DEFAULTS_WORKBOOK: ApicizeWorkbook = {
  version: 1.0,
  requests: [],
  defaults: {
    selectedScenario: {
      id: 'scenario-1',
      name: 'Default Scenario',
    },
    selectedAuthorization: {
      id: 'auth-1',
      name: 'Default Auth',
    },
    selectedProxy: {
      id: 'proxy-1',
      name: 'Default Proxy',
    },
    selectedCertificate: {
      id: 'cert-1',
      name: 'Default Certificate',
    },
  },
};

/**
 * Complete workbook with all features
 */
export const COMPLETE_WORKBOOK: ApicizeWorkbook = {
  version: 1.0,
  requests: [
    {
      id: 'group-main',
      name: 'Main API Tests',
      children: [
        {
          id: 'req-get',
          name: 'Get Resource',
          url: '{{baseUrl}}/resources',
          method: HttpMethod.GET,
          test: `
            describe('Get Resource', () => {
              it('should return 200', () => {
                expect(response.status).to.equal(200);
              });
            });
          `,
        },
        {
          id: 'req-post',
          name: 'Create Resource',
          url: '{{baseUrl}}/resources',
          method: HttpMethod.POST,
          body: {
            type: BodyType.JSON,
            data: { name: '{{resourceName}}' },
          },
          test: `
            describe('Create Resource', () => {
              it('should create successfully', () => {
                expect(response.status).to.equal(201);
                const data = response.body.data;
                output('resourceId', data.id);
              });
            });
          `,
        },
      ],
      execution: ExecutionMode.SEQUENTIAL,
      selectedScenario: {
        id: 'scenario-dev',
        name: 'Development',
      },
    }
  ],
  scenarios: [
    {
      id: 'scenario-dev',
      name: 'Development',
      variables: [
        {
          name: 'baseUrl',
          value: 'http://localhost:3000',
          type: VariableType.TEXT,
        },
        {
          name: 'resourceName',
          value: 'Test Resource',
          type: VariableType.TEXT,
        }
      ],
    }
  ],
  authorizations: [
    {
      id: 'auth-1',
      name: 'Test Auth',
      type: AuthorizationType.ApiKey,
      header: 'X-API-Key',
      value: 'test-key',
    }
  ],
  defaults: {
    selectedAuthorization: {
      id: 'auth-1',
      name: 'Test Auth',
    },
    selectedScenario: {
      id: 'scenario-dev',
      name: 'Development',
    },
  },
};