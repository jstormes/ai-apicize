import { describe, it, expect, beforeEach } from '@jest/globals';
import { TestGenerator } from './test-generator';
import {
  ApicizeWorkbook,
  Request,
  RequestGroup,
  BodyType,
  HttpMethod,
  ExecutionMode,
  VariableType,
} from '../types';

describe('TestGenerator', () => {
  let testGenerator: TestGenerator;

  beforeEach(() => {
    testGenerator = new TestGenerator();
  });

  describe('generateTestProject', () => {
    it('should generate a complete test project structure', () => {
      const workbook: ApicizeWorkbook = {
        version: 1.0,
        requests: [
          {
            id: 'group1',
            name: 'API Tests',
            children: [
              {
                id: 'req1',
                name: 'Get Users',
                url: 'https://api.example.com/users',
                method: HttpMethod.GET,
                test: 'expect(response.status).to.equal(200);',
              } as Request,
            ],
          } as RequestGroup,
        ],
        scenarios: [
          {
            id: 'sc1',
            name: 'Default',
            variables: [
              { name: 'baseUrl', value: 'https://api.example.com', type: VariableType.TEXT },
            ],
          },
        ],
      };

      const result = testGenerator.generateTestProject(workbook, 'test-workbook.apicize');

      // Check that main files are generated
      expect(result.files).toHaveLength(6); // index.spec.ts, group file, package.json, tsconfig.json, .mocharc.json, metadata
      expect(result.files.find(f => f.path === 'tests/index.spec.ts')).toBeDefined();
      expect(result.files.find(f => f.path === 'package.json')).toBeDefined();
      expect(result.files.find(f => f.path === 'tsconfig.json')).toBeDefined();
      expect(result.files.find(f => f.path === '.mocharc.json')).toBeDefined();
      expect(result.files.find(f => f.path === 'metadata/workbook.json')).toBeDefined();

      // Check metadata
      expect(result.metadata.sourceFile).toBe('test-workbook.apicize');
      expect(result.metadata.totalTests).toBe(1);
      expect(result.metadata.totalFiles).toBe(6);
    });

    it('should handle workbook without requests', () => {
      const workbook: ApicizeWorkbook = {
        version: 1.0,
        requests: [],
      };

      const result = testGenerator.generateTestProject(workbook);

      expect(result.files).toHaveLength(5); // index.spec.ts, package.json, tsconfig.json, .mocharc.json, metadata
      expect(result.metadata.totalTests).toBe(0);
    });

    it('should respect generateHelpers option', () => {
      const workbook: ApicizeWorkbook = {
        version: 1.0,
        requests: [],
      };

      const result = testGenerator.generateTestProject(workbook, 'test.apicize', {
        generateHelpers: false,
      });

      // Should only have index.spec.ts and metadata
      expect(result.files).toHaveLength(2);
      expect(result.files.find(f => f.path === 'tests/index.spec.ts')).toBeDefined();
      expect(result.files.find(f => f.path === 'metadata/workbook.json')).toBeDefined();
    });

    it('should respect includeMetadata option', () => {
      const workbook: ApicizeWorkbook = {
        version: 1.0,
        requests: [],
      };

      const result = testGenerator.generateTestProject(workbook, 'test.apicize', {
        includeMetadata: false,
      });

      // Should not include metadata file
      expect(result.files.find(f => f.path === 'metadata/workbook.json')).toBeUndefined();
    });
  });

  describe('generateRequestGroupTests', () => {
    it('should generate valid TypeScript for request group', () => {
      const group: RequestGroup = {
        id: 'group1',
        name: 'Authentication',
        execution: ExecutionMode.SEQUENTIAL,
        children: [
          {
            id: 'req1',
            name: 'Login',
            url: 'https://api.example.com/login',
            method: HttpMethod.POST,
            test: 'expect(response.status).to.equal(200);',
            headers: [{ name: 'Content-Type', value: 'application/json' }],
            body: {
              type: BodyType.JSON,
              data: { username: '{{username}}', password: '{{password}}' },
            },
          } as Request,
        ],
      };

      const workbook: ApicizeWorkbook = {
        version: 1.0,
        requests: [group],
      };

      const result = testGenerator.generateRequestGroupTests(group, workbook);

      expect(result).toContain("describe('Authentication'");
      expect(result).toContain("describe('Login'");
      expect(result).toContain('beforeEach(async function()');
      expect(result).toContain("method: 'POST'");
      expect(result).toContain('expect(response.status).to.equal(200);');
      expect(result).toContain('@apicize-group-metadata');
      expect(result).toContain('@apicize-request-metadata');
    });

    it('should handle nested request groups', () => {
      const group: RequestGroup = {
        id: 'group1',
        name: 'API Tests',
        children: [
          {
            id: 'subgroup1',
            name: 'User Management',
            children: [
              {
                id: 'req1',
                name: 'Get User',
                url: 'https://api.example.com/users/1',
                method: HttpMethod.GET,
              } as Request,
            ],
          } as RequestGroup,
        ],
      };

      const workbook: ApicizeWorkbook = {
        version: 1.0,
        requests: [group],
      };

      const result = testGenerator.generateRequestGroupTests(group, workbook);

      expect(result).toContain("describe('API Tests'");
      expect(result).toContain("describe('User Management'");
      // Note: Nested requests within subgroups are not fully implemented yet
    });
  });

  describe('generateIndividualRequestTest', () => {
    it('should generate valid TypeScript for individual request', () => {
      const request: Request = {
        id: 'req1',
        name: 'Get Profile',
        url: 'https://api.example.com/profile',
        method: HttpMethod.GET,
        test: `describe('response validation', () => {
    it('should return user profile', () => {
        expect(response.status).to.equal(200);
        const JSON_body = (response.body.type == BodyType.JSON)
            ? response.body.data
            : expect.fail('Response body is not JSON');
        expect(JSON_body.id).to.be.a('string');
    });
});`,
        timeout: 10000,
        headers: [{ name: 'Authorization', value: 'Bearer {{token}}' }],
        queryStringParams: [{ name: 'fields', value: 'id,name,email' }],
      };

      const workbook: ApicizeWorkbook = {
        version: 1.0,
        requests: [request],
      };

      const result = testGenerator.generateIndividualRequestTest(request, workbook);

      expect(result).toContain("describe('Get Profile'");
      expect(result).toContain('this.timeout(10000);');
      expect(result).toContain('beforeEach(async function()');
      expect(result).toContain("method: 'GET'");
      expect(result).toContain('Authorization');
      expect(result).toContain('Bearer {{token}}');
      expect(result).toContain('fields');
      expect(result).toContain('expect(response.status).to.equal(200);');
      expect(result).toContain('@apicize-request-metadata');
    });

    it('should handle request without test code', () => {
      const request: Request = {
        id: 'req1',
        name: 'Simple Request',
        url: 'https://api.example.com/test',
        method: HttpMethod.GET,
      };

      const workbook: ApicizeWorkbook = {
        version: 1.0,
        requests: [request],
      };

      const result = testGenerator.generateIndividualRequestTest(request, workbook);

      expect(result).toContain("describe('Simple Request'");
      expect(result).toContain("it('has successful response'");
      expect(result).toContain('expect(response.status).to.be.oneOf([200, 201, 204]);');
    });

    it('should handle request with different body types', () => {
      const request: Request = {
        id: 'req1',
        name: 'Post Data',
        url: 'https://api.example.com/data',
        method: HttpMethod.POST,
        body: {
          type: BodyType.Form,
          data: [
            { name: 'field1', value: 'value1' },
            { name: 'field2', value: 'value2' },
          ],
        },
      };

      const workbook: ApicizeWorkbook = {
        version: 1.0,
        requests: [request],
      };

      const result = testGenerator.generateIndividualRequestTest(request, workbook);

      expect(result).toContain('body: {');
      expect(result).toContain('"type":"Form"');
      expect(result).toContain('field1');
      expect(result).toContain('value1');
    });
  });

  describe('convertGroupToDescribeBlock', () => {
    it('should convert request group to nested describe blocks', () => {
      const group: RequestGroup = {
        id: 'group1',
        name: 'API Tests',
        execution: ExecutionMode.CONCURRENT,
        children: [
          {
            id: 'req1',
            name: 'Test Request',
            url: 'https://api.example.com/test',
            method: HttpMethod.GET,
            test: 'expect(response.status).to.equal(200);',
          } as Request,
        ],
      };

      const workbook: ApicizeWorkbook = {
        version: 1.0,
        requests: [group],
      };

      const result = testGenerator.convertGroupToDescribeBlock(group, workbook, 0);

      expect(result).toContain("describe('API Tests', function() {");
      expect(result).toContain('@apicize-group-metadata');
      expect(result).toContain('"execution": "CONCURRENT"');
      expect(result).toContain("describe('Test Request', function() {");
    });

    it('should handle proper indentation for nested groups', () => {
      const group: RequestGroup = {
        id: 'group1',
        name: 'Level 1',
        children: [
          {
            id: 'subgroup1',
            name: 'Level 2',
            children: [],
          } as RequestGroup,
        ],
      };

      const workbook: ApicizeWorkbook = {
        version: 1.0,
        requests: [group],
      };

      const result = testGenerator.convertGroupToDescribeBlock(group, workbook, 1);

      // Check that indentation increases with depth
      expect(result).toContain("    describe('Level 1'"); // depth 1
      expect(result).toContain("        describe('Level 2'"); // depth 2
    });
  });

  describe('convertRequestToTestCase', () => {
    it('should convert request to test case with beforeEach hook', () => {
      const request: Request = {
        id: 'req1',
        name: 'API Call',
        url: 'https://api.example.com/data',
        method: HttpMethod.POST,
        test: 'expect(response.status).to.equal(201);',
        timeout: 5000,
        headers: [{ name: 'Content-Type', value: 'application/json' }],
      };

      const workbook: ApicizeWorkbook = {
        version: 1.0,
        requests: [request],
      };

      const result = testGenerator.convertRequestToTestCase(request, workbook, 0);

      expect(result).toContain("describe('API Call', function() {");
      expect(result).toContain('this.timeout(5000);');
      expect(result).toContain('beforeEach(async function() {');
      expect(result).toContain('response = await context.execute({');
      expect(result).toContain("method: 'POST'");
      expect(result).toContain('Content-Type');
      expect(result).toContain('expect(response.status).to.equal(201);');
    });

    it('should handle requests with complex test code', () => {
      const request: Request = {
        id: 'req1',
        name: 'Complex Test',
        url: 'https://api.example.com/complex',
        method: HttpMethod.GET,
        test: `describe('validation suite', () => {
    it('should validate status', () => {
        expect(response.status).to.equal(200);
    });
    it('should validate content', () => {
        const data = response.body.data;
        expect(data).to.have.property('id');
    });
});`,
      };

      const workbook: ApicizeWorkbook = {
        version: 1.0,
        requests: [request],
      };

      const result = testGenerator.convertRequestToTestCase(request, workbook, 0);

      expect(result).toContain("describe('validation suite'");
      expect(result).toContain("it('should validate status'");
      expect(result).toContain("it('should validate content'");
    });
  });

  describe('utility methods', () => {
    it('should sanitize file names properly', () => {
      const workbook: ApicizeWorkbook = {
        version: 1.0,
        requests: [
          {
            id: 'group1',
            name: 'API Tests / Special Characters!',
            children: [],
          } as RequestGroup,
        ],
      };

      const result = testGenerator.generateTestProject(workbook);
      const groupFile = result.files.find(f => f.path.includes('suites/'));

      expect(groupFile?.path).toContain('API-Tests-Special-Characters-');
    });

    it('should count tests correctly', () => {
      const workbook: ApicizeWorkbook = {
        version: 1.0,
        requests: [
          {
            id: 'group1',
            name: 'Group 1',
            children: [
              {
                id: 'req1',
                name: 'Request 1',
                url: 'https://api.example.com/1',
                method: HttpMethod.GET,
              } as Request,
              {
                id: 'req2',
                name: 'Request 2',
                url: 'https://api.example.com/2',
                method: HttpMethod.GET,
              } as Request,
            ],
          } as RequestGroup,
          {
            id: 'req3',
            name: 'Request 3',
            url: 'https://api.example.com/3',
            method: HttpMethod.GET,
          } as Request,
        ],
      };

      const result = testGenerator.generateTestProject(workbook);

      expect(result.metadata.totalTests).toBe(3);
    });

    it('should handle string escaping in generated code', () => {
      const request: Request = {
        id: 'req1',
        name: 'Test with \'quotes\' and "more quotes"',
        url: 'https://api.example.com/test',
        method: HttpMethod.GET,
        test: "expect(response.body).to.contain('success');",
      };

      const workbook: ApicizeWorkbook = {
        version: 1.0,
        requests: [request],
      };

      const result = testGenerator.generateIndividualRequestTest(request, workbook);

      expect(result).toContain("Test with 'quotes'");
      expect(result).toContain("expect(response.body).to.contain('success');");
    });
  });

  describe('options handling', () => {
    it('should use default options when none provided', () => {
      const workbook: ApicizeWorkbook = {
        version: 1.0,
        requests: [],
      };

      const result = testGenerator.generateTestProject(workbook);

      // Should include all default files
      expect(result.files.find(f => f.path === 'package.json')).toBeDefined();
      expect(result.files.find(f => f.path === 'metadata/workbook.json')).toBeDefined();
    });

    it('should respect splitByGroup option', () => {
      const workbook: ApicizeWorkbook = {
        version: 1.0,
        requests: [
          {
            id: 'group1',
            name: 'Test Group',
            children: [
              {
                id: 'req1',
                name: 'Test Request',
                url: 'https://api.example.com/test',
                method: HttpMethod.GET,
              } as Request,
            ],
          } as RequestGroup,
        ],
      };

      const withSplit = testGenerator.generateTestProject(workbook, 'test.apicize', {
        splitByGroup: true,
      });

      const withoutSplit = testGenerator.generateTestProject(workbook, 'test.apicize', {
        splitByGroup: false,
      });

      // With split should have separate group files
      expect(withSplit.files.filter(f => f.path.includes('suites/')).length).toBeGreaterThan(0);

      // Without split should only have main index file
      expect(withoutSplit.files.filter(f => f.path.includes('suites/')).length).toBe(0);
    });
  });
});
