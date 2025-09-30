import * as fs from 'fs';
import * as path from 'path';
import { ApicizeValidator } from './validator';

describe('Demo File Validation', () => {
  let validator: ApicizeValidator;
  let demoFilePath: string;

  beforeAll(() => {
    validator = new ApicizeValidator();
    demoFilePath = path.join(__dirname, '../../../examples/workbooks/demo.apicize');
  });

  describe('demo.apicize validation', () => {
    it('should successfully validate the demo.apicize file', () => {
      // Check if file exists
      const fileExists = fs.existsSync(demoFilePath);
      if (!fileExists) {
        console.warn(`Demo file not found at: ${demoFilePath}`);
        // Skip test if demo file doesn't exist
        return;
      }

      // Read and parse the demo file
      const fileContent = fs.readFileSync(demoFilePath, 'utf-8');
      let data: unknown;

      try {
        data = JSON.parse(fileContent);
      } catch (error) {
        throw new Error(`Failed to parse demo.apicize as JSON: ${error}`);
      }

      // Validate the parsed data
      const result = validator.validateApicizeFile(data);

      // Log any validation errors for debugging
      if (!result.valid) {
        console.error('Validation errors:', result.errors);
      }

      // Assert that the demo file is valid
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should have expected structure', () => {
      const fileExists = fs.existsSync(demoFilePath);
      if (!fileExists) {
        return;
      }

      const fileContent = fs.readFileSync(demoFilePath, 'utf-8');
      const data = JSON.parse(fileContent);

      // Check basic structure
      expect(data).toHaveProperty('version', 1.0);
      expect(data).toHaveProperty('requests');
      expect(Array.isArray(data.requests)).toBe(true);

      if (data.scenarios) {
        expect(Array.isArray(data.scenarios)).toBe(true);
      }

      // Validate with type assertion
      validator.assertValidApicizeFile(data);

      // Now TypeScript knows data is ApicizeWorkbook
      expect(data.version).toBe(1.0);
    });

    it('should validate individual sections', () => {
      const fileExists = fs.existsSync(demoFilePath);
      if (!fileExists) {
        return;
      }

      const fileContent = fs.readFileSync(demoFilePath, 'utf-8');
      const data = JSON.parse(fileContent);

      // Validate requests section if it exists
      if (data.requests) {
        const requestsResult = validator.validateSection('requests', data.requests);
        expect(requestsResult.valid).toBe(true);
      }

      // Validate scenarios section if it exists
      if (data.scenarios) {
        const scenariosResult = validator.validateSection('scenarios', data.scenarios);
        expect(scenariosResult.valid).toBe(true);
      }

      // Validate authorizations section if it exists
      if (data.authorizations) {
        const authResult = validator.validateSection('authorizations', data.authorizations);
        expect(authResult.valid).toBe(true);
      }

      // Validate defaults section if it exists
      if (data.defaults) {
        const defaultsResult = validator.validateSection('defaults', data.defaults);
        expect(defaultsResult.valid).toBe(true);
      }
    });
  });

  describe('Schema completeness', () => {
    it('should handle all request properties from demo file', () => {
      const fileExists = fs.existsSync(demoFilePath);
      if (!fileExists) {
        return;
      }

      const fileContent = fs.readFileSync(demoFilePath, 'utf-8');
      const data = JSON.parse(fileContent);

      // Extract all unique properties from requests
      const collectProperties = (obj: any, path: string = ''): Set<string> => {
        const props = new Set<string>();

        if (Array.isArray(obj)) {
          obj.forEach(item => {
            const itemProps = collectProperties(item, path);
            itemProps.forEach(p => props.add(p));
          });
        } else if (obj && typeof obj === 'object') {
          Object.keys(obj).forEach(key => {
            const fullPath = path ? `${path}.${key}` : key;
            props.add(fullPath);

            if (key !== 'children' && key !== 'requests') {
              const childProps = collectProperties(obj[key], fullPath);
              childProps.forEach(p => props.add(p));
            }
          });
        }

        return props;
      };

      if (data.requests && data.requests.length > 0) {
        const requestProps = collectProperties(data.requests[0]);

        // Validate a request with all discovered properties
        const result = validator.validateApicizeFile(data);

        if (!result.valid) {
          console.log('Properties found in demo:', Array.from(requestProps).sort());
          console.log('Validation errors:', result.errors);
        }

        expect(result.valid).toBe(true);
      }
    });
  });
});
