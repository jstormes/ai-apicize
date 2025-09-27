/**
 * Configuration interfaces to reduce tight coupling
 * Provides flexible configuration management with type safety
 */

import { LogLevel } from './implementations';

/**
 * Base configuration interface
 */
export interface BaseConfig {
  [key: string]: unknown;
}

/**
 * HTTP client configuration
 */
export interface HttpClientConfig extends BaseConfig {
  defaultTimeout?: number;
  maxRedirects?: number;
  userAgent?: string;
  acceptInvalidCerts?: boolean;
  keepAlive?: boolean;
  retryAttempts?: number;
  retryDelay?: number;
}

/**
 * Parser configuration
 */
export interface ParserConfig extends BaseConfig {
  validateOnLoad?: boolean;
  strictMode?: boolean;
  includeWarnings?: boolean;
  maxFileSize?: number;
}

/**
 * Logger configuration
 */
export interface LoggerConfig extends BaseConfig {
  level?: LogLevel;
  enableConsole?: boolean;
  enableFile?: boolean;
  logFilePath?: string;
  maxLogFileSize?: number;
  includeTimestamp?: boolean;
  includeContext?: boolean;
}

/**
 * Telemetry configuration
 */
export interface TelemetryConfig extends BaseConfig {
  enabled?: boolean;
  serviceName?: string;
  endpoint?: string;
  apiKey?: string;
  sampleRate?: number;
  enableConsoleExporter?: boolean;
}

/**
 * File system configuration
 */
export interface FileSystemConfig extends BaseConfig {
  baseDirectory?: string;
  createDirectories?: boolean;
  backupFiles?: boolean;
  encoding?: BufferEncoding;
}

/**
 * Configuration provider interface
 */
export interface ConfigProvider<T extends BaseConfig = BaseConfig> {
  getConfig(): T;
  updateConfig(updates: Partial<T>): void;
  resetConfig(): void;
  validateConfig(config: T): boolean;
}

/**
 * Configuration schema for validation
 */
export interface ConfigSchema<T extends BaseConfig = BaseConfig> {
  properties: {
    [K in keyof T]: {
      type: string;
      required?: boolean;
      default?: T[K];
      validate?: (value: any) => boolean;
    };
  };
}

/**
 * Generic configuration provider implementation
 */
export class GenericConfigProvider<T extends BaseConfig> implements ConfigProvider<T> {
  private config: T;
  private defaultConfig: T;
  private schema?: ConfigSchema<T>;

  constructor(defaultConfig: T, schema?: ConfigSchema<T>) {
    this.defaultConfig = { ...defaultConfig };
    this.config = { ...defaultConfig };
    if (schema !== undefined) {
      this.schema = schema;
    }
  }

  getConfig(): T {
    return { ...this.config };
  }

  updateConfig(updates: Partial<T>): void {
    const newConfig = { ...this.config, ...updates };
    if (this.validateConfig(newConfig)) {
      this.config = newConfig;
    } else {
      throw new Error('Invalid configuration update');
    }
  }

  resetConfig(): void {
    this.config = { ...this.defaultConfig };
  }

  validateConfig(config: T): boolean {
    if (!this.schema) {
      return true; // No schema means no validation
    }

    try {
      for (const [key, rule] of Object.entries(this.schema.properties)) {
        const value = config[key as keyof T];

        // Check required fields
        if (rule.required && (value === undefined || value === null)) {
          throw new Error(`Required field missing: ${key}`);
        }

        // Type checking
        if (value !== undefined && value !== null) {
          const actualType = Array.isArray(value) ? 'array' : typeof value;
          if (actualType !== rule.type) {
            throw new Error(`Type mismatch for ${key}: expected ${rule.type}, got ${actualType}`);
          }

          // Custom validation
          if (rule.validate && !rule.validate(value)) {
            throw new Error(`Validation failed for ${key}`);
          }
        }
      }
      return true;
    } catch (error) {
      console.error(`Configuration validation error: ${error}`);
      return false;
    }
  }
}

/**
 * Default HTTP client configuration
 */
export const defaultHttpClientConfig: HttpClientConfig = {
  defaultTimeout: 30000,
  maxRedirects: 10,
  userAgent: 'Apicize-Client/1.0.0',
  acceptInvalidCerts: false,
  keepAlive: true,
  retryAttempts: 3,
  retryDelay: 1000,
};

/**
 * Default parser configuration
 */
export const defaultParserConfig: ParserConfig = {
  validateOnLoad: true,
  strictMode: false,
  includeWarnings: true,
  maxFileSize: 10 * 1024 * 1024, // 10MB
};

/**
 * Default logger configuration
 */
export const defaultLoggerConfig: LoggerConfig = {
  level: LogLevel.INFO,
  enableConsole: true,
  enableFile: false,
  includeTimestamp: true,
  includeContext: true,
  maxLogFileSize: 10 * 1024 * 1024, // 10MB
};

/**
 * Default telemetry configuration
 */
export const defaultTelemetryConfig: TelemetryConfig = {
  enabled: false,
  serviceName: 'apicize-lib',
  sampleRate: 1.0,
  enableConsoleExporter: false,
};

/**
 * Default file system configuration
 */
export const defaultFileSystemConfig: FileSystemConfig = {
  createDirectories: true,
  backupFiles: false,
  encoding: 'utf-8',
};

/**
 * Configuration schemas for validation
 */
export const httpClientConfigSchema: ConfigSchema<HttpClientConfig> = {
  properties: {
    defaultTimeout: { type: 'number', default: 30000, validate: v => v > 0 },
    maxRedirects: { type: 'number', default: 10, validate: v => v >= 0 },
    userAgent: { type: 'string', default: 'Apicize-Client/1.0.0' },
    acceptInvalidCerts: { type: 'boolean', default: false },
    keepAlive: { type: 'boolean', default: true },
    retryAttempts: { type: 'number', default: 3, validate: v => v >= 0 },
    retryDelay: { type: 'number', default: 1000, validate: v => v >= 0 },
  },
};

export const parserConfigSchema: ConfigSchema<ParserConfig> = {
  properties: {
    validateOnLoad: { type: 'boolean', default: true },
    strictMode: { type: 'boolean', default: false },
    includeWarnings: { type: 'boolean', default: true },
    maxFileSize: { type: 'number', default: 10 * 1024 * 1024, validate: v => v > 0 },
  },
};

export const loggerConfigSchema: ConfigSchema<LoggerConfig> = {
  properties: {
    level: {
      type: 'number',
      default: LogLevel.INFO,
      validate: v => Object.values(LogLevel).includes(v),
    },
    enableConsole: { type: 'boolean', default: true },
    enableFile: { type: 'boolean', default: false },
    logFilePath: { type: 'string' },
    maxLogFileSize: { type: 'number', default: 10 * 1024 * 1024, validate: v => v > 0 },
    includeTimestamp: { type: 'boolean', default: true },
    includeContext: { type: 'boolean', default: true },
  },
};

export const telemetryConfigSchema: ConfigSchema<TelemetryConfig> = {
  properties: {
    enabled: { type: 'boolean', default: false },
    serviceName: { type: 'string', default: 'apicize-lib' },
    endpoint: { type: 'string' },
    apiKey: { type: 'string' },
    sampleRate: { type: 'number', default: 1.0, validate: v => v >= 0 && v <= 1 },
    enableConsoleExporter: { type: 'boolean', default: false },
  },
};

export const fileSystemConfigSchema: ConfigSchema<FileSystemConfig> = {
  properties: {
    baseDirectory: { type: 'string' },
    createDirectories: { type: 'boolean', default: true },
    backupFiles: { type: 'boolean', default: false },
    encoding: { type: 'string', default: 'utf-8' },
  },
};

/**
 * Configuration manager for all services
 */
export class ConfigurationManager {
  private httpClientProvider: ConfigProvider<HttpClientConfig>;
  private parserProvider: ConfigProvider<ParserConfig>;
  private loggerProvider: ConfigProvider<LoggerConfig>;
  private telemetryProvider: ConfigProvider<TelemetryConfig>;
  private fileSystemProvider: ConfigProvider<FileSystemConfig>;

  constructor() {
    this.httpClientProvider = new GenericConfigProvider(
      defaultHttpClientConfig,
      httpClientConfigSchema
    );
    this.parserProvider = new GenericConfigProvider(defaultParserConfig, parserConfigSchema);
    this.loggerProvider = new GenericConfigProvider(defaultLoggerConfig, loggerConfigSchema);
    this.telemetryProvider = new GenericConfigProvider(
      defaultTelemetryConfig,
      telemetryConfigSchema
    );
    this.fileSystemProvider = new GenericConfigProvider(
      defaultFileSystemConfig,
      fileSystemConfigSchema
    );
  }

  /**
   * Get HTTP client configuration
   */
  getHttpClientConfig(): HttpClientConfig {
    return this.httpClientProvider.getConfig();
  }

  /**
   * Update HTTP client configuration
   */
  updateHttpClientConfig(updates: Partial<HttpClientConfig>): void {
    this.httpClientProvider.updateConfig(updates);
  }

  /**
   * Get parser configuration
   */
  getParserConfig(): ParserConfig {
    return this.parserProvider.getConfig();
  }

  /**
   * Update parser configuration
   */
  updateParserConfig(updates: Partial<ParserConfig>): void {
    this.parserProvider.updateConfig(updates);
  }

  /**
   * Get logger configuration
   */
  getLoggerConfig(): LoggerConfig {
    return this.loggerProvider.getConfig();
  }

  /**
   * Update logger configuration
   */
  updateLoggerConfig(updates: Partial<LoggerConfig>): void {
    this.loggerProvider.updateConfig(updates);
  }

  /**
   * Get telemetry configuration
   */
  getTelemetryConfig(): TelemetryConfig {
    return this.telemetryProvider.getConfig();
  }

  /**
   * Update telemetry configuration
   */
  updateTelemetryConfig(updates: Partial<TelemetryConfig>): void {
    this.telemetryProvider.updateConfig(updates);
  }

  /**
   * Get file system configuration
   */
  getFileSystemConfig(): FileSystemConfig {
    return this.fileSystemProvider.getConfig();
  }

  /**
   * Update file system configuration
   */
  updateFileSystemConfig(updates: Partial<FileSystemConfig>): void {
    this.fileSystemProvider.updateConfig(updates);
  }

  /**
   * Reset all configurations to defaults
   */
  resetAllConfigs(): void {
    this.httpClientProvider.resetConfig();
    this.parserProvider.resetConfig();
    this.loggerProvider.resetConfig();
    this.telemetryProvider.resetConfig();
    this.fileSystemProvider.resetConfig();
  }

  /**
   * Get all configurations
   */
  getAllConfigs() {
    return {
      httpClient: this.getHttpClientConfig(),
      parser: this.getParserConfig(),
      logger: this.getLoggerConfig(),
      telemetry: this.getTelemetryConfig(),
      fileSystem: this.getFileSystemConfig(),
    };
  }
}
