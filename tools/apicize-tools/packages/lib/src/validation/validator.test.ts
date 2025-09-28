import { ApicizeValidator, validateApicizeFile, assertValidApicizeFile } from './validator';
import {
  ApicizeWorkbook,
  HttpMethod,
  BodyType,
  VariableType,
  ExecutionMode,
  AuthorizationType,
  DataType,
} from '../types';
import { WORKBOOK_EXAMPLES, loadExampleAsJson } from '../../../examples/src/index';

describe('ApicizeValidator', () => {
  let validator: ApicizeValidator;

  beforeEach(() => {
    validator = new ApicizeValidator();
  });

  describe('validateApicizeFile', () => {
    it('should validate a minimal valid .apicize file', () => {
      const data: ApicizeWorkbook = {
        version: 1.0,
        requests: [],
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
            method: HttpMethod.GET,
            test: 'expect(response.status).to.equal(200);',
            headers: [{ name: 'Accept', value: 'application/json' }],
            timeout: 5000,
            runs: 1,
          },
        ],
        scenarios: [
          {
            id: 'def456',
            name: 'Development',
            variables: [
              {
                name: 'apiUrl',
                value: 'http://localhost:3000',
                type: VariableType.TEXT,
              },
            ],
          },
        ],
      };

      const result = validator.validateApicizeFile(data);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject missing version', () => {
      const data = {
        requests: [],
      };

      const result = validator.validateApicizeFile(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining("Missing required property 'version'"),
        })
      );
    });

    it('should reject invalid version', () => {
      const data = {
        version: 2.0,
      };

      const result = validator.validateApicizeFile(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('maximum 1'),
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
            method: 'INVALID',
          },
        ],
      };

      const result = validator.validateApicizeFile(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('must be one of'),
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
                method: HttpMethod.GET,
              },
              {
                id: 'group2',
                name: 'Admin Operations',
                children: [
                  {
                    id: 'req2',
                    name: 'Delete User',
                    url: 'https://api.example.com/users/{{id}}',
                    method: HttpMethod.DELETE,
                  },
                ],
              },
            ],
            execution: ExecutionMode.SEQUENTIAL,
          },
        ],
      };

      const result = validator.validateApicizeFile(data);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate authorization configurations', () => {
      const data: ApicizeWorkbook = {
        version: 1.0,
        requests: [],
        authorizations: [
          {
            id: 'auth1',
            name: 'Basic Auth',
            type: AuthorizationType.Basic,
            username: 'user',
            password: 'pass',
          },
          {
            id: 'auth2',
            name: 'API Key',
            type: AuthorizationType.ApiKey,
            header: 'X-API-Key',
            value: 'secret-key',
          },
          {
            id: 'auth3',
            name: 'OAuth2 Client',
            type: AuthorizationType.OAuth2Client,
            accessTokenUrl: 'https://auth.example.com/token',
            clientId: 'client-id',
            clientSecret: 'client-secret',
            scope: 'api:read',
          },
        ],
      };

      const result = validator.validateApicizeFile(data);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate request body types', () => {
      const testCases = [
        {
          name: 'text body',
          body: {
            type: BodyType.Text as BodyType.Text,
            data: 'Plain text content',
          },
        },
        {
          name: 'JSON body',
          body: {
            type: BodyType.JSON as BodyType.JSON,
            data: { key: 'value' },
          },
        },
        {
          name: 'XML body',
          body: {
            type: BodyType.XML as BodyType.XML,
            data: '<root><element>value</element></root>',
          },
        },
        {
          name: 'Form body',
          body: {
            type: BodyType.Form as BodyType.Form,
            data: [
              { name: 'field1', value: 'value1' },
              { name: 'field2', value: 'value2' },
            ],
          },
        },
      ];

      for (const testCase of testCases) {
        const data: ApicizeWorkbook = {
          version: 1.0,
          requests: [
            {
              id: 'req1',
              name: `Request with ${testCase.name}`,
              url: 'https://api.example.com/endpoint',
              method: HttpMethod.POST,
              body: testCase.body,
            },
          ],
        };

        const result = validator.validateApicizeFile(data);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      }

      // Test case for no body (undefined)
      const dataWithNoBody: ApicizeWorkbook = {
        version: 1.0,
        requests: [
          {
            id: 'req1',
            name: 'Request with no body',
            url: 'https://api.example.com/endpoint',
            method: HttpMethod.GET,
          },
        ],
      };

      const result = validator.validateApicizeFile(dataWithNoBody);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject additional properties', () => {
      const data = {
        version: 1.0,
        unknownProperty: 'value',
      };

      const result = validator.validateApicizeFile(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining("Unknown property 'unknownProperty'"),
        })
      );
    });

    it('should validate external data sources', () => {
      const data: ApicizeWorkbook = {
        version: 1.0,
        requests: [],
        data: [
          {
            id: 'data1',
            name: 'Test Data',
            type: DataType.FILE_JSON,
            source: './data/test-data.json',
            validation_errors: null,
          },
          {
            id: 'data2',
            name: 'CSV Data',
            type: DataType.FILE_CSV,
            source: './data/users.csv',
            validation_errors: null,
          },
        ],
      };

      const result = validator.validateApicizeFile(data);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate defaults section', () => {
      const data: ApicizeWorkbook = {
        version: 1.0,
        requests: [],
        defaults: {
          selectedScenario: {
            id: 'scenario1',
            name: 'Development',
          },
          selectedAuthorization: {
            id: 'auth1',
            name: 'API Key',
          },
        },
      };

      const result = validator.validateApicizeFile(data);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('assertValidApicizeFile', () => {
    it('should not throw for valid data', () => {
      const data = {
        version: 1.0,
      };

      expect(() => {
        validator.assertValidApicizeFile(data);
      }).not.toThrow();
    });

    it('should throw for invalid data with detailed message', () => {
      const data = {
        version: 'invalid',
      };

      expect(() => {
        validator.assertValidApicizeFile(data);
      }).toThrow('Invalid .apicize file:');
    });

    it('should provide type guard functionality', () => {
      const data: unknown = {
        version: 1.0,
        requests: [],
      };

      validator.assertValidApicizeFile(data);
      // TypeScript should now know that data is ApicizeWorkbook
      expect(data.version).toBe(1.0);
      expect(data.requests).toEqual([]);
    });
  });

  describe('validateSection', () => {
    it('should validate scenarios through complete workbook validation', () => {
      const workbookData: ApicizeWorkbook = {
        version: 1.0,
        requests: [],
        scenarios: [
          {
            id: 'scenario1',
            name: 'Test Scenario',
            variables: [
              {
                name: 'apiUrl',
                value: 'https://api.example.com',
                type: VariableType.TEXT,
              },
            ],
          },
        ],
      };

      const result = validator.validateApicizeFile(workbookData);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid scenario data through complete workbook validation', () => {
      const workbookData = {
        version: 1.0,
        requests: [],
        scenarios: [
          {
            id: 'scenario1',
            // Missing required 'name' property
            variables: [],
          },
        ],
      };

      const result = validator.validateApicizeFile(workbookData);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain("Missing required property 'name'");
    });

    it('should handle unknown section names', () => {
      const result = validator.validateSection('unknownSection' as any, {});
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining("Unknown section 'unknownSection'"),
        })
      );
    });
  });

  describe('convenience functions', () => {
    it('validateApicizeFile should work as standalone function', () => {
      const data = {
        version: 1.0,
        requests: [],
      };

      const result = validateApicizeFile(data);
      expect(result.valid).toBe(true);
    });

    it('assertValidApicizeFile should work as standalone function', () => {
      const data = {
        version: 1.0,
        requests: [],
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
            method: HttpMethod.GET,
            headers: [
              {
                name: 'Header1',
                // Missing 'value' property
              },
            ],
          },
        ],
      };

      const result = validator.validateApicizeFile(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining("Missing required property 'value'"),
        })
      );
    });

    it('should handle multiple errors', () => {
      const data = {
        // Missing version
        requests: [
          {
            // Missing required properties
            name: 'Invalid Request',
          },
        ],
      };

      const result = validator.validateApicizeFile(data);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('Additional validation scenarios', () => {
    it('should validate requests with all HTTP methods', () => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

      methods.forEach(method => {
        const data: ApicizeWorkbook = {
          version: 1.0,
          requests: [
            {
              id: `req-${method}`,
              name: `${method} Request`,
              url: 'https://api.example.com/test',
              method: method as HttpMethod,
            },
          ],
        };

        const result = validator.validateApicizeFile(data);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it('should validate complex nested request groups', () => {
      const data: ApicizeWorkbook = {
        version: 1.0,
        requests: [
          {
            id: 'group1',
            name: 'Level 1 Group',
            children: [
              {
                id: 'group2',
                name: 'Level 2 Group',
                children: [
                  {
                    id: 'req1',
                    name: 'Nested Request',
                    url: 'https://api.example.com/nested',
                    method: HttpMethod.GET,
                  },
                ],
                execution: ExecutionMode.CONCURRENT,
              },
            ],
            execution: ExecutionMode.SEQUENTIAL,
          },
        ],
      };

      const result = validator.validateApicizeFile(data);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle empty optional arrays', () => {
      const data: ApicizeWorkbook = {
        version: 1.0,
        requests: [],
        scenarios: [],
        authorizations: [],
        certificates: [],
        proxies: [],
        data: [],
      };

      const result = validator.validateApicizeFile(data);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Real Workbook Examples', () => {
    it('should validate all example workbooks', () => {
      // Test each real workbook example to ensure our validation handles real-world data
      WORKBOOK_EXAMPLES.forEach(example => {
        try {
          const data = loadExampleAsJson(example);
          const result = validator.validateApicizeFile(data);

          expect(result.valid).toBe(true);
          expect(result.errors).toHaveLength(0);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          throw new Error(`Failed to validate ${example.name}: ${errorMessage}`);
        }
      });
    });

    it('should validate the demo workbook specifically', () => {
      const demoExample = WORKBOOK_EXAMPLES.find(ex => ex.name === 'demo.apicize');
      expect(demoExample).toBeDefined();

      const data = loadExampleAsJson(demoExample!);
      const result = validator.validateApicizeFile(data);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);

      // Ensure it has the expected structure
      expect(data.version).toBe(1.0);
      expect(data.requests).toBeDefined();
      expect(Array.isArray(data.requests)).toBe(true);
      expect(data.requests.length).toBeGreaterThan(0);
    });

    it('should validate workbooks with complex nested structures', () => {
      const nestedExample = WORKBOOK_EXAMPLES.find(ex => ex.name === 'request-groups.apicize');
      expect(nestedExample).toBeDefined();

      const data = loadExampleAsJson(nestedExample!);
      const result = validator.validateApicizeFile(data);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);

      // Verify nested structure
      expect(data.requests).toBeDefined();
      expect(data.requests.length).toBeGreaterThan(0);

      // Check for nested children in request groups
      const hasNestedChildren = data.requests.some(
        (req: any) => req.children && req.children.some((child: any) => child.children)
      );
      expect(hasNestedChildren).toBe(true);
    });

    it('should validate workbooks with different authentication types', () => {
      const authExample = WORKBOOK_EXAMPLES.find(ex => ex.name === 'with-authentication.apicize');
      expect(authExample).toBeDefined();

      const data = loadExampleAsJson(authExample!);
      const result = validator.validateApicizeFile(data);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);

      // Verify authorization configurations
      expect(data.authorizations).toBeDefined();
      expect(Array.isArray(data.authorizations)).toBe(true);
      expect(data.authorizations.length).toBeGreaterThan(0);
    });

    it('should validate minimal workbook', () => {
      const minimalExample = WORKBOOK_EXAMPLES.find(ex => ex.name === 'minimal.apicize');
      expect(minimalExample).toBeDefined();

      const data = loadExampleAsJson(minimalExample!);
      const result = validator.validateApicizeFile(data);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);

      // Verify minimal structure
      expect(data.version).toBe(1.0);
      // Minimal workbook may not have requests property
      if (data.requests) {
        expect(Array.isArray(data.requests)).toBe(true);
      }
    });
  });
});
