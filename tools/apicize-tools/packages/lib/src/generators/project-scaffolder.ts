import { ApicizeWorkbook } from '../types';
import { TestGenerator, GeneratedFile } from './test-generator';

export interface ProjectScaffolderOptions {
    outputDir?: string;
    projectName?: string;
    includeExampleData?: boolean;
    includeEnvConfig?: boolean;
    packageManager?: 'npm' | 'yarn' | 'pnpm';
    typescript?: boolean;
    strict?: boolean;
}

export interface ScaffoldedProject {
    files: GeneratedFile[];
    metadata: {
        projectName: string;
        outputDir: string;
        totalFiles: number;
        folders: string[];
        scripts: string[];
    };
}

/**
 * Generates complete test project structure with all necessary scaffolding files.
 *
 * Creates a comprehensive TypeScript test project following the structure outlined
 * in CLAUDE.md, including lib/, config/, tests/, data/, and scripts/ folders.
 */
export class ProjectScaffolder {
    private testGenerator: TestGenerator;

    constructor() {
        this.testGenerator = new TestGenerator();
    }

    /**
     * Generate a complete scaffolded test project from an .apicize workbook
     */
    public scaffoldProject(
        workbook: ApicizeWorkbook,
        sourceFileName: string = 'workbook.apicize',
        options: ProjectScaffolderOptions = {}
    ): ScaffoldedProject {
        const opts = this.mergeOptions(options);
        const files: GeneratedFile[] = [];
        const folders: string[] = [];
        const scripts: string[] = [];

        // Generate test files using TestGenerator
        const testResult = this.testGenerator.generateTestProject(workbook, sourceFileName, {
            outputDir: 'tests',
            includeMetadata: true,
            splitByGroup: true,
            generateHelpers: false, // We'll generate our own comprehensive helpers
            indent: '    '
        });

        // Add test files
        files.push(...testResult.files);

        // Generate main project structure
        this.generateProjectStructure(files, folders, opts);

        // Generate library files
        this.generateLibraryFiles(files, folders, opts);

        // Generate configuration files
        this.generateConfigurationFiles(files, folders, workbook, opts);

        // Generate package management files
        this.generatePackageFiles(files, opts);

        // Generate utility scripts
        this.generateScripts(files, scripts, opts);

        // Generate example data if requested
        if (opts.includeExampleData) {
            this.generateExampleData(files, folders);
        }

        return {
            files,
            metadata: {
                projectName: opts.projectName,
                outputDir: opts.outputDir,
                totalFiles: files.length,
                folders,
                scripts
            }
        };
    }

    /**
     * Generate the main project folder structure
     */
    private generateProjectStructure(
        files: GeneratedFile[],
        folders: string[],
        _options: ProjectScaffolderOptions
    ): void {
        // Main project folders
        const mainFolders = [
            'lib',
            'lib/runtime',
            'lib/testing',
            'lib/data',
            'lib/auth',
            'lib/output',
            'lib/import-export',
            'config',
            'config/environments',
            'config/auth',
            'config/endpoints',
            'config/scenarios',
            'config/data-sources',
            'tests',
            'data',
            'data/csv',
            'data/json',
            'data/schemas',
            'reports',
            'reports/results',
            'reports/coverage',
            'reports/apicize',
            'scripts'
        ];

        folders.push(...mainFolders);

        // Generate .gitignore
        files.push({
            path: '.gitignore',
            content: this.generateGitignore(),
            type: 'config'
        });

        // Generate README.md
        files.push({
            path: 'README.md',
            content: this.generateReadme(_options),
            type: 'config'
        });
    }

    /**
     * Generate library files
     */
    private generateLibraryFiles(
        files: GeneratedFile[],
        _folders: string[],
        _options: ProjectScaffolderOptions
    ): void {
        // Main library index
        files.push({
            path: 'lib/index.ts',
            content: this.generateLibraryIndex(),
            type: 'config'
        });

        // Runtime files
        files.push({
            path: 'lib/runtime/index.ts',
            content: this.generateRuntimeIndex(),
            type: 'config'
        });

        files.push({
            path: 'lib/runtime/types.ts',
            content: this.generateRuntimeTypes(),
            type: 'config'
        });

        files.push({
            path: 'lib/runtime/context.ts',
            content: this.generateRuntimeContext(),
            type: 'config'
        });

        files.push({
            path: 'lib/runtime/client.ts',
            content: this.generateRuntimeClient(),
            type: 'config'
        });

        // Testing utilities
        files.push({
            path: 'lib/testing/index.ts',
            content: this.generateTestingIndex(),
            type: 'config'
        });

        files.push({
            path: 'lib/testing/helpers.ts',
            content: this.generateTestingHelpers(),
            type: 'config'
        });

        files.push({
            path: 'lib/testing/assertions.ts',
            content: this.generateTestingAssertions(),
            type: 'config'
        });

        // Auth system
        files.push({
            path: 'lib/auth/index.ts',
            content: this.generateAuthIndex(),
            type: 'config'
        });

        files.push({
            path: 'lib/auth/manager.ts',
            content: this.generateAuthManager(),
            type: 'config'
        });

        // Data handling
        files.push({
            path: 'lib/data/index.ts',
            content: this.generateDataIndex(),
            type: 'config'
        });

        files.push({
            path: 'lib/data/loader.ts',
            content: this.generateDataLoader(),
            type: 'config'
        });

        // Output management
        files.push({
            path: 'lib/output/index.ts',
            content: this.generateOutputIndex(),
            type: 'config'
        });

        files.push({
            path: 'lib/output/collector.ts',
            content: this.generateOutputCollector(),
            type: 'config'
        });
    }

    /**
     * Generate configuration files
     */
    private generateConfigurationFiles(
        files: GeneratedFile[],
        _folders: string[],
        workbook: ApicizeWorkbook,
        options: ProjectScaffolderOptions
    ): void {
        // Main apicize configuration
        files.push({
            path: 'apicize.config.json',
            content: this.generateApicizeConfig(options),
            type: 'config'
        });

        // TypeScript configuration
        files.push({
            path: 'tsconfig.json',
            content: this.generateTsConfig(options),
            type: 'config'
        });

        // Mocha configuration
        files.push({
            path: '.mocharc.json',
            content: this.generateMochaConfig(),
            type: 'config'
        });

        // Environment configurations
        files.push({
            path: 'config/environments/default.json',
            content: this.generateEnvironmentConfig('default'),
            type: 'config'
        });

        files.push({
            path: 'config/environments/development.json',
            content: this.generateEnvironmentConfig('development'),
            type: 'config'
        });

        files.push({
            path: 'config/environments/staging.json',
            content: this.generateEnvironmentConfig('staging'),
            type: 'config'
        });

        files.push({
            path: 'config/environments/production.json',
            content: this.generateEnvironmentConfig('production'),
            type: 'config'
        });

        // Auth configuration
        files.push({
            path: 'config/auth/providers.json',
            content: this.generateAuthProviders(),
            type: 'config'
        });

        // Endpoint configuration
        files.push({
            path: 'config/endpoints/base-urls.json',
            content: this.generateEndpointConfig(),
            type: 'config'
        });

        // Scenario configuration based on workbook
        files.push({
            path: 'config/scenarios/default.json',
            content: this.generateScenarioConfig(workbook),
            type: 'config'
        });

        // Test settings
        files.push({
            path: 'config/test-settings.json',
            content: this.generateTestSettings(),
            type: 'config'
        });

        // Environment file template
        if (options.includeEnvConfig ?? true) {
            files.push({
                path: '.env.example',
                content: this.generateEnvExample(),
                type: 'config'
            });
        }
    }

    /**
     * Generate package.json and related package management files
     */
    private generatePackageFiles(
        files: GeneratedFile[],
        options: ProjectScaffolderOptions
    ): void {
        files.push({
            path: 'package.json',
            content: this.generatePackageJson(options),
            type: 'config'
        });

        // Package manager specific files
        if ((options.packageManager ?? 'npm') === 'yarn') {
            files.push({
                path: 'yarn.lock',
                content: '# Yarn lockfile - run yarn install to generate',
                type: 'config'
            });
        } else if ((options.packageManager ?? 'npm') === 'pnpm') {
            files.push({
                path: 'pnpm-lock.yaml',
                content: '# pnpm lockfile - run pnpm install to generate',
                type: 'config'
            });
        }
    }

    /**
     * Generate utility scripts
     */
    private generateScripts(
        files: GeneratedFile[],
        scripts: string[],
        options: ProjectScaffolderOptions
    ): void {
        const scriptExtension = (options.typescript ?? true) ? '.ts' : '.js';

        // Main runner script
        const useTypeScript = options.typescript ?? true;

        files.push({
            path: `scripts/run${scriptExtension}`,
            content: this.generateRunScript(useTypeScript),
            type: 'config'
        });
        scripts.push('run');

        // Import script
        files.push({
            path: `scripts/import${scriptExtension}`,
            content: this.generateImportScript(useTypeScript),
            type: 'config'
        });
        scripts.push('import');

        // Export script
        files.push({
            path: `scripts/export${scriptExtension}`,
            content: this.generateExportScript(useTypeScript),
            type: 'config'
        });
        scripts.push('export');

        // Validation script
        files.push({
            path: `scripts/validate${scriptExtension}`,
            content: this.generateValidateScript(useTypeScript),
            type: 'config'
        });
        scripts.push('validate');

        // Config manager script
        files.push({
            path: `scripts/config-manager${scriptExtension}`,
            content: this.generateConfigManagerScript(useTypeScript),
            type: 'config'
        });
        scripts.push('config-manager');
    }

    /**
     * Generate example data files
     */
    private generateExampleData(files: GeneratedFile[], _folders: string[]): void {
        // Example CSV data
        files.push({
            path: 'data/csv/users.csv',
            content: this.generateExampleCSV(),
            type: 'metadata'
        });

        // Example JSON data
        files.push({
            path: 'data/json/products.json',
            content: this.generateExampleJSON(),
            type: 'metadata'
        });

        // Example schema
        files.push({
            path: 'data/schemas/api-responses.json',
            content: this.generateExampleSchema(),
            type: 'metadata'
        });
    }

    // Content generation methods
    private generateGitignore(): string {
        return `# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
.pnpm-store/

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/
*.lcov

# nyc test coverage
.nyc_output

# Test results
reports/results/
reports/coverage/

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Credentials and secrets
config/auth/credentials.json
config/environments/local.json

# Build outputs
dist/
build/
*.tsbuildinfo

# Logs
logs
*.log

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Temporary files
tmp/
temp/
`;
    }

    private generateReadme(options: ProjectScaffolderOptions): string {
        return `# ${options.projectName}

API Test Suite generated from .apicize workbook

## Setup

\`\`\`bash
${options.packageManager || 'npm'} install
\`\`\`

## Running Tests

\`\`\`bash
# Run all tests
${options.packageManager || 'npm'} test

# Run with specific environment
${options.packageManager || 'npm'} run test:env staging

# Run with specific scenario
${options.packageManager || 'npm'} run test:scenario smoke-test

# Watch mode
${options.packageManager || 'npm'} run test:watch

# Debug mode
${options.packageManager || 'npm'} run test:debug
\`\`\`

## Configuration

- Environment settings: \`config/environments/\`
- Authentication: \`config/auth/\`
- Test scenarios: \`config/scenarios/\`
- Base URLs: \`config/endpoints/\`

## Project Structure

- \`lib/\` - Shared library code
- \`config/\` - Configuration files
- \`tests/\` - Generated test files
- \`data/\` - Test data files
- \`scripts/\` - Utility scripts
- \`reports/\` - Test reports

## Environment Variables

Copy \`.env.example\` to \`.env\` and configure your settings.

## Import/Export

\`\`\`bash
# Export back to .apicize
${options.packageManager || 'npm'} run import

# Validate structure
${options.packageManager || 'npm'} run validate
\`\`\`
`;
    }

    private generateLibraryIndex(): string {
        return `export * from './runtime';
export * from './testing';
export * from './data';
export * from './auth';
export * from './output';
`;
    }

    private generateRuntimeIndex(): string {
        return `export * from './types';
export * from './context';
export * from './client';
`;
    }

    private generateRuntimeTypes(): string {
        return `import { ApicizeWorkbook, ApicizeResponse, BodyType } from '@apicize/lib';

export interface ApicizeContext {
    $: Record<string, any>;
    execute(request: RequestConfig): Promise<ApicizeResponse>;
    substituteVariables(text: string): string;
    output(key: string, value: any): void;
}

export interface RequestConfig {
    url: string;
    method: string;
    headers?: Array<{ name: string; value: string }>;
    body?: any;
    queryStringParams?: Array<{ name: string; value: string }>;
    timeout?: number;
    auth?: string;
    service?: string;
    endpoint?: string;
}

export interface TestConfig {
    scenario?: string;
    environment?: string;
    auth?: string;
    timeout?: number;
}

export { ApicizeResponse, BodyType };
`;
    }

    private generateRuntimeContext(): string {
        return `import { ApicizeContext, RequestConfig } from './types';
import { ApicizeResponse } from '@apicize/lib';
import { ApicizeClient } from './client';

export class TestContext implements ApicizeContext {
    public $: Record<string, any> = {};

    constructor(
        private client: ApicizeClient,
        variables: Record<string, any> = {}
    ) {
        this.$ = { ...variables };
    }

    async execute(request: RequestConfig): Promise<ApicizeResponse> {
        return this.client.execute(request);
    }

    substituteVariables(text: string): string {
        return text.replace(/\\{\\{([^}]+)\\}\\}/g, (match, variable) => {
            const value = this.getNestedProperty(this.$, variable.trim());
            return value !== undefined ? String(value) : match;
        });
    }

    output(key: string, value: any): void {
        this.$[key] = value;
    }

    private getNestedProperty(obj: any, path: string): any {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }
}
`;
    }

    private generateRuntimeClient(): string {
        return `import { ApicizeResponse, BodyType } from '@apicize/lib';
import { RequestConfig } from './types';

export class ApicizeClient {
    constructor(
        private config: any,
        private auth: any
    ) {}

    async execute(request: RequestConfig): Promise<ApicizeResponse> {
        // This is a simplified implementation
        // In a full implementation, this would handle:
        // - Authentication
        // - Base URL resolution
        // - Variable substitution
        // - Request execution via HTTP client

        const response = await fetch(request.url, {
            method: request.method,
            headers: this.buildHeaders(request.headers),
            body: request.body ? JSON.stringify(request.body) : undefined
        });

        const text = await response.text();
        let bodyData: any = text;
        let bodyType = BodyType.Text;

        try {
            bodyData = JSON.parse(text);
            bodyType = BodyType.JSON;
        } catch {
            // Keep as text
        }

        return {
            status: response.status,
            statusText: response.statusText,
            headers: Array.from(response.headers.entries()).map(([name, value]) => ({ name, value })),
            body: {
                type: bodyType,
                data: bodyData
            }
        };
    }

    private buildHeaders(headers: Array<{ name: string; value: string }> = []): Record<string, string> {
        const headerMap: Record<string, string> = {};
        headers.forEach(({ name, value }) => {
            headerMap[name] = value;
        });
        return headerMap;
    }
}
`;
    }

    private generateTestingIndex(): string {
        return `export * from './helpers';
export * from './assertions';
`;
    }

    private generateTestingHelpers(): string {
        return `import { TestContext } from '../runtime/context';
import { ApicizeClient } from '../runtime/client';

export class TestHelper {
    async setupTest(testName: string): Promise<TestContext> {
        // Load configuration
        const config = this.loadConfig();
        const auth = await this.loadAuth();

        // Create client
        const client = new ApicizeClient(config, auth);

        // Load scenario variables
        const variables = this.loadVariables(testName);

        return new TestContext(client, variables);
    }

    private loadConfig(): any {
        // Load from config files
        return {};
    }

    private async loadAuth(): Promise<any> {
        // Load authentication configuration
        return {};
    }

    private loadVariables(testName: string): Record<string, any> {
        // Load scenario variables
        return {};
    }
}
`;
    }

    private generateTestingAssertions(): string {
        return `import { expect } from 'chai';
import { BodyType } from '@apicize/lib';

// Custom Chai assertions for Apicize tests
declare global {
    namespace Chai {
        interface Assertion {
            json(): Assertion;
            status(code: number): Assertion;
        }
    }
}

// Extend Chai with custom assertions
chai.use(function(chai, utils) {
    chai.Assertion.addMethod('json', function() {
        const response = utils.flag(this, 'object');
        expect(response.body.type).to.equal(BodyType.JSON);
        utils.flag(this, 'object', response.body.data);
    });

    chai.Assertion.addMethod('status', function(expectedStatus: number) {
        const response = utils.flag(this, 'object');
        expect(response.status).to.equal(expectedStatus);
    });
});
`;
    }

    private generateAuthIndex(): string {
        return `export * from './manager';
`;
    }

    private generateAuthManager(): string {
        return `export class AuthManager {
    async getHeaders(authType?: string): Promise<Record<string, string>> {
        if (!authType) return {};

        // Load auth configuration and generate headers
        // This would integrate with the auth providers configuration

        return {};
    }

    async authenticate(provider: string): Promise<string> {
        // Perform authentication flow based on provider type
        return 'mock-token';
    }
}
`;
    }

    private generateDataIndex(): string {
        return `export * from './loader';
`;
    }

    private generateDataLoader(): string {
        return `import * as fs from 'fs';
import * as path from 'path';

export class DataLoader {
    loadCSV(filePath: string): Record<string, any>[] {
        // CSV parsing implementation
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\\n').filter(line => line.trim());
        if (lines.length === 0) return [];

        const headers = lines[0].split(',').map(h => h.trim());
        return lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim());
            const row: Record<string, any> = {};
            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });
            return row;
        });
    }

    loadJSON(filePath: string): any {
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content);
    }
}
`;
    }

    private generateOutputIndex(): string {
        return `export * from './collector';
`;
    }

    private generateOutputCollector(): string {
        return `export class OutputCollector {
    private outputs: Map<string, any> = new Map();

    collect(key: string, value: any): void {
        this.outputs.set(key, value);
    }

    get(key: string): any {
        return this.outputs.get(key);
    }

    getAll(): Record<string, any> {
        return Object.fromEntries(this.outputs.entries());
    }

    clear(): void {
        this.outputs.clear();
    }
}
`;
    }

    private generateApicizeConfig(_options: ProjectScaffolderOptions): string {
        return JSON.stringify({
            version: "1.0.0",
            activeEnvironment: "development",
            libPath: "./lib",
            configPath: "./config",
            testsPath: "./tests",
            dataPath: "./data",
            reportsPath: "./reports",
            settings: {
                defaultTimeout: 30000,
                retryAttempts: 3,
                parallelExecution: false,
                verboseLogging: true,
                preserveMetadata: true
            },
            imports: {
                autoGenerateIds: true,
                validateOnImport: true,
                preserveComments: true
            },
            exports: {
                includeMetadata: true,
                generateHelpers: true,
                splitByGroup: true
            }
        }, null, 2);
    }

    private generateTsConfig(options: ProjectScaffolderOptions): string {
        return JSON.stringify({
            compilerOptions: {
                target: "ES2020",
                module: "commonjs",
                lib: ["ES2020"],
                outDir: "./dist",
                rootDir: "./",
                strict: options.strict ?? true,
                esModuleInterop: true,
                skipLibCheck: true,
                forceConsistentCasingInFileNames: true,
                declaration: true,
                declarationMap: true,
                sourceMap: true,
                resolveJsonModule: true,
                moduleResolution: "node",
                typeRoots: ["./node_modules/@types"],
                types: ["mocha", "chai", "node"]
            },
            include: [
                "lib/**/*",
                "tests/**/*",
                "scripts/**/*"
            ],
            exclude: [
                "node_modules",
                "dist",
                "reports"
            ],
            "ts-node": {
                files: true
            }
        }, null, 2);
    }

    private generateMochaConfig(): string {
        return JSON.stringify({
            require: ["ts-node/register"],
            extension: ["ts"],
            spec: "tests/**/*.spec.ts",
            timeout: 30000,
            recursive: true,
            reporter: "spec",
            exit: true
        }, null, 2);
    }

    private generateEnvironmentConfig(env: string): string {
        const configs = {
            default: {
                name: "default",
                baseUrls: {
                    api: "https://api.example.com",
                    auth: "https://auth.example.com",
                    cdn: "https://cdn.example.com"
                },
                headers: {
                    "X-Environment": "default"
                },
                timeouts: {
                    default: 30000,
                    long: 60000
                },
                features: {
                    debugMode: false,
                    mockResponses: false,
                    rateLimiting: true
                }
            },
            development: {
                name: "development",
                baseUrls: {
                    api: "http://localhost:3000",
                    auth: "http://localhost:4000",
                    cdn: "http://localhost:8080"
                },
                headers: {
                    "X-Environment": "dev",
                    "X-Debug": "true"
                },
                timeouts: {
                    default: 30000,
                    long: 60000
                },
                features: {
                    debugMode: true,
                    mockResponses: true,
                    rateLimiting: false
                }
            },
            staging: {
                name: "staging",
                baseUrls: {
                    api: "https://staging-api.example.com",
                    auth: "https://staging-auth.example.com",
                    cdn: "https://staging-cdn.example.com"
                },
                headers: {
                    "X-Environment": "staging"
                },
                timeouts: {
                    default: 30000,
                    long: 60000
                },
                features: {
                    debugMode: false,
                    mockResponses: false,
                    rateLimiting: true
                }
            },
            production: {
                name: "production",
                baseUrls: {
                    api: "https://api.example.com",
                    auth: "https://auth.example.com",
                    cdn: "https://cdn.example.com"
                },
                headers: {
                    "X-Environment": "production"
                },
                timeouts: {
                    default: 30000,
                    long: 60000
                },
                features: {
                    debugMode: false,
                    mockResponses: false,
                    rateLimiting: true
                }
            }
        };

        return JSON.stringify(configs[env as keyof typeof configs] || configs.default, null, 2);
    }

    private generateAuthProviders(): string {
        return JSON.stringify({
            providers: {
                "main-api": {
                    type: "OAuth2Client",
                    config: {
                        accessTokenUrl: "${env.AUTH_URL}/token",
                        clientId: "${env.CLIENT_ID}",
                        clientSecret: "${env.CLIENT_SECRET}",
                        scope: "api:read api:write",
                        audience: "https://api.example.com"
                    }
                },
                "basic-auth": {
                    type: "Basic",
                    config: {
                        username: "${env.BASIC_USERNAME}",
                        password: "${env.BASIC_PASSWORD}"
                    }
                },
                "api-key": {
                    type: "ApiKey",
                    config: {
                        header: "X-API-Key",
                        value: "${env.API_KEY}"
                    }
                }
            }
        }, null, 2);
    }

    private generateEndpointConfig(): string {
        return JSON.stringify({
            services: {
                users: {
                    base: "${baseUrls.api}/users",
                    endpoints: {
                        list: "/",
                        get: "/{id}",
                        create: "/",
                        update: "/{id}",
                        delete: "/{id}"
                    }
                },
                products: {
                    base: "${baseUrls.api}/products",
                    endpoints: {
                        list: "/",
                        search: "/search",
                        categories: "/categories"
                    }
                }
            }
        }, null, 2);
    }

    private generateScenarioConfig(workbook: ApicizeWorkbook): string {
        const variables: Record<string, any> = {};

        // Extract variables from workbook scenarios if available
        if (workbook.scenarios && workbook.scenarios.length > 0) {
            const defaultScenario = workbook.scenarios[0];
            if (defaultScenario.variables) {
                defaultScenario.variables.forEach(variable => {
                    variables[variable.name] = variable.value;
                });
            }
        }

        return JSON.stringify({
            name: "default",
            description: "Default test scenario",
            variables: {
                ...variables,
                baseUrl: "https://api.example.com",
                timeout: 30000,
                retries: 3
            }
        }, null, 2);
    }

    private generateTestSettings(): string {
        return JSON.stringify({
            timeout: 30000,
            retries: 3,
            parallel: false,
            bail: false,
            reporter: "spec",
            reporterOptions: {
                output: "./reports/results/test-results.json"
            },
            coverage: {
                enabled: false,
                directory: "./reports/coverage",
                reporters: ["text", "html", "lcov"]
            }
        }, null, 2);
    }

    private generateEnvExample(): string {
        return `# Authentication
AUTH_URL=https://auth.example.com
CLIENT_ID=your-client-id
CLIENT_SECRET=your-client-secret

# Basic Auth
BASIC_USERNAME=your-username
BASIC_PASSWORD=your-password

# API Key
API_KEY=your-api-key

# Environment
NODE_ENV=development
DEBUG=apicize:*

# Database (if needed)
DATABASE_URL=

# Other services
REDIS_URL=
`;
    }

    private generatePackageJson(options: ProjectScaffolderOptions): string {

        return JSON.stringify({
            name: options.projectName || 'apicize-tests',
            version: "1.0.0",
            private: true,
            description: "API tests generated from .apicize workbook",
            scripts: {
                test: "mocha",
                "test:watch": "mocha --watch",
                "test:debug": "mocha --inspect-brk",
                "test:scenario": "cross-env SCENARIO=$npm_config_scenario mocha",
                "test:env": "cross-env ENV=$npm_config_env mocha",
                "test:single": "mocha --grep",
                "test:report": "mocha --reporter mochawesome",
                "test:coverage": "nyc mocha",
                build: "tsc",
                "build:watch": "tsc --watch",
                import: "apicize import .",
                export: "apicize export",
                validate: "apicize validate",
                clean: "rimraf dist reports/results reports/coverage",
                "config:list": "node scripts/config-manager.js list",
                "config:set": "node scripts/config-manager.js set"
            },
            dependencies: {
                "@apicize/lib": "^1.0.0",
                dotenv: "^16.0.0"
            },
            devDependencies: {
                "@types/mocha": "^10.0.0",
                "@types/chai": "^4.3.0",
                "@types/node": "^20.0.0",
                mocha: "^10.0.0",
                chai: "^4.3.0",
                typescript: "^5.0.0",
                "ts-node": "^10.0.0",
                "cross-env": "^7.0.3",
                mochawesome: "^7.1.0",
                nyc: "^15.1.0",
                rimraf: "^5.0.0"
            },
            engines: {
                node: ">=14.0.0"
            }
        }, null, 2);
    }

    private generateRunScript(typescript: boolean): string {
        return `#!/usr/bin/env node
${typescript ? 'import * as fs from \'fs\';' : 'const fs = require(\'fs\');'}

// Test runner script
console.log('Running Apicize tests...');

// This would implement the actual test execution logic
// including environment setup, scenario loading, etc.
`;
    }

    private generateImportScript(typescript: boolean): string {
        return `#!/usr/bin/env node
${typescript ? 'import * as fs from \'fs\';' : 'const fs = require(\'fs\');'}

// Import script to convert TypeScript tests back to .apicize format
console.log('Importing tests back to .apicize format...');
`;
    }

    private generateExportScript(typescript: boolean): string {
        return `#!/usr/bin/env node
${typescript ? 'import * as fs from \'fs\';' : 'const fs = require(\'fs\');'}

// Export script to convert .apicize to TypeScript tests
console.log('Exporting .apicize to TypeScript tests...');
`;
    }

    private generateValidateScript(typescript: boolean): string {
        return `#!/usr/bin/env node
${typescript ? 'import * as fs from \'fs\';' : 'const fs = require(\'fs\');'}

// Validation script for .apicize files and test structure
console.log('Validating project structure...');
`;
    }

    private generateConfigManagerScript(typescript: boolean): string {
        return `#!/usr/bin/env node
${typescript ? 'import * as fs from \'fs\';' : 'const fs = require(\'fs\');'}

// Configuration management script
const command = process.argv[2];

switch (command) {
    case 'list':
        console.log('Listing configurations...');
        break;
    case 'set':
        console.log('Setting configuration...');
        break;
    default:
        console.log('Available commands: list, set');
}
`;
    }

    private generateExampleCSV(): string {
        return `username,password,expected_status,role
user1,pass123,200,user
admin,admin123,200,admin
guest,guest123,200,guest
invalid,wrong,401,none
`;
    }

    private generateExampleJSON(): string {
        return JSON.stringify({
            products: [
                {
                    id: 1,
                    name: "Product 1",
                    price: 29.99,
                    category: "electronics"
                },
                {
                    id: 2,
                    name: "Product 2",
                    price: 49.99,
                    category: "books"
                }
            ]
        }, null, 2);
    }

    private generateExampleSchema(): string {
        return JSON.stringify({
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "API Response Schema",
            "type": "object",
            "properties": {
                "status": {
                    "type": "integer",
                    "minimum": 200,
                    "maximum": 599
                },
                "data": {
                    "type": "object"
                },
                "message": {
                    "type": "string"
                }
            },
            "required": ["status"]
        }, null, 2);
    }

    private mergeOptions(options: ProjectScaffolderOptions): Required<ProjectScaffolderOptions> {
        return {
            outputDir: options.outputDir || './scaffolded-project',
            projectName: options.projectName || 'apicize-test-project',
            includeExampleData: options.includeExampleData ?? true,
            includeEnvConfig: options.includeEnvConfig ?? true,
            packageManager: options.packageManager || 'npm',
            typescript: options.typescript ?? true,
            strict: options.strict ?? true
        };
    }
}