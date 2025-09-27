/**
 * Invalid test cases for validation testing
 */

/**
 * Missing version field
 */
export const MISSING_VERSION = {
  requests: [],
};

/**
 * Invalid version number
 */
export const INVALID_VERSION = {
  version: 2.0,
  requests: [],
};

/**
 * Invalid version type
 */
export const INVALID_VERSION_TYPE = {
  version: '1.0',
  requests: [],
};

/**
 * Invalid HTTP method
 */
export const INVALID_HTTP_METHOD = {
  version: 1.0,
  requests: [
    {
      id: 'req-1',
      name: 'Invalid Method',
      url: 'https://api.example.com',
      method: 'INVALID',
    },
  ],
};

/**
 * Missing required request fields
 */
export const MISSING_REQUEST_FIELDS = {
  version: 1.0,
  requests: [
    {
      id: 'req-1',
      name: 'Missing URL and Method',
      // Missing: url and method
    },
  ],
};

/**
 * Invalid body type
 */
export const INVALID_BODY_TYPE = {
  version: 1.0,
  requests: [
    {
      id: 'req-1',
      name: 'Invalid Body Type',
      url: 'https://api.example.com',
      method: 'POST',
      body: {
        type: 'InvalidType',
        data: 'test',
      },
    },
  ],
};

/**
 * Invalid variable type
 */
export const INVALID_VARIABLE_TYPE = {
  version: 1.0,
  requests: [],
  scenarios: [
    {
      id: 'scenario-1',
      name: 'Invalid Variable',
      variables: [
        {
          name: 'test',
          value: 'value',
          type: 'INVALID_TYPE',
        },
      ],
    },
  ],
};

/**
 * Invalid authorization type
 */
export const INVALID_AUTH_TYPE = {
  version: 1.0,
  requests: [],
  authorizations: [
    {
      id: 'auth-1',
      name: 'Invalid Auth',
      type: 'InvalidAuth',
    },
  ],
};

/**
 * Missing required auth fields
 */
export const MISSING_AUTH_FIELDS = {
  version: 1.0,
  requests: [],
  authorizations: [
    {
      id: 'auth-basic',
      name: 'Incomplete Basic Auth',
      type: 'Basic',
      // Missing: username and password
    },
    {
      id: 'auth-apikey',
      name: 'Incomplete API Key',
      type: 'ApiKey',
      // Missing: header and value
    },
    {
      id: 'auth-oauth',
      name: 'Incomplete OAuth',
      type: 'OAuth2Client',
      // Missing: accessTokenUrl, clientId, clientSecret
    },
  ],
};

/**
 * Duplicate IDs
 */
export const DUPLICATE_IDS = {
  version: 1.0,
  requests: [
    {
      id: 'duplicate-id',
      name: 'Request 1',
      url: 'https://api.example.com/1',
      method: 'GET',
    },
    {
      id: 'duplicate-id',
      name: 'Request 2',
      url: 'https://api.example.com/2',
      method: 'GET',
    },
  ],
};

/**
 * Invalid nested structure
 */
export const INVALID_NESTED_STRUCTURE = {
  version: 1.0,
  requests: [
    {
      id: 'group-1',
      name: 'Group with invalid child',
      children: [
        {
          // Missing all required fields
        },
      ],
    },
  ],
};

/**
 * Unknown properties
 */
export const UNKNOWN_PROPERTIES = {
  version: 1.0,
  requests: [],
  unknownField1: 'value1',
  unknownField2: 123,
  anotherUnknown: { nested: 'object' },
};

/**
 * Invalid execution mode
 */
export const INVALID_EXECUTION_MODE = {
  version: 1.0,
  requests: [
    {
      id: 'group-1',
      name: 'Invalid Execution',
      children: [],
      execution: 'INVALID_MODE',
    },
  ],
};

/**
 * Invalid data type
 */
export const INVALID_DATA_TYPE = {
  version: 1.0,
  requests: [],
  data: [
    {
      id: 'data-1',
      name: 'Invalid Data Type',
      type: 'INVALID_TYPE',
      source: './data.json',
    },
  ],
};

/**
 * Circular reference (for advanced validation)
 */
export const CIRCULAR_REFERENCE = {
  version: 1.0,
  requests: [
    {
      id: 'group-1',
      name: 'Group 1',
      children: [
        {
          id: 'group-2',
          name: 'Group 2',
          // This would create a circular reference if group-2 contained group-1
          children: [],
        },
      ],
    },
  ],
};

/**
 * Invalid URL format
 */
export const INVALID_URL_FORMAT = {
  version: 1.0,
  requests: [
    {
      id: 'req-1',
      name: 'Invalid URL',
      url: 'not-a-valid-url',
      method: 'GET',
    },
  ],
};

/**
 * Invalid timeout value
 */
export const INVALID_TIMEOUT = {
  version: 1.0,
  requests: [
    {
      id: 'req-1',
      name: 'Invalid Timeout',
      url: 'https://api.example.com',
      method: 'GET',
      timeout: -1000, // Negative timeout
    },
  ],
};

/**
 * Invalid runs value
 */
export const INVALID_RUNS = {
  version: 1.0,
  requests: [
    {
      id: 'req-1',
      name: 'Invalid Runs',
      url: 'https://api.example.com',
      method: 'GET',
      runs: 0, // Zero runs
    },
  ],
};
