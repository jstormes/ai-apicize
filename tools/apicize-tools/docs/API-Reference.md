# Apicize API Reference

This document provides complete API reference for the Apicize libraries and tools.

## Table of Contents

- [@apicize/lib](#apicizelib)
- [@apicize/tools](#apicizetools)
- [Type Definitions](#type-definitions)
- [Core Classes](#core-classes)
- [Utility Functions](#utility-functions)
- [Error Handling](#error-handling)

## @apicize/lib

The core library providing all functionality for working with .apicize files.

### Installation

```bash
npm install @apicize/lib
```

### Basic Usage

```typescript
import {
  ExportPipeline,
  ImportPipeline,
  validateApicizeFile
} from '@apicize/lib';

// Export .apicize to TypeScript
const exporter = new ExportPipeline();
const result = await exporter.exportFromFile('demo.apicize', {
  outputDir: './tests'
});

// Import TypeScript back to .apicize
const importer = new ImportPipeline();
const importResult = await importer.importFromDirectory('./tests', {
  outputFile: 'imported.apicize'
});

// Validate .apicize file
const validation = validateApicizeFile(data);
if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
}
```

## Type Definitions

### ApicizeWorkbook

Main interface representing a complete .apicize file structure.

```typescript
interface ApicizeWorkbook {
  version: number;
  requests: (Request | RequestGroup)[];
  scenarios: Scenario[];
  authorizations: Authorization[];
  certificates: Certificate[];
  proxies: Proxy[];
  data: ExternalData[];
  defaults?: WorkbookDefaults;
}
```

### Request

Individual HTTP request configuration.

```typescript
interface Request {
  id: string;
  name: string;
  url: string;
  method: HttpMethod;
  test?: string;
  headers: NameValuePair[];
  body?: RequestBody;
  queryStringParams: NameValuePair[];
  timeout?: number;
  numberOfRedirects?: number;
  runs?: number;
  multiRunExecution?: ExecutionMode;
  keepAlive?: boolean;
  acceptInvalidCerts?: boolean;
  mode?: string;
  referrer?: string;
  referrerPolicy?: string;
  duplex?: string;
}
```

### RequestGroup

Container for organizing multiple requests.

```typescript
interface RequestGroup {
  id: string;
  name: string;
  children: (Request | RequestGroup)[];
  execution: ExecutionMode;
  runs?: number;
  multiRunExecution?: ExecutionMode;
  selectedScenario?: ScenarioReference;
  selectedData?: DataReference;
}
```

### RequestBody

HTTP request body configuration.

```typescript
interface RequestBody {
  type: BodyType;
  data?: any;
  formatted?: string;
}

enum BodyType {
  None = 'None',
  Text = 'Text',
  JSON = 'JSON',
  XML = 'XML',
  Form = 'Form',
  Raw = 'Raw'
}
```

### Scenario

Environment configuration with variables.

```typescript
interface Scenario {
  id: string;
  name: string;
  variables: Variable[];
}

interface Variable {
  name: string;
  value: string;
  type: VariableType;
  disabled?: boolean;
}

enum VariableType {
  TEXT = 'TEXT',
  JSON = 'JSON',
  FILE_JSON = 'FILE-JSON',
  FILE_CSV = 'FILE-CSV'
}
```

### Authorization

Authentication configuration.

```typescript
interface Authorization {
  id: string;
  name: string;
  type: AuthorizationType;
  [key: string]: any; // Type-specific properties
}

enum AuthorizationType {
  Basic = 'Basic',
  OAuth2Client = 'OAuth2Client',
  OAuth2Pkce = 'OAuth2Pkce',
  ApiKey = 'ApiKey'
}
```

### HttpMethod

Supported HTTP methods.

```typescript
enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  PATCH = 'PATCH',
  HEAD = 'HEAD',
  OPTIONS = 'OPTIONS'
}
```

### ExecutionMode

Request execution modes.

```typescript
enum ExecutionMode {
  SEQUENTIAL = 'SEQUENTIAL',
  CONCURRENT = 'CONCURRENT'
}
```

## Core Classes

### ExportPipeline

Exports .apicize files to TypeScript test projects.

```typescript
class ExportPipeline {
  /**
   * Export from .apicize file
   */
  async exportFromFile(
    filePath: string,
    options: ExportOptions
  ): Promise<ExportResult>;

  /**
   * Export from workbook data
   */
  async exportFromWorkbook(
    workbook: ApicizeWorkbook,
    options: ExportOptions
  ): Promise<ExportResult>;
}
```

#### ExportOptions

```typescript
interface ExportOptions {
  outputDir: string;
  scenario?: string;
  split?: boolean;
  overwrite?: boolean;
}
```

#### ExportResult

```typescript
interface ExportResult {
  success: boolean;
  filesCreated: string[];
  duration: number;
  errors?: string[];
}
```

### ImportPipeline

Imports TypeScript test projects back to .apicize format.

```typescript
class ImportPipeline {
  /**
   * Import from TypeScript project directory
   */
  async importFromDirectory(
    directory: string,
    options: ImportOptions
  ): Promise<ImportResult>;
}
```

#### ImportOptions

```typescript
interface ImportOptions {
  outputFile?: string;
  validate?: boolean;
}
```

#### ImportResult

```typescript
interface ImportResult {
  success: boolean;
  workbook: ApicizeWorkbook;
  accuracy: number;
  warnings: string[];
  errors?: string[];
}
```

### TestHelper

Runtime helper for exported TypeScript tests.

```typescript
class TestHelper {
  /**
   * Setup test context
   */
  async setupTest(testName: string): Promise<ApicizeContext>;

  /**
   * Execute HTTP request
   */
  async executeRequest(
    config: RequestConfig
  ): Promise<ApicizeResponse>;
}
```

#### ApicizeContext

Test execution context available in exported tests.

```typescript
interface ApicizeContext {
  $: Record<string, any>; // Variables and outputs
  output(key: string, value: any): void;
  substituteVariables(text: string): string;
  execute(config: RequestConfig): Promise<ApicizeResponse>;
}
```

#### ApicizeResponse

HTTP response object available in tests.

```typescript
interface ApicizeResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: ResponseBody;
  timing: ResponseTiming;
  redirects: Redirect[];
}

interface ResponseBody {
  type: BodyType;
  data: any;
  raw: Uint8Array;
}

interface ResponseTiming {
  start: number;
  end: number;
  duration: number;
}
```

### ConfigManager

Manages configuration files and variable substitution.

```typescript
class ConfigManager {
  /**
   * Load configuration from file
   */
  async loadConfig(configPath: string): Promise<ApicizeConfig>;

  /**
   * Get scenario configuration
   */
  getScenario(name: string): Scenario;

  /**
   * Get authentication configuration
   */
  getAuth(name: string): Authorization;

  /**
   * Substitute variables in text
   */
  substituteVariables(text: string, context: any): string;
}
```

### VariableEngine

Handles variable substitution with {{variable}} syntax.

```typescript
class VariableEngine {
  /**
   * Substitute variables in string
   */
  substitute(
    text: string,
    variables: Record<string, any>
  ): string;

  /**
   * Extract variable references from text
   */
  extractVariables(text: string): string[];

  /**
   * Validate all variables are defined
   */
  validateVariables(
    text: string,
    variables: Record<string, any>
  ): ValidationResult;
}
```

### ApicizeClient

HTTP client for executing requests.

```typescript
class ApicizeClient {
  /**
   * Execute HTTP request
   */
  async request(config: RequestConfig): Promise<ApicizeResponse>;

  /**
   * Set authentication
   */
  setAuth(auth: Authorization): void;

  /**
   * Set default headers
   */
  setHeaders(headers: Record<string, string>): void;
}
```

#### RequestConfig

```typescript
interface RequestConfig {
  url: string;
  method: HttpMethod;
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  auth?: string;
  service?: string;
  endpoint?: string;
}
```

## Utility Functions

### Validation

```typescript
/**
 * Validate .apicize file data against schema
 */
function validateApicizeFile(data: any): ValidationResult;

/**
 * Validate TypeScript project structure
 */
function validateTypeScriptProject(projectPath: string): ValidationResult;

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}
```

### File Operations

```typescript
/**
 * Parse .apicize file from JSON
 */
function parseApicizeFile(content: string): ApicizeWorkbook;

/**
 * Serialize workbook to JSON
 */
function serializeWorkbook(workbook: ApicizeWorkbook): string;

/**
 * Load workbook from file
 */
async function loadWorkbook(filePath: string): Promise<ApicizeWorkbook>;

/**
 * Save workbook to file
 */
async function saveWorkbook(
  workbook: ApicizeWorkbook,
  filePath: string
): Promise<void>;
```

### Metadata Operations

```typescript
/**
 * Extract metadata from TypeScript file
 */
function extractMetadata(fileContent: string): MetadataBlock[];

/**
 * Embed metadata in TypeScript file
 */
function embedMetadata(
  fileContent: string,
  metadata: any
): string;

interface MetadataBlock {
  type: string;
  data: any;
  location: {
    start: number;
    end: number;
  };
}
```

### Template Functions

```typescript
/**
 * Generate TypeScript test from request
 */
function generateTest(
  request: Request,
  context: TemplateContext
): string;

/**
 * Generate test project structure
 */
function generateProject(
  workbook: ApicizeWorkbook,
  options: ProjectOptions
): ProjectStructure;

interface TemplateContext {
  scenario?: Scenario;
  helpers: Record<string, Function>;
  imports: string[];
}
```

## Error Handling

### Exception Types

```typescript
class ApicizeError extends Error {
  code: string;
  details?: any;
}

class ValidationError extends ApicizeError {
  errors: string[];
}

class ExportError extends ApicizeError {
  file?: string;
  line?: number;
}

class ImportError extends ApicizeError {
  accuracy?: number;
  warnings?: string[];
}

class NetworkError extends ApicizeError {
  status?: number;
  response?: string;
}
```

### Error Codes

| Code | Description |
|------|-------------|
| `INVALID_FILE` | Invalid .apicize file format |
| `VALIDATION_FAILED` | Schema validation failed |
| `EXPORT_FAILED` | Export process failed |
| `IMPORT_FAILED` | Import process failed |
| `NETWORK_ERROR` | HTTP request failed |
| `AUTH_ERROR` | Authentication failed |
| `TEMPLATE_ERROR` | Template generation failed |
| `FILE_NOT_FOUND` | Required file not found |
| `PERMISSION_DENIED` | File permission error |

### Error Handling Examples

```typescript
try {
  const result = await exporter.exportFromFile('demo.apicize', options);
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Validation failed:', error.errors);
  } else if (error instanceof ExportError) {
    console.error('Export failed:', error.message);
    if (error.file) {
      console.error('File:', error.file, 'Line:', error.line);
    }
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## @apicize/tools

CLI tools package built on top of @apicize/lib.

### Installation

```bash
npm install -g @apicize/tools
```

### Programmatic Usage

```typescript
import {
  exportCommand,
  importCommand,
  validateCommand,
  createCommand,
  runCommand
} from '@apicize/tools';

// Use CLI commands programmatically
await exportCommand.action('demo.apicize', {
  output: './tests',
  scenario: 'Production'
});
```

### CLI Utilities

```typescript
import {
  createSpinner,
  validateInputFile,
  formatDuration,
  handleCliError
} from '@apicize/tools/utils';

// Create progress spinner
const spinner = createSpinner('Processing...');
spinner.start();

// Validate file
try {
  const validPath = validateInputFile('demo.apicize');
  console.log('Valid file:', validPath);
} catch (error) {
  handleCliError(error, spinner);
}

// Format duration
const formatted = formatDuration(1234); // "1.2s"
```

## Advanced Usage

### Custom Templates

```typescript
import { TemplateEngine } from '@apicize/lib';

const engine = new TemplateEngine();

// Register custom template
engine.registerTemplate('custom-api', {
  files: {
    'index.spec.ts': customIndexTemplate,
    'helpers.ts': customHelpersTemplate
  },
  variables: {
    testFramework: 'jest',
    assertionLibrary: 'expect'
  }
});

// Use custom template
await exporter.exportFromFile('demo.apicize', {
  outputDir: './tests',
  template: 'custom-api'
});
```

### Custom Authentication

```typescript
import { AuthManager } from '@apicize/lib';

class CustomAuthProvider {
  async getHeaders(config: any): Promise<Record<string, string>> {
    // Custom authentication logic
    const token = await this.getToken(config);
    return {
      'Authorization': `Custom ${token}`
    };
  }
}

// Register custom auth provider
AuthManager.register('custom', CustomAuthProvider);
```

### Plugin System

```typescript
import { ApicizePlugin } from '@apicize/lib';

class CustomPlugin implements ApicizePlugin {
  name = 'custom-plugin';
  version = '1.0.0';

  async beforeExport(workbook: ApicizeWorkbook): Promise<ApicizeWorkbook> {
    // Modify workbook before export
    return workbook;
  }

  async afterExport(result: ExportResult): Promise<ExportResult> {
    // Process export result
    return result;
  }
}

// Register plugin
await exporter.use(new CustomPlugin());
```

---

For more examples and tutorials, see the [CLI Guide](./CLI-Guide.md) and [Examples](./Examples.md) documentation.