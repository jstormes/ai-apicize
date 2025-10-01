/**
 * Performance tests for Apicize tools
 * Tests performance with large files and complex operations
 */

import * as fs from 'fs';
import * as path from 'path';
import { setupTestContext, runCLICommand, CLITestContext } from '../integration/setup';

describe('Performance Tests', () => {
  let context: CLITestContext;
  let npmCommand: string;

  beforeAll(async () => {
    context = setupTestContext();
    npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

    // Ensure tools are built
    const buildResult = await runCLICommand(npmCommand, ['run', 'build'], {
      cwd: context.toolsPath,
      timeout: 60000,
    });

    if (buildResult.exitCode !== 0) {
      throw new Error('Failed to build tools package for performance tests');
    }
  }, 120000);

  afterAll(() => {
    context.cleanup();
  });

  describe('Large File Handling', () => {
    test('should handle 100+ request file within 10 seconds', async () => {
      const largeFile = createLargeApicizeFile(100);
      const testFile = path.join(context.tempDir, 'large-100.apicize');
      fs.writeFileSync(testFile, JSON.stringify(largeFile, null, 2));

      const startTime = Date.now();

      const result = await runCLICommand('node', ['dist/cli.js', 'validate', testFile], {
        cwd: context.toolsPath,
        timeout: 15000,
      });

      const duration = Date.now() - startTime;

      expect(result.exitCode).toBe(0);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
      expect(result.stdout).toContain('Valid files: 1');

      console.log(`Large file validation (100 requests): ${duration}ms`);
    });

    test('should handle 500+ request file within 30 seconds', async () => {
      const largeFile = createLargeApicizeFile(500);
      const testFile = path.join(context.tempDir, 'large-500.apicize');
      fs.writeFileSync(testFile, JSON.stringify(largeFile, null, 2));

      const startTime = Date.now();

      const result = await runCLICommand('node', ['dist/cli.js', 'validate', testFile], {
        cwd: context.toolsPath,
        timeout: 45000,
      });

      const duration = Date.now() - startTime;

      expect(result.exitCode).toBe(0);
      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds

      console.log(`Large file validation (500 requests): ${duration}ms`);
    });

    test('should export large file efficiently', async () => {
      const largeFile = createLargeApicizeFile(100);
      const testFile = path.join(context.tempDir, 'export-large.apicize');
      const outputDir = path.join(context.tempDir, 'export-large-output');

      fs.writeFileSync(testFile, JSON.stringify(largeFile, null, 2));

      const startTime = Date.now();

      const result = await runCLICommand(
        'node',
        ['dist/cli.js', 'export', testFile, '--output', outputDir],
        {
          cwd: context.toolsPath,
          timeout: 60000,
        }
      );

      const duration = Date.now() - startTime;

      expect(result.exitCode).toBe(0);
      expect(duration).toBeLessThan(45000); // Should complete within 45 seconds

      // Verify output exists
      expect(fs.existsSync(path.join(outputDir, 'package.json'))).toBe(true);

      console.log(`Large file export (100 requests): ${duration}ms`);
    });
  });

  describe('Memory Usage', () => {
    test('should handle multiple large files without memory issues', async () => {
      const files: string[] = [];

      // Create 5 large files
      for (let i = 0; i < 5; i++) {
        const largeFile = createLargeApicizeFile(50);
        const testFile = path.join(context.tempDir, `memory-test-${i}.apicize`);
        fs.writeFileSync(testFile, JSON.stringify(largeFile, null, 2));
        files.push(testFile);
      }

      const startTime = Date.now();

      const result = await runCLICommand('node', ['dist/cli.js', 'validate', ...files], {
        cwd: context.toolsPath,
        timeout: 60000,
      });

      const duration = Date.now() - startTime;

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Valid files: 5');
      expect(duration).toBeLessThan(30000);

      console.log(`Multiple large files validation: ${duration}ms`);
    });
  });

  describe('Complex Operations', () => {
    test('should handle round-trip with large file efficiently', async () => {
      const largeFile = createLargeApicizeFile(50);
      const testFile = path.join(context.tempDir, 'roundtrip-large.apicize');
      const exportDir = path.join(context.tempDir, 'roundtrip-export');
      const importFile = path.join(context.tempDir, 'roundtrip-import.apicize');

      fs.writeFileSync(testFile, JSON.stringify(largeFile, null, 2));

      const startTime = Date.now();

      // Export
      const exportResult = await runCLICommand(
        'node',
        ['dist/cli.js', 'export', testFile, '--output', exportDir],
        {
          cwd: context.toolsPath,
          timeout: 60000,
        }
      );

      expect(exportResult.exitCode).toBe(0);

      // Import
      const importResult = await runCLICommand(
        'node',
        ['dist/cli.js', 'import', exportDir, '--output', importFile],
        {
          cwd: context.toolsPath,
          timeout: 60000,
        }
      );

      const duration = Date.now() - startTime;

      expect(importResult.exitCode).toBe(0);
      expect(duration).toBeLessThan(60000); // Should complete within 1 minute

      console.log(`Round-trip with large file (50 requests): ${duration}ms`);
    });
  });

  describe('Concurrent Operations', () => {
    test('should handle multiple concurrent validations', async () => {
      const files: string[] = [];

      // Create multiple test files
      for (let i = 0; i < 3; i++) {
        const file = createLargeApicizeFile(20);
        const testFile = path.join(context.tempDir, `concurrent-${i}.apicize`);
        fs.writeFileSync(testFile, JSON.stringify(file, null, 2));
        files.push(testFile);
      }

      const startTime = Date.now();

      // Run multiple validations concurrently
      const promises = files.map(file =>
        runCLICommand('node', ['dist/cli.js', 'validate', file], {
          cwd: context.toolsPath,
          timeout: 30000,
        })
      );

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      // All should succeed
      results.forEach(result => {
        expect(result.exitCode).toBe(0);
      });

      expect(duration).toBeLessThan(20000); // Should complete within 20 seconds

      console.log(`Concurrent validations (3 files): ${duration}ms`);
    });
  });

  describe('Performance Benchmarks', () => {
    test('should establish baseline performance metrics', async () => {
      const metrics = {
        smallFile: { size: 10, validationTime: 0, exportTime: 0 },
        mediumFile: { size: 50, validationTime: 0, exportTime: 0 },
        largeFile: { size: 100, validationTime: 0, exportTime: 0 },
      };

      // Test small file
      const smallFile = createLargeApicizeFile(metrics.smallFile.size);
      const smallTestFile = path.join(context.tempDir, 'benchmark-small.apicize');
      fs.writeFileSync(smallTestFile, JSON.stringify(smallFile, null, 2));

      let startTime = Date.now();
      let result = await runCLICommand('node', ['dist/cli.js', 'validate', smallTestFile], {
        cwd: context.toolsPath,
        timeout: 15000,
      });
      metrics.smallFile.validationTime = Date.now() - startTime;
      expect(result.exitCode).toBe(0);

      startTime = Date.now();
      result = await runCLICommand(
        'node',
        [
          'dist/cli.js',
          'export',
          smallTestFile,
          '--output',
          path.join(context.tempDir, 'benchmark-small-export'),
        ],
        { cwd: context.toolsPath, timeout: 30000 }
      );
      metrics.smallFile.exportTime = Date.now() - startTime;
      expect(result.exitCode).toBe(0);

      // Test medium file
      const mediumFile = createLargeApicizeFile(metrics.mediumFile.size);
      const mediumTestFile = path.join(context.tempDir, 'benchmark-medium.apicize');
      fs.writeFileSync(mediumTestFile, JSON.stringify(mediumFile, null, 2));

      startTime = Date.now();
      result = await runCLICommand('node', ['dist/cli.js', 'validate', mediumTestFile], {
        cwd: context.toolsPath,
        timeout: 20000,
      });
      metrics.mediumFile.validationTime = Date.now() - startTime;
      expect(result.exitCode).toBe(0);

      startTime = Date.now();
      result = await runCLICommand(
        'node',
        [
          'dist/cli.js',
          'export',
          mediumTestFile,
          '--output',
          path.join(context.tempDir, 'benchmark-medium-export'),
        ],
        { cwd: context.toolsPath, timeout: 45000 }
      );
      metrics.mediumFile.exportTime = Date.now() - startTime;
      expect(result.exitCode).toBe(0);

      // Test large file
      const largeFile = createLargeApicizeFile(metrics.largeFile.size);
      const largeTestFile = path.join(context.tempDir, 'benchmark-large.apicize');
      fs.writeFileSync(largeTestFile, JSON.stringify(largeFile, null, 2));

      startTime = Date.now();
      result = await runCLICommand('node', ['dist/cli.js', 'validate', largeTestFile], {
        cwd: context.toolsPath,
        timeout: 30000,
      });
      metrics.largeFile.validationTime = Date.now() - startTime;
      expect(result.exitCode).toBe(0);

      startTime = Date.now();
      result = await runCLICommand(
        'node',
        [
          'dist/cli.js',
          'export',
          largeTestFile,
          '--output',
          path.join(context.tempDir, 'benchmark-large-export'),
        ],
        { cwd: context.toolsPath, timeout: 60000 }
      );
      metrics.largeFile.exportTime = Date.now() - startTime;
      expect(result.exitCode).toBe(0);

      // Log performance metrics
      console.log('\n=== Performance Benchmarks ===');
      Object.entries(metrics).forEach(([name, data]) => {
        console.log(`${name}: ${data.size} requests`);
        console.log(`  Validation: ${data.validationTime}ms`);
        console.log(`  Export: ${data.exportTime}ms`);
        console.log(
          `  Validation rate: ${((data.size / data.validationTime) * 1000).toFixed(2)} requests/sec`
        );
        console.log(
          `  Export rate: ${((data.size / data.exportTime) * 1000).toFixed(2)} requests/sec`
        );
      });

      // Performance assertions
      expect(metrics.smallFile.validationTime).toBeLessThan(5000);
      expect(metrics.mediumFile.validationTime).toBeLessThan(15000);
      expect(metrics.largeFile.validationTime).toBeLessThan(30000);

      expect(metrics.smallFile.exportTime).toBeLessThan(10000);
      expect(metrics.mediumFile.exportTime).toBeLessThan(30000);
      expect(metrics.largeFile.exportTime).toBeLessThan(60000);
    });
  });
});

/**
 * Create a large .apicize file with specified number of requests
 */
function createLargeApicizeFile(requestCount: number): any {
  const requests = [];

  // Create request groups of 10 requests each
  const groupCount = Math.ceil(requestCount / 10);

  for (let g = 0; g < groupCount; g++) {
    const groupRequests = Math.min(10, requestCount - g * 10);
    const children = [];

    for (let r = 0; r < groupRequests; r++) {
      const requestId = `request-${g}-${r}`;
      children.push({
        id: requestId,
        name: `Test Request ${g + 1}.${r + 1}`,
        url: `{{baseUrl}}/api/test/${g}/${r}`,
        method: ['GET', 'POST', 'PUT', 'DELETE'][r % 4],
        test: `describe('Test Request ${g + 1}.${r + 1}', () => {
  it('should return successful response', () => {
    expect(response.status).to.be.oneOf([200, 201, 204]);
  });

  it('should have valid response body', () => {
    if (response.body.type === BodyType.JSON) {
      expect(response.body.data).to.be.an('object');
    }
  });

  it('should complete within timeout', () => {
    expect(response.timing.duration).to.be.lessThan(30000);
  });
});`,
        headers: [
          { name: 'Content-Type', value: 'application/json' },
          { name: 'X-Request-ID', value: `{{requestId}}-${requestId}` },
        ],
        body:
          r % 2 === 0
            ? {
                type: 'JSON',
                data: {
                  testId: `${g}-${r}`,
                  data: `Test data for request ${g}.${r}`,
                  timestamp: new Date().toISOString(),
                  metadata: {
                    group: g,
                    request: r,
                    type: 'performance-test',
                  },
                },
              }
            : undefined,
        queryStringParams: [
          { name: 'group', value: g.toString() },
          { name: 'request', value: r.toString() },
        ],
        timeout: 30000,
        runs: 1,
      });
    }

    requests.push({
      id: `group-${g}`,
      name: `Test Group ${g + 1}`,
      children,
      execution: 'SEQUENTIAL',
      runs: 1,
    });
  }

  // Create multiple scenarios
  const scenarios = [];
  for (let s = 0; s < 3; s++) {
    scenarios.push({
      id: `scenario-${s}`,
      name: ['Development', 'Staging', 'Production'][s],
      variables: [
        {
          name: 'baseUrl',
          value: [
            `https://api-dev.example.com`,
            `https://api-staging.example.com`,
            `https://api.example.com`,
          ][s],
          type: 'TEXT',
        },
        {
          name: 'requestId',
          value: `perf-test-${s}`,
          type: 'TEXT',
        },
        {
          name: 'timeout',
          value: [5000, 10000, 30000][s].toString(),
          type: 'TEXT',
        },
      ],
    });
  }

  return {
    version: 1.0,
    requests,
    scenarios,
    authorizations: [
      {
        id: 'api-key',
        name: 'API Key',
        type: 'ApiKey',
        header: 'X-API-Key',
        value: '{{apiKey}}',
      },
    ],
    certificates: [],
    proxies: [],
    data: [],
    defaults: {
      selectedScenario: {
        id: 'scenario-0',
        name: 'Development',
      },
      selectedAuthorization: {
        id: 'api-key',
        name: 'API Key',
      },
    },
  };
}
