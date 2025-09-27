/**
 * Config Loader - Responsible for loading configuration files
 */

import { Result, success, failure } from '../../infrastructure/result';
import { ApicizeError, ApicizeErrorCode } from '../../infrastructure/errors';
import { FileSystem } from '../../infrastructure/interfaces';
import { ConfigLoader as IConfigLoader } from '../../domain/configuration/configuration-domain';
import { ApicizeConfig, EnvironmentConfig, AuthProvidersConfig } from '../../types';

/**
 * Config loader configuration
 */
export interface ConfigLoaderConfig {
  enableCache?: boolean;
  cacheTimeout?: number;
  validateOnLoad?: boolean;
  allowMissingFiles?: boolean;
}

/**
 * Cache entry for loaded configurations
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  path: string;
}

/**
 * Config loader implementation
 */
export class ApicizeConfigLoader implements IConfigLoader {
  private config: ConfigLoaderConfig;
  private fileSystem: FileSystem;
  private cache = new Map<string, CacheEntry<unknown>>();

  constructor(fileSystem: FileSystem, config: ConfigLoaderConfig = {}) {
    this.fileSystem = fileSystem;
    this.config = {
      enableCache: true,
      cacheTimeout: 5 * 60 * 1000, // 5 minutes
      validateOnLoad: true,
      allowMissingFiles: false,
      ...config,
    };
  }

  /**
   * Load base configuration file
   */
  async loadBaseConfig(configPath: string): Promise<Result<ApicizeConfig, ApicizeError>> {
    const configFile = this.resolveConfigPath(configPath, 'apicize.config.json');

    try {
      // Check cache first
      if (this.config.enableCache) {
        const cached = this.getFromCache<ApicizeConfig>(configFile);
        if (cached) {
          return success(cached);
        }
      }

      // Check if file exists
      const exists = await this.fileSystem.existsAsync(configFile);
      if (!exists) {
        return failure(
          new ApicizeError(
            ApicizeErrorCode.FILE_NOT_FOUND,
            `Base configuration file not found: ${configFile}`,
            { context: { configFile, operation: 'loadBaseConfig' } }
          )
        );
      }

      // Load and parse file
      const content = await this.fileSystem.readFileAsync(configFile, 'utf-8');
      const parseResult = this.parseJson<ApicizeConfig>(content, configFile);
      if (parseResult.isFailure()) {
        return parseResult;
      }

      const config = parseResult.data;

      // Validate if enabled
      if (this.config.validateOnLoad) {
        const validationResult = this.validateConfig(config);
        if (validationResult.isFailure()) {
          return validationResult as any;
        }
      }

      // Cache the result
      if (this.config.enableCache) {
        this.setCache(configFile, config);
      }

      return success(config);
    } catch (error) {
      return failure(
        new ApicizeError(
          ApicizeErrorCode.FILE_READ_ERROR,
          `Failed to load base configuration: ${configFile}`,
          {
            cause: error as Error,
            context: { configFile, operation: 'loadBaseConfig' },
          }
        )
      );
    }
  }

  /**
   * Load environment configuration file
   */
  async loadEnvironmentConfig(
    configPath: string,
    environment: string
  ): Promise<Result<EnvironmentConfig | null, ApicizeError>> {
    const envConfigFile = this.resolveConfigPath(
      configPath,
      'config',
      'environments',
      `${environment}.json`
    );

    try {
      // Check cache first
      if (this.config.enableCache) {
        const cached = this.getFromCache<EnvironmentConfig | null>(envConfigFile);
        if (cached !== undefined) {
          return success(cached);
        }
      }

      // Check if file exists
      const exists = await this.fileSystem.existsAsync(envConfigFile);
      if (!exists) {
        if (this.config.allowMissingFiles) {
          // Cache null result
          if (this.config.enableCache) {
            this.setCache(envConfigFile, null);
          }
          return success(null);
        }

        return failure(
          new ApicizeError(
            ApicizeErrorCode.FILE_NOT_FOUND,
            `Environment configuration file not found: ${envConfigFile}`,
            {
              context: {
                configFile: envConfigFile,
                environment,
                operation: 'loadEnvironmentConfig',
              },
            }
          )
        );
      }

      // Load and parse file
      const content = await this.fileSystem.readFileAsync(envConfigFile, 'utf-8');
      const parseResult = this.parseJson<EnvironmentConfig>(content, envConfigFile);
      if (parseResult.isFailure()) {
        return parseResult as any;
      }

      const config = parseResult.data;

      // Cache the result
      if (this.config.enableCache) {
        this.setCache(envConfigFile, config);
      }

      return success(config);
    } catch (error) {
      return failure(
        new ApicizeError(
          ApicizeErrorCode.FILE_READ_ERROR,
          `Failed to load environment configuration: ${envConfigFile}`,
          {
            cause: error as Error,
            context: {
              configFile: envConfigFile,
              environment,
              operation: 'loadEnvironmentConfig',
            },
          }
        )
      );
    }
  }

  /**
   * Load auth providers configuration file
   */
  async loadAuthProvidersConfig(
    configPath: string
  ): Promise<Result<AuthProvidersConfig | null, ApicizeError>> {
    const authConfigFile = this.resolveConfigPath(configPath, 'config', 'auth', 'providers.json');

    try {
      // Check cache first
      if (this.config.enableCache) {
        const cached = this.getFromCache<AuthProvidersConfig | null>(authConfigFile);
        if (cached !== undefined) {
          return success(cached);
        }
      }

      // Check if file exists
      const exists = await this.fileSystem.existsAsync(authConfigFile);
      if (!exists) {
        if (this.config.allowMissingFiles) {
          // Cache null result
          if (this.config.enableCache) {
            this.setCache(authConfigFile, null);
          }
          return success(null);
        }

        return failure(
          new ApicizeError(
            ApicizeErrorCode.FILE_NOT_FOUND,
            `Auth providers configuration file not found: ${authConfigFile}`,
            {
              context: {
                configFile: authConfigFile,
                operation: 'loadAuthProvidersConfig',
              },
            }
          )
        );
      }

      // Load and parse file
      const content = await this.fileSystem.readFileAsync(authConfigFile, 'utf-8');
      const parseResult = this.parseJson<AuthProvidersConfig>(content, authConfigFile);
      if (parseResult.isFailure()) {
        return parseResult as any;
      }

      const config = parseResult.data;

      // Cache the result
      if (this.config.enableCache) {
        this.setCache(authConfigFile, config);
      }

      return success(config);
    } catch (error) {
      return failure(
        new ApicizeError(
          ApicizeErrorCode.FILE_READ_ERROR,
          `Failed to load auth providers configuration: ${authConfigFile}`,
          {
            cause: error as Error,
            context: {
              configFile: authConfigFile,
              operation: 'loadAuthProvidersConfig',
            },
          }
        )
      );
    }
  }

  /**
   * Validate configuration structure
   */
  validateConfig(config: unknown): Result<boolean, ApicizeError> {
    try {
      if (!config || typeof config !== 'object') {
        return failure(
          new ApicizeError(ApicizeErrorCode.VALIDATION_ERROR, 'Configuration must be an object', {
            context: { configType: typeof config },
          })
        );
      }

      const configObj = config as any;

      // Check for required fields in base config
      if ('version' in configObj) {
        const requiredFields = ['version', 'settings'];
        for (const field of requiredFields) {
          if (!(field in configObj)) {
            return failure(
              new ApicizeError(
                ApicizeErrorCode.VALIDATION_ERROR,
                `Missing required field in configuration: ${field}`,
                { context: { missingField: field } }
              )
            );
          }
        }

        if (typeof configObj.version !== 'string') {
          return failure(
            new ApicizeError(
              ApicizeErrorCode.VALIDATION_ERROR,
              'Configuration version must be a string',
              { context: { versionType: typeof configObj.version } }
            )
          );
        }

        if (!configObj.settings || typeof configObj.settings !== 'object') {
          return failure(
            new ApicizeError(
              ApicizeErrorCode.VALIDATION_ERROR,
              'Configuration settings must be an object',
              { context: { settingsType: typeof configObj.settings } }
            )
          );
        }
      }

      return success(true);
    } catch (error) {
      return failure(
        new ApicizeError(ApicizeErrorCode.VALIDATION_ERROR, 'Failed to validate configuration', {
          cause: error as Error,
        })
      );
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clear cache for specific file
   */
  clearCacheForFile(filePath: string): boolean {
    return this.cache.delete(filePath);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    entries: Array<{ path: string; timestamp: number; age: number }>;
  } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([path, entry]) => ({
      path,
      timestamp: entry.timestamp,
      age: now - entry.timestamp,
    }));

    return {
      size: this.cache.size,
      entries,
    };
  }

  // Private helper methods

  private resolveConfigPath(...segments: string[]): string {
    return segments.join('/').replace(/\/+/g, '/');
  }

  private parseJson<T>(content: string, filePath: string): Result<T, ApicizeError> {
    try {
      const data = JSON.parse(content) as T;
      return success(data);
    } catch (error) {
      if (error instanceof SyntaxError) {
        return failure(
          new ApicizeError(
            ApicizeErrorCode.INVALID_JSON,
            `Invalid JSON in configuration file: ${filePath}`,
            {
              cause: error,
              context: { filePath, parseError: error.message },
            }
          )
        );
      }

      return failure(
        new ApicizeError(
          ApicizeErrorCode.PARSE_ERROR,
          `Failed to parse configuration file: ${filePath}`,
          {
            cause: error as Error,
            context: { filePath },
          }
        )
      );
    }
  }

  private getFromCache<T>(key: string): T | undefined {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) {
      return undefined;
    }

    // Check if cache entry is expired
    const now = Date.now();
    if (now - entry.timestamp > this.config.cacheTimeout!) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.data;
  }

  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      path: key,
    });
  }

  /**
   * Create a copy with different configuration
   */
  withConfig(newConfig: Partial<ConfigLoaderConfig>): ApicizeConfigLoader {
    return new ApicizeConfigLoader(this.fileSystem, { ...this.config, ...newConfig });
  }

  /**
   * Get current configuration
   */
  getConfig(): ConfigLoaderConfig {
    return { ...this.config };
  }
}
