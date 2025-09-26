import { ApicizeValidator, validateApicizeFile, assertValidApicizeFile } from './validator';
import { ApicizeWorkbook } from '../types';

describe('ApicizeValidator', () => {
  let validator: ApicizeValidator;

  beforeEach(() => {
    validator = new ApicizeValidator();
  });

  describe('validateApicizeFile', () => {
    it('should validate a minimal valid .apicize file', () => {
      const data: ApicizeWorkbook = {
        version: 1.0
      };

      const result = validator.validateApicizeFile(data);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate a complete valid .apicize file', () => {
      const data: ApicizeWorkbook = {
        version: 1.0,
        requests: [
          {
            id: 'abc123',
            name: 'Get Users',
            url: 'https://api.example.com/users',
            method: 'GET',
            test: 'expect(response.status).to.equal(200);',
            headers: [
              { name: 'Accept', value: 'application/json' }
            ],
            timeout: 5000,
            runs: 1
          }
        ],
        scenarios: [
          {
            id: 'def456',
            name: 'Development',
            variables: [
              {
                name: 'apiUrl',
                value: 'http://localhost:3000',
                type: 'TEXT'
              }
            ]
          }
        ]
      };

      const result = validator.validateApicizeFile(data);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject missing version', () => {
      const data = {
        requests: []
      };

      const result = validator.validateApicizeFile(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining("Missing required property 'version'")
        })
      );
    });

    it('should reject invalid version', () => {
      const data = {
        version: 2.0
      };

      const result = validator.validateApicizeFile(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('maximum 1')
        })
      );
    });

    it('should reject invalid HTTP method', () => {
      const data = {
        version: 1.0,
        requests: [
          {
            id: 'abc123',
            name: 'Invalid Request',
            url: 'https://api.example.com',
            method: 'INVALID'
          }
        ]
      };

      const result = validator.validateApicizeFile(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('must be one of')
        })
      );
    });

    it('should validate request groups with nested structure', () => {
      const data: ApicizeWorkbook = {
        version: 1.0,
        requests: [
          {
            id: 'group1',
            name: 'User Operations',
            children: [
              {
                id: 'req1',
                name: 'Get Users',
                url: 'https://api.example.com/users',
                method: 'GET'
              },
              {
                id: 'group2',
                name: 'Admin Operations',
                children: [
                  {
                    id: 'req2',
                    name: 'Delete User',
                    url: 'https://api.example.com/users/{{id}}',
                    method: 'DELETE'
                  }
                ]
              }
            ],
            execution: 'SEQUENTIAL'
          }
        ]
      };

      const result = validator.validateApicizeFile(data);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate authorization configurations', () => {
      const data: ApicizeWorkbook = {
        version: 1.0,
        authorizations: [
          {
            id: 'auth1',
            name: 'Basic Auth',
            type: 'Basic',
            username: 'user',
            password: 'pass'
          },
          {
            id: 'auth2',
            name: 'API Key',
            type: 'ApiKey',
            header: 'X-API-Key',
            value: 'secret-key'
          },
          {
            id: 'auth3',
            name: 'OAuth2 Client',
            type: 'OAuth2Client',
            accessTokenUrl: 'https://auth.example.com/token',
            clientId: 'client-id',
            clientSecret: 'client-secret',
            scope: 'api:read'
          }
        ]
      };

      const result = validator.validateApicizeFile(data);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate request body types', () => {
      const testCases = [
        {
          type: 'None' as const,
          data: undefined
        },
        {
          type: 'Text' as const,
          data: 'Plain text content'
        },
        {
          type: 'JSON' as const,
          data: { key: 'value' }
        },
        {
          type: 'XML' as const,
          data: '<root><element>value</element></root>'
        },
        {
          type: 'Form' as const,
          data: [
            { name: 'field1', value: 'value1' },
            { name: 'field2', value: 'value2' }
          ]
        }
      ];

      for (const testCase of testCases) {
        const data: ApicizeWorkbook = {
          version: 1.0,
          requests: [
            {
              id: 'req1',
              name: `Request with ${testCase.type} body`,
              url: 'https://api.example.com/endpoint',
              method: 'POST',
              body: {
                type: testCase.type,
                data: testCase.data
              }
            }
          ]
        };

        const result = validator.validateApicizeFile(data);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      }
    });

    it('should reject additional properties', () => {
      const data = {
        version: 1.0,
        unknownProperty: 'value'
      };

      const result = validator.validateApicizeFile(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining("Unknown property 'unknownProperty'")
        })
      );
    });

    it('should validate external data sources', () => {
      const data: ApicizeWorkbook = {
        version: 1.0,
        data: [
          {
            id: 'data1',
            name: 'Test Data',
            type: 'FILE-JSON',
            source: './data/test-data.json',
            validation_errors: null
          },
          {
            id: 'data2',
            name: 'CSV Data',
            type: 'FILE-CSV',
            source: './data/users.csv',
            validation_errors: null
          }
        ]
      };

      const result = validator.validateApicizeFile(data);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate defaults section', () => {
      const data: ApicizeWorkbook = {
        version: 1.0,
        defaults: {
          selectedScenario: {
            id: 'scenario1',
            name: 'Development'
          },
          selectedAuthorization: {
            id: 'auth1',
            name: 'API Key'
          }
        }
      };

      const result = validator.validateApicizeFile(data);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('assertValidApicizeFile', () => {
    it('should not throw for valid data', () => {
      const data = {
        version: 1.0
      };

      expect(() => {
        validator.assertValidApicizeFile(data);
      }).not.toThrow();
    });

    it('should throw for invalid data with detailed message', () => {
      const data = {
        version: 'invalid'
      };

      expect(() => {
        validator.assertValidApicizeFile(data);
      }).toThrow('Invalid .apicize file:');
    });

    it('should provide type guard functionality', () => {
      const data: unknown = {
        version: 1.0,
        requests: []
      };

      validator.assertValidApicizeFile(data);
      // TypeScript should now know that data is ApicizeWorkbook
      expect(data.version).toBe(1.0);
      expect(data.requests).toEqual([]);
    });
  });

  describe('validateSection', () => {
    it('should validate individual sections', () => {
      const scenarioData = [
        {
          id: 'scenario1',
          name: 'Test Scenario',
          variables: [
            {
              name: 'apiUrl',
              value: 'https://api.example.com',
              type: 'TEXT'
            }
          ]
        }
      ];

      const result = validator.validateSection('scenarios', scenarioData);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid section data', () => {
      const invalidScenarioData = [
        {
          id: 'scenario1',
          // Missing required 'name' property
          variables: []
        }
      ];

      const result = validator.validateSection('scenarios', invalidScenarioData);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle unknown section names', () => {
      const result = validator.validateSection('unknownSection' as any, {});
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining("Unknown section 'unknownSection'")
        })
      );
    });
  });

  describe('convenience functions', () => {
    it('validateApicizeFile should work as standalone function', () => {
      const data = {
        version: 1.0
      };

      const result = validateApicizeFile(data);
      expect(result.valid).toBe(true);
    });

    it('assertValidApicizeFile should work as standalone function', () => {
      const data = {
        version: 1.0
      };

      expect(() => {
        assertValidApicizeFile(data);
      }).not.toThrow();
    });
  });

  describe('error formatting', () => {
    it('should provide clear error messages for nested paths', () => {
      const data = {
        version: 1.0,
        requests: [
          {
            id: 'req1',
            name: 'Test Request',
            url: 'https://api.example.com',
            method: 'GET',
            headers: [
              {
                name: 'Header1'
                // Missing 'value' property
              }
            ]
          }
        ]
      };

      const result = validator.validateApicizeFile(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining("Missing required property 'value'")
        })
      );
    });

    it('should handle multiple errors', () => {
      const data = {
        // Missing version
        requests: [
          {
            // Missing required properties
            name: 'Invalid Request'
          }
        ]
      };

      const result = validator.validateApicizeFile(data);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });
});