import { VariableEngine, VariableContext } from './variable-engine';
import { Scenario, VariableType } from '../types';

describe('VariableEngine', () => {
  let engine: VariableEngine;

  beforeEach(() => {
    engine = new VariableEngine();
  });

  describe('Basic String Substitution', () => {
    it('should substitute simple variables', () => {
      engine.setOutputs({ name: 'World' });
      const result = engine.substituteString('Hello {{name}}');
      expect(result).toBe('Hello World');
    });

    it('should substitute multiple variables in one string', () => {
      engine.setOutputs({
        greeting: 'Hello',
        name: 'World',
        punctuation: '!'
      });
      const result = engine.substituteString('{{greeting}} {{name}}{{punctuation}}');
      expect(result).toBe('Hello World!');
    });

    it('should handle URL substitution', () => {
      engine.setOutputs({ endpoint: 'users' });
      const result = engine.substituteString('https://api.com/{{endpoint}}');
      expect(result).toBe('https://api.com/users');
    });

    it('should handle variables with whitespace', () => {
      engine.setOutputs({ value: 'test' });
      const result = engine.substituteString('{{ value }}');
      expect(result).toBe('test');
    });

    it('should return original string for missing variables', () => {
      const result = engine.substituteString('Hello {{missing}}');
      expect(result).toBe('Hello {{missing}}');
      expect(engine.getWarnings()).toContain('Variable not found: missing');
    });

    it('should handle empty variable names', () => {
      const result = engine.substituteString('Hello {{}}');
      expect(result).toBe('Hello {{}}');
    });

    it('should handle malformed variable syntax', () => {
      const result = engine.substituteString('Hello {name}');
      expect(result).toBe('Hello {name}');
    });
  });

  describe('Nested Object and Array Support', () => {
    it('should substitute variables in objects', () => {
      engine.setOutputs({ host: 'localhost', port: '3000' });

      const input = {
        baseUrl: 'http://{{host}}:{{port}}',
        paths: {
          api: '/api/{{host}}',
          health: '/health'
        }
      };

      const result = engine.substitute(input);
      expect(result).toEqual({
        baseUrl: 'http://localhost:3000',
        paths: {
          api: '/api/localhost',
          health: '/health'
        }
      });
    });

    it('should substitute variables in arrays', () => {
      engine.setOutputs({ env: 'dev', service: 'api' });

      const input = ['{{env}}-{{service}}', 'static-value', '{{env}}'];
      const result = engine.substitute(input);

      expect(result).toEqual(['dev-api', 'static-value', 'dev']);
    });

    it('should handle deeply nested structures', () => {
      engine.setOutputs({ value: 'test' });

      const input = {
        level1: {
          level2: {
            level3: ['{{value}}', { deep: '{{value}}' }]
          }
        }
      };

      const result = engine.substitute(input);
      expect(result).toEqual({
        level1: {
          level2: {
            level3: ['test', { deep: 'test' }]
          }
        }
      });
    });

    it('should handle mixed data types', () => {
      engine.setOutputs({
        str: 'text',
        num: 42,
        bool: true,
        obj: { key: 'value' }
      });

      const input = {
        string: '{{str}}',
        number: '{{num}}',
        boolean: '{{bool}}',
        object: '{{obj}}'
      };

      const result = engine.substitute(input);
      expect(result).toEqual({
        string: 'text',
        number: '42',
        boolean: 'true',
        object: '{"key":"value"}'
      });
    });
  });

  describe('Scenario Variables', () => {
    it('should resolve text scenario variables', () => {
      const scenario: Scenario = {
        id: 'test-scenario',
        name: 'Test Scenario',
        variables: [
          { name: 'apiKey', value: 'abc123', type: VariableType.TEXT },
          { name: 'baseUrl', value: 'https://api.test.com', type: VariableType.TEXT }
        ]
      };

      engine.setScenario(scenario);
      const result = engine.substituteString('{{baseUrl}}/auth?key={{apiKey}}');
      expect(result).toBe('https://api.test.com/auth?key=abc123');
    });

    it('should resolve JSON scenario variables', () => {
      const scenario: Scenario = {
        id: 'test-scenario',
        name: 'Test Scenario',
        variables: [
          { name: 'config', value: '{"timeout": 5000, "retry": true}', type: VariableType.JSON }
        ]
      };

      engine.setScenario(scenario);
      const result = engine.substituteString('Config: {{config}}');
      expect(result).toBe('Config: {"timeout":5000,"retry":true}');
    });

    it('should handle invalid JSON in scenario variables', () => {
      const scenario: Scenario = {
        id: 'test-scenario',
        name: 'Test Scenario',
        variables: [
          { name: 'invalid', value: '{invalid json}', type: VariableType.JSON }
        ]
      };

      engine.setScenario(scenario);
      const result = engine.substituteString('Value: {{invalid}}');
      expect(result).toBe('Value: {invalid json}');
      expect(engine.getWarnings()).toContain('Invalid JSON in variable invalid: {invalid json}');
    });

    it('should skip disabled variables', () => {
      const scenario: Scenario = {
        id: 'test-scenario',
        name: 'Test Scenario',
        variables: [
          { name: 'enabled', value: 'active', type: VariableType.TEXT },
          { name: 'disabled', value: 'inactive', type: VariableType.TEXT, disabled: true }
        ]
      };

      engine.setScenario(scenario);
      const result = engine.substituteString('{{enabled}} {{disabled}}');
      expect(result).toBe('active {{disabled}}');
    });

    it('should handle file variables', () => {
      const scenario: Scenario = {
        id: 'test-scenario',
        name: 'Test Scenario',
        variables: [
          { name: 'csvFile', value: './data.csv', type: VariableType.FILE_CSV },
          { name: 'jsonFile', value: './config.json', type: VariableType.FILE_JSON }
        ]
      };

      engine.setScenario(scenario);
      const result1 = engine.substituteString('CSV: {{csvFile}}');
      const result2 = engine.substituteString('JSON: {{jsonFile}}');

      expect(result1).toBe('CSV: ./data.csv');
      expect(result2).toBe('JSON: ./config.json');
      expect(engine.getWarnings()).toContain('File variable csvFile requires external data loading');
      expect(engine.getWarnings()).toContain('File variable jsonFile requires external data loading');
    });
  });

  describe('Output Variables', () => {
    it('should handle output variables from previous tests', () => {
      engine.addOutput('userId', '12345');
      engine.addOutput('token', 'jwt-token-here');

      const result = engine.substituteString('User {{userId}} with token {{token}}');
      expect(result).toBe('User 12345 with token jwt-token-here');
    });

    it('should prioritize outputs over scenario variables', () => {
      const scenario: Scenario = {
        id: 'test-scenario',
        name: 'Test Scenario',
        variables: [
          { name: 'value', value: 'scenario', type: VariableType.TEXT }
        ]
      };

      engine.setScenario(scenario);
      engine.addOutput('value', 'output');

      const result = engine.substituteString('{{value}}');
      expect(result).toBe('output');
    });
  });

  describe('CSV Data Support', () => {
    it('should resolve variables from CSV data', () => {
      const csvData = [
        { username: 'user1', password: 'pass1', expected: '200' },
        { username: 'user2', password: 'pass2', expected: '401' },
        { username: 'admin', password: 'admin123', expected: '200' }
      ];

      engine.setCsvData(csvData, 0);
      let result = engine.substituteString('{{username}}:{{password}} expects {{expected}}');
      expect(result).toBe('user1:pass1 expects 200');

      engine.setCsvData(csvData, 1);
      result = engine.substituteString('{{username}}:{{password}} expects {{expected}}');
      expect(result).toBe('user2:pass2 expects 401');
    });

    it('should handle CSV row creation helper', () => {
      const csvData = [
        { name: 'Alice', age: '25' },
        { name: 'Bob', age: '30' }
      ];

      engine.setCsvData(csvData, 0);
      const rowEngine = engine.withCsvRow(1);

      const result1 = engine.substituteString('{{name}} is {{age}}');
      const result2 = rowEngine.substituteString('{{name}} is {{age}}');

      expect(result1).toBe('Alice is 25');
      expect(result2).toBe('Bob is 30');
    });
  });

  describe('JSON Data Support', () => {
    it('should resolve variables from JSON data', () => {
      const jsonData = {
        apiUrl: 'https://api.example.com',
        version: 'v1',
        features: { debug: true }
      };

      engine.setJsonData(jsonData);
      const result = engine.substituteString('{{apiUrl}}/{{version}} debug:{{features}}');
      expect(result).toBe('https://api.example.com/v1 debug:{"debug":true}');
    });
  });

  describe('Environment Variables', () => {
    beforeEach(() => {
      process.env.TEST_VAR = 'test-value';
      process.env.API_URL = 'https://test-api.com';
    });

    afterEach(() => {
      delete process.env.TEST_VAR;
      delete process.env.API_URL;
    });

    it('should resolve environment variables', () => {
      engine = new VariableEngine(); // Recreate to pick up env vars
      const result = engine.substituteString('{{TEST_VAR}} at {{API_URL}}');
      expect(result).toBe('test-value at https://test-api.com');
    });

    it('should have lowest priority for environment variables', () => {
      engine = new VariableEngine();
      engine.addOutput('TEST_VAR', 'output-value');

      const result = engine.substituteString('{{TEST_VAR}}');
      expect(result).toBe('output-value'); // Output should override env
    });
  });

  describe('Variable Priority and Resolution', () => {
    beforeEach(() => {
      process.env.SHARED_VAR = 'env-value';

      const scenario: Scenario = {
        id: 'test',
        name: 'Test',
        variables: [{ name: 'SHARED_VAR', value: 'scenario-value', type: VariableType.TEXT }]
      };

      const csvData = [{ SHARED_VAR: 'csv-value' }];
      const jsonData = { SHARED_VAR: 'json-value' };

      engine = new VariableEngine();
      engine.setScenario(scenario);
      engine.setCsvData(csvData, 0);
      engine.setJsonData(jsonData);
      engine.addOutput('SHARED_VAR', 'output-value');
    });

    afterEach(() => {
      delete process.env.SHARED_VAR;
    });

    it('should prioritize outputs over all other sources', () => {
      const result = engine.substituteString('{{SHARED_VAR}}');
      expect(result).toBe('output-value');
    });

    it('should use scenario variables when no output exists', () => {
      engine.setOutputs({}); // Clear outputs
      const result = engine.substituteString('{{SHARED_VAR}}');
      expect(result).toBe('scenario-value');
    });
  });

  describe('Utility Methods', () => {
    it('should detect if string has variables', () => {
      expect(engine.hasVariables('Hello {{world}}')).toBe(true);
      expect(engine.hasVariables('Hello world')).toBe(false);
      expect(engine.hasVariables('{{start}} and {{end}}')).toBe(true);
      expect(engine.hasVariables('')).toBe(false);
    });

    it('should extract variable names from string', () => {
      const names = engine.extractVariableNames('{{name}} lives in {{city}} and works at {{company}}');
      expect(names).toEqual(['name', 'city', 'company']);

      const empty = engine.extractVariableNames('No variables here');
      expect(empty).toEqual([]);

      const withSpaces = engine.extractVariableNames('{{ spaced }} and {{normal}}');
      expect(withSpaces).toEqual(['spaced', 'normal']);
    });

    it('should get available variables', () => {
      engine.addOutput('outputVar', 'output-value');

      const scenario: Scenario = {
        id: 'test',
        name: 'Test',
        variables: [{ name: 'scenarioVar', value: 'scenario-value', type: VariableType.TEXT }]
      };
      engine.setScenario(scenario);

      const variables = engine.getAvailableVariables();
      expect(variables.outputVar.value).toBe('output-value');
      expect(variables.outputVar.source).toBe('output');
      expect(variables.scenarioVar.value).toBe('scenario-value');
      expect(variables.scenarioVar.source).toBe('scenario');
    });

    it('should handle cloning', () => {
      engine.addOutput('test', 'value');
      const clone = engine.clone();

      clone.addOutput('clone', 'clone-value');

      expect(engine.getContext().outputs?.clone).toBeUndefined();
      expect(clone.getContext().outputs?.test).toBe('value');
      expect(clone.getContext().outputs?.clone).toBe('clone-value');
    });

    it('should preview substitution without side effects', () => {
      engine.addOutput('name', 'World');

      const preview = engine.previewSubstitution('Hello {{name}} and {{missing}}');

      expect(preview.result).toBe('Hello World and {{missing}}');
      expect(preview.variables.name.value).toBe('World');
      expect(preview.variables.missing.source).toBe('not_found');
      expect(preview.warnings).toContain('Variable not found: missing');

      // Original engine should not have warnings
      expect(engine.getWarnings()).toHaveLength(0);
    });
  });

  describe('Warning Management', () => {
    it('should collect warnings for missing variables', () => {
      engine.substituteString('{{missing1}} and {{missing2}}');

      const warnings = engine.getWarnings();
      expect(warnings).toContain('Variable not found: missing1');
      expect(warnings).toContain('Variable not found: missing2');
    });

    it('should not duplicate warnings', () => {
      engine.substituteString('{{missing}} {{missing}} {{missing}}');

      const warnings = engine.getWarnings();
      expect(warnings.filter(w => w.includes('missing'))).toHaveLength(1);
    });

    it('should clear warnings', () => {
      engine.substituteString('{{missing}}');
      expect(engine.getWarnings()).toHaveLength(1);

      engine.clearWarnings();
      expect(engine.getWarnings()).toHaveLength(0);
    });

    it('should clear warnings when context changes', () => {
      engine.substituteString('{{missing}}');
      expect(engine.getWarnings()).toHaveLength(1);

      engine.updateContext({ outputs: { test: 'value' } });
      expect(engine.getWarnings()).toHaveLength(0);
    });
  });

  describe('Context Management', () => {
    it('should update context', () => {
      const initialContext: VariableContext = {
        outputs: { initial: 'value' }
      };

      engine.updateContext(initialContext);
      expect(engine.getContext().outputs).toEqual({ initial: 'value' });

      engine.updateContext({ outputs: { updated: 'new-value' } });
      expect(engine.getContext().outputs).toEqual({ updated: 'new-value' });
    });

    it('should get current context', () => {
      engine.addOutput('test', 'value');
      const context = engine.getContext();

      expect(context.outputs).toEqual({ test: 'value' });
      expect(context.environmentVars).toBeDefined();
    });
  });

  describe('Value Conversion', () => {
    it('should convert null and undefined to empty string', () => {
      engine.setOutputs({ nullValue: null, undefinedValue: undefined });

      const result1 = engine.substituteString('{{nullValue}}');
      const result2 = engine.substituteString('{{undefinedValue}}');

      expect(result1).toBe('');
      expect(result2).toBe('');
    });

    it('should convert numbers and booleans to strings', () => {
      engine.setOutputs({
        number: 42,
        boolean: true,
        zero: 0,
        false: false
      });

      expect(engine.substituteString('{{number}}')).toBe('42');
      expect(engine.substituteString('{{boolean}}')).toBe('true');
      expect(engine.substituteString('{{zero}}')).toBe('0');
      expect(engine.substituteString('{{false}}')).toBe('false');
    });

    it('should convert objects to JSON strings', () => {
      engine.setOutputs({
        object: { key: 'value', nested: { deep: true } },
        array: [1, 2, 3]
      });

      expect(engine.substituteString('{{object}}')).toBe('{"key":"value","nested":{"deep":true}}');
      expect(engine.substituteString('{{array}}')).toBe('[1,2,3]');
    });
  });
});