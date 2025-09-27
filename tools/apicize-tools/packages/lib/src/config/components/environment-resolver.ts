/**
 * Environment Resolver - Responsible for resolving environment-specific configurations
 */

import { Result, success, failure } from '../../infrastructure/result';
import { ApicizeError, ApicizeErrorCode } from '../../infrastructure/errors';
import {
  EnvironmentResolver as IEnvironmentResolver,
  ConfigLoader,
  VariableSubstitutor,
} from '../../domain/configuration/configuration-domain';
import { ApicizeConfig, EnvironmentConfig, AuthProvidersConfig } from '../../types';

/**
 * Environment resolver configuration
 */
export interface EnvironmentResolverConfig {
  defaultEnvironment?: string;
  enableCaching?: boolean;
  cacheTimeout?: number;
  fallbackToDefault?: boolean;
  warningCallback?: (message: string) => void;
}

/**
 * Environment cache entry
 */
interface EnvironmentCacheEntry {
  config: EnvironmentConfig;
  timestamp: number;
}

/**
 * Environment resolver implementation
 */
export class ApicizeEnvironmentResolver implements IEnvironmentResolver {
  private config: EnvironmentResolverConfig;
  private configLoader: ConfigLoader;
  private variableSubstitutor: VariableSubstitutor;
  private configPath: string;
  private activeEnvironment: string;
  private environmentCache = new Map<string, EnvironmentCacheEntry>();
  private authProvidersCache: AuthProvidersConfig | null = null;

  constructor(
    configLoader: ConfigLoader,
    variableSubstitutor: VariableSubstitutor,
    configPath: string,
    config: EnvironmentResolverConfig = {}
  ) {
    this.configLoader = configLoader;
    this.variableSubstitutor = variableSubstitutor;
    this.configPath = configPath;
    this.config = {
      defaultEnvironment: 'development',
      enableCaching: true,
      cacheTimeout: 5 * 60 * 1000, // 5 minutes
      fallbackToDefault: true,
      warningCallback: message => console.warn(message),
      ...config,
    };

    this.activeEnvironment = this.config.defaultEnvironment!;
  }

  /**
   * Resolve environment name
   */
  resolveEnvironment(environment?: string): string {
    if (environment) {
      return environment;
    }

    // Check environment variable
    const envFromProcess = process.env.APICIZE_ENV || process.env.NODE_ENV;
    if (envFromProcess) {
      return envFromProcess;
    }

    return this.activeEnvironment;
  }

  /**
   * Get environment configuration
   */
  async getEnvironmentConfig(
    environment: string
  ): Promise<Result<EnvironmentConfig | null, ApicizeError>> {
    try {
      // Check cache first
      if (this.config.enableCaching) {
        const cached = this.getFromCache(environment);
        if (cached) {
          return success(cached);
        }
      }

      // Load environment configuration
      const result = await this.configLoader.loadEnvironmentConfig(this.configPath, environment);
      if (result.isFailure()) {
        // Try fallback to default environment
        if (this.config.fallbackToDefault && environment !== this.config.defaultEnvironment) {
          this.config.warningCallback?.(
            `Environment '${environment}' not found, falling back to '${this.config.defaultEnvironment}'`
          );
          return this.getEnvironmentConfig(this.config.defaultEnvironment!);
        }
        return result;
      }

      const envConfig = result.data;
      if (envConfig) {
        // Apply variable substitution
        const substitutionResult = await this.variableSubstitutor.substitute(envConfig);
        if (substitutionResult.isFailure()) {
          return substitutionResult as any;
        }

        const processedConfig = substitutionResult.data as EnvironmentConfig;

        // Cache the result
        if (this.config.enableCaching) {
          this.setCache(environment, processedConfig);
        }

        return success(processedConfig);
      }

      return success(null);
    } catch (error) {
      return failure(
        new ApicizeError(
          ApicizeErrorCode.CONFIGURATION_ERROR,
          `Failed to get environment configuration for '${environment}'`,
          {
            cause: error as Error,
            context: { environment, configPath: this.configPath },
          }
        )
      );
    }
  }

  /**
   * Merge base and environment configurations
   */
  mergeConfigs(
    base: ApicizeConfig,
    environment: EnvironmentConfig
  ): Result<ApicizeConfig, ApicizeError> {
    try {
      const merged: ApicizeConfig & { _environment: EnvironmentConfig } = {
        ...base,
        // Merge settings with environment-specific overrides
        settings: {
          ...base.settings,
          // Environment can override certain settings
          ...(environment.timeouts && {
            defaultTimeout: environment.timeouts.default || base.settings.defaultTimeout,
          }),
        },
        // Store environment config for reference
        _environment: environment,
      };

      return success(merged);
    } catch (error) {
      return failure(
        new ApicizeError(
          ApicizeErrorCode.CONFIGURATION_ERROR,
          'Failed to merge base and environment configurations',
          {
            cause: error as Error,
            context: { baseConfig: base, environmentConfig: environment },
          }
        )
      );
    }
  }

  /**
   * Get base URL for a service
   */
  async getBaseUrl(
    service: string,
    environment?: string
  ): Promise<Result<string | undefined, ApicizeError>> {
    try {
      const env = this.resolveEnvironment(environment);
      const envConfigResult = await this.getEnvironmentConfig(env);

      if (envConfigResult.isFailure()) {
        return envConfigResult as any;
      }

      const envConfig = envConfigResult.data;
      if (!envConfig || !envConfig.baseUrls) {
        return success(undefined);
      }

      const baseUrl = envConfig.baseUrls[service];
      return success(baseUrl);
    } catch (error) {
      return failure(
        new ApicizeError(
          ApicizeErrorCode.CONFIGURATION_ERROR,
          `Failed to get base URL for service '${service}'`,
          {
            cause: error as Error,
            context: { service, environment },
          }
        )
      );
    }
  }

  /**
   * Get auth provider configuration
   */
  async getAuthProvider(providerName: string): Promise<Result<unknown, ApicizeError>> {
    try {
      // Load auth providers config if not cached
      if (!this.authProvidersCache) {
        const result = await this.configLoader.loadAuthProvidersConfig(this.configPath);
        if (result.isFailure()) {
          return result as any;
        }

        if (result.data) {
          // Apply variable substitution
          const substitutionResult = await this.variableSubstitutor.substitute(result.data);
          if (substitutionResult.isFailure()) {
            return substitutionResult as any;
          }

          this.authProvidersCache = substitutionResult.data as AuthProvidersConfig;
        }
      }

      if (!this.authProvidersCache || !this.authProvidersCache.providers) {
        return failure(
          new ApicizeError(
            ApicizeErrorCode.CONFIGURATION_ERROR,
            'Auth providers configuration not available',
            { context: { providerName } }
          )
        );
      }

      const provider = this.authProvidersCache.providers[providerName];
      if (!provider) {
        return failure(
          new ApicizeError(
            ApicizeErrorCode.NOT_FOUND,
            `Auth provider '${providerName}' not found`,
            {
              context: {
                providerName,
                availableProviders: Object.keys(this.authProvidersCache.providers),
              },
            }
          )
        );
      }

      return success(provider);
    } catch (error) {
      return failure(
        new ApicizeError(
          ApicizeErrorCode.CONFIGURATION_ERROR,
          `Failed to get auth provider '${providerName}'`,
          {
            cause: error as Error,
            context: { providerName },
          }
        )
      );
    }
  }

  /**
   * Set active environment
   */
  setEnvironment(environment: string): void {
    this.activeEnvironment = environment;
    // Clear relevant caches
    this.environmentCache.delete(environment);
  }

  /**
   * Get current active environment
   */
  getEnvironment(): string {
    return this.activeEnvironment;
  }

  /**
   * Get all available environments
   */
  async getAvailableEnvironments(): Promise<Result<string[], ApicizeError>> {
    try {
      // This would require filesystem access to scan for environment files
      // For now, return common environment names
      const commonEnvironments = ['development', 'staging', 'production', 'test'];
      return success(commonEnvironments);
    } catch (error) {
      return failure(
        new ApicizeError(
          ApicizeErrorCode.CONFIGURATION_ERROR,
          'Failed to get available environments',
          { cause: error as Error }
        )
      );
    }
  }

  /**
   * Validate environment exists
   */
  async validateEnvironment(environment: string): Promise<Result<boolean, ApicizeError>> {
    try {
      const result = await this.getEnvironmentConfig(environment);
      if (result.isFailure()) {
        return failure(result.error);
      }

      return success(result.data !== null);
    } catch (error) {
      return failure(
        new ApicizeError(
          ApicizeErrorCode.CONFIGURATION_ERROR,
          `Failed to validate environment '${environment}'`,
          {
            cause: error as Error,
            context: { environment },
          }
        )
      );
    }
  }

  /**
   * Get environment-specific headers
   */
  async getEnvironmentHeaders(
    environment?: string
  ): Promise<Result<Record<string, string>, ApicizeError>> {
    try {
      const env = this.resolveEnvironment(environment);
      const envConfigResult = await this.getEnvironmentConfig(env);

      if (envConfigResult.isFailure()) {
        return envConfigResult as any;
      }

      const envConfig = envConfigResult.data;
      const headers = envConfig?.headers || {};

      return success(headers);
    } catch (error) {
      return failure(
        new ApicizeError(
          ApicizeErrorCode.CONFIGURATION_ERROR,
          'Failed to get environment headers',
          {
            cause: error as Error,
            context: { environment },
          }
        )
      );
    }
  }

  /**
   * Get environment-specific timeouts
   */
  async getEnvironmentTimeouts(
    environment?: string
  ): Promise<Result<Record<string, number>, ApicizeError>> {
    try {
      const env = this.resolveEnvironment(environment);
      const envConfigResult = await this.getEnvironmentConfig(env);

      if (envConfigResult.isFailure()) {
        return envConfigResult as any;
      }

      const envConfig = envConfigResult.data;
      const timeouts = envConfig?.timeouts || {};

      return success(timeouts);
    } catch (error) {
      return failure(
        new ApicizeError(
          ApicizeErrorCode.CONFIGURATION_ERROR,
          'Failed to get environment timeouts',
          {
            cause: error as Error,
            context: { environment },
          }
        )
      );
    }
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.environmentCache.clear();
    this.authProvidersCache = null;
  }

  /**
   * Clear cache for specific environment
   */
  clearEnvironmentCache(environment: string): boolean {
    return this.environmentCache.delete(environment);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    environmentCache: {
      size: number;
      entries: Array<{ environment: string; timestamp: number; age: number }>;
    };
    authProvidersCache: boolean;
  } {
    const now = Date.now();
    const environmentEntries = Array.from(this.environmentCache.entries()).map(([env, entry]) => ({
      environment: env,
      timestamp: entry.timestamp,
      age: now - entry.timestamp,
    }));

    return {
      environmentCache: {
        size: this.environmentCache.size,
        entries: environmentEntries,
      },
      authProvidersCache: this.authProvidersCache !== null,
    };
  }

  // Private helper methods

  private getFromCache(environment: string): EnvironmentConfig | undefined {
    const entry = this.environmentCache.get(environment);
    if (!entry) {
      return undefined;
    }

    // Check if cache entry is expired
    const now = Date.now();
    if (now - entry.timestamp > this.config.cacheTimeout!) {
      this.environmentCache.delete(environment);
      return undefined;
    }

    return entry.config;
  }

  private setCache(environment: string, config: EnvironmentConfig): void {
    this.environmentCache.set(environment, {
      config,
      timestamp: Date.now(),
    });
  }

  /**
   * Create a copy with different configuration
   */
  withConfig(newConfig: Partial<EnvironmentResolverConfig>): ApicizeEnvironmentResolver {
    return new ApicizeEnvironmentResolver(
      this.configLoader,
      this.variableSubstitutor,
      this.configPath,
      { ...this.config, ...newConfig }
    );
  }

  /**
   * Get current configuration
   */
  getConfig(): EnvironmentResolverConfig {
    return { ...this.config };
  }
}
