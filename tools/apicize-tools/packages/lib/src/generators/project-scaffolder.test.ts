import { describe, it, expect, beforeEach } from '@jest/globals';
import { ProjectScaffolder } from './project-scaffolder';
import { ApicizeWorkbook, Request, RequestGroup, HttpMethod, VariableType } from '../types';

describe('ProjectScaffolder', () => {
  let scaffolder: ProjectScaffolder;

  beforeEach(() => {
    scaffolder = new ProjectScaffolder();
  });

  describe('scaffoldProject', () => {
    it('should generate a complete project structure', () => {
      const workbook: ApicizeWorkbook = {
        version: 1.0,
        requests: [
          {
            id: 'req1',
            name: 'Test Request',
            url: 'https://api.example.com/test',
            method: HttpMethod.GET,
            test: 'expect(response.status).to.equal(200);',
          } as Request,
        ],
        scenarios: [
          {
            id: 'sc1',
            name: 'Default',
            variables: [
              { name: 'baseUrl', value: 'https://api.example.com', type: VariableType.TEXT },
            ],
          },
        ],
      };

      const result = scaffolder.scaffoldProject(workbook, 'test.apicize');

      // Check that essential files are generated
      expect(result.files.length).toBeGreaterThan(20);
      expect(result.files.find(f => f.path === 'package.json')).toBeDefined();
      expect(result.files.find(f => f.path === 'tsconfig.json')).toBeDefined();
      expect(result.files.find(f => f.path === '.mocharc.json')).toBeDefined();
      expect(result.files.find(f => f.path === 'apicize.config.json')).toBeDefined();
      expect(result.files.find(f => f.path === '.gitignore')).toBeDefined();
      expect(result.files.find(f => f.path === 'README.md')).toBeDefined();

      // Check folder structure metadata
      expect(result.metadata.folders).toContain('lib');
      expect(result.metadata.folders).toContain('config');
      expect(result.metadata.folders).toContain('tests');
      expect(result.metadata.folders).toContain('data');
    });

    it('should generate library files', () => {
      const workbook: ApicizeWorkbook = {
        version: 1.0,
        requests: [],
      };

      const result = scaffolder.scaffoldProject(workbook);

      // Check core library files
      expect(result.files.find(f => f.path === 'lib/index.ts')).toBeDefined();
      expect(result.files.find(f => f.path === 'lib/runtime/index.ts')).toBeDefined();
      expect(result.files.find(f => f.path === 'lib/runtime/types.ts')).toBeDefined();
      expect(result.files.find(f => f.path === 'lib/runtime/context.ts')).toBeDefined();
      expect(result.files.find(f => f.path === 'lib/runtime/client.ts')).toBeDefined();

      // Check testing utilities
      expect(result.files.find(f => f.path === 'lib/testing/helpers.ts')).toBeDefined();
      expect(result.files.find(f => f.path === 'lib/testing/assertions.ts')).toBeDefined();

      // Check other library modules
      expect(result.files.find(f => f.path === 'lib/auth/manager.ts')).toBeDefined();
      expect(result.files.find(f => f.path === 'lib/data/loader.ts')).toBeDefined();
      expect(result.files.find(f => f.path === 'lib/output/collector.ts')).toBeDefined();
    });

    it('should generate configuration files', () => {
      const workbook: ApicizeWorkbook = {
        version: 1.0,
        requests: [],
        scenarios: [
          {
            id: 'sc1',
            name: 'Test Scenario',
            variables: [{ name: 'apiKey', value: 'test123', type: VariableType.TEXT }],
          },
        ],
      };

      const result = scaffolder.scaffoldProject(workbook);

      // Check environment configs
      expect(result.files.find(f => f.path === 'config/environments/default.json')).toBeDefined();
      expect(
        result.files.find(f => f.path === 'config/environments/development.json')
      ).toBeDefined();
      expect(result.files.find(f => f.path === 'config/environments/staging.json')).toBeDefined();
      expect(
        result.files.find(f => f.path === 'config/environments/production.json')
      ).toBeDefined();

      // Check auth config
      expect(result.files.find(f => f.path === 'config/auth/providers.json')).toBeDefined();

      // Check endpoint config
      expect(result.files.find(f => f.path === 'config/endpoints/base-urls.json')).toBeDefined();

      // Check scenario config
      const scenarioFile = result.files.find(f => f.path === 'config/scenarios/default.json');
      expect(scenarioFile).toBeDefined();

      // Verify scenario contains workbook variables
      const scenarioConfig = JSON.parse(scenarioFile!.content);
      expect(scenarioConfig.variables.apiKey).toBe('test123');
    });

    it('should generate utility scripts', () => {
      const workbook: ApicizeWorkbook = {
        version: 1.0,
        requests: [],
      };

      const result = scaffolder.scaffoldProject(workbook, 'test.apicize', {
        typescript: true,
      });

      // Check script files
      expect(result.files.find(f => f.path === 'scripts/run.ts')).toBeDefined();
      expect(result.files.find(f => f.path === 'scripts/import.ts')).toBeDefined();
      expect(result.files.find(f => f.path === 'scripts/export.ts')).toBeDefined();
      expect(result.files.find(f => f.path === 'scripts/validate.ts')).toBeDefined();
      expect(result.files.find(f => f.path === 'scripts/config-manager.ts')).toBeDefined();

      // Check scripts metadata
      expect(result.metadata.scripts).toContain('run');
      expect(result.metadata.scripts).toContain('import');
      expect(result.metadata.scripts).toContain('export');
      expect(result.metadata.scripts).toContain('validate');
      expect(result.metadata.scripts).toContain('config-manager');
    });

    it('should respect project options', () => {
      const workbook: ApicizeWorkbook = {
        version: 1.0,
        requests: [],
      };

      const result = scaffolder.scaffoldProject(workbook, 'test.apicize', {
        projectName: 'my-custom-project',
        packageManager: 'yarn',
        typescript: false,
        includeExampleData: false,
        includeEnvConfig: false,
      });

      // Check package.json contains custom project name
      const packageFile = result.files.find(f => f.path === 'package.json');
      expect(packageFile).toBeDefined();
      const packageJson = JSON.parse(packageFile!.content);
      expect(packageJson.name).toBe('my-custom-project');

      // Check JavaScript scripts instead of TypeScript
      expect(result.files.find(f => f.path === 'scripts/run.js')).toBeDefined();
      expect(result.files.find(f => f.path === 'scripts/run.ts')).toBeUndefined();

      // Check yarn lockfile
      expect(result.files.find(f => f.path === 'yarn.lock')).toBeDefined();

      // Check no example data
      expect(result.files.find(f => f.path === 'data/csv/users.csv')).toBeUndefined();

      // Check no .env.example
      expect(result.files.find(f => f.path === '.env.example')).toBeUndefined();

      // Check metadata
      expect(result.metadata.projectName).toBe('my-custom-project');
    });

    it('should include example data when requested', () => {
      const workbook: ApicizeWorkbook = {
        version: 1.0,
        requests: [],
      };

      const result = scaffolder.scaffoldProject(workbook, 'test.apicize', {
        includeExampleData: true,
      });

      // Check example data files
      expect(result.files.find(f => f.path === 'data/csv/users.csv')).toBeDefined();
      expect(result.files.find(f => f.path === 'data/json/products.json')).toBeDefined();
      expect(result.files.find(f => f.path === 'data/schemas/api-responses.json')).toBeDefined();

      // Verify CSV content format
      const csvFile = result.files.find(f => f.path === 'data/csv/users.csv');
      expect(csvFile!.content).toContain('username,password,expected_status');
      expect(csvFile!.content).toContain('user1,pass123,200');

      // Verify JSON content format
      const jsonFile = result.files.find(f => f.path === 'data/json/products.json');
      const jsonData = JSON.parse(jsonFile!.content);
      expect(jsonData.products).toBeDefined();
      expect(Array.isArray(jsonData.products)).toBe(true);
    });

    it('should generate valid package.json', () => {
      const workbook: ApicizeWorkbook = {
        version: 1.0,
        requests: [],
      };

      const result = scaffolder.scaffoldProject(workbook, 'test.apicize', {
        projectName: 'test-project',
        packageManager: 'npm',
      });

      const packageFile = result.files.find(f => f.path === 'package.json');
      expect(packageFile).toBeDefined();

      const packageJson = JSON.parse(packageFile!.content);

      // Check basic properties
      expect(packageJson.name).toBe('test-project');
      expect(packageJson.version).toBe('1.0.0');
      expect(packageJson.private).toBe(true);

      // Check scripts
      expect(packageJson.scripts.test).toBe('mocha');
      expect(packageJson.scripts['test:watch']).toBe('mocha --watch');
      expect(packageJson.scripts.build).toBe('tsc');

      // Check dependencies
      expect(packageJson.dependencies['@apicize/lib']).toBeDefined();
      expect(packageJson.devDependencies.mocha).toBeDefined();
      expect(packageJson.devDependencies.chai).toBeDefined();
      expect(packageJson.devDependencies.typescript).toBeDefined();
    });

    it('should generate valid TypeScript configuration', () => {
      const workbook: ApicizeWorkbook = {
        version: 1.0,
        requests: [],
      };

      const result = scaffolder.scaffoldProject(workbook, 'test.apicize', {
        strict: true,
      });

      const tsconfigFile = result.files.find(f => f.path === 'tsconfig.json');
      expect(tsconfigFile).toBeDefined();

      const tsconfig = JSON.parse(tsconfigFile!.content);

      // Check compiler options
      expect(tsconfig.compilerOptions.target).toBe('ES2020');
      expect(tsconfig.compilerOptions.module).toBe('commonjs');
      expect(tsconfig.compilerOptions.strict).toBe(true);
      expect(tsconfig.compilerOptions.esModuleInterop).toBe(true);

      // Check includes
      expect(tsconfig.include).toContain('lib/**/*');
      expect(tsconfig.include).toContain('tests/**/*');
      expect(tsconfig.include).toContain('scripts/**/*');

      // Check excludes
      expect(tsconfig.exclude).toContain('node_modules');
      expect(tsconfig.exclude).toContain('dist');
    });

    it('should generate valid Mocha configuration', () => {
      const workbook: ApicizeWorkbook = {
        version: 1.0,
        requests: [],
      };

      const result = scaffolder.scaffoldProject(workbook);

      const mochaFile = result.files.find(f => f.path === '.mocharc.json');
      expect(mochaFile).toBeDefined();

      const mochaConfig = JSON.parse(mochaFile!.content);

      // Check configuration
      expect(mochaConfig.require).toContain('ts-node/register');
      expect(mochaConfig.extension).toContain('ts');
      expect(mochaConfig.spec).toBe('tests/**/*.spec.ts');
      expect(mochaConfig.timeout).toBe(30000);
      expect(mochaConfig.recursive).toBe(true);
    });

    it('should handle different package managers', () => {
      const workbook: ApicizeWorkbook = {
        version: 1.0,
        requests: [],
      };

      // Test yarn
      const yarnResult = scaffolder.scaffoldProject(workbook, 'test.apicize', {
        packageManager: 'yarn',
      });
      expect(yarnResult.files.find(f => f.path === 'yarn.lock')).toBeDefined();

      // Test pnpm
      const pnpmResult = scaffolder.scaffoldProject(workbook, 'test.apicize', {
        packageManager: 'pnpm',
      });
      expect(pnpmResult.files.find(f => f.path === 'pnpm-lock.yaml')).toBeDefined();

      // Test npm (default - no lock file generated)
      const npmResult = scaffolder.scaffoldProject(workbook, 'test.apicize', {
        packageManager: 'npm',
      });
      expect(npmResult.files.find(f => f.path === 'yarn.lock')).toBeUndefined();
      expect(npmResult.files.find(f => f.path === 'pnpm-lock.yaml')).toBeUndefined();
    });

    it('should generate environment-specific configurations', () => {
      const workbook: ApicizeWorkbook = {
        version: 1.0,
        requests: [],
      };

      const result = scaffolder.scaffoldProject(workbook);

      // Check development environment
      const devFile = result.files.find(f => f.path === 'config/environments/development.json');
      expect(devFile).toBeDefined();
      const devConfig = JSON.parse(devFile!.content);
      expect(devConfig.name).toBe('development');
      expect(devConfig.baseUrls.api).toBe('http://localhost:3000');
      expect(devConfig.features.debugMode).toBe(true);

      // Check production environment
      const prodFile = result.files.find(f => f.path === 'config/environments/production.json');
      expect(prodFile).toBeDefined();
      const prodConfig = JSON.parse(prodFile!.content);
      expect(prodConfig.name).toBe('production');
      expect(prodConfig.baseUrls.api).toBe('https://api.example.com');
      expect(prodConfig.features.debugMode).toBe(false);
    });

    it('should generate auth provider configuration', () => {
      const workbook: ApicizeWorkbook = {
        version: 1.0,
        requests: [],
      };

      const result = scaffolder.scaffoldProject(workbook);

      const authFile = result.files.find(f => f.path === 'config/auth/providers.json');
      expect(authFile).toBeDefined();

      const authConfig = JSON.parse(authFile!.content);
      expect(authConfig.providers['main-api']).toBeDefined();
      expect(authConfig.providers['main-api'].type).toBe('OAuth2Client');
      expect(authConfig.providers['basic-auth']).toBeDefined();
      expect(authConfig.providers['basic-auth'].type).toBe('Basic');
      expect(authConfig.providers['api-key']).toBeDefined();
      expect(authConfig.providers['api-key'].type).toBe('ApiKey');
    });

    it('should generate valid apicize configuration', () => {
      const workbook: ApicizeWorkbook = {
        version: 1.0,
        requests: [],
      };

      const result = scaffolder.scaffoldProject(workbook);

      const configFile = result.files.find(f => f.path === 'apicize.config.json');
      expect(configFile).toBeDefined();

      const config = JSON.parse(configFile!.content);
      expect(config.version).toBe('1.0.0');
      expect(config.activeEnvironment).toBe('development');
      expect(config.libPath).toBe('./lib');
      expect(config.configPath).toBe('./config');
      expect(config.testsPath).toBe('./tests');
      expect(config.settings.defaultTimeout).toBe(30000);
      expect(config.exports.includeMetadata).toBe(true);
    });

    it('should generate proper .gitignore', () => {
      const workbook: ApicizeWorkbook = {
        version: 1.0,
        requests: [],
      };

      const result = scaffolder.scaffoldProject(workbook);

      const gitignoreFile = result.files.find(f => f.path === '.gitignore');
      expect(gitignoreFile).toBeDefined();

      const gitignoreContent = gitignoreFile!.content;
      expect(gitignoreContent).toContain('node_modules/');
      expect(gitignoreContent).toContain('.env');
      expect(gitignoreContent).toContain('dist/');
      expect(gitignoreContent).toContain('coverage/');
      expect(gitignoreContent).toContain('config/auth/credentials.json');
    });

    it('should generate README with proper instructions', () => {
      const workbook: ApicizeWorkbook = {
        version: 1.0,
        requests: [],
      };

      const result = scaffolder.scaffoldProject(workbook, 'test.apicize', {
        projectName: 'my-api-tests',
        packageManager: 'yarn',
      });

      const readmeFile = result.files.find(f => f.path === 'README.md');
      expect(readmeFile).toBeDefined();

      const readmeContent = readmeFile!.content;
      expect(readmeContent).toContain('# my-api-tests');
      expect(readmeContent).toContain('yarn install');
      expect(readmeContent).toContain('yarn test');
      expect(readmeContent).toContain('yarn run test:env staging');
    });

    it('should include test files from TestGenerator', () => {
      const workbook: ApicizeWorkbook = {
        version: 1.0,
        requests: [
          {
            id: 'group1',
            name: 'API Group',
            children: [
              {
                id: 'req1',
                name: 'Test Request',
                url: 'https://api.example.com/test',
                method: HttpMethod.GET,
              } as Request,
            ],
          } as RequestGroup,
        ],
      };

      const result = scaffolder.scaffoldProject(workbook);

      // Should include test files generated by TestGenerator
      expect(result.files.find(f => f.path === 'tests/index.spec.ts')).toBeDefined();
      expect(result.files.find(f => f.path.startsWith('tests/suites/'))).toBeDefined();
      expect(result.files.find(f => f.path === 'metadata/workbook.json')).toBeDefined();
    });
  });

  describe('metadata tracking', () => {
    it('should track project metadata correctly', () => {
      const workbook: ApicizeWorkbook = {
        version: 1.0,
        requests: [],
      };

      const result = scaffolder.scaffoldProject(workbook, 'test.apicize', {
        projectName: 'test-project',
        outputDir: './output',
      });

      expect(result.metadata.projectName).toBe('test-project');
      expect(result.metadata.outputDir).toBe('./output');
      expect(result.metadata.totalFiles).toBe(result.files.length);
      expect(result.metadata.folders.length).toBeGreaterThan(10);
      expect(result.metadata.scripts.length).toBeGreaterThan(4);
    });
  });

  describe('option handling', () => {
    it('should use default options when none provided', () => {
      const workbook: ApicizeWorkbook = {
        version: 1.0,
        requests: [],
      };

      const result = scaffolder.scaffoldProject(workbook);

      expect(result.metadata.projectName).toBe('apicize-test-project');
      expect(result.metadata.outputDir).toBe('./scaffolded-project');

      // Should include default files
      expect(result.files.find(f => f.path === 'data/csv/users.csv')).toBeDefined();
      expect(result.files.find(f => f.path === '.env.example')).toBeDefined();
    });

    it('should override defaults with provided options', () => {
      const workbook: ApicizeWorkbook = {
        version: 1.0,
        requests: [],
      };

      const result = scaffolder.scaffoldProject(workbook, 'custom.apicize', {
        projectName: 'custom-project',
        outputDir: './custom-output',
        includeExampleData: false,
        includeEnvConfig: false,
        packageManager: 'yarn',
        typescript: false,
        strict: false,
      });

      expect(result.metadata.projectName).toBe('custom-project');
      expect(result.metadata.outputDir).toBe('./custom-output');

      // Should respect overrides
      expect(result.files.find(f => f.path === 'data/csv/users.csv')).toBeUndefined();
      expect(result.files.find(f => f.path === '.env.example')).toBeUndefined();
      expect(result.files.find(f => f.path === 'yarn.lock')).toBeDefined();
      expect(result.files.find(f => f.path === 'scripts/run.js')).toBeDefined();

      // Check TypeScript config reflects strict: false
      const tsconfigFile = result.files.find(f => f.path === 'tsconfig.json');
      const tsconfig = JSON.parse(tsconfigFile!.content);
      expect(tsconfig.compilerOptions.strict).toBe(false);
    });
  });
});
