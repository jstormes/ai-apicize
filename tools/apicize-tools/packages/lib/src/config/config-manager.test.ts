import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ConfigManager } from './config-manager';
import { ApicizeConfig, EnvironmentConfig, AuthProvidersConfig, AuthorizationType } from '../types';

describe('ConfigManager', () => {
  let tempDir: string;
  let configManager: ConfigManager;

  beforeEach(() => {
    // Create temporary directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apicize-config-test-'));
    configManager = new ConfigManager(tempDir);
  });

  afterEach(() => {
    // Clean up temporary directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Base Configuration', () => {
    it('should load valid base configuration', async () => {
      const config: ApicizeConfig = {
        version: '1.0.0',
        activeEnvironment: 'test',
        libPath: './lib',
        configPath: './config',
        testsPath: './tests',
        dataPath: './data',
        reportsPath: './reports',
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
          generateHelpers: true,
          splitByGroup: true,
        },
      };

      fs.writeFileSync(path.join(tempDir, 'apicize.config.json'), JSON.stringify(config, null, 2));

      const loadedConfig = await configManager.loadBaseConfig();
      expect(loadedConfig).toEqual(config);
      expect(configManager.getEnvironment()).toBe('test');
    });

    it('should throw error for missing config file', async () => {
      await expect(configManager.loadBaseConfig()).rejects.toThrow('Configuration file not found');
    });

    it('should throw error for invalid JSON', async () => {
      fs.writeFileSync(path.join(tempDir, 'apicize.config.json'), '{ invalid json }');

      await expect(configManager.loadBaseConfig()).rejects.toThrow(
        'Invalid JSON in configuration file'
      );
    });

    it('should throw error for missing required fields', async () => {
      fs.writeFileSync(
        path.join(tempDir, 'apicize.config.json'),
        JSON.stringify({ version: '1.0.0' })
      );

      await expect(configManager.loadBaseConfig()).rejects.toThrow(
        'Missing required field in configuration: settings'
      );
    });

    it('should validate configuration structure', async () => {
      fs.writeFileSync(
        path.join(tempDir, 'apicize.config.json'),
        JSON.stringify({ version: 123, settings: 'invalid' })
      );

      await expect(configManager.loadBaseConfig()).rejects.toThrow(
        'Configuration version must be a string'
      );
    });
  });

  describe('Environment Configuration', () => {
    beforeEach(() => {
      // Create config directory structure
      fs.mkdirSync(path.join(tempDir, 'config', 'environments'), { recursive: true });
    });

    it('should load environment configuration', async () => {
      const envConfig: EnvironmentConfig = {
        name: 'development',
        baseUrls: {
          api: 'http://localhost:3000',
          auth: 'http://localhost:4000',
        },
        headers: {
          'X-Environment': 'dev',
        },
        timeouts: {
          default: 30000,
          long: 60000,
        },
        features: {
          debugMode: true,
          mockResponses: false,
        },
      };

      fs.writeFileSync(
        path.join(tempDir, 'config', 'environments', 'development.json'),
        JSON.stringify(envConfig, null, 2)
      );

      const loadedConfig = await configManager.loadEnvironmentConfig('development');
      expect(loadedConfig).toEqual(envConfig);
    });

    it('should return null for missing environment config', async () => {
      const result = await configManager.loadEnvironmentConfig('nonexistent');
      expect(result).toBeNull();
    });

    it('should use active environment by default', async () => {
      const envConfig: EnvironmentConfig = {
        name: 'development',
        baseUrls: { api: 'http://localhost:3000' },
      };

      fs.writeFileSync(
        path.join(tempDir, 'config', 'environments', 'development.json'),
        JSON.stringify(envConfig, null, 2)
      );

      configManager.setEnvironment('development');
      const loadedConfig = await configManager.loadEnvironmentConfig();
      expect(loadedConfig).toEqual(envConfig);
    });
  });

  describe('Authentication Providers Configuration', () => {
    beforeEach(() => {
      fs.mkdirSync(path.join(tempDir, 'config', 'auth'), { recursive: true });
    });

    it('should load auth providers configuration', async () => {
      const authConfig: AuthProvidersConfig = {
        providers: {
          'main-api': {
            type: AuthorizationType.OAuth2Client,
            config: {
              accessTokenUrl: '${env.AUTH_URL}/token',
              clientId: '${env.CLIENT_ID}',
              clientSecret: '${env.CLIENT_SECRET}',
              scope: 'api:read api:write',
            },
          },
          'basic-auth': {
            type: AuthorizationType.Basic,
            config: {
              username: '${env.BASIC_USERNAME}',
              password: '${env.BASIC_PASSWORD}',
            },
          },
        },
      };

      fs.writeFileSync(
        path.join(tempDir, 'config', 'auth', 'providers.json'),
        JSON.stringify(authConfig, null, 2)
      );

      const loadedConfig = await configManager.loadAuthProvidersConfig();
      expect(loadedConfig).toEqual(authConfig);
    });

    it('should return null for missing auth config', async () => {
      const result = await configManager.loadAuthProvidersConfig();
      expect(result).toBeNull();
    });

    it('should get specific auth provider', async () => {
      const authConfig: AuthProvidersConfig = {
        providers: {
          'test-provider': {
            type: AuthorizationType.ApiKey,
            config: { header: 'X-API-Key', value: 'test-key' },
          },
        },
      };

      fs.writeFileSync(
        path.join(tempDir, 'config', 'auth', 'providers.json'),
        JSON.stringify(authConfig, null, 2)
      );

      const provider = await configManager.getAuthProvider('test-provider');
      expect(provider).toEqual(authConfig.providers['test-provider']);
    });
  });

  describe('Variable Substitution', () => {
    beforeEach(() => {
      // Set test environment variables
      process.env.TEST_VAR = 'test-value';
      process.env.AUTH_URL = 'https://auth.example.com';
      process.env.CLIENT_ID = 'test-client-id';
    });

    afterEach(() => {
      // Clean up environment variables
      delete process.env.TEST_VAR;
      delete process.env.AUTH_URL;
      delete process.env.CLIENT_ID;
    });

    it('should substitute environment variables', async () => {
      const config = {
        version: '1.0.0',
        activeEnvironment: 'test',
        libPath: './lib',
        configPath: './config',
        testsPath: './tests',
        dataPath: './data',
        reportsPath: './reports',
        testUrl: '${env.AUTH_URL}/api',
        testId: '${env.CLIENT_ID}',
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
          generateHelpers: true,
          splitByGroup: true,
        },
      };

      fs.writeFileSync(path.join(tempDir, 'apicize.config.json'), JSON.stringify(config, null, 2));

      const loadedConfig = await configManager.loadBaseConfig();
      expect((loadedConfig as any).testUrl).toBe('https://auth.example.com/api');
      expect((loadedConfig as any).testId).toBe('test-client-id');
    });

    it('should handle missing environment variables', async () => {
      const config = {
        version: '1.0.0',
        testValue: '${env.MISSING_VAR}',
        settings: {},
        imports: { autoGenerateIds: true, validateOnImport: true, preserveComments: true },
        exports: { includeMetadata: true, generateHelpers: true, splitByGroup: true },
        activeEnvironment: 'test',
        libPath: './lib',
        configPath: './config',
        testsPath: './tests',
        dataPath: './data',
        reportsPath: './reports',
      };

      fs.writeFileSync(path.join(tempDir, 'apicize.config.json'), JSON.stringify(config, null, 2));

      const loadedConfig = await configManager.loadBaseConfig();
      expect((loadedConfig as any).testValue).toBe('${env.MISSING_VAR}'); // Should remain unchanged
    });

    it('should substitute variables in nested objects', async () => {
      fs.mkdirSync(path.join(tempDir, 'config', 'auth'), { recursive: true });

      const authConfig = {
        providers: {
          oauth: {
            type: 'OAuth2Client',
            config: {
              accessTokenUrl: '${env.AUTH_URL}/token',
              clientId: '${env.CLIENT_ID}',
              nested: {
                value: '${env.TEST_VAR}',
              },
            },
          },
        },
      };

      fs.writeFileSync(
        path.join(tempDir, 'config', 'auth', 'providers.json'),
        JSON.stringify(authConfig, null, 2)
      );

      const loadedConfig = await configManager.loadAuthProvidersConfig();
      expect(loadedConfig?.providers.oauth.config.accessTokenUrl).toBe(
        'https://auth.example.com/token'
      );
      expect(loadedConfig?.providers.oauth.config.clientId).toBe('test-client-id');
      expect((loadedConfig?.providers.oauth.config as any).nested.value).toBe('test-value');
    });
  });

  describe('Configuration Merging', () => {
    it('should merge environment config into base config', async () => {
      const baseConfig: ApicizeConfig = ConfigManager.createDefaultConfig();

      fs.writeFileSync(
        path.join(tempDir, 'apicize.config.json'),
        JSON.stringify(baseConfig, null, 2)
      );

      fs.mkdirSync(path.join(tempDir, 'config', 'environments'), { recursive: true });

      const envConfig: EnvironmentConfig = {
        name: 'test',
        baseUrls: {
          api: 'http://test-api.com',
        },
        headers: {
          'X-Test': 'true',
        },
      };

      fs.writeFileSync(
        path.join(tempDir, 'config', 'environments', 'development.json'),
        JSON.stringify(envConfig, null, 2)
      );

      const mergedConfig = await configManager.getConfig();
      expect(mergedConfig.version).toBe(baseConfig.version);
      expect((mergedConfig as any)._environment).toEqual(envConfig);
    });

    it('should return base config when environment config is missing', async () => {
      const baseConfig: ApicizeConfig = ConfigManager.createDefaultConfig();

      fs.writeFileSync(
        path.join(tempDir, 'apicize.config.json'),
        JSON.stringify(baseConfig, null, 2)
      );

      const mergedConfig = await configManager.getConfig();
      expect(mergedConfig).toEqual(baseConfig);
    });
  });

  describe('Utility Methods', () => {
    it('should get base URL for service', async () => {
      fs.mkdirSync(path.join(tempDir, 'config', 'environments'), { recursive: true });

      const envConfig: EnvironmentConfig = {
        name: 'test',
        baseUrls: {
          api: 'http://localhost:3000',
          auth: 'http://localhost:4000',
        },
      };

      fs.writeFileSync(
        path.join(tempDir, 'config', 'environments', 'development.json'),
        JSON.stringify(envConfig, null, 2)
      );

      const apiUrl = await configManager.getBaseUrl('api');
      const authUrl = await configManager.getBaseUrl('auth');
      const missingUrl = await configManager.getBaseUrl('missing');

      expect(apiUrl).toBe('http://localhost:3000');
      expect(authUrl).toBe('http://localhost:4000');
      expect(missingUrl).toBeUndefined();
    });

    it('should set and get environment', () => {
      expect(configManager.getEnvironment()).toBe('development');

      configManager.setEnvironment('production');
      expect(configManager.getEnvironment()).toBe('production');
    });

    it('should create default configuration', () => {
      const defaultConfig = ConfigManager.createDefaultConfig();

      expect(defaultConfig.version).toBe('1.0.0');
      expect(defaultConfig.activeEnvironment).toBe('development');
      expect(defaultConfig.settings).toBeDefined();
      expect(defaultConfig.imports).toBeDefined();
      expect(defaultConfig.exports).toBeDefined();
    });

    it('should write configuration to file', async () => {
      const config = ConfigManager.createDefaultConfig();

      await ConfigManager.writeConfig(tempDir, config);

      const configFile = path.join(tempDir, 'apicize.config.json');
      expect(fs.existsSync(configFile)).toBe(true);

      const writtenConfig = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
      expect(writtenConfig).toEqual(config);
    });
  });
});
