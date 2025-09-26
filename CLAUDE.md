# Apicize Tool Development Documentation

## Project Overview

This project involves creating tools to work with `.apicize` files - JSON-based API testing files that contain embedded Mocha/Chai TypeScript tests. The tools will enable:
- **Export**: Convert .apicize files to executable TypeScript/Mocha/Chai test files
- **Import**: Convert TypeScript test files back to .apicize format
- **Create**: Generate new .apicize files from scratch
- **Execute**: Run the exported TypeScript tests directly with Mocha

### Goal
Enable seamless bidirectional conversion between Apicize's JSON format and executable TypeScript tests while maintaining complete data fidelity for round-trip operations.

## .apicize File Format Specification

### Top-Level Structure
```json
{
    "version": 1.0,
    "requests": [...],
    "scenarios": [...],
    "authorizations": [...],
    "certificates": [...],
    "proxies": [...],
    "data": [...],
    "defaults": {...}
}
```

### 1. Requests Section
Hierarchical tree structure containing requests and request groups.

#### Request Object
```typescript
{
    "id": "uuid-string",
    "name": "Request name",
    "url": "https://api.example.com/{{endpoint}}",
    "method": "GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS",
    "test": "// Mocha/Chai TypeScript test code as string",
    "headers": [
        {"name": "Content-Type", "value": "application/json"}
    ],
    "body": {
        "type": "None|Text|JSON|XML|Form|Raw",
        "data": "...",
        "formatted": "..." // Optional formatted version
    },
    "queryStringParams": [
        {"name": "param", "value": "value"}
    ],
    "timeout": 30000,
    "numberOfRedirects": 10,
    "runs": 1,
    "multiRunExecution": "SEQUENTIAL|CONCURRENT",
    "keepAlive": boolean,
    "acceptInvalidCerts": boolean,
    "mode": "cors|no-cors|same-origin",
    "referrer": string,
    "referrerPolicy": string,
    "duplex": string
}
```

#### Request Group Object
```typescript
{
    "id": "uuid-string",
    "name": "Group name",
    "children": [...], // Array of Request or RequestGroup objects
    "execution": "SEQUENTIAL|CONCURRENT",
    "runs": 1,
    "multiRunExecution": "SEQUENTIAL|CONCURRENT",
    "selectedScenario": {
        "id": "scenario-id",
        "name": "Scenario name"
    },
    "selectedData": {
        "id": "data-id",
        "name": "Data name"
    }
}
```

### 2. Test Code Structure
Tests are embedded as TypeScript strings using Mocha/Chai syntax:

```typescript
describe('Test Suite', () => {
    it('Test Case', () => {
        // Access response object
        expect(response.status).to.equal(200)

        // Type-safe body handling
        const data = (response.body.type == BodyType.JSON)
            ? response.body.data
            : expect.fail('Response body is not JSON')

        // Access scenario variables
        expect(data.field).to.equal($.variableName)

        // Pass data between tests
        output('key', value)

        // Console output
        console.info(`Message: ${data}`)
    })
})
```

#### Test Context Objects
- `response`: Contains status, body, headers from API response
- `$`: Object containing scenario variables
- `output(key, value)`: Function to pass data between tests
- `BodyType`: Enum for response body types (JSON, XML, Text, etc.)

### 3. Scenarios Section
Named sets of variables for different test environments:

```typescript
{
    "id": "uuid-string",
    "name": "Scenario name",
    "variables": [
        {
            "name": "variableName",
            "value": "value",
            "type": "TEXT|JSON|FILE-JSON|FILE-CSV",
            "disabled": boolean // optional
        }
    ]
}
```

### 4. External Data Section
References to external data files:

```typescript
{
    "id": "uuid-string",
    "name": "Data source name",
    "type": "JSON|FILE-JSON|FILE-CSV",
    "source": "./path/to/file.json|csv",
    "validation_errors": null
}
```

### 5. Authorization Section
Authentication configurations:

```typescript
{
    "id": "uuid-string",
    "name": "Auth name",
    "type": "Basic|OAuth2Client|OAuth2Pkce|ApiKey",
    // Type-specific fields...
}
```

#### Authorization Types:
- **Basic**: username, password
- **OAuth2Client**: accessTokenUrl, clientId, clientSecret, audience, scope
- **OAuth2Pkce**: authorizeUrl, accessTokenUrl, clientId, scope, audience
- **ApiKey**: header, value

### 6. Certificates & Proxies
Optional security and network configurations.

### 7. Defaults Section
Default selections for workspace:

```typescript
{
    "selectedAuthorization": {"id": "...", "name": "..."},
    "selectedCertificate": {"id": "...", "name": "..."},
    "selectedProxy": {"id": "...", "name": "..."},
    "selectedScenario": {"id": "...", "name": "..."}
}
```

## Variable Substitution

Variables use `{{variableName}}` syntax and can be used in:
- URLs
- Headers
- Request bodies
- Query parameters

Variable sources:
1. Scenario variables
2. External data files (JSON/CSV)
3. Output from previous tests
4. Environment variables

## Tool Development Requirements

### Export Tool (.apicize → TypeScript)

1. **File Structure**
   - Generate one test file per request group
   - Preserve hierarchical structure using describe blocks
   - Include metadata comments for reimport

2. **Metadata Format**
   ```typescript
   /* @apicize-metadata
   {
       "id": "...",
       "url": "...",
       "method": "...",
       // All non-test fields
   }
   @apicize-metadata-end */
   ```

3. **Helper Functions**
   - Variable substitution handler
   - Response type checking
   - Data passing between tests
   - External data loader

### Import Tool (TypeScript → .apicize)

1. **Parsing Requirements**
   - Extract metadata from comments
   - Parse Mocha/Chai test structure
   - Rebuild request hierarchy
   - Validate structure completeness

2. **Data Preservation**
   - Maintain all IDs
   - Preserve execution settings
   - Keep variable references
   - Retain authorization/proxy settings

### Create Tool (New .apicize)

1. **Generation Features**
   - UUID generation for IDs
   - Request builder API
   - Test scaffolding
   - Variable management

2. **Validation**
   - Schema validation
   - URL format checking
   - Test syntax validation
   - Variable reference checking

## TypeScript Test Execution

### Setup Requirements
```json
{
  "devDependencies": {
    "@types/mocha": "^10.0.0",
    "@types/chai": "^4.3.0",
    "mocha": "^10.0.0",
    "chai": "^4.3.0",
    "typescript": "^5.0.0",
    "ts-node": "^10.0.0"
  }
}
```

### Execution Context
Tests must have access to:
1. Response mock/actual object
2. Variable substitution system
3. Output collection mechanism
4. BodyType enum definition
5. External data loading

### Test Runner Integration
- Support for .mocharc.json configuration
- TypeScript compilation settings
- Test report generation
- Result mapping back to .apicize format

## Code Standards

### TypeScript Output
1. **Must be valid Mocha/Chai syntax**
2. **Include all necessary imports**
3. **Preserve original test logic exactly**
4. **Add type definitions for response objects**
5. **Handle async operations properly**

### Metadata Requirements
1. **Every converted element must include metadata**
2. **Metadata must be valid JSON**
3. **Comments must not interfere with test execution**
4. **Support incremental updates**

### Variable Handling
1. **Implement variable substitution before request execution**
2. **Support all variable types (text, JSON, CSV)**
3. **Handle missing variables gracefully**
4. **Maintain variable scope (scenario-level)**

## Test Scaffolding Folder Structure

### Exported Test Project Structure

```
exported-tests/
├── package.json                    # Node.js dependencies and scripts
├── tsconfig.json                   # TypeScript configuration
├── .mocharc.json                   # Mocha configuration
├── .env                            # Environment variables (optional)
├── .gitignore
├── apicize.config.json             # Main configuration file
│
├── lib/                            # Shared library code
│   ├── runtime/                    # Apicize runtime engine
│   │   ├── types.ts               # TypeScript type definitions
│   │   ├── context.ts             # Test execution context
│   │   ├── client.ts              # HTTP client wrapper
│   │   ├── request-executor.ts    # Request execution logic
│   │   ├── variable-engine.ts     # Variable substitution engine
│   │   ├── response-handler.ts    # Response processing
│   │   └── index.ts              # Main runtime exports
│   │
│   ├── testing/                    # Test utilities
│   │   ├── assertions.ts         # Custom Chai assertions
│   │   ├── matchers.ts           # Custom matchers
│   │   ├── hooks.ts              # Mocha hooks
│   │   └── helpers.ts            # Test helper functions
│   │
│   ├── data/                      # Data handling
│   │   ├── loader.ts             # CSV/JSON data file loader
│   │   ├── parser.ts             # Data parsing utilities
│   │   ├── iterator.ts           # Data iteration for tests
│   │   └── transformer.ts        # Data transformation utils
│   │
│   ├── auth/                      # Authentication handlers
│   │   ├── basic.ts              # Basic auth implementation
│   │   ├── oauth2-client.ts      # OAuth2 client flow
│   │   ├── oauth2-pkce.ts        # OAuth2 PKCE flow
│   │   ├── api-key.ts            # API key auth
│   │   ├── provider.ts           # Auth provider interface
│   │   └── manager.ts            # Auth management
│   │
│   ├── output/                    # Output management
│   │   ├── collector.ts          # Output collection
│   │   ├── reporter.ts           # Test reporting
│   │   ├── formatter.ts          # Output formatting
│   │   └── logger.ts             # Logging utilities
│   │
│   ├── import-export/             # Import/Export utilities
│   │   ├── exporter.ts           # .apicize to TypeScript
│   │   ├── importer.ts           # TypeScript to .apicize
│   │   ├── metadata-parser.ts    # Metadata handling
│   │   └── validator.ts          # Structure validation
│   │
│   └── index.ts                   # Main library exports
│
├── config/                         # Configuration files
│   ├── environments/               # Environment-specific configs
│   │   ├── default.json          # Default configuration
│   │   ├── development.json      # Development environment
│   │   ├── staging.json          # Staging environment
│   │   ├── production.json       # Production environment
│   │   └── local.json            # Local overrides (gitignored)
│   │
│   ├── auth/                      # Authentication configurations
│   │   ├── credentials.json      # Auth credentials (gitignored)
│   │   └── providers.json        # Auth provider settings
│   │
│   ├── endpoints/                 # API endpoint configurations
│   │   ├── base-urls.json        # Base URL mappings
│   │   ├── services.json         # Service definitions
│   │   └── routes.json           # Route configurations
│   │
│   ├── scenarios/                 # Test scenario variables
│   │   ├── default.json          # Default scenario
│   │   ├── smoke-test.json       # Smoke test variables
│   │   ├── regression.json       # Regression test variables
│   │   └── load-test.json        # Load test variables
│   │
│   ├── data-sources/              # External data configurations
│   │   ├── connections.json      # Data source connections
│   │   └── schemas.json          # Data schemas
│   │
│   └── test-settings.json        # Test execution settings
│
├── tests/                         # Generated test files
│   ├── [workbook-name]/          # One folder per .apicize file
│   │   ├── index.spec.ts         # Main test suite
│   │   ├── suites/              # Test suites (grouped)
│   │   │   ├── crud-operations.spec.ts
│   │   │   ├── authentication.spec.ts
│   │   │   └── data-validation.spec.ts
│   │   ├── metadata/            # Metadata for reimport
│   │   │   ├── workbook.json   # Original .apicize structure
│   │   │   ├── requests.json   # Request definitions
│   │   │   └── mappings.json   # Config mappings
│   │   └── fixtures/            # Test-specific data
│   │       ├── responses/       # Mock responses
│   │       └── payloads/        # Request payloads
│   └── ...
│
├── data/                         # Test data files
│   ├── csv/                     # CSV data files
│   │   └── users.csv
│   ├── json/                    # JSON data files
│   │   └── products.json
│   └── schemas/                 # Data validation schemas
│       └── api-responses.json
│
├── reports/                      # Test execution reports
│   ├── results/                 # Test results
│   ├── coverage/                # Code coverage
│   └── apicize/                # Apicize format reports
│
└── scripts/                     # Utility scripts
    ├── run.ts                   # Test runner
    ├── import.ts                # Import from .apicize
    ├── export.ts                # Export to TypeScript
    ├── validate.ts              # Validate structure
    └── config-manager.ts        # Config management
```

## Configuration Files

### Main Configuration (apicize.config.json)
```json
{
  "version": "1.0.0",
  "activeEnvironment": "development",
  "libPath": "./lib",
  "configPath": "./config",
  "testsPath": "./tests",
  "dataPath": "./data",
  "reportsPath": "./reports",
  "settings": {
    "defaultTimeout": 30000,
    "retryAttempts": 3,
    "parallelExecution": false,
    "verboseLogging": true,
    "preserveMetadata": true
  },
  "imports": {
    "autoGenerateIds": true,
    "validateOnImport": true,
    "preserveComments": true
  },
  "exports": {
    "includeMetadata": true,
    "generateHelpers": true,
    "splitByGroup": true
  }
}
```

### Environment Configuration (config/environments/development.json)
```json
{
  "name": "development",
  "baseUrls": {
    "api": "http://localhost:3000",
    "auth": "http://localhost:4000",
    "cdn": "http://localhost:8080"
  },
  "headers": {
    "X-Environment": "dev",
    "X-Debug": "true"
  },
  "timeouts": {
    "default": 30000,
    "long": 60000
  },
  "features": {
    "debugMode": true,
    "mockResponses": true,
    "rateLimiting": false
  }
}
```

### Authentication Configuration (config/auth/providers.json)
```json
{
  "providers": {
    "main-api": {
      "type": "OAuth2Client",
      "config": {
        "accessTokenUrl": "${env.AUTH_URL}/token",
        "clientId": "${env.CLIENT_ID}",
        "clientSecret": "${env.CLIENT_SECRET}",
        "scope": "api:read api:write",
        "audience": "https://api.example.com"
      }
    },
    "basic-auth": {
      "type": "Basic",
      "config": {
        "username": "${env.BASIC_USERNAME}",
        "password": "${env.BASIC_PASSWORD}"
      }
    },
    "api-key": {
      "type": "ApiKey",
      "config": {
        "header": "X-API-Key",
        "value": "${env.API_KEY}"
      }
    }
  }
}
```

### Endpoints Configuration (config/endpoints/base-urls.json)
```json
{
  "services": {
    "users": {
      "base": "${baseUrls.api}/users",
      "endpoints": {
        "list": "/",
        "get": "/{id}",
        "create": "/",
        "update": "/{id}",
        "delete": "/{id}"
      }
    },
    "products": {
      "base": "${baseUrls.api}/products",
      "endpoints": {
        "list": "/",
        "search": "/search",
        "categories": "/categories"
      }
    }
  }
}
```

## Test Scaffolding Details

### Export Scaffolding (.apicize → TypeScript)

#### File Structure Template
Each exported TypeScript file includes:

```typescript
// Auto-generated from [filename].apicize
import { describe, it, before, after } from 'mocha';
import { expect } from 'chai';
import { TestHelper, ApicizeContext, BodyType } from '../../../lib';

// Runtime Types
enum BodyType {
    None = 'None',
    Text = 'Text',
    JSON = 'JSON',
    XML = 'XML',
    Form = 'Form',
    Raw = 'Raw'
}

// Global context
declare const response: ApicizeResponse;
declare const $: Record<string, any>;
declare function output(key: string, value: any): void;

/* @apicize-file-metadata
{
    "version": 1.0,
    "source": "filename.apicize",
    "exportDate": "2024-01-01T00:00:00Z"
}
@apicize-file-metadata-end */
```

#### Request to Test Conversion
```typescript
describe('[Group Name]', () => {
    /* @apicize-request-metadata
    {
        "id": "uuid",
        "url": "https://api.example.com/{{endpoint}}",
        "method": "POST",
        "headers": [...],
        "body": {...},
        "timeout": 30000
    }
    @apicize-request-metadata-end */

    describe('[Request Name]', () => {
        it('should execute test', async () => {
            // Original test code from .apicize
        });
    });
});
```

### Create Tool Scaffolding Templates

#### Basic Test Template
```typescript
describe('New API Test', () => {
    it('should return successful response', () => {
        expect(response.status).to.equal(200);
    });
});
```

#### Common Test Patterns
```typescript
// Status Check
describe('status', () => {
    it('equals 200', () => {
        expect(response.status).to.equal(200);
    });
});

// JSON Response Validation
describe('response', () => {
    it('contains expected data', () => {
        const data = (response.body.type == BodyType.JSON)
            ? response.body.data
            : expect.fail('Response body is not JSON');

        expect(data.field).to.equal(expectedValue);
    });
});

// Capture Output
describe('capture data', () => {
    it('saves ID for next request', () => {
        const data = (response.body.type == BodyType.JSON)
            ? response.body.data
            : expect.fail('Response body is not JSON');

        output('savedId', data.id);
        console.info(`Saved ID: ${data.id}`);
    });
});
```

### Library Module Examples

#### Runtime Client (lib/runtime/client.ts)
```typescript
export class ApicizeClient {
    constructor(
        private config: ApicizeConfig,
        private auth: AuthManager,
        private variables: VariableEngine
    ) {}

    async execute(request: RequestConfig): Promise<ApicizeResponse> {
        // Resolve base URL from config
        const baseUrl = this.config.getBaseUrl(request.service);

        // Substitute variables
        const url = this.variables.substitute(
            `${baseUrl}${request.path}`
        );

        // Apply authentication
        const headers = await this.auth.getHeaders(request.auth);

        // Execute request
        return this.httpClient.request({
            url,
            headers,
            ...request
        });
    }
}
```

#### Test Helper (lib/testing/helpers.ts)
```typescript
export class TestHelper {
    private client: ApicizeClient;
    private config: ConfigManager;

    async setupTest(testName: string) {
        const scenario = this.config.getScenario(testName);
        const auth = await this.config.getAuth(testName);

        return {
            client: this.client,
            variables: scenario.variables,
            auth
        };
    }
}
```

### Generated Test Using Library
```typescript
import { describe, it, before } from 'mocha';
import { expect } from 'chai';
import { TestHelper, ApicizeContext, BodyType } from '../../../lib';

describe('CRUD Operations', function() {
    let context: ApicizeContext;

    before(async () => {
        const helper = new TestHelper();
        context = await helper.setupTest('crud-operations');
    });

    describe('Create quote', () => {
        it('should create successfully', async () => {
            const response = await context.execute({
                service: 'quotes',
                endpoint: 'create',
                method: 'POST',
                body: {
                    author: context.$.author,
                    quote: context.$.quote
                },
                auth: 'main-api'
            });

            expect(response.status).to.equal(200);

            const data = (response.body.type == BodyType.JSON)
                ? response.body.data
                : expect.fail('Response body is not JSON');

            context.output('id', data.id);
        });
    });
});
```

## Key Implementation Notes

1. **Round-trip Compatibility**: Every export→import cycle must produce identical .apicize files
2. **Test Preservation**: Test code must work identically in both Apicize and TypeScript environments
3. **Data Integrity**: All request configurations, variables, and settings must be preserved
4. **Error Handling**: Clear error messages for invalid files or failed conversions
5. **Performance**: Handle large .apicize files with many requests efficiently
6. **Extensibility**: Design for future format changes and new features

## CSV Data File Support

CSV files are supported for data-driven testing:
- Each row represents a test iteration
- Column headers become variable names
- Supports bulk testing with different data sets
- Enables parameterized test execution

Example CSV usage:
```csv
username,password,expected_status
user1,pass1,200
user2,wrong,401
admin,admin123,200
```

Variables accessed as: `{{username}}`, `{{password}}`, `{{expected_status}}`

## Architecture Benefits

### Library-Based Approach
1. **Centralized Configuration**
   - All URLs, authentication, and settings in config files
   - Environment-specific overrides
   - Secure credential management with .env support

2. **Reusable Library Code**
   - Common functionality shared across all tests
   - Consistent implementation patterns
   - Easy maintenance and updates

3. **Clean Separation of Concerns**
   - Library code separate from generated tests
   - Configuration isolated from implementation
   - Data files organized by type and purpose

4. **Security Features**
   - Sensitive values in environment variables or gitignored files
   - Token and credential abstraction
   - Environment isolation prevents cross-environment data leaks

5. **Flexibility & Extensibility**
   - Easy environment switching via config
   - Dynamic configuration loading
   - Extensible authentication system
   - Plugin architecture for custom handlers

6. **Maintainability**
   - Single source of truth for configurations
   - Modular library components
   - Clear folder organization
   - TypeScript type safety throughout

## Execution Modes

The scaffolded structure supports multiple execution modes:

1. **Full Test Suite**: `npm test`
2. **Single Workbook**: `npm test -- tests/demo`
3. **Single Group**: `npm test -- --grep "CRUD Operations"`
4. **Single Request**: `npm test -- --grep "Create quote"`
5. **With Scenario**: `npm run test:scenario production`
6. **With Data**: `npm run test:data ./data/test-set.csv`
7. **Debug Mode**: `npm run test:debug`
8. **Watch Mode**: `npm run test:watch`

## Package.json Scripts

```json
{
  "scripts": {
    "test": "mocha",
    "test:watch": "mocha --watch",
    "test:debug": "mocha --inspect-brk",
    "test:scenario": "cross-env SCENARIO=$1 mocha",
    "test:env": "cross-env ENV=$1 mocha",
    "test:single": "mocha --grep",
    "test:report": "mocha --reporter mochawesome",
    "test:coverage": "nyc mocha",
    "import": "ts-node scripts/import.ts",
    "export": "ts-node scripts/export.ts",
    "validate": "ts-node scripts/validate.ts",
    "config:check": "ts-node scripts/config-manager.ts check",
    "config:merge": "ts-node scripts/config-manager.ts merge"
  }
}
```

## Summary

The Apicize tools provide seamless conversion between the JSON-based .apicize format and executable TypeScript/Mocha/Chai tests while maintaining complete data fidelity. The library-based architecture with centralized configuration ensures maintainable, secure, and scalable test automation. All TypeScript output is directly executable with standard Mocha tooling, and all conversions support full round-trip compatibility.