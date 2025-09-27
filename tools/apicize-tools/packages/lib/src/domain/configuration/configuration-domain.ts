/**
 * Configuration Domain - Interfaces for configuration management
 */

import { Result } from '../../infrastructure/result';
import { ApicizeError } from '../../infrastructure/errors';
import { ApicizeConfig, EnvironmentConfig, AuthProvidersConfig } from '../../types';

/**
 * Configuration loader interface - responsible for loading raw configuration files
 */
export interface ConfigLoader {
  loadBaseConfig(path: string): Promise<Result<ApicizeConfig, ApicizeError>>;
  loadEnvironmentConfig(
    path: string,
    environment: string
  ): Promise<Result<EnvironmentConfig | null, ApicizeError>>;
  loadAuthProvidersConfig(path: string): Promise<Result<AuthProvidersConfig | null, ApicizeError>>;
  validateConfig(config: unknown): Result<boolean, ApicizeError>;
}

/**
 * Variable substitutor interface - responsible for variable substitution in configurations
 */
export interface VariableSubstitutor {
  substitute(value: unknown, context?: VariableContext): Promise<Result<unknown, ApicizeError>>;
  substituteString(str: string, context?: VariableContext): Promise<Result<string, ApicizeError>>;
  addVariableSource(name: string, source: VariableSource): void;
  removeVariableSource(name: string): boolean;
}

/**
 * Variable context for substitution
 */
export interface VariableContext {
  environment?: EnvironmentConfig;
  baseConfig?: ApicizeConfig;
  authConfig?: AuthProvidersConfig;
  customVariables?: Record<string, string>;
}

/**
 * Variable source interface
 */
export interface VariableSource {
  getValue(key: string): Promise<string | undefined>;
  hasKey(key: string): Promise<boolean>;
  getAllKeys(): Promise<string[]>;
}

/**
 * Configuration validator interface - responsible for validating configuration structures
 */
export interface ConfigValidator {
  validateBaseConfig(config: unknown): Result<ApicizeConfig, ApicizeError>;
  validateEnvironmentConfig(config: unknown): Result<EnvironmentConfig, ApicizeError>;
  validateAuthProvidersConfig(config: unknown): Result<AuthProvidersConfig, ApicizeError>;
  validateField(
    fieldName: string,
    value: unknown,
    rules: ValidationRule[]
  ): Result<boolean, ApicizeError>;
}

/**
 * Validation rule interface
 */
export interface ValidationRule {
  name: string;
  validate(value: unknown): boolean;
  message: string;
}

/**
 * Environment resolver interface - responsible for resolving environment-specific configurations
 */
export interface EnvironmentResolver {
  resolveEnvironment(environment?: string): string;
  getEnvironmentConfig(
    environment: string
  ): Promise<Result<EnvironmentConfig | null, ApicizeError>>;
  mergeConfigs(
    base: ApicizeConfig,
    environment: EnvironmentConfig
  ): Result<ApicizeConfig, ApicizeError>;
  getBaseUrl(
    service: string,
    environment?: string
  ): Promise<Result<string | undefined, ApicizeError>>;
  getAuthProvider(providerName: string): Promise<Result<unknown, ApicizeError>>;
}

/**
 * Configuration manager interface - orchestrates all configuration operations
 */
export interface ConfigurationManager {
  getConfig(environment?: string): Promise<Result<ApicizeConfig, ApicizeError>>;
  getBaseUrl(service: string): Promise<Result<string | undefined, ApicizeError>>;
  getAuthProvider(providerName: string): Promise<Result<unknown, ApicizeError>>;
  setEnvironment(environment: string): void;
  getEnvironment(): string;
  reloadConfig(): Promise<Result<void, ApicizeError>>;
}
