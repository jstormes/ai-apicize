import * as fs from 'fs';
import * as path from 'path';
import {
  ApicizeConfig,
  EnvironmentConfig,
  AuthProvidersConfig,
} from '../types';

/**
 * Configuration Manager for Apicize tools
 * Handles loading, merging, and variable substitution for configuration files
 */
export class ConfigManager {
  private baseConfig: ApicizeConfig | null = null;
  private environmentConfig: EnvironmentConfig | null = null;
  private authProvidersConfig: AuthProvidersConfig | null = null;
  private configPath: string;
  private activeEnvironment: string;

  constructor(configPath: string = '.', environment?: string) {
    this.configPath = path.resolve(configPath);
    this.activeEnvironment = environment || 'development';
  }

  /**
   * Load the main apicize.config.json file
   */
  async loadBaseConfig(): Promise<ApicizeConfig> {
    if (this.baseConfig) {
      return this.baseConfig;
    }

    const configFile = path.join(this.configPath, 'apicize.config.json');

    if (!fs.existsSync(configFile)) {
      throw new Error(`Configuration file not found: ${configFile}`);
    }

    try {
      const configData = fs.readFileSync(configFile, 'utf-8');
      const rawConfig = JSON.parse(configData) as ApicizeConfig;

      // Validate required fields
      this.validateBaseConfig(rawConfig);

      // Apply variable substitution
      this.baseConfig = this.substituteVariables(rawConfig) as ApicizeConfig;

      // Update active environment if specified in config
      if (this.baseConfig.activeEnvironment) {
        this.activeEnvironment = this.baseConfig.activeEnvironment;
      }

      return this.baseConfig;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in configuration file: ${configFile}\n${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Load environment-specific configuration
   */
  async loadEnvironmentConfig(environment?: string): Promise<EnvironmentConfig | null> {
    const env = environment || this.activeEnvironment;
    const envConfigFile = path.join(this.configPath, 'config', 'environments', `${env}.json`);

    if (!fs.existsSync(envConfigFile)) {
      console.warn(`Environment config not found: ${envConfigFile}`);
      return null;
    }

    try {
      const configData = fs.readFileSync(envConfigFile, 'utf-8');
      const rawConfig = JSON.parse(configData) as EnvironmentConfig;

      this.environmentConfig = this.substituteVariables(rawConfig) as EnvironmentConfig;
      return this.environmentConfig;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in environment config: ${envConfigFile}\n${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Load authentication providers configuration
   */
  async loadAuthProvidersConfig(): Promise<AuthProvidersConfig | null> {
    if (this.authProvidersConfig) {
      return this.authProvidersConfig;
    }

    const authConfigFile = path.join(this.configPath, 'config', 'auth', 'providers.json');

    if (!fs.existsSync(authConfigFile)) {
      console.warn(`Auth providers config not found: ${authConfigFile}`);
      return null;
    }

    try {
      const configData = fs.readFileSync(authConfigFile, 'utf-8');
      const rawConfig = JSON.parse(configData) as AuthProvidersConfig;

      this.authProvidersConfig = this.substituteVariables(rawConfig) as AuthProvidersConfig;
      return this.authProvidersConfig;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in auth providers config: ${authConfigFile}\n${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get merged configuration for current environment
   */
  async getConfig(): Promise<ApicizeConfig> {
    const baseConfig = await this.loadBaseConfig();
    const envConfig = await this.loadEnvironmentConfig();

    if (!envConfig) {
      return baseConfig;
    }

    // Merge environment config into base config
    return this.mergeConfigs(baseConfig, envConfig);
  }

  /**
   * Get base URL for a service from environment config
   */
  async getBaseUrl(service: string): Promise<string | undefined> {
    const envConfig = await this.loadEnvironmentConfig();
    return envConfig?.baseUrls?.[service];
  }

  /**
   * Get authentication provider configuration by name
   */
  async getAuthProvider(providerName: string) {
    const authConfig = await this.loadAuthProvidersConfig();
    return authConfig?.providers?.[providerName];
  }

  /**
   * Set active environment
   */
  setEnvironment(environment: string): void {
    this.activeEnvironment = environment;
    // Clear cached environment config to force reload
    this.environmentConfig = null;
  }

  /**
   * Get current active environment
   */
  getEnvironment(): string {
    return this.activeEnvironment;
  }

  /**
   * Substitute variables in configuration using ${env.VAR} syntax
   */
  private substituteVariables(obj: any): any {
    if (typeof obj === 'string') {
      return this.substituteString(obj);
    } else if (Array.isArray(obj)) {
      return obj.map(item => this.substituteVariables(item));
    } else if (obj && typeof obj === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.substituteVariables(value);
      }
      return result;
    }
    return obj;
  }

  /**
   * Substitute variables in a string using ${env.VAR} syntax
   */
  private substituteString(str: string): string {
    return str.replace(/\$\{([^}]+)\}/g, (match, expression) => {
      const [source, key] = expression.split('.');

      if (source === 'env') {
        const envValue = process.env[key];
        if (envValue === undefined) {
          console.warn(`Environment variable not found: ${key}`);
          return match; // Return original if not found
        }
        return envValue;
      } else if (source === 'baseUrls' && this.environmentConfig) {
        const baseUrl = this.environmentConfig.baseUrls?.[key];
        if (baseUrl === undefined) {
          console.warn(`Base URL not found: ${key}`);
          return match;
        }
        return baseUrl;
      }

      console.warn(`Unknown variable source: ${source}`);
      return match;
    });
  }

  /**
   * Validate base configuration structure
   */
  private validateBaseConfig(config: any): void {
    const requiredFields = ['version', 'settings'];

    for (const field of requiredFields) {
      if (!(field in config)) {
        throw new Error(`Missing required field in configuration: ${field}`);
      }
    }

    if (typeof config.version !== 'string') {
      throw new Error('Configuration version must be a string');
    }

    if (!config.settings || typeof config.settings !== 'object') {
      throw new Error('Configuration settings must be an object');
    }
  }

  /**
   * Merge environment configuration into base configuration
   */
  private mergeConfigs(base: ApicizeConfig, env: EnvironmentConfig): ApicizeConfig & { _environment: EnvironmentConfig } {
    return {
      ...base,
      // Add environment-specific headers to settings if they exist
      settings: {
        ...base.settings,
        // Could add environment-specific settings here
      },
      // Store environment config for reference
      _environment: env,
    };
  }

  /**
   * Create default configuration file
   */
  static createDefaultConfig(): ApicizeConfig {
    return {
      version: '1.0.0',
      activeEnvironment: 'development',
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
  }

  /**
   * Write configuration to file
   */
  static async writeConfig(configPath: string, config: ApicizeConfig): Promise<void> {
    const configFile = path.join(configPath, 'apicize.config.json');
    const configDir = path.dirname(configFile);

    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    const configData = JSON.stringify(config, null, 2);
    fs.writeFileSync(configFile, configData, 'utf-8');
  }
}