// Example .apicize files for testing and development
import * as path from 'path';
import * as fs from 'fs';

export interface ExampleFile {
  name: string;
  path: string;
  description: string;
  category: 'workbook' | 'data' | 'test-case';
  valid: boolean; // Whether this file should pass validation
}

/**
 * Registry of all example files
 */
export const EXAMPLES: ExampleFile[] = [
  // Workbooks
  {
    name: 'demo.apicize',
    path: '../workbooks/demo.apicize',
    description: 'Official demo file from the Apicize application',
    category: 'workbook',
    valid: true
  },
  {
    name: 'minimal.apicize',
    path: '../workbooks/minimal.apicize',
    description: 'Minimal valid .apicize file (version only)',
    category: 'workbook',
    valid: true
  },
  {
    name: 'simple-rest-api.apicize',
    path: '../workbooks/simple-rest-api.apicize',
    description: 'Basic REST API testing with GET and POST requests',
    category: 'workbook',
    valid: true
  },
  {
    name: 'with-authentication.apicize',
    path: '../workbooks/with-authentication.apicize',
    description: 'Examples of different authentication methods',
    category: 'workbook',
    valid: true
  },
  {
    name: 'request-groups.apicize',
    path: '../workbooks/request-groups.apicize',
    description: 'Demonstrates hierarchical request organization',
    category: 'workbook',
    valid: true
  },

  // Data files
  {
    name: 'demo-test.json',
    path: '../data/demo-test.json',
    description: 'JSON data file from the original demo',
    category: 'data',
    valid: true
  },
  {
    name: 'demo-test.csv',
    path: '../data/demo-test.csv',
    description: 'CSV data file from the original demo',
    category: 'data',
    valid: true
  },
  {
    name: 'users.json',
    path: '../data/users.json',
    description: 'Sample user data for testing',
    category: 'data',
    valid: true
  },
  {
    name: 'test-scenarios.csv',
    path: '../data/test-scenarios.csv',
    description: 'Environment configuration scenarios',
    category: 'data',
    valid: true
  },

  // Test cases
  {
    name: 'valid-all-body-types.apicize',
    path: '../test-cases/valid-all-body-types.apicize',
    description: 'Demonstrates all supported request body types',
    category: 'test-case',
    valid: true
  },
  {
    name: 'invalid-missing-version.apicize',
    path: '../test-cases/invalid-missing-version.apicize',
    description: 'Missing required version field (for validation testing)',
    category: 'test-case',
    valid: false
  },
  {
    name: 'invalid-wrong-method.apicize',
    path: '../test-cases/invalid-wrong-method.apicize',
    description: 'Invalid HTTP method (for validation testing)',
    category: 'test-case',
    valid: false
  }
];

/**
 * Get all examples of a specific category
 */
export function getExamplesByCategory(category: ExampleFile['category']): ExampleFile[] {
  return EXAMPLES.filter(example => example.category === category);
}

/**
 * Get all valid examples (should pass validation)
 */
export function getValidExamples(): ExampleFile[] {
  return EXAMPLES.filter(example => example.valid);
}

/**
 * Get all invalid examples (should fail validation)
 */
export function getInvalidExamples(): ExampleFile[] {
  return EXAMPLES.filter(example => !example.valid);
}

/**
 * Get example by name
 */
export function getExample(name: string): ExampleFile | undefined {
  return EXAMPLES.find(example => example.name === name);
}

/**
 * Load example file content
 */
export function loadExampleContent(example: ExampleFile): string {
  const filePath = path.resolve(__dirname, example.path);
  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * Load and parse example .apicize file as JSON
 */
export function loadExampleAsJson(example: ExampleFile): any {
  if (!example.name.endsWith('.apicize')) {
    throw new Error(`Example ${example.name} is not an .apicize file`);
  }
  const content = loadExampleContent(example);
  return JSON.parse(content);
}

/**
 * Get absolute path to example file
 */
export function getExamplePath(example: ExampleFile): string {
  return path.resolve(__dirname, example.path);
}

// Convenience exports for commonly used examples
export const DEMO_APICIZE = getExample('demo.apicize')!;
export const MINIMAL_APICIZE = getExample('minimal.apicize')!;
export const SIMPLE_REST_API = getExample('simple-rest-api.apicize')!;

// Category collections
export const WORKBOOK_EXAMPLES = getExamplesByCategory('workbook');
export const DATA_EXAMPLES = getExamplesByCategory('data');
export const TEST_CASE_EXAMPLES = getExamplesByCategory('test-case');
export const VALID_EXAMPLES = getValidExamples();
export const INVALID_EXAMPLES = getInvalidExamples();