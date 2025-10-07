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
      indent: '    ',
    });

    // Add test files
    files.push(...testResult.files);

    // Generate main project structure
    this.generateProjectStructure(files, folders, opts);

    // ❌ REMOVED: Don't generate library files (Phase 3 - Library-centric architecture)
    // All runtime code is now in @jstormes/apicize-lib npm package
    // this.generateLibraryFiles(files, folders, opts);

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
        scripts,
      },
    };
  }

  /**
   * Generate the main project folder structure
   */
  private generateProjectStructure(
    files: GeneratedFile[],
    folders: string[],
    options: ProjectScaffolderOptions
  ): void {
    // Main project folders (Phase 3: removed all lib/ folders)
    const mainFolders = [
      // ❌ Removed lib/ folders - all runtime code is in @jstormes/apicize-lib
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
      'scripts',
      'metadata', // ✅ Added for workbook.json storage
    ];

    folders.push(...mainFolders);

    // Generate .gitignore
    files.push({
      path: '.gitignore',
      content: this.generateGitignore(),
      type: 'config',
    });

    // Generate README.md
    files.push({
      path: 'README.md',
      content: this.generateReadme(options),
      type: 'config',
    });
  }

  // ❌ REMOVED: generateLibraryFiles() and all related methods
  // Phase 3: Library-centric architecture - all runtime code is in @jstormes/apicize-lib
  // No longer generating scaffolded lib/ directory

  /**
   * Generate configuration files
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
      type: 'config',
    });

    // TypeScript configuration
    files.push({
      path: 'tsconfig.json',
      content: this.generateTsConfig(options),
      type: 'config',
    });

    // Mocha configuration
    files.push({
      path: '.mocharc.json',
      content: this.generateMochaConfig(),
      type: 'config',
    });

    // Environment configurations
    files.push({
      path: 'config/environments/default.json',
      content: this.generateEnvironmentConfig('default'),
      type: 'config',
    });

    files.push({
      path: 'config/environments/development.json',
      content: this.generateEnvironmentConfig('development'),
      type: 'config',
    });

    files.push({
      path: 'config/environments/staging.json',
      content: this.generateEnvironmentConfig('staging'),
      type: 'config',
    });

    files.push({
      path: 'config/environments/production.json',
      content: this.generateEnvironmentConfig('production'),
      type: 'config',
    });

    // Auth configuration
    files.push({
      path: 'config/auth/providers.json',
      content: this.generateAuthProviders(),
      type: 'config',
    });

    // Endpoint configuration
    files.push({
      path: 'config/endpoints/base-urls.json',
      content: this.generateEndpointConfig(),
      type: 'config',
    });

    // Scenario configuration based on workbook
    files.push({
      path: 'config/scenarios/default.json',
      content: this.generateScenarioConfig(workbook),
      type: 'config',
    });

    // Test settings
    files.push({
      path: 'config/test-settings.json',
      content: this.generateTestSettings(),
      type: 'config',
    });

    // Environment file template
    if (options.includeEnvConfig ?? true) {
      files.push({
        path: '.env.example',
        content: this.generateEnvExample(),
        type: 'config',
      });
    }
  }

  /**
   * Generate package.json and related package management files
   */
  private generatePackageFiles(files: GeneratedFile[], options: ProjectScaffolderOptions): void {
    files.push({
      path: 'package.json',
      content: this.generatePackageJson(options),
      type: 'config',
    });

    // Package manager specific files
    if ((options.packageManager ?? 'npm') === 'yarn') {
      files.push({
        path: 'yarn.lock',
        content: '# Yarn lockfile - run yarn install to generate',
        type: 'config',
      });
    } else if ((options.packageManager ?? 'npm') === 'pnpm') {
      files.push({
        path: 'pnpm-lock.yaml',
        content: '# pnpm lockfile - run pnpm install to generate',
        type: 'config',
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
      type: 'config',
    });
    scripts.push('run');

    // Import script
    files.push({
      path: `scripts/import${scriptExtension}`,
      content: this.generateImportScript(useTypeScript),
      type: 'config',
    });
    scripts.push('import');

    // Export script
    files.push({
      path: `scripts/export${scriptExtension}`,
      content: this.generateExportScript(useTypeScript),
      type: 'config',
    });
    scripts.push('export');

    // Validation script
    files.push({
      path: `scripts/validate${scriptExtension}`,
      content: this.generateValidateScript(useTypeScript),
      type: 'config',
    });
    scripts.push('validate');

    // Config manager script
    files.push({
      path: `scripts/config-manager${scriptExtension}`,
      content: this.generateConfigManagerScript(useTypeScript),
      type: 'config',
    });
    scripts.push('config-manager');
  }

  /**
   * Generate example data files
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private generateExampleData(files: GeneratedFile[], _folders: string[]): void {
    // Example CSV data
    files.push({
      path: 'data/csv/users.csv',
      content: this.generateExampleCSV(),
      type: 'metadata',
    });

    // Example JSON data
    files.push({
      path: 'data/json/products.json',
      content: this.generateExampleJSON(),
      type: 'metadata',
    });

    // Example schema
    files.push({
      path: 'data/schemas/api-responses.json',
      content: this.generateExampleSchema(),
      type: 'metadata',
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

- \`config/\` - Configuration files
- \`tests/\` - Generated test files
- \`data/\` - Test data files
- \`metadata/\` - Workbook metadata for round-trip conversion
- \`scripts/\` - Utility scripts
- \`reports/\` - Test reports

**Note**: All runtime code is provided by the \`@jstormes/apicize-lib\` npm package.

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

  // ❌ REMOVED: All library file generation methods (Phase 3)
  // - generateLibraryIndex()
  // - generateRuntimeIndex()
  // - generateRuntimeTypes()
  // - generateRuntimeContext()
  // - generateRuntimeClient()
  // - generateTestingIndex()
  // - generateTestingHelpers()
  // - generateTestingAssertions()
  // - generateAuthIndex()
  // - generateAuthManager()
  // - generateDataIndex()
  // - generateDataLoader()
  // - generateOutputIndex()
  // - generateOutputCollector()
  // All runtime functionality is now provided by @jstormes/apicize-lib

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private generateApicizeConfig(_options: ProjectScaffolderOptions): string {
    return JSON.stringify(
      {
        version: '1.0.0',
        activeEnvironment: 'development',
        // Phase 3: Removed 'libPath: ./lib' - no local lib directory
        configPath: './config',
        testsPath: './tests',
        dataPath: './data',
        reportsPath: './reports',
        metadataPath: './metadata', // ✅ Added metadata path
        settings: {
          defaultTimeout: 30000,
          retryAttempts: 3,
          parallelExecution: false,
          verboseLogging: true,
          preserveMetadata: true,
        },
        imports: {
          autoGenerateIds: true,
          validateOnImport: true,
          preserveComments: true,
        },
        exports: {
          includeMetadata: true,
          generateHelpers: false, // Phase 3: No local helpers generated
          splitByGroup: true,
        },
      },
      null,
      2
    );
  }

  private generateTsConfig(options: ProjectScaffolderOptions): string {
    return JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2020',
          module: 'commonjs',
          lib: ['ES2020'],
          outDir: './dist',
          rootDir: './',
          strict: options.strict ?? true,
          esModuleInterop: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true,
          declaration: true,
          declarationMap: true,
          sourceMap: true,
          resolveJsonModule: true,
          moduleResolution: 'node',
          typeRoots: ['./node_modules/@types'],
          types: ['mocha', 'chai', 'node'],
        },
        // Phase 3: Removed 'lib/**/*' - no local lib code, only @jstormes/apicize-lib
        include: ['tests/**/*', 'scripts/**/*'],
        exclude: ['node_modules', 'dist', 'reports'],
        'ts-node': {
          files: true,
        },
      },
      null,
      2
    );
  }

  private generateMochaConfig(): string {
    return JSON.stringify(
      {
        require: ['ts-node/register'],
        extension: ['ts'],
        spec: 'tests/**/*.spec.ts',
        timeout: 30000,
        recursive: true,
        reporter: 'spec',
        exit: true,
      },
      null,
      2
    );
  }

  private generateEnvironmentConfig(env: string): string {
    const configs = {
      default: {
        name: 'default',
        baseUrls: {
          api: 'https://api.example.com',
          auth: 'https://auth.example.com',
          cdn: 'https://cdn.example.com',
        },
        headers: {
          'X-Environment': 'default',
        },
        timeouts: {
          default: 30000,
          long: 60000,
        },
        features: {
          debugMode: false,
          mockResponses: false,
          rateLimiting: true,
        },
      },
      development: {
        name: 'development',
        baseUrls: {
          api: 'http://localhost:3000',
          auth: 'http://localhost:4000',
          cdn: 'http://localhost:8080',
        },
        headers: {
          'X-Environment': 'dev',
          'X-Debug': 'true',
        },
        timeouts: {
          default: 30000,
          long: 60000,
        },
        features: {
          debugMode: true,
          mockResponses: true,
          rateLimiting: false,
        },
      },
      staging: {
        name: 'staging',
        baseUrls: {
          api: 'https://staging-api.example.com',
          auth: 'https://staging-auth.example.com',
          cdn: 'https://staging-cdn.example.com',
        },
        headers: {
          'X-Environment': 'staging',
        },
        timeouts: {
          default: 30000,
          long: 60000,
        },
        features: {
          debugMode: false,
          mockResponses: false,
          rateLimiting: true,
        },
      },
      production: {
        name: 'production',
        baseUrls: {
          api: 'https://api.example.com',
          auth: 'https://auth.example.com',
          cdn: 'https://cdn.example.com',
        },
        headers: {
          'X-Environment': 'production',
        },
        timeouts: {
          default: 30000,
          long: 60000,
        },
        features: {
          debugMode: false,
          mockResponses: false,
          rateLimiting: true,
        },
      },
    };

    return JSON.stringify(configs[env as keyof typeof configs] || configs.default, null, 2);
  }

  private generateAuthProviders(): string {
    return JSON.stringify(
      {
        providers: {
          'main-api': {
            type: 'OAuth2Client',
            config: {
              accessTokenUrl: '${env.AUTH_URL}/token',
              clientId: '${env.CLIENT_ID}',
              clientSecret: '${env.CLIENT_SECRET}',
              scope: 'api:read api:write',
              audience: 'https://api.example.com',
            },
          },
          'basic-auth': {
            type: 'Basic',
            config: {
              username: '${env.BASIC_USERNAME}',
              password: '${env.BASIC_PASSWORD}',
            },
          },
          'api-key': {
            type: 'ApiKey',
            config: {
              header: 'X-API-Key',
              value: '${env.API_KEY}',
            },
          },
        },
      },
      null,
      2
    );
  }

  private generateEndpointConfig(): string {
    return JSON.stringify(
      {
        services: {
          users: {
            base: '${baseUrls.api}/users',
            endpoints: {
              list: '/',
              get: '/{id}',
              create: '/',
              update: '/{id}',
              delete: '/{id}',
            },
          },
          products: {
            base: '${baseUrls.api}/products',
            endpoints: {
              list: '/',
              search: '/search',
              categories: '/categories',
            },
          },
        },
      },
      null,
      2
    );
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

    return JSON.stringify(
      {
        name: 'default',
        description: 'Default test scenario',
        variables: {
          ...variables,
          baseUrl: 'https://api.example.com',
          timeout: 30000,
          retries: 3,
        },
      },
      null,
      2
    );
  }

  private generateTestSettings(): string {
    return JSON.stringify(
      {
        timeout: 30000,
        retries: 3,
        parallel: false,
        bail: false,
        reporter: 'spec',
        reporterOptions: {
          output: './reports/results/test-results.json',
        },
        coverage: {
          enabled: false,
          directory: './reports/coverage',
          reporters: ['text', 'html', 'lcov'],
        },
      },
      null,
      2
    );
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
    return JSON.stringify(
      {
        name: options.projectName || 'apicize-tests',
        version: '1.0.0',
        private: true,
        description: 'API tests generated from .apicize workbook',
        scripts: {
          test: 'mocha',
          'test:watch': 'mocha --watch',
          'test:debug': 'mocha --inspect-brk',
          'test:scenario': 'cross-env SCENARIO=$npm_config_scenario mocha',
          'test:env': 'cross-env ENV=$npm_config_env mocha',
          'test:single': 'mocha --grep',
          'test:report': 'mocha --reporter mochawesome',
          'test:coverage': 'nyc mocha',
          build: 'tsc',
          'build:watch': 'tsc --watch',
          import: 'apicize import .',
          export: 'apicize export',
          validate: 'apicize validate',
          clean: 'rimraf dist reports/results reports/coverage',
          'config:list': 'node scripts/config-manager.js list',
          'config:set': 'node scripts/config-manager.js set',
        },
        dependencies: {
          // Phase 4: Only @jstormes/apicize-lib dependency needed
          '@jstormes/apicize-lib': '^1.0.5',
        },
        devDependencies: {
          '@types/mocha': '^10.0.0',
          '@types/chai': '^4.3.0',
          '@types/node': '^20.0.0',
          mocha: '^10.0.0',
          chai: '^4.3.0',
          typescript: '^5.0.0',
          'ts-node': '^10.0.0',
          'cross-env': '^7.0.3',
          mochawesome: '^7.1.0',
          nyc: '^15.1.0',
          rimraf: '^5.0.0',
        },
        engines: {
          node: '>=14.0.0',
        },
      },
      null,
      2
    );
  }

  private generateRunScript(typescript: boolean): string {
    return `#!/usr/bin/env node
${typescript ? "import * as fs from 'fs';" : "const fs = require('fs');"}

// Test runner script
console.log('Running Apicize tests...');

// This would implement the actual test execution logic
// including environment setup, scenario loading, etc.
`;
  }

  private generateImportScript(typescript: boolean): string {
    return `#!/usr/bin/env node
${typescript ? "import * as fs from 'fs';" : "const fs = require('fs');"}

// Import script to convert TypeScript tests back to .apicize format
console.log('Importing tests back to .apicize format...');
`;
  }

  private generateExportScript(typescript: boolean): string {
    return `#!/usr/bin/env node
${typescript ? "import * as fs from 'fs';" : "const fs = require('fs');"}

// Export script to convert .apicize to TypeScript tests
console.log('Exporting .apicize to TypeScript tests...');
`;
  }

  private generateValidateScript(typescript: boolean): string {
    return `#!/usr/bin/env node
${typescript ? "import * as fs from 'fs';" : "const fs = require('fs');"}

// Validation script for .apicize files and test structure
console.log('Validating project structure...');
`;
  }

  private generateConfigManagerScript(typescript: boolean): string {
    return `#!/usr/bin/env node
${typescript ? "import * as fs from 'fs';" : "const fs = require('fs');"}

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
    return JSON.stringify(
      {
        products: [
          {
            id: 1,
            name: 'Product 1',
            price: 29.99,
            category: 'electronics',
          },
          {
            id: 2,
            name: 'Product 2',
            price: 49.99,
            category: 'books',
          },
        ],
      },
      null,
      2
    );
  }

  private generateExampleSchema(): string {
    return JSON.stringify(
      {
        $schema: 'http://json-schema.org/draft-07/schema#',
        title: 'API Response Schema',
        type: 'object',
        properties: {
          status: {
            type: 'integer',
            minimum: 200,
            maximum: 599,
          },
          data: {
            type: 'object',
          },
          message: {
            type: 'string',
          },
        },
        required: ['status'],
      },
      null,
      2
    );
  }

  private mergeOptions(options: ProjectScaffolderOptions): Required<ProjectScaffolderOptions> {
    return {
      outputDir: options.outputDir || './scaffolded-project',
      projectName: options.projectName || 'apicize-test-project',
      includeExampleData: options.includeExampleData ?? true,
      includeEnvConfig: options.includeEnvConfig ?? true,
      packageManager: options.packageManager || 'npm',
      typescript: options.typescript ?? true,
      strict: options.strict ?? true,
    };
  }
}
