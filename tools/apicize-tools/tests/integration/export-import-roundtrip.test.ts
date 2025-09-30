/**
 * Integration tests focused on export/import round-trip accuracy
 * Tests data preservation and fidelity through complete conversion cycles
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  setupTestContext,
  runCLICommand,
  copyTestFile,
  validateApicizeStructure,
  validateTypeScriptProject,
  compareApicizeFiles,
  CLITestContext,
} from './setup';

describe('Export-Import Round-Trip Tests', () => {
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
      throw new Error('Failed to build tools package for round-trip tests');
    }
  }, 120000);

  afterAll(() => {
    context.cleanup();
  });

  describe('Complete Data Preservation', () => {
    test('should preserve all data in demo.apicize round-trip', async () => {
      const originalFile = path.join(context.workbooksDir, 'demo.apicize');
      if (!fs.existsSync(originalFile)) {
        console.log('Skipping demo.apicize round-trip test - file not found');
        return;
      }

      const testFile = copyTestFile(originalFile, context.tempDir, 'demo-roundtrip.apicize');
      const exportDir = path.join(context.tempDir, 'demo-export');
      const importedFile = path.join(context.tempDir, 'demo-imported.apicize');

      // Export
      const exportResult = await runCLICommand(
        'node',
        ['dist/cli.js', 'export', testFile, '--output', exportDir],
        {
          cwd: context.toolsPath,
          timeout: 45000,
        }
      );

      expect(exportResult.exitCode).toBe(0);

      // Verify export created valid TypeScript project
      const exportValidation = validateTypeScriptProject(exportDir);
      expect(exportValidation.valid).toBe(true);

      // Import back
      const importResult = await runCLICommand(
        'node',
        ['dist/cli.js', 'import', exportDir, '--output', importedFile],
        {
          cwd: context.toolsPath,
          timeout: 30000,
        }
      );

      expect(importResult.exitCode).toBe(0);

      // Verify import created valid .apicize file
      const importValidation = validateApicizeStructure(importedFile);
      expect(importValidation.valid).toBe(true);

      // Compare with original
      const comparison = compareApicizeFiles(testFile, importedFile);
      expect(comparison.accuracy).toBeGreaterThan(95);

      if (comparison.differences.length > 0) {
        console.log('Round-trip differences:', comparison.differences);
      }
    }, 60000);

    test('should preserve authentication configurations', async () => {
      const originalFile = path.join(context.workbooksDir, 'with-authentication.apicize');
      if (!fs.existsSync(originalFile)) {
        console.log('Skipping auth test - with-authentication.apicize not found');
        return;
      }

      const testFile = copyTestFile(originalFile, context.tempDir, 'auth-test.apicize');
      const exportDir = path.join(context.tempDir, 'auth-export');
      const importedFile = path.join(context.tempDir, 'auth-imported.apicize');

      // Round-trip
      const exportResult = await runCLICommand(
        'node',
        ['dist/cli.js', 'export', testFile, '--output', exportDir],
        { cwd: context.toolsPath, timeout: 30000 }
      );

      expect(exportResult.exitCode).toBe(0);

      const importResult = await runCLICommand(
        'node',
        ['dist/cli.js', 'import', exportDir, '--output', importedFile],
        { cwd: context.toolsPath, timeout: 30000 }
      );

      expect(importResult.exitCode).toBe(0);

      // Verify authentication data preservation
      const original = JSON.parse(fs.readFileSync(testFile, 'utf8'));
      const imported = JSON.parse(fs.readFileSync(importedFile, 'utf8'));

      expect(imported.authorizations).toEqual(original.authorizations);
      expect(imported.defaults?.selectedAuthorization).toEqual(
        original.defaults?.selectedAuthorization
      );
    }, 60000);

    test('should preserve request groups and hierarchy', async () => {
      const originalFile = path.join(context.workbooksDir, 'request-groups.apicize');
      if (!fs.existsSync(originalFile)) {
        console.log('Skipping groups test - request-groups.apicize not found');
        return;
      }

      const testFile = copyTestFile(originalFile, context.tempDir, 'groups-test.apicize');
      const exportDir = path.join(context.tempDir, 'groups-export');
      const importedFile = path.join(context.tempDir, 'groups-imported.apicize');

      // Round-trip
      const exportResult = await runCLICommand(
        'node',
        ['dist/cli.js', 'export', testFile, '--output', exportDir],
        { cwd: context.toolsPath, timeout: 30000 }
      );

      expect(exportResult.exitCode).toBe(0);

      const importResult = await runCLICommand(
        'node',
        ['dist/cli.js', 'import', exportDir, '--output', importedFile],
        { cwd: context.toolsPath, timeout: 30000 }
      );

      expect(importResult.exitCode).toBe(0);

      // Verify request structure preservation
      const original = JSON.parse(fs.readFileSync(testFile, 'utf8'));
      const imported = JSON.parse(fs.readFileSync(importedFile, 'utf8'));

      expect(imported.requests).toHaveLength(original.requests.length);

      // Check first request group structure
      if (original.requests.length > 0) {
        expect(imported.requests[0].children).toHaveLength(original.requests[0].children.length);
        expect(imported.requests[0].execution).toBe(original.requests[0].execution);
      }
    });

    test('should preserve minimal file structure', async () => {
      const originalFile = path.join(context.workbooksDir, 'minimal.apicize');
      if (!fs.existsSync(originalFile)) {
        console.log('Skipping minimal test - minimal.apicize not found');
        return;
      }

      const testFile = copyTestFile(originalFile, context.tempDir, 'minimal-test.apicize');
      const exportDir = path.join(context.tempDir, 'minimal-export');
      const importedFile = path.join(context.tempDir, 'minimal-imported.apicize');

      // Round-trip
      const exportResult = await runCLICommand(
        'node',
        ['dist/cli.js', 'export', testFile, '--output', exportDir],
        { cwd: context.toolsPath, timeout: 30000 }
      );

      expect(exportResult.exitCode).toBe(0);

      const importResult = await runCLICommand(
        'node',
        ['dist/cli.js', 'import', exportDir, '--output', importedFile],
        { cwd: context.toolsPath, timeout: 30000 }
      );

      expect(importResult.exitCode).toBe(0);

      // Compare complete structure
      const comparison = compareApicizeFiles(testFile, importedFile);
      expect(comparison.identical).toBe(true);
    });
  });

  describe('Scenario-Specific Round-Trips', () => {
    test('should handle scenario-specific exports correctly', async () => {
      const originalFile = path.join(context.workbooksDir, 'demo.apicize');
      if (!fs.existsSync(originalFile)) {
        console.log('Skipping scenario test - demo.apicize not found');
        return;
      }

      const testFile = copyTestFile(originalFile, context.tempDir, 'scenario-test.apicize');
      const exportDir = path.join(context.tempDir, 'scenario-export');
      const importedFile = path.join(context.tempDir, 'scenario-imported.apicize');

      // Export with specific scenario
      const exportResult = await runCLICommand(
        'node',
        ['dist/cli.js', 'export', testFile, '--output', exportDir, '--scenario', 'Development'],
        { cwd: context.toolsPath, timeout: 30000 }
      );

      expect(exportResult.exitCode).toBe(0);

      // Import back
      const importResult = await runCLICommand(
        'node',
        ['dist/cli.js', 'import', exportDir, '--output', importedFile],
        { cwd: context.toolsPath, timeout: 30000 }
      );

      expect(importResult.exitCode).toBe(0);

      // Verify scenarios are preserved
      const original = JSON.parse(fs.readFileSync(testFile, 'utf8'));
      const imported = JSON.parse(fs.readFileSync(importedFile, 'utf8'));

      expect(imported.scenarios).toEqual(original.scenarios);
    });
  });

  describe('Edge Cases and Data Types', () => {
    test('should handle special characters in test names and URLs', async () => {
      const specialCharsTest = {
        version: 1.0,
        requests: [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            name: 'Tests with "quotes" & <tags> % encoding',
            children: [
              {
                id: '123e4567-e89b-12d3-a456-426614174001',
                name: 'Request with émojis 🚀 and unicode',
                url: 'https://example.com/path with spaces/{{param}}',
                method: 'POST',
                test: 'describe("Test with special chars", () => { it("should work", () => { expect(1).to.equal(1); }); });',
                headers: [
                  { name: 'Content-Type', value: 'application/json; charset=utf-8' },
                  { name: 'X-Special', value: 'value with "quotes" and \n newlines' },
                ],
                body: {
                  type: 'JSON',
                  data: {
                    message: 'Hello "world" with émojis 🌍',
                    special: 'Line 1\nLine 2\tTabbed',
                  },
                },
                queryStringParams: [
                  { name: 'q', value: 'search with spaces' },
                  { name: 'filter', value: 'status:"active" AND type:special' },
                ],
                timeout: 30000,
                runs: 1,
              },
            ],
            execution: 'SEQUENTIAL',
            runs: 1,
          },
        ],
        scenarios: [
          {
            id: '123e4567-e89b-12d3-a456-426614174002',
            name: 'Special Scenario 🎯',
            variables: [
              { name: 'param', value: 'special/value with/slashes', type: 'TEXT' },
              { name: 'encoding', value: 'ñoño español', type: 'TEXT' },
            ],
          },
        ],
        authorizations: [],
        certificates: [],
        proxies: [],
        data: [],
        defaults: {},
      };

      const testFile = path.join(context.tempDir, 'special-chars.apicize');
      fs.writeFileSync(testFile, JSON.stringify(specialCharsTest, null, 2));

      const exportDir = path.join(context.tempDir, 'special-export');
      const importedFile = path.join(context.tempDir, 'special-imported.apicize');

      // Round-trip
      const exportResult = await runCLICommand(
        'node',
        ['dist/cli.js', 'export', testFile, '--output', exportDir],
        { cwd: context.toolsPath, timeout: 30000 }
      );

      expect(exportResult.exitCode).toBe(0);

      const importResult = await runCLICommand(
        'node',
        ['dist/cli.js', 'import', exportDir, '--output', importedFile],
        { cwd: context.toolsPath, timeout: 30000 }
      );

      expect(importResult.exitCode).toBe(0);

      // Compare
      const comparison = compareApicizeFiles(testFile, importedFile);
      expect(comparison.accuracy).toBeGreaterThan(95);
    });

    test('should handle empty and null values correctly', async () => {
      const emptyValuesTest = {
        version: 1.0,
        requests: [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            name: 'Empty Values Test',
            children: [
              {
                id: '123e4567-e89b-12d3-a456-426614174001',
                name: 'Request with empty values',
                url: 'https://example.com/empty',
                method: 'GET',
                test: '',
                headers: [],
                body: { type: 'None' },
                queryStringParams: [],
                timeout: 30000,
                runs: 1,
              },
            ],
            execution: 'SEQUENTIAL',
            runs: 1,
          },
        ],
        scenarios: [
          {
            id: '123e4567-e89b-12d3-a456-426614174002',
            name: 'Empty Scenario',
            variables: [],
          },
        ],
        authorizations: [],
        certificates: [],
        proxies: [],
        data: [],
        defaults: {},
      };

      const testFile = path.join(context.tempDir, 'empty-values.apicize');
      fs.writeFileSync(testFile, JSON.stringify(emptyValuesTest, null, 2));

      const exportDir = path.join(context.tempDir, 'empty-export');
      const importedFile = path.join(context.tempDir, 'empty-imported.apicize');

      // Round-trip
      const exportResult = await runCLICommand(
        'node',
        ['dist/cli.js', 'export', testFile, '--output', exportDir],
        { cwd: context.toolsPath, timeout: 30000 }
      );

      expect(exportResult.exitCode).toBe(0);

      const importResult = await runCLICommand(
        'node',
        ['dist/cli.js', 'import', exportDir, '--output', importedFile],
        { cwd: context.toolsPath, timeout: 30000 }
      );

      expect(importResult.exitCode).toBe(0);

      // Verify empty arrays are preserved
      const imported = JSON.parse(fs.readFileSync(importedFile, 'utf8'));
      expect(imported.requests[0].children[0].headers).toEqual([]);
      expect(imported.requests[0].children[0].queryStringParams).toEqual([]);
      expect(imported.scenarios[0].variables).toEqual([]);
    });

    test('should handle large numeric values and complex body types', async () => {
      const complexDataTest = {
        version: 1.0,
        requests: [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            name: 'Complex Data Test',
            children: [
              {
                id: '123e4567-e89b-12d3-a456-426614174001',
                name: 'Request with complex body',
                url: 'https://example.com/complex',
                method: 'POST',
                test: 'describe("Complex test", () => { it("should handle complex data", () => { expect(1).to.equal(1); }); });',
                headers: [{ name: 'Content-Type', value: 'application/json' }],
                body: {
                  type: 'JSON',
                  data: {
                    id: 9007199254740991, // Max safe integer
                    price: 123.456789,
                    active: true,
                    tags: ['test', 'complex', null],
                    metadata: {
                      nested: {
                        deep: {
                          value: 'very deep',
                        },
                      },
                    },
                    timestamp: '2024-01-01T00:00:00.000Z',
                  },
                },
                queryStringParams: [],
                timeout: 60000,
                numberOfRedirects: 10,
                runs: 5,
                multiRunExecution: 'CONCURRENT',
                keepAlive: true,
              },
            ],
            execution: 'SEQUENTIAL',
            runs: 1,
          },
        ],
        scenarios: [
          {
            id: '123e4567-e89b-12d3-a456-426614174002',
            name: 'Default',
            variables: [],
          },
        ],
        authorizations: [],
        certificates: [],
        proxies: [],
        data: [],
        defaults: {},
      };

      const testFile = path.join(context.tempDir, 'complex-data.apicize');
      fs.writeFileSync(testFile, JSON.stringify(complexDataTest, null, 2));

      const exportDir = path.join(context.tempDir, 'complex-export');
      const importedFile = path.join(context.tempDir, 'complex-imported.apicize');

      // Round-trip
      const exportResult = await runCLICommand(
        'node',
        ['dist/cli.js', 'export', testFile, '--output', exportDir],
        { cwd: context.toolsPath, timeout: 30000 }
      );

      expect(exportResult.exitCode).toBe(0);

      const importResult = await runCLICommand(
        'node',
        ['dist/cli.js', 'import', exportDir, '--output', importedFile],
        { cwd: context.toolsPath, timeout: 30000 }
      );

      expect(importResult.exitCode).toBe(0);

      // Compare numeric precision and complex structures
      const original = JSON.parse(fs.readFileSync(testFile, 'utf8'));
      const imported = JSON.parse(fs.readFileSync(importedFile, 'utf8'));

      expect(imported.requests[0].children[0].timeout).toBe(
        original.requests[0].children[0].timeout
      );
      expect(imported.requests[0].children[0].runs).toBe(original.requests[0].children[0].runs);
      expect(imported.requests[0].children[0].body.data).toEqual(
        original.requests[0].children[0].body.data
      );
    });
  });

  describe('Performance and Scale', () => {
    test('should handle multiple round-trips without degradation', async () => {
      const originalFile = path.join(context.workbooksDir, 'simple-rest-api.apicize');
      if (!fs.existsSync(originalFile)) {
        console.log('Skipping multiple round-trip test - simple-rest-api.apicize not found');
        return;
      }

      let currentFile = copyTestFile(originalFile, context.tempDir, 'multi-roundtrip-0.apicize');
      let accuracy = 100;

      // Perform 3 round-trips
      for (let i = 1; i <= 3; i++) {
        const exportDir = path.join(context.tempDir, `multi-export-${i}`);
        const importedFile = path.join(context.tempDir, `multi-roundtrip-${i}.apicize`);

        // Export
        const exportResult = await runCLICommand(
          'node',
          ['dist/cli.js', 'export', currentFile, '--output', exportDir],
          { cwd: context.toolsPath, timeout: 30000 }
        );

        expect(exportResult.exitCode).toBe(0);

        // Import
        const importResult = await runCLICommand(
          'node',
          ['dist/cli.js', 'import', exportDir, '--output', importedFile],
          { cwd: context.toolsPath, timeout: 30000 }
        );

        expect(importResult.exitCode).toBe(0);

        // Check accuracy hasn't degraded
        const comparison = compareApicizeFiles(originalFile, importedFile);
        expect(comparison.accuracy).toBeGreaterThan(90);
        accuracy = Math.min(accuracy, comparison.accuracy);

        currentFile = importedFile;
      }

      console.log(`Final accuracy after 3 round-trips: ${accuracy.toFixed(2)}%`);
    });
  });
});
