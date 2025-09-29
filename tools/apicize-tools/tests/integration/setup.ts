/**
 * Integration test setup and utilities
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { tmpdir } from 'os';

export interface TestResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
}

export interface CLITestContext {
  tempDir: string;
  workbooksDir: string;
  toolsPath: string;
  examplesPath: string;
  cleanup: () => void;
}

/**
 * Setup test context with temporary directories and paths
 */
export function setupTestContext(): CLITestContext {
  const tempDir = fs.mkdtempSync(path.join(tmpdir(), 'apicize-integration-'));
  const projectRoot = path.resolve(__dirname, '../..');
  const workbooksDir = path.join(projectRoot, 'packages/examples/workbooks');
  const toolsPath = path.join(projectRoot, 'packages/tools');
  const examplesPath = path.join(projectRoot, 'packages/examples');

  return {
    tempDir,
    workbooksDir,
    toolsPath,
    examplesPath,
    cleanup: () => {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    }
  };
}

/**
 * Run CLI command and capture output
 */
export function runCLICommand(
  command: string,
  args: string[],
  options: {
    cwd?: string;
    timeout?: number;
    input?: string;
  } = {}
): Promise<TestResult> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const child = spawn(command, args, {
      cwd: options.cwd || process.cwd(),
      stdio: 'pipe',
      timeout: options.timeout || 30000
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    // Send input if provided
    if (options.input && child.stdin) {
      child.stdin.write(options.input);
      child.stdin.end();
    }

    child.on('close', (code) => {
      const duration = Date.now() - startTime;
      resolve({
        exitCode: code || 0,
        stdout,
        stderr,
        duration
      });
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Copy test file to temporary directory
 */
export function copyTestFile(sourcePath: string, targetDir: string, filename?: string): string {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const targetFilename = filename || path.basename(sourcePath);
  const targetPath = path.join(targetDir, targetFilename);
  fs.copyFileSync(sourcePath, targetPath);
  return targetPath;
}

/**
 * Check if directory contains expected files
 */
export function checkDirectoryContents(dirPath: string, expectedFiles: string[]): boolean {
  if (!fs.existsSync(dirPath)) {
    return false;
  }

  const actualFiles = fs.readdirSync(dirPath, { recursive: true })
    .map(f => f.toString())
    .filter(f => !f.includes('node_modules'));

  return expectedFiles.every(expected =>
    actualFiles.some(actual => actual.includes(expected))
  );
}

/**
 * Validate .apicize file structure
 */
export function validateApicizeStructure(filePath: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  try {
    if (!fs.existsSync(filePath)) {
      errors.push(`File does not exist: ${filePath}`);
      return { valid: false, errors };
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);

    // Check required top-level properties
    const requiredProps = ['version', 'requests', 'scenarios', 'authorizations', 'certificates', 'proxies', 'data'];
    requiredProps.forEach(prop => {
      if (!(prop in data)) {
        errors.push(`Missing required property: ${prop}`);
      }
    });

    // Check version
    if (data.version !== 1 && data.version !== 1.0) {
      errors.push(`Invalid version: ${data.version}`);
    }

    // Check arrays are arrays
    const arrayProps = ['requests', 'scenarios', 'authorizations', 'certificates', 'proxies', 'data'];
    arrayProps.forEach(prop => {
      if (data[prop] && !Array.isArray(data[prop])) {
        errors.push(`Property ${prop} must be an array`);
      }
    });

  } catch (error) {
    errors.push(`JSON parse error: ${error}`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate TypeScript project structure
 */
export function validateTypeScriptProject(projectPath: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  try {
    // Check package.json exists
    const packageJsonPath = path.join(projectPath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      errors.push('Missing package.json');
    } else {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

      // Check required dependencies
      const requiredDeps = ['@apicize/lib', 'mocha', 'chai'];
      requiredDeps.forEach(dep => {
        if (!packageJson.dependencies?.[dep] && !packageJson.devDependencies?.[dep]) {
          errors.push(`Missing dependency: ${dep}`);
        }
      });
    }

    // Check tsconfig.json exists
    if (!fs.existsSync(path.join(projectPath, 'tsconfig.json'))) {
      errors.push('Missing tsconfig.json');
    }

    // Check for test files
    const testFiles = fs.readdirSync(projectPath, { recursive: true })
      .filter(f => f.toString().endsWith('.spec.ts'));

    if (testFiles.length === 0) {
      errors.push('No test files found (.spec.ts)');
    }

  } catch (error) {
    errors.push(`Project validation error: ${error}`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Compare two JSON objects for round-trip testing
 */
export function compareApicizeFiles(original: string, imported: string): {
  identical: boolean;
  differences: string[];
  accuracy: number;
} {
  const differences: string[] = [];

  try {
    const originalData = JSON.parse(fs.readFileSync(original, 'utf8'));
    const importedData = JSON.parse(fs.readFileSync(imported, 'utf8'));

    const totalFields = countFields(originalData);
    const matchingFields = compareObjects(originalData, importedData, '', differences);
    const accuracy = totalFields > 0 ? (matchingFields / totalFields) * 100 : 0;

    return {
      identical: differences.length === 0,
      differences,
      accuracy
    };

  } catch (error) {
    differences.push(`Comparison error: ${error}`);
    return { identical: false, differences, accuracy: 0 };
  }
}

function countFields(obj: any, path = ''): number {
  if (typeof obj !== 'object' || obj === null) {
    return 1;
  }

  if (Array.isArray(obj)) {
    return obj.reduce((count, item, index) =>
      count + countFields(item, `${path}[${index}]`), 0);
  }

  return Object.keys(obj).reduce((count, key) =>
    count + countFields(obj[key], path ? `${path}.${key}` : key), 0);
}

function compareObjects(obj1: any, obj2: any, path: string, differences: string[]): number {
  if (typeof obj1 !== typeof obj2) {
    differences.push(`Type mismatch at ${path}: ${typeof obj1} vs ${typeof obj2}`);
    return 0;
  }

  if (obj1 === obj2) {
    return 1;
  }

  if (typeof obj1 !== 'object' || obj1 === null) {
    differences.push(`Value mismatch at ${path}: ${obj1} vs ${obj2}`);
    return 0;
  }

  if (Array.isArray(obj1) !== Array.isArray(obj2)) {
    differences.push(`Array type mismatch at ${path}`);
    return 0;
  }

  if (Array.isArray(obj1)) {
    if (obj1.length !== obj2.length) {
      differences.push(`Array length mismatch at ${path}: ${obj1.length} vs ${obj2.length}`);
    }

    let matches = 0;
    const minLength = Math.min(obj1.length, obj2.length);
    for (let i = 0; i < minLength; i++) {
      matches += compareObjects(obj1[i], obj2[i], `${path}[${i}]`, differences);
    }
    return matches;
  }

  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  keys1.forEach(key => {
    if (!(key in obj2)) {
      differences.push(`Missing key in imported: ${path}.${key}`);
    }
  });

  keys2.forEach(key => {
    if (!(key in obj1)) {
      differences.push(`Extra key in imported: ${path}.${key}`);
    }
  });

  let matches = 0;
  keys1.forEach(key => {
    if (key in obj2) {
      matches += compareObjects(obj1[key], obj2[key], path ? `${path}.${key}` : key, differences);
    }
  });

  return matches;
}