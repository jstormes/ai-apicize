import { describe, it, expect, beforeEach } from '@jest/globals';
import { TemplateEngine, TemplateContext } from './template-engine';
import {
  ApicizeWorkbook,
  Request,
  RequestGroup,
  BodyType,
  HttpMethod,
  ExecutionMode,
  VariableType,
} from '../types';

describe('TemplateEngine', () => {
  let templateEngine: TemplateEngine;

  beforeEach(() => {
    templateEngine = new TemplateEngine();
  });

  describe('render', () => {
    it('should substitute simple variables', () => {
      const template = 'Hello {{name}}!';
      const context: TemplateContext = { name: 'World' };
      const result = templateEngine.render(template, context);
      expect(result).toBe('Hello World!\n');
    });

    it('should substitute nested properties', () => {
      const template = 'User: {{user.name}} ({{user.email}})';
      const context: TemplateContext = {
        user: { name: 'John Doe', email: 'john@example.com' },
      };
      const result = templateEngine.render(template, context);
      expect(result).toBe('User: John Doe (john@example.com)\n');
    });

    it('should handle missing variables by leaving them unchanged', () => {
      const template = 'Hello {{missing}}!';
      const context: TemplateContext = {};
      const result = templateEngine.render(template, context);
      expect(result).toBe('Hello {{missing}}!\n');
    });

    it('should handle conditionals', () => {
      const template = '{{#if showMessage}}Hello {{name}}!{{/if}}';

      const contextWithMessage: TemplateContext = { showMessage: true, name: 'World' };
      const resultWithMessage = templateEngine.render(template, contextWithMessage);
      expect(resultWithMessage).toBe('Hello World!\n');

      const contextWithoutMessage: TemplateContext = { showMessage: false, name: 'World' };
      const resultWithoutMessage = templateEngine.render(template, contextWithoutMessage);
      expect(resultWithoutMessage).toBe('\n');
    });

    it('should handle loops with each', () => {
      const template = '{{#each items}}Item: {{this.name}}\n{{/each}}';
      const context: TemplateContext = {
        items: [{ name: 'Item 1' }, { name: 'Item 2' }, { name: 'Item 3' }],
      };
      const result = templateEngine.render(template, context);
      expect(result).toBe('Item: Item 1\nItem: Item 2\nItem: Item 3\n');
    });

    it('should handle loops with index', () => {
      const template = '{{#each items}}{{@index}}: {{this}}\n{{/each}}';
      const context: TemplateContext = {
        items: ['Apple', 'Banana', 'Cherry'],
      };
      const result = templateEngine.render(template, context);
      expect(result).toBe('0: Apple\n1: Banana\n2: Cherry\n');
    });

    it('should handle empty arrays in loops', () => {
      const template = '{{#each items}}Item: {{this}}\n{{/each}}';
      const context: TemplateContext = { items: [] };
      const result = templateEngine.render(template, context);
      expect(result).toBe('\n');
    });
  });

  describe('generateMainIndex', () => {
    it('should generate a valid main index file', () => {
      const workbook: ApicizeWorkbook = {
        version: 1.0,
        requests: [
          {
            id: 'group1',
            name: 'Authentication',
            children: [
              {
                id: 'req1',
                name: 'Login',
                url: 'https://api.example.com/login',
                method: HttpMethod.POST,
                test: 'expect(response.status).to.equal(200);',
              } as Request,
            ],
          } as RequestGroup,
        ],
        scenarios: [
          {
            id: 'sc1',
            name: 'Development',
            variables: [
              { name: 'baseUrl', value: 'https://dev.api.example.com', type: VariableType.TEXT },
            ],
          },
        ],
        defaults: {
          selectedScenario: { id: 'sc1', name: 'Development' },
        },
      };

      const result = templateEngine.generateMainIndex(workbook);

      expect(result).toContain('// Auto-generated from api-tests.apicize');
      expect(result).toContain('TestHelper,');
      expect(result).toContain('ApicizeContext,');
      expect(result).toContain('ApicizeResponse,');
      expect(result).toContain('BodyType');
      expect(result).toContain("} from '@apicize/lib';");
      expect(result).toContain("describe('API Tests', function() {");
      expect(result).toContain('this.timeout(30000);');
      expect(result).toContain("describe('Authentication', function() {");
      expect(result).toContain("import './suites/0-Authentication.spec';");
    });

    it('should handle workbook without optional fields', () => {
      const workbook: ApicizeWorkbook = {
        version: 1.0,
        requests: [],
      };

      const result = templateEngine.generateMainIndex(workbook);

      expect(result).toContain('// Auto-generated from api-tests.apicize');
      expect(result).toContain("describe('API Tests', function() {");
      expect(result).not.toContain("import './suites/");
    });
  });

  describe('generateRequestGroup', () => {
    it('should generate a valid request group file', () => {
      const group: RequestGroup = {
        id: 'group1',
        name: 'User Management',
        execution: ExecutionMode.SEQUENTIAL,
        children: [
          {
            id: 'req1',
            name: 'Get Users',
            url: 'https://api.example.com/users',
            method: HttpMethod.GET,
            test: 'expect(response.status).to.equal(200);',
            timeout: 5000,
            headers: [{ name: 'Authorization', value: 'Bearer {{token}}' }],
            queryStringParams: [{ name: 'limit', value: '10' }],
          } as Request,
          {
            id: 'req2',
            name: 'Create User',
            url: 'https://api.example.com/users',
            method: HttpMethod.POST,
            test: 'expect(response.status).to.equal(201);',
            body: {
              type: BodyType.JSON,
              data: { name: '{{userName}}', email: '{{userEmail}}' },
            },
          } as Request,
        ],
      };

      const workbook: ApicizeWorkbook = {
        version: 1.0,
        requests: [group],
      };

      const result = templateEngine.generateRequestGroup(group, workbook);

      expect(result).toContain('// Auto-generated request group: User Management');
      expect(result).toContain("describe('User Management', function() {");
      expect(result).toContain("describe('Get Users', function() {");
      expect(result).toContain("describe('Create User', function() {");
      expect(result).toContain('this.timeout(5000);');
      expect(result).toContain("method: 'GET'");
      expect(result).toContain("method: 'POST'");
      expect(result).toContain('expect(response.status).to.equal(200);');
      expect(result).toContain('expect(response.status).to.equal(201);');
    });

    it('should handle groups with sub-groups', () => {
      const group: RequestGroup = {
        id: 'group1',
        name: 'API Tests',
        children: [
          {
            id: 'subgroup1',
            name: 'Authentication',
            children: [],
          } as RequestGroup,
        ],
      };

      const workbook: ApicizeWorkbook = {
        version: 1.0,
        requests: [group],
      };

      const result = templateEngine.generateRequestGroup(group, workbook);

      expect(result).toContain("describe('Authentication', function() {");
      // Should contain recursive nested group implementation, not placeholder comment
      expect(result).not.toContain('// Nested group - would be implemented recursively');
    });
  });

  describe('generateIndividualRequest', () => {
    it('should generate a valid individual request test', () => {
      const request: Request = {
        id: 'req1',
        name: 'Get User Profile',
        url: 'https://api.example.com/profile',
        method: HttpMethod.GET,
        test: `describe('response validation', () => {
    it('should return user data', () => {
        expect(response.status).to.equal(200);
        const data = (response.body.type == BodyType.JSON)
            ? response.body.data
            : expect.fail('Response body is not JSON');
        expect(data.id).to.be.a('string');
        expect(data.email).to.be.a('string');
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

      const result = templateEngine.generateIndividualRequest(request, workbook);

      expect(result).toContain('// Auto-generated individual request: Get User Profile');
      expect(result).toContain("describe('Get User Profile', function() {");
      expect(result).toContain('this.timeout(10000);');
      expect(result).toContain("method: 'GET'");
      expect(result).toContain("url: 'https://api.example.com/profile'");
      expect(result).toContain('expect(response.status).to.equal(200);');
      expect(result).toContain("expect(data.id).to.be.a('string');");
    });

    it('should handle requests without test code', () => {
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

      const result = templateEngine.generateIndividualRequest(request, workbook);

      expect(result).toContain("describe('should pass', () => {");
      expect(result).toContain('expect(response.status).to.be.oneOf([200, 201, 204]);');
    });
  });

  describe('generatePackageJson', () => {
    it('should generate a valid package.json', () => {
      const workbook: ApicizeWorkbook = {
        version: 1.0,
        requests: [],
      };

      const result = templateEngine.generatePackageJson(workbook);
      const packageJson = JSON.parse(result);

      expect(packageJson.name).toBe('apicize-tests');
      expect(packageJson.version).toBe('1.0.0');
      expect(packageJson.private).toBe(true);
      expect(packageJson.description).toContain('Apicize');
      expect(packageJson.scripts.test).toBe('mocha');
      expect(packageJson.dependencies['@apicize/lib']).toBe('^1.0.0');
      expect(packageJson.devDependencies['mocha']).toBeDefined();
      expect(packageJson.devDependencies['chai']).toBeDefined();
      expect(packageJson.devDependencies['typescript']).toBeDefined();
    });

    it('should handle workbook without name', () => {
      const workbook: ApicizeWorkbook = {
        version: 1.0,
        requests: [],
      };

      const result = templateEngine.generatePackageJson(workbook);
      const packageJson = JSON.parse(result);

      expect(packageJson.name).toBe('apicize-tests');
      expect(packageJson.description).toContain('Apicize');
    });
  });

  describe('generateTsConfig', () => {
    it('should generate a valid tsconfig.json', () => {
      const result = templateEngine.generateTsConfig();
      const tsConfig = JSON.parse(result);

      expect(tsConfig.compilerOptions.target).toBe('ES2020');
      expect(tsConfig.compilerOptions.module).toBe('commonjs');
      expect(tsConfig.compilerOptions.strict).toBe(true);
      expect(tsConfig.compilerOptions.outDir).toBe('./dist');
      expect(tsConfig.include).toContain('tests/**/*');
      expect(tsConfig.exclude).toContain('node_modules');
    });
  });

  describe('generateMochaConfig', () => {
    it('should generate a valid mocha configuration', () => {
      const result = templateEngine.generateMochaConfig();
      const mochaConfig = JSON.parse(result);

      expect(mochaConfig.require).toContain('ts-node/register');
      expect(mochaConfig.extensions).toContain('ts');
      expect(mochaConfig.spec).toBe('tests/**/*.spec.ts');
      expect(mochaConfig.timeout).toBe(30000);
      expect(mochaConfig.reporter).toBe('spec');
    });
  });

  describe('template options', () => {
    it('should respect includeMetadata option', () => {
      const workbook: ApicizeWorkbook = {
        version: 1.0,
        requests: [],
      };

      const withMetadata = templateEngine.generateMainIndex(workbook, { includeMetadata: true });
      const withoutMetadata = templateEngine.generateMainIndex(workbook, {
        includeMetadata: false,
      });

      expect(withMetadata).toContain('@apicize-file-metadata');
      expect(withoutMetadata).not.toContain('@apicize-file-metadata');
    });

    it('should respect custom indent option', () => {
      const template = 'function test() {\n    return true;\n}';
      const context: TemplateContext = {};

      const twoSpaces = templateEngine.render(template, context, { indent: '  ' });
      const fourSpaces = templateEngine.render(template, context, { indent: '    ' });

      expect(twoSpaces).toContain('  return true;');
      expect(fourSpaces).toContain('    return true;');
    });
  });

  describe('utility methods', () => {
    it('should sanitize file names properly', () => {
      const workbook: ApicizeWorkbook = {
        version: 1.0,
        requests: [],
      };

      const result = templateEngine.generateMainIndex(workbook);
      expect(result).toContain('api-tests.apicize');
    });

    it('should sanitize package names properly', () => {
      const workbook: ApicizeWorkbook = {
        version: 1.0,
        requests: [],
      };

      const result = templateEngine.generatePackageJson(workbook);
      const packageJson = JSON.parse(result);
      expect(packageJson.name).toBe('apicize-tests');
    });
  });
});
