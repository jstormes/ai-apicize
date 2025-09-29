# @apicize/lib

[![npm version](https://badge.fury.io/js/%40apicize%2Flib.svg)](https://badge.fury.io/js/%40apicize%2Flib)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue.svg)](https://www.typescriptlang.org/)
[![npm downloads](https://img.shields.io/npm/dm/@apicize/lib.svg)](https://www.npmjs.com/package/@apicize/lib)

Core library for Apicize tools - provides TypeScript types, utilities, and runtime support for API testing with `.apicize` files.

## 📦 Installation

```bash
npm install @apicize/lib
# or
yarn add @apicize/lib
# or
pnpm add @apicize/lib
```

## 🚀 Quick Start

```typescript
import {
    ApicizeFile,
    ApicizeRequest,
    BodyType,
    TestContext,
    RequestExecutor,
    VariableEngine
} from '@apicize/lib';

// Parse and validate .apicize files
const validator = new ApicizeValidator();
const result = await validator.validate('api-test.apicize');

// Execute requests with test context
const executor = new RequestExecutor();
const response = await executor.execute({
    url: 'https://api.example.com/users',
    method: 'GET',
    headers: { 'Authorization': 'Bearer token' }
});

// Use in generated tests
describe('API Test', () => {
    let response: ApicizeResponse;

    beforeEach(async () => {
        response = await context.execute(request);
    });

    it('should return success', () => {
        expect(response.status).to.equal(200);

        const data = (response.body.type === BodyType.JSON)
            ? response.body.data
            : expect.fail('Response not JSON');

        output('userId', data.id);
    });
});
```

## 📚 Core Components

### Types and Interfaces

```typescript
// Main file structure
interface ApicizeFile {
    version: number;
    requests: (ApicizeRequest | ApicizeRequestGroup)[];
    scenarios: ApicizeScenario[];
    authorizations: ApicizeAuthorization[];
    defaults: ApicizeDefaults;
}

// Request definition
interface ApicizeRequest {
    id: string;
    name: string;
    url: string;
    method: HttpMethod;
    test?: string;
    headers?: NameValuePair[];
    body?: ApicizeBody;
    queryStringParams?: NameValuePair[];
}

// Response structure
interface ApicizeResponse {
    status: number;
    headers: Record<string, string>;
    body: {
        type: BodyType;
        data: any;
    };
    timing: ResponseTiming;
}
```

### Validation

```typescript
import { ApicizeValidator, ValidationResult } from '@apicize/lib';

const validator = new ApicizeValidator();

// Validate single file
const result: ValidationResult = await validator.validate('test.apicize');
if (!result.valid) {
    console.error('Validation errors:', result.errors);
}

// Validate with options
const strictResult = await validator.validate('test.apicize', {
    strict: true,
    autoFix: true,
    schemaVersion: '1.0'
});
```

### Request Execution

```typescript
import { RequestExecutor, ExecutionOptions } from '@apicize/lib';

const executor = new RequestExecutor();

// Basic execution
const response = await executor.execute({
    url: 'https://api.example.com/users',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: {
        name: 'John Doe',
        email: 'john@example.com'
    }
});

// With options
const responseWithOptions = await executor.execute(request, {
    timeout: 30000,
    followRedirects: true,
    validateSSL: false,
    proxy: 'http://proxy.example.com:8080'
});
```

### Variable Substitution

```typescript
import { VariableEngine } from '@apicize/lib';

const engine = new VariableEngine();

// Set variables
engine.setVariables({
    baseUrl: 'https://api.example.com',
    apiKey: 'secret-key',
    userId: 123
});

// Substitute in strings
const url = engine.substitute('{{baseUrl}}/users/{{userId}}');
// Result: 'https://api.example.com/users/123'

// Substitute in objects
const body = engine.substituteObject({
    user: '{{userId}}',
    key: '{{apiKey}}'
});
```

### Test Context

```typescript
import { TestContext, TestHelper } from '@apicize/lib';

// In test setup
const helper = new TestHelper();
const context = await helper.setupTest('test-name', {
    scenario: 'production',
    variables: {
        baseUrl: 'https://api.example.com'
    }
});

// Access context in tests
const response = await context.execute(request);
const variables = context.$; // Access variables
context.output('key', 'value'); // Pass data to next test
```

### Authentication Handlers

```typescript
import {
    AuthManager,
    BasicAuth,
    OAuth2Client,
    ApiKeyAuth
} from '@apicize/lib';

const authManager = new AuthManager();

// Register auth providers
authManager.register('basic', new BasicAuth({
    username: 'user',
    password: 'pass'
}));

authManager.register('oauth', new OAuth2Client({
    accessTokenUrl: 'https://auth.example.com/token',
    clientId: 'client-id',
    clientSecret: 'client-secret'
}));

// Apply authentication to request
const headers = await authManager.applyAuth('oauth', request);
```

### Data Handling

```typescript
import {
    DataLoader,
    CsvParser,
    JsonParser
} from '@apicize/lib';

// Load CSV data
const csvLoader = new DataLoader();
const csvData = await csvLoader.loadCsv('data/users.csv');

// Load JSON data
const jsonData = await csvLoader.loadJson('data/config.json');

// Iterate data for tests
for (const row of csvData) {
    await runTestWithData(row);
}
```

## 🔧 Utilities

### Path Utilities

```typescript
import { PathUtils } from '@apicize/lib';

// Resolve paths
const absolutePath = PathUtils.resolve('./relative/path');

// Ensure directory exists
await PathUtils.ensureDir('./output/directory');

// Find project root
const projectRoot = PathUtils.findProjectRoot();
```

### String Utilities

```typescript
import { StringUtils } from '@apicize/lib';

// Generate IDs
const uuid = StringUtils.generateId();

// Sanitize filenames
const safeName = StringUtils.sanitizeFilename('my:file?.txt');

// Template processing
const result = StringUtils.processTemplate('Hello {{name}}', { name: 'World' });
```

### Validation Schemas

```typescript
import { Schemas } from '@apicize/lib';

// Get schema for validation
const requestSchema = Schemas.getRequestSchema();
const fileSchema = Schemas.getApicizeFileSchema();

// Custom validation
const isValid = Schemas.validate(data, requestSchema);
```

## 🎯 Error Handling

```typescript
import {
    ApicizeError,
    ValidationError,
    ExecutionError,
    ParseError
} from '@apicize/lib';

try {
    const result = await validator.validate(file);
} catch (error) {
    if (error instanceof ValidationError) {
        console.error('Validation failed:', error.errors);
    } else if (error instanceof ExecutionError) {
        console.error('Execution failed:', error.request, error.response);
    } else if (error instanceof ParseError) {
        console.error('Parse failed:', error.file, error.line);
    }
}
```

## 📊 Types Reference

### Body Types

```typescript
enum BodyType {
    None = 'None',
    Text = 'Text',
    JSON = 'JSON',
    XML = 'XML',
    Form = 'Form',
    Raw = 'Raw'
}
```

### HTTP Methods

```typescript
type HttpMethod =
    | 'GET'
    | 'POST'
    | 'PUT'
    | 'DELETE'
    | 'PATCH'
    | 'HEAD'
    | 'OPTIONS';
```

### Authorization Types

```typescript
type AuthorizationType =
    | 'Basic'
    | 'OAuth2Client'
    | 'OAuth2Pkce'
    | 'ApiKey';
```

## 🧪 Testing Support

The library provides comprehensive support for test generation:

```typescript
// Test runtime globals
declare global {
    var response: ApicizeResponse;
    var $: Record<string, any>;
    function output(key: string, value: any): void;
}

// In generated tests
it('should validate response', () => {
    expect(response.status).to.equal(200);

    const data = (response.body.type === BodyType.JSON)
        ? response.body.data
        : expect.fail('Expected JSON response');

    expect(data.id).to.exist;
    output('userId', data.id); // Available in next test as $.userId
});
```

## 📦 Exports

The library exports the following modules:

```typescript
// Main exports
export * from './types';
export * from './validation';
export * from './execution';
export * from './variables';
export * from './auth';
export * from './data';
export * from './utils';
export * from './errors';

// Test support
export * from './testing/context';
export * from './testing/helpers';
export * from './testing/assertions';
```

## 🔗 Integration

### With Mocha/Chai

```typescript
import { expect } from 'chai';
import { TestHelper, BodyType } from '@apicize/lib';

describe('API Tests', function() {
    const helper = new TestHelper();

    beforeEach(async function() {
        this.context = await helper.setupTest(this.currentTest.title);
    });

    it('should test API', async function() {
        const response = await this.context.execute(request);
        expect(response.status).to.equal(200);
    });
});
```

### With Jest

```typescript
import { TestHelper, BodyType } from '@apicize/lib';

describe('API Tests', () => {
    let context;

    beforeEach(async () => {
        const helper = new TestHelper();
        context = await helper.setupTest('test-name');
    });

    test('should test API', async () => {
        const response = await context.execute(request);
        expect(response.status).toBe(200);
    });
});
```

## 📄 License

MIT © Apicize Tools

## 🔗 Links

- [GitHub Repository](https://github.com/apicize/tools/tree/main/packages/lib)
- [npm Package](https://www.npmjs.com/package/@apicize/lib)
- [Main Tools Package](https://www.npmjs.com/package/@apicize/tools)
- [Documentation](https://github.com/apicize/tools/blob/main/docs/API-Reference.md)