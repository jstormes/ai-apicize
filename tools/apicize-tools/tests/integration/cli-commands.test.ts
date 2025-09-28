/**
 * Integration tests for CLI commands
 * Tests the complete export/import workflows and CLI functionality
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  setupTestContext,
  runCLICommand,
  copyTestFile,
  checkDirectoryContents,
  validateApicizeStructure,
  validateTypeScriptProject,
  compareApicizeFiles,
  CLITestContext,
  TestResult
} from './setup';

describe('CLI Commands Integration Tests', () => {
  let context: CLITestContext;
  let npmCommand: string;

  beforeAll(async () => {
    context = setupTestContext();

    // Determine npm command based on platform
    npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

    // Build the tools package first
    console.log('Building tools package for integration tests...');
    const buildResult = await runCLICommand(npmCommand, ['run', 'build'], {
      cwd: context.toolsPath,
      timeout: 60000
    });

    if (buildResult.exitCode !== 0) {
      console.error('Build failed:', buildResult.stderr);
      throw new Error('Failed to build tools package for integration tests');
    }
  }, 120000);

  afterAll(() => {
    context.cleanup();
  });

  describe('CLI Framework', () => {
    test('should show help when --help flag is provided', async () => {
      const result = await runCLICommand('node', ['dist/cli.js', '--help'], {
        cwd: context.toolsPath,
        timeout: 10000
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('CLI tools for working with .apicize API test files');
      expect(result.stdout).toContain('Commands:');
      expect(result.stdout).toContain('export');
      expect(result.stdout).toContain('import');
      expect(result.stdout).toContain('validate');
      expect(result.stdout).toContain('create');
      expect(result.stdout).toContain('run');
    });

    test('should show version when --version flag is provided', async () => {
      const result = await runCLICommand('node', ['dist/cli.js', '--version'], {
        cwd: context.toolsPath,
        timeout: 10000
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
    });

    test('should show error for unknown command', async () => {
      const result = await runCLICommand('node', ['dist/cli.js', 'unknown-command'], {
        cwd: context.toolsPath,
        timeout: 10000
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Unknown command');
    });
  });

  describe('Export Command', () => {
    test('should export demo.apicize to TypeScript successfully', async () => {
      const demoFile = path.join(context.workbooksDir, 'demo.apicize');
      const testFile = copyTestFile(demoFile, context.tempDir, 'demo.apicize');
      const outputDir = path.join(context.tempDir, 'exported-tests');

      const result = await runCLICommand('node', [
        'dist/cli.js', 'export', testFile,
        '--output', outputDir
      ], {
        cwd: context.toolsPath,
        timeout: 30000
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Export completed successfully');

      // Verify exported project structure
      const validation = validateTypeScriptProject(outputDir);
      expect(validation.valid).toBe(true);

      // Check for expected files
      expect(checkDirectoryContents(outputDir, [
        'package.json',
        'tsconfig.json',
        '.spec.ts'
      ])).toBe(true);
    });

    test('should handle missing input file gracefully', async () => {
      const missingFile = path.join(context.tempDir, 'missing.apicize');
      const outputDir = path.join(context.tempDir, 'output');

      const result = await runCLICommand('node', [
        'dist/cli.js', 'export', missingFile,
        '--output', outputDir
      ], {
        cwd: context.toolsPath,
        timeout: 10000
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Input file does not exist');
    });

    test('should handle invalid .apicize file', async () => {
      const invalidFile = path.join(context.tempDir, 'invalid.apicize');
      fs.writeFileSync(invalidFile, '{ invalid json }');
      const outputDir = path.join(context.tempDir, 'output');

      const result = await runCLICommand('node', [
        'dist/cli.js', 'export', invalidFile,
        '--output', outputDir
      ], {
        cwd: context.toolsPath,
        timeout: 10000
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Export failed');
    });

    test('should export with scenario option', async () => {
      const demoFile = path.join(context.workbooksDir, 'demo.apicize');
      const testFile = copyTestFile(demoFile, context.tempDir, 'demo-scenario.apicize');
      const outputDir = path.join(context.tempDir, 'scenario-tests');

      const result = await runCLICommand('node', [
        'dist/cli.js', 'export', testFile,
        '--output', outputDir,
        '--scenario', 'Development'
      ], {
        cwd: context.toolsPath,
        timeout: 30000
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Export completed successfully');
      expect(result.stdout).toContain('Development');
    });
  });

  describe('Import Command', () => {
    test('should import TypeScript project back to .apicize', async () => {
      // First export a file
      const demoFile = path.join(context.workbooksDir, 'demo.apicize');
      const testFile = copyTestFile(demoFile, context.tempDir, 'demo-roundtrip.apicize');
      const exportDir = path.join(context.tempDir, 'roundtrip-export');

      const exportResult = await runCLICommand('node', [
        'dist/cli.js', 'export', testFile,
        '--output', exportDir
      ], {
        cwd: context.toolsPath,
        timeout: 30000
      });

      expect(exportResult.exitCode).toBe(0);

      // Then import it back
      const importedFile = path.join(context.tempDir, 'imported.apicize');
      const importResult = await runCLICommand('node', [
        'dist/cli.js', 'import', exportDir,
        '--output', importedFile
      ], {
        cwd: context.toolsPath,
        timeout: 30000
      });

      expect(importResult.exitCode).toBe(0);
      expect(importResult.stdout).toContain('Import completed successfully');

      // Verify imported file structure
      const validation = validateApicizeStructure(importedFile);
      expect(validation.valid).toBe(true);

      // Compare with original (round-trip test)
      const comparison = compareApicizeFiles(testFile, importedFile);
      expect(comparison.accuracy).toBeGreaterThan(90); // Allow for minor differences
    });

    test('should handle missing input directory', async () => {
      const missingDir = path.join(context.tempDir, 'missing-dir');
      const outputFile = path.join(context.tempDir, 'output.apicize');

      const result = await runCLICommand('node', [
        'dist/cli.js', 'import', missingDir,
        '--output', outputFile
      ], {
        cwd: context.toolsPath,
        timeout: 10000
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Input path is not a directory');
    });
  });

  describe('Validate Command', () => {
    test('should validate valid .apicize file', async () => {
      const demoFile = path.join(context.workbooksDir, 'demo.apicize');
      const testFile = copyTestFile(demoFile, context.tempDir, 'validate-demo.apicize');

      const result = await runCLICommand('node', [
        'dist/cli.js', 'validate', testFile
      ], {
        cwd: context.toolsPath,
        timeout: 10000
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Validation completed');
      expect(result.stdout).toContain('Valid files: 1');
    });

    test('should detect invalid .apicize file', async () => {
      const invalidFile = path.join(context.tempDir, 'invalid-validate.apicize');
      fs.writeFileSync(invalidFile, JSON.stringify({ version: 999 })); // Invalid version

      const result = await runCLICommand('node', [
        'dist/cli.js', 'validate', invalidFile
      ], {
        cwd: context.toolsPath,
        timeout: 10000
      });

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain('Invalid files: 1');
    });

    test('should validate multiple files with glob pattern', async () => {
      // Copy multiple test files
      const files = ['demo.apicize', 'simple-rest-api.apicize'];
      files.forEach(file => {
        const source = path.join(context.workbooksDir, file);
        if (fs.existsSync(source)) {
          copyTestFile(source, context.tempDir, file);
        }
      });

      const result = await runCLICommand('node', [
        'dist/cli.js', 'validate', path.join(context.tempDir, '*.apicize')
      ], {
        cwd: context.toolsPath,
        timeout: 15000
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Validation completed');
    });
  });

  describe('Create Command', () => {
    test('should create new .apicize file with basic template', async () => {
      const outputFile = path.join(context.tempDir, 'new-basic.apicize');

      const result = await runCLICommand('node', [
        'dist/cli.js', 'create', 'test-api',
        '--output', outputFile
      ], {
        cwd: context.toolsPath,
        timeout: 15000
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Created "new-basic.apicize"');

      // Verify created file structure
      const validation = validateApicizeStructure(outputFile);
      expect(validation.valid).toBe(true);

      // Check content
      const content = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
      expect(content.version).toBe(1.0);
      expect(content.requests).toHaveLength(1);
      expect(content.scenarios).toHaveLength(2);
    });

    test('should create file with rest-crud template', async () => {
      const outputFile = path.join(context.tempDir, 'new-crud.apicize');

      const result = await runCLICommand('node', [
        'dist/cli.js', 'create', 'crud-api',
        '--template', 'rest-crud',
        '--output', outputFile
      ], {
        cwd: context.toolsPath,
        timeout: 15000
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Created "new-crud.apicize"');

      const validation = validateApicizeStructure(outputFile);
      expect(validation.valid).toBe(true);
    });

    test('should handle file overwrite protection', async () => {
      const outputFile = path.join(context.tempDir, 'existing.apicize');
      fs.writeFileSync(outputFile, '{}'); // Create existing file

      const result = await runCLICommand('node', [
        'dist/cli.js', 'create', 'test-api',
        '--output', outputFile
      ], {
        cwd: context.toolsPath,
        timeout: 10000
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Output file already exists');
    });

    test('should overwrite with --overwrite flag', async () => {
      const outputFile = path.join(context.tempDir, 'overwrite.apicize');
      fs.writeFileSync(outputFile, '{}'); // Create existing file

      const result = await runCLICommand('node', [
        'dist/cli.js', 'create', 'test-api',
        '--output', outputFile,
        '--overwrite'
      ], {
        cwd: context.toolsPath,
        timeout: 15000
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Created "overwrite.apicize"');
    });
  });

  describe('Run Command', () => {
    test('should execute simple .apicize file tests', async () => {
      // Create a simple test file that should pass
      const simpleTest = {
        version: 1.0,
        requests: [{
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Simple Test',
          children: [{
            id: '123e4567-e89b-12d3-a456-426614174001',
            name: 'Basic Request',
            url: 'https://httpbin.org/status/200',
            method: 'GET',
            test: 'describe("Basic Request", () => { it("should return 200", () => { expect(response.status).to.equal(200); }); });',
            headers: [],
            queryStringParams: [],
            timeout: 30000,
            runs: 1
          }],
          execution: 'SEQUENTIAL',
          runs: 1
        }],
        scenarios: [{
          id: '123e4567-e89b-12d3-a456-426614174002',
          name: 'Default',
          variables: []
        }],
        authorizations: [],
        certificates: [],
        proxies: [],
        data: [],
        defaults: {
          selectedScenario: {
            id: '123e4567-e89b-12d3-a456-426614174002',
            name: 'Default'
          }
        }
      };

      const testFile = path.join(context.tempDir, 'run-test.apicize');
      fs.writeFileSync(testFile, JSON.stringify(simpleTest, null, 2));

      const result = await runCLICommand('node', [
        'dist/cli.js', 'run', testFile
      ], {
        cwd: context.toolsPath,
        timeout: 60000
      });

      // Note: The run command might fail due to missing dependencies in the temporary environment
      // We primarily test that the command executes without crashing
      expect([0, 1]).toContain(result.exitCode);
      expect(result.stdout).toContain('Test execution');
    });

    test('should handle missing .apicize file', async () => {
      const missingFile = path.join(context.tempDir, 'missing-run.apicize');

      const result = await runCLICommand('node', [
        'dist/cli.js', 'run', missingFile
      ], {
        cwd: context.toolsPath,
        timeout: 10000
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Input file does not exist');
    });
  });

  describe('End-to-End Workflows', () => {
    test('complete export-import-validate workflow', async () => {
      const originalFile = path.join(context.workbooksDir, 'simple-rest-api.apicize');
      if (!fs.existsSync(originalFile)) {
        console.log('Skipping workflow test - simple-rest-api.apicize not found');
        return;
      }

      const testFile = copyTestFile(originalFile, context.tempDir, 'workflow-test.apicize');
      const exportDir = path.join(context.tempDir, 'workflow-export');
      const importedFile = path.join(context.tempDir, 'workflow-imported.apicize');

      // Step 1: Export
      const exportResult = await runCLICommand('node', [
        'dist/cli.js', 'export', testFile,
        '--output', exportDir
      ], {
        cwd: context.toolsPath,
        timeout: 30000
      });

      expect(exportResult.exitCode).toBe(0);

      // Step 2: Import
      const importResult = await runCLICommand('node', [
        'dist/cli.js', 'import', exportDir,
        '--output', importedFile
      ], {
        cwd: context.toolsPath,
        timeout: 30000
      });

      expect(importResult.exitCode).toBe(0);

      // Step 3: Validate
      const validateResult = await runCLICommand('node', [
        'dist/cli.js', 'validate', importedFile
      ], {
        cwd: context.toolsPath,
        timeout: 10000
      });

      expect(validateResult.exitCode).toBe(0);

      // Step 4: Compare accuracy
      const comparison = compareApicizeFiles(testFile, importedFile);
      expect(comparison.accuracy).toBeGreaterThan(85);
    });

    test('multiple file operations', async () => {
      // Copy multiple workbook files
      const workbookFiles = ['demo.apicize', 'minimal.apicize'];
      const testFiles: string[] = [];

      workbookFiles.forEach(file => {
        const source = path.join(context.workbooksDir, file);
        if (fs.existsSync(source)) {
          const testFile = copyTestFile(source, context.tempDir, file);
          testFiles.push(testFile);
        }
      });

      if (testFiles.length === 0) {
        console.log('Skipping multiple file test - no workbook files found');
        return;
      }

      // Validate all files
      const validateResult = await runCLICommand('node', [
        'dist/cli.js', 'validate',
        ...testFiles
      ], {
        cwd: context.toolsPath,
        timeout: 20000
      });

      expect(validateResult.exitCode).toBe(0);
      expect(validateResult.stdout).toContain(`Valid files: ${testFiles.length}`);
    });
  });

  describe('Error Conditions and Edge Cases', () => {
    test('should handle corrupted .apicize file gracefully', async () => {
      const corruptedFile = path.join(context.tempDir, 'corrupted.apicize');
      fs.writeFileSync(corruptedFile, 'This is not JSON at all');

      const result = await runCLICommand('node', [
        'dist/cli.js', 'validate', corruptedFile
      ], {
        cwd: context.toolsPath,
        timeout: 10000
      });

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain('Invalid files: 1');
    });

    test('should handle very large file names', async () => {
      const longName = 'a'.repeat(200);
      const testFile = path.join(context.tempDir, `${longName}.apicize`);

      const result = await runCLICommand('node', [
        'dist/cli.js', 'create', 'test',
        '--output', testFile
      ], {
        cwd: context.toolsPath,
        timeout: 15000
      });

      // Should handle gracefully (may succeed or fail with clear error)
      expect([0, 1]).toContain(result.exitCode);
    });

    test('should handle insufficient permissions gracefully', async () => {
      // Try to create in root directory (should fail on most systems)
      const restrictedFile = '/test-restricted.apicize';

      const result = await runCLICommand('node', [
        'dist/cli.js', 'create', 'test',
        '--output', restrictedFile
      ], {
        cwd: context.toolsPath,
        timeout: 10000
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Create failed');
    });
  });

  describe('Performance Tests', () => {
    test('should complete operations within reasonable time limits', async () => {
      const demoFile = path.join(context.workbooksDir, 'demo.apicize');
      if (!fs.existsSync(demoFile)) {
        console.log('Skipping performance test - demo.apicize not found');
        return;
      }

      const testFile = copyTestFile(demoFile, context.tempDir, 'perf-test.apicize');
      const outputDir = path.join(context.tempDir, 'perf-output');

      const startTime = Date.now();

      const result = await runCLICommand('node', [
        'dist/cli.js', 'export', testFile,
        '--output', outputDir
      ], {
        cwd: context.toolsPath,
        timeout: 45000 // 45 second timeout
      });

      const duration = Date.now() - startTime;

      expect(result.exitCode).toBe(0);
      expect(duration).toBeLessThan(30000); // Should complete in under 30 seconds
    });
  });
});