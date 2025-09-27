/**
 * Factory patterns for complex object creation
 * Provides centralized object creation with dependency injection support
 */

import {
  FileSystem,
  Console,
  Process,
  HttpClient,
  AbortControllerFactory,
  JsonParser,
  Timer,
  Logger,
  Telemetry,
  ConfigurationProvider,
} from './interfaces';
import {
  DefaultFileSystem,
  DefaultConsole,
  DefaultProcess,
  DefaultHttpClient,
  DefaultAbortControllerFactory,
  DefaultJsonParser,
  DefaultTimer,
  DefaultLogger,
  DefaultTelemetry,
  DefaultConfigurationProvider,
  LogLevel,
} from './implementations';

/**
 * Dependencies container for dependency injection
 */
export interface Dependencies {
  fileSystem: FileSystem;
  console: Console;
  process: Process;
  httpClient: HttpClient;
  abortControllerFactory: AbortControllerFactory;
  jsonParser: JsonParser;
  timer: Timer;
  logger: Logger;
  telemetry: Telemetry;
  configurationProvider: ConfigurationProvider;
}

/**
 * Partial dependencies for override scenarios
 */
export type PartialDependencies = Partial<Dependencies>;

/**
 * Factory configuration options
 */
export interface FactoryConfig {
  logLevel?: LogLevel;
  enableTelemetry?: boolean;
  defaultTimeout?: number;
}

/**
 * Central factory for creating dependencies with proper defaults
 */
export class DependencyFactory {
  private static instance: DependencyFactory | null = null;
  private defaultDependencies: Dependencies;

  constructor(config: FactoryConfig = {}) {
    const {
      logLevel = LogLevel.INFO,
      enableTelemetry = false,
      defaultTimeout: _defaultTimeout = 30000,
    } = config;

    // Create default dependencies
    const console = new DefaultConsole();
    const logger = new DefaultLogger(console, logLevel);
    const telemetry = enableTelemetry ? new DefaultTelemetry() : new DefaultTelemetry();

    this.defaultDependencies = {
      fileSystem: new DefaultFileSystem(),
      console,
      process: new DefaultProcess(),
      httpClient: new DefaultHttpClient(),
      abortControllerFactory: new DefaultAbortControllerFactory(),
      jsonParser: new DefaultJsonParser(),
      timer: new DefaultTimer(),
      logger,
      telemetry,
      configurationProvider: new DefaultConfigurationProvider(),
    };
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: FactoryConfig): DependencyFactory {
    if (!DependencyFactory.instance) {
      DependencyFactory.instance = new DependencyFactory(config);
    }
    return DependencyFactory.instance;
  }

  /**
   * Reset singleton instance (mainly for testing)
   */
  static resetInstance(): void {
    DependencyFactory.instance = null;
  }

  /**
   * Create dependencies with optional overrides
   */
  createDependencies(overrides: PartialDependencies = {}): Dependencies {
    return {
      ...this.defaultDependencies,
      ...overrides,
    };
  }

  /**
   * Get default dependencies
   */
  getDefaultDependencies(): Dependencies {
    return { ...this.defaultDependencies };
  }

  /**
   * Create file system with optional override
   */
  createFileSystem(override?: FileSystem): FileSystem {
    return override || this.defaultDependencies.fileSystem;
  }

  /**
   * Create console with optional override
   */
  createConsole(override?: Console): Console {
    return override || this.defaultDependencies.console;
  }

  /**
   * Create process with optional override
   */
  createProcess(override?: Process): Process {
    return override || this.defaultDependencies.process;
  }

  /**
   * Create HTTP client with optional override
   */
  createHttpClient(override?: HttpClient): HttpClient {
    return override || this.defaultDependencies.httpClient;
  }

  /**
   * Create abort controller factory with optional override
   */
  createAbortControllerFactory(override?: AbortControllerFactory): AbortControllerFactory {
    return override || this.defaultDependencies.abortControllerFactory;
  }

  /**
   * Create JSON parser with optional override
   */
  createJsonParser(override?: JsonParser): JsonParser {
    return override || this.defaultDependencies.jsonParser;
  }

  /**
   * Create timer with optional override
   */
  createTimer(override?: Timer): Timer {
    return override || this.defaultDependencies.timer;
  }

  /**
   * Create logger with optional override or custom log level
   */
  createLogger(override?: Logger, logLevel?: LogLevel): Logger {
    if (override) {
      return override;
    }
    if (logLevel !== undefined) {
      return new DefaultLogger(this.defaultDependencies.console, logLevel);
    }
    return this.defaultDependencies.logger;
  }

  /**
   * Create telemetry with optional override
   */
  createTelemetry(override?: Telemetry): Telemetry {
    return override || this.defaultDependencies.telemetry;
  }

  /**
   * Create configuration provider with optional override
   */
  createConfigurationProvider(override?: ConfigurationProvider): ConfigurationProvider {
    return override || this.defaultDependencies.configurationProvider;
  }
}

/**
 * Builder pattern for creating dependencies with fluent interface
 */
export class DependencyBuilder {
  private overrides: PartialDependencies = {};
  private factory: DependencyFactory;

  constructor(factory?: DependencyFactory) {
    this.factory = factory || DependencyFactory.getInstance();
  }

  /**
   * Set file system override
   */
  withFileSystem(fileSystem: FileSystem): DependencyBuilder {
    this.overrides.fileSystem = fileSystem;
    return this;
  }

  /**
   * Set console override
   */
  withConsole(console: Console): DependencyBuilder {
    this.overrides.console = console;
    return this;
  }

  /**
   * Set process override
   */
  withProcess(process: Process): DependencyBuilder {
    this.overrides.process = process;
    return this;
  }

  /**
   * Set HTTP client override
   */
  withHttpClient(httpClient: HttpClient): DependencyBuilder {
    this.overrides.httpClient = httpClient;
    return this;
  }

  /**
   * Set abort controller factory override
   */
  withAbortControllerFactory(factory: AbortControllerFactory): DependencyBuilder {
    this.overrides.abortControllerFactory = factory;
    return this;
  }

  /**
   * Set JSON parser override
   */
  withJsonParser(jsonParser: JsonParser): DependencyBuilder {
    this.overrides.jsonParser = jsonParser;
    return this;
  }

  /**
   * Set timer override
   */
  withTimer(timer: Timer): DependencyBuilder {
    this.overrides.timer = timer;
    return this;
  }

  /**
   * Set logger override
   */
  withLogger(logger: Logger): DependencyBuilder {
    this.overrides.logger = logger;
    return this;
  }

  /**
   * Set telemetry override
   */
  withTelemetry(telemetry: Telemetry): DependencyBuilder {
    this.overrides.telemetry = telemetry;
    return this;
  }

  /**
   * Set configuration provider override
   */
  withConfigurationProvider(provider: ConfigurationProvider): DependencyBuilder {
    this.overrides.configurationProvider = provider;
    return this;
  }

  /**
   * Build the dependencies with all overrides applied
   */
  build(): Dependencies {
    return this.factory.createDependencies(this.overrides);
  }
}

/**
 * Convenience function to create dependencies
 */
export function createDependencies(overrides: PartialDependencies = {}): Dependencies {
  return DependencyFactory.getInstance().createDependencies(overrides);
}

/**
 * Convenience function to create dependency builder
 */
export function createDependencyBuilder(): DependencyBuilder {
  return new DependencyBuilder();
}
