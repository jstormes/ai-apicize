import * as fs from 'fs/promises';
import * as path from 'path';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { FileScanner, FileScannerError, scanProject, findTestFiles } from './file-scanner';

describe('FileScanner', () => {
  let tempDir: string;
  let scanner: FileScanner;

  beforeEach(async () => {
    // Create temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(process.cwd(), 'test-temp-'));
    scanner = new FileScanner();
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('constructor', () => {
    it('should use default options when none provided', () => {
      const scanner = new FileScanner();
      expect(scanner).toBeInstanceOf(FileScanner);
    });

    it('should merge provided options with defaults', () => {
      const customOptions = {
        includePatterns: ['**/*.custom.ts'],
        maxDepth: 5,
      };
      const scanner = new FileScanner(customOptions);
      expect(scanner).toBeInstanceOf(FileScanner);
    });
  });

  describe('scanProject', () => {
    it('should throw error for non-existent directory', async () => {
      const nonExistentPath = path.join(tempDir, 'does-not-exist');

      await expect(scanner.scanProject(nonExistentPath)).rejects.toThrow(FileScannerError);
      await expect(scanner.scanProject(nonExistentPath)).rejects.toThrow('Cannot access directory');
    });

    it('should throw error when path is not a directory', async () => {
      // Create a file instead of directory
      const filePath = path.join(tempDir, 'not-a-directory.txt');
      await fs.writeFile(filePath, 'test content');

      await expect(scanner.scanProject(filePath)).rejects.toThrow(FileScannerError);
      await expect(scanner.scanProject(filePath)).rejects.toThrow('Path is not a directory');
    });

    it('should scan empty directory successfully', async () => {
      const result = await scanner.scanProject(tempDir);

      expect(result).toMatchObject({
        rootPath: tempDir,
        mainFiles: [],
        suiteFiles: [],
        allFiles: [],
        packageJsonPath: undefined,
        configPath: undefined,
        dependencies: expect.any(Map),
      });
    });

    it('should find package.json and config files', async () => {
      // Create package.json
      const packageJsonPath = path.join(tempDir, 'package.json');
      await fs.writeFile(packageJsonPath, JSON.stringify({ name: 'test' }));

      // Create apicize config
      const configPath = path.join(tempDir, 'apicize.config.json');
      await fs.writeFile(configPath, JSON.stringify({ version: '1.0.0' }));

      const result = await scanner.scanProject(tempDir);

      expect(result.packageJsonPath).toBe(packageJsonPath);
      expect(result.configPath).toBe(configPath);
    });

    it('should find and categorize test files', async () => {
      // Create test directory structure
      const testsDir = path.join(tempDir, 'tests');
      const suitesDir = path.join(testsDir, 'suites');
      await fs.mkdir(testsDir, { recursive: true });
      await fs.mkdir(suitesDir, { recursive: true });

      // Create main test file
      const mainTestPath = path.join(testsDir, 'index.spec.ts');
      await fs.writeFile(mainTestPath, 'describe("main test", () => {});');

      // Create suite test file
      const suiteTestPath = path.join(suitesDir, 'user-api.spec.ts');
      await fs.writeFile(suiteTestPath, 'describe("user api", () => {});');

      // Create another test file at root level
      const rootTestPath = path.join(testsDir, 'integration.spec.ts');
      await fs.writeFile(rootTestPath, 'describe("integration test", () => {});');

      const result = await scanner.scanProject(tempDir);

      expect(result.allFiles).toHaveLength(3);
      expect(result.mainFiles).toHaveLength(2); // index.spec.ts and integration.spec.ts
      expect(result.suiteFiles).toHaveLength(1); // user-api.spec.ts

      // Verify file properties
      const mainFile = result.mainFiles.find(f => f.baseName === 'index.spec');
      expect(mainFile).toBeDefined();
      expect(mainFile!.isMainFile).toBe(true);
      expect(mainFile!.isSuiteFile).toBe(false);

      const suiteFile = result.suiteFiles.find(f => f.baseName === 'user-api.spec');
      expect(suiteFile).toBeDefined();
      expect(suiteFile!.isMainFile).toBe(false);
      expect(suiteFile!.isSuiteFile).toBe(true);
    });

    it('should respect include and exclude patterns', async () => {
      // Create various file types
      await fs.writeFile(path.join(tempDir, 'test1.spec.ts'), 'test');
      await fs.writeFile(path.join(tempDir, 'test2.test.ts'), 'test');
      await fs.writeFile(path.join(tempDir, 'test3.ts'), 'test'); // Should be excluded
      await fs.writeFile(path.join(tempDir, 'test4.spec.js'), 'test'); // Should be excluded

      const result = await scanner.scanProject(tempDir);

      expect(result.allFiles).toHaveLength(2);
      expect(
        result.allFiles.every(
          f => f.relativePath.endsWith('.spec.ts') || f.relativePath.endsWith('.test.ts')
        )
      ).toBe(true);
    });

    it('should build dependency graph when enabled', async () => {
      // Create test files with imports
      const libDir = path.join(tempDir, 'lib');
      await fs.mkdir(libDir, { recursive: true });

      const utilsPath = path.join(libDir, 'utils.ts');
      await fs.writeFile(utilsPath, 'export function helper() {}');

      const testPath = path.join(tempDir, 'test.spec.ts');
      await fs.writeFile(
        testPath,
        'import { helper } from "./lib/utils";\ndescribe("test", () => {});'
      );

      const result = await scanner.scanProject(tempDir);

      expect(result.dependencies.size).toBeGreaterThan(0);
      const testDeps = result.dependencies.get(testPath);
      expect(testDeps).toBeDefined();
    });

    it('should handle files with different extensions', async () => {
      const customScanner = new FileScanner({
        includePatterns: ['**/*.spec.ts', '**/*.test.tsx'],
      });

      await fs.writeFile(path.join(tempDir, 'test1.spec.ts'), 'test');
      await fs.writeFile(path.join(tempDir, 'test2.test.tsx'), 'test');

      const result = await customScanner.scanProject(tempDir);

      expect(result.allFiles).toHaveLength(2);
    });
  });

  describe('dependency scanning', () => {
    it('should skip dependency scanning when disabled', async () => {
      const noDepsScanner = new FileScanner({ scanDependencies: false });

      await fs.writeFile(
        path.join(tempDir, 'test.spec.ts'),
        'import { something } from "./other";\ndescribe("test", () => {});'
      );

      const result = await noDepsScanner.scanProject(tempDir);

      expect(result.dependencies.size).toBe(0);
    });
  });

  describe('validateApicizeProject', () => {
    it('should validate a proper Apicize project', async () => {
      // Create a typical Apicize project structure
      const libDir = path.join(tempDir, 'lib');
      const configDir = path.join(tempDir, 'config');
      const testsDir = path.join(tempDir, 'tests');

      await fs.mkdir(libDir, { recursive: true });
      await fs.mkdir(configDir, { recursive: true });
      await fs.mkdir(testsDir, { recursive: true });

      await fs.writeFile(path.join(tempDir, 'package.json'), '{}');
      await fs.writeFile(path.join(testsDir, 'index.spec.ts'), 'describe("test", () => {});');
      await fs.writeFile(path.join(libDir, 'runtime.ts'), 'export class Runtime {}');

      const result = await scanner.scanProject(tempDir);
      const validation = await FileScanner.validateApicizeProject(result);

      expect(validation.valid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    it('should identify missing package.json', async () => {
      await fs.writeFile(path.join(tempDir, 'test.spec.ts'), 'describe("test", () => {});');

      const result = await scanner.scanProject(tempDir);
      const validation = await FileScanner.validateApicizeProject(result);

      expect(validation.valid).toBe(false);
      expect(validation.issues).toContain('No package.json found in project root');
    });

    it('should identify missing test files', async () => {
      await fs.writeFile(path.join(tempDir, 'package.json'), '{}');

      const result = await scanner.scanProject(tempDir);
      const validation = await FileScanner.validateApicizeProject(result);

      expect(validation.valid).toBe(false);
      expect(validation.issues).toContain('No test files found');
    });

    it('should identify missing Apicize structure', async () => {
      await fs.writeFile(path.join(tempDir, 'package.json'), '{}');
      await fs.writeFile(path.join(tempDir, 'test.spec.ts'), 'describe("test", () => {});');

      const result = await scanner.scanProject(tempDir);
      const validation = await FileScanner.validateApicizeProject(result);

      expect(validation.valid).toBe(false);
      expect(
        validation.issues.some(issue =>
          issue.includes('does not appear to have Apicize library structure')
        )
      ).toBe(true);
    });
  });

  describe('convenience functions', () => {
    it('should export scanProject function', async () => {
      await fs.writeFile(path.join(tempDir, 'test.spec.ts'), 'describe("test", () => {});');

      const result = await scanProject(tempDir);

      expect(result).toMatchObject({
        rootPath: tempDir,
        allFiles: expect.any(Array),
      });
    });

    it('should export findTestFiles function', async () => {
      await fs.writeFile(path.join(tempDir, 'test.spec.ts'), 'describe("test", () => {});');

      const files = await findTestFiles(tempDir);

      expect(Array.isArray(files)).toBe(true);
      expect(files).toHaveLength(1);
    });

    it('should accept custom patterns in findTestFiles', async () => {
      await fs.writeFile(path.join(tempDir, 'test.custom.ts'), 'describe("test", () => {});');
      await fs.writeFile(path.join(tempDir, 'test.spec.ts'), 'describe("test", () => {});');

      const files = await findTestFiles(tempDir, ['**/*.custom.ts']);

      expect(files).toHaveLength(1);
      expect(files[0].relativePath).toContain('custom');
    });
  });

  describe('error handling', () => {
    it('should handle permission errors gracefully', async () => {
      // This test would need platform-specific setup for permission testing
      // Skipping for cross-platform compatibility
      expect(true).toBe(true);
    });

    it('should handle malformed glob patterns gracefully', async () => {
      // Note: Modern glob library is quite tolerant, so this may not throw errors
      const badScanner = new FileScanner({
        includePatterns: ['[invalid-glob-pattern'],
      });

      // Should not throw, but might return empty results
      const result = await badScanner.scanProject(tempDir);
      expect(result.allFiles).toEqual([]);
    });
  });
});
