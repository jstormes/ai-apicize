import { ApicizeParser } from './apicize-parser';
import * as path from 'path';

describe('ApicizeParser - Demo.apicize Integration', () => {
  let parser: ApicizeParser;

  beforeEach(() => {
    parser = new ApicizeParser();
  });

  describe('demo.apicize parsing', () => {
    const demoFilePath = path.join(__dirname, '../../../examples/workbooks/demo.apicize');

    it('should successfully parse demo.apicize file', async () => {
      const result = await parser.parseFile(demoFilePath);

      expect(result.success).toBe(true);
      expect(result.workbook).toBeDefined();

      if (result.workbook) {
        expect(result.workbook.version).toBe(1.0);
        expect(result.workbook.requests).toBeDefined();
        expect(Array.isArray(result.workbook.requests)).toBe(true);
      }
    });

    it('should extract correct number of requests and groups from demo.apicize', async () => {
      const result = await parser.parseFile(demoFilePath);

      expect(result.success).toBe(true);

      if (result.workbook) {
        const stats = parser.getWorkbookStats(result.workbook);

        // Log stats for verification
        console.log('Demo.apicize statistics:', stats);

        expect(stats.totalRequests).toBeGreaterThan(0);
        expect(stats.totalGroups).toBeGreaterThan(0);
        expect(stats.version).toBe(1.0);
      }
    });

    it('should find all scenarios in demo.apicize', async () => {
      const result = await parser.parseFile(demoFilePath);

      expect(result.success).toBe(true);

      if (result.workbook) {
        const scenarios = parser.getScenarios(result.workbook);

        console.log(
          'Demo.apicize scenarios:',
          scenarios.map(s => ({ id: s.id, name: s.name }))
        );

        expect(scenarios.length).toBeGreaterThanOrEqual(0);

        // Each scenario should have valid structure
        scenarios.forEach(scenario => {
          expect(scenario.id).toBeDefined();
          expect(scenario.name).toBeDefined();
          expect(Array.isArray(scenario.variables)).toBe(true);
        });
      }
    });

    it('should find all authorizations in demo.apicize', async () => {
      const result = await parser.parseFile(demoFilePath);

      expect(result.success).toBe(true);

      if (result.workbook) {
        const authorizations = parser.getAuthorizations(result.workbook);

        console.log(
          'Demo.apicize authorizations:',
          authorizations.map(a => ({ id: a.id, name: a.name, type: a.type }))
        );

        // Each authorization should have valid structure
        authorizations.forEach(auth => {
          expect(auth.id).toBeDefined();
          expect(auth.name).toBeDefined();
          expect(auth.type).toBeDefined();
        });
      }
    });

    it('should extract requests with tests from demo.apicize', async () => {
      const result = await parser.parseFile(demoFilePath);

      expect(result.success).toBe(true);

      if (result.workbook) {
        const requests = parser.getRequests(result.workbook);
        const requestsWithTests = requests.filter(r => r.test && r.test.trim().length > 0);

        console.log(
          `Demo.apicize: ${requestsWithTests.length} out of ${requests.length} requests have tests`
        );

        expect(requestsWithTests.length).toBeGreaterThan(0);

        // Verify test structure
        requestsWithTests.forEach(request => {
          expect(request.test).toBeDefined();
          expect(typeof request.test).toBe('string');
          expect(request.test!.trim().length).toBeGreaterThan(0);

          // Should contain Mocha/Chai syntax
          expect(request.test).toMatch(/describe\s*\(/);
          expect(request.test).toMatch(/it\s*\(/);
          expect(request.test).toMatch(/expect\s*\(/);
        });
      }
    });

    it('should handle various body types in demo.apicize requests', async () => {
      const result = await parser.parseFile(demoFilePath);

      expect(result.success).toBe(true);

      if (result.workbook) {
        const requests = parser.getRequests(result.workbook);
        const requestsWithBodies = requests.filter(r => r.body && r.body.type !== 'None');

        console.log('Demo.apicize body types found:', [
          ...new Set(requestsWithBodies.map(r => r.body!.type)),
        ]);

        requestsWithBodies.forEach(request => {
          expect(request.body).toBeDefined();
          expect(request.body!.type).toBeDefined();

          // Verify body data structure based on type
          switch (request.body!.type) {
            case 'JSON':
              expect(request.body!.data).toBeDefined();
              expect(typeof request.body!.data).toBe('object');
              break;
            case 'Text':
            case 'XML':
              expect(request.body!.data).toBeDefined();
              expect(typeof request.body!.data).toBe('string');
              break;
            case 'Form':
              expect(request.body!.data).toBeDefined();
              expect(Array.isArray(request.body!.data)).toBe(true);
              break;
            case 'Raw':
              expect(request.body!.data).toBeDefined();
              break;
          }
        });
      }
    });

    it('should validate all request URLs and methods in demo.apicize', async () => {
      const result = await parser.parseFile(demoFilePath);

      expect(result.success).toBe(true);

      if (result.workbook) {
        const requests = parser.getRequests(result.workbook);

        console.log(`Demo.apicize: Validating ${requests.length} requests`);

        requests.forEach(request => {
          expect(request.id).toBeDefined();
          expect(request.name).toBeDefined();
          expect(request.url).toBeDefined();
          expect(request.method).toBeDefined();

          // URL should be a valid string
          expect(typeof request.url).toBe('string');
          expect(request.url.length).toBeGreaterThan(0);

          // Method should be valid HTTP method
          const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
          expect(validMethods).toContain(request.method);
        });
      }
    });

    it('should handle nested request groups in demo.apicize', async () => {
      const result = await parser.parseFile(demoFilePath);

      expect(result.success).toBe(true);

      if (result.workbook) {
        const groups = parser.getRequestGroups(result.workbook);

        console.log(`Demo.apicize: Found ${groups.length} request groups`);

        groups.forEach(group => {
          expect(group.id).toBeDefined();
          expect(group.name).toBeDefined();
          expect(group.children).toBeDefined();
          expect(Array.isArray(group.children)).toBe(true);
        });

        // Test finding specific groups by ID
        if (groups.length > 0) {
          const firstGroup = groups[0];
          const foundGroup = parser.findRequestGroup(result.workbook!, firstGroup.id);
          expect(foundGroup).toBeDefined();
          expect(foundGroup!.id).toBe(firstGroup.id);
        }
      }
    });

    it('should successfully parse with different validation options', async () => {
      // Test with validation enabled
      const strictResult = await parser.parseFile(demoFilePath, {
        validateOnLoad: true,
        strictMode: true,
      });

      expect(strictResult.success).toBe(true);

      // Test with validation disabled
      const relaxedResult = await parser.parseFile(demoFilePath, {
        validateOnLoad: false,
        strictMode: false,
      });

      expect(relaxedResult.success).toBe(true);

      // Test with warnings
      const warningResult = await parser.parseFile(demoFilePath, {
        validateOnLoad: true,
        strictMode: false,
        includeWarnings: true,
      });

      expect(warningResult.success).toBe(true);
      console.log('Demo.apicize warnings:', warningResult.warnings);
    });
  });
});
