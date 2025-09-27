/**
 * Test-specific configurations for different testing scenarios
 * Part of Phase 3: Testing Improvements
 */

import { IConfigProvider, IDependencyContainer } from './dependency-interfaces';
import { TestDoubleFactory } from './test-doubles';

/**
 * Test configuration options
 */
export interface TestConfig {
  /** Test execution timeout in milliseconds */
  timeout?: number;
  /** Number of retry attempts for flaky tests */
  retries?: number;
  /** Enable verbose logging during tests */
  verbose?: boolean;
  /** Test environment (unit, integration, e2e) */
  environment?: 'unit' | 'integration' | 'e2e';
  /** Enable performance monitoring */
  performance?: boolean;
  /** Mock external dependencies */
  mockExternals?: boolean;
  /** Use fake timers */
  useFakeTimers?: boolean;
  /** Custom test data directory */
  testDataDir?: string;
  /** Enable test coverage collection */
  coverage?: boolean;
  /** Custom reporter options */
  reporter?: {
    type?: 'console' | 'json' | 'html';
    outputDir?: string;
    includeStackTrace?: boolean;
  };
}

/**
 * Configuration presets for different test types
 */
export class TestConfigPresets {
  /**
   * Configuration for fast unit tests
   */
  static unit(): TestConfig {
    return {
      timeout: 5000,
      retries: 0,
      verbose: false,
      environment: 'unit',
      performance: false,
      mockExternals: true,
      useFakeTimers: true,
      coverage: true,
      reporter: {
        type: 'console',
        includeStackTrace: false,
      },
    };
  }

  /**
   * Configuration for integration tests
   */
  static integration(): TestConfig {
    return {
      timeout: 30000,
      retries: 2,
      verbose: true,
      environment: 'integration',
      performance: true,
      mockExternals: false,
      useFakeTimers: false,
      coverage: true,
      reporter: {
        type: 'json',
        includeStackTrace: true,
      },
    };
  }

  /**
   * Configuration for end-to-end tests
   */
  static e2e(): TestConfig {
    return {
      timeout: 60000,
      retries: 3,
      verbose: true,
      environment: 'e2e',
      performance: true,
      mockExternals: false,
      useFakeTimers: false,
      coverage: false,
      reporter: {
        type: 'html',
        outputDir: './test-results',
        includeStackTrace: true,
      },
    };
  }

  /**
   * Configuration for performance/stress tests
   */
  static performance(): TestConfig {
    return {
      timeout: 120000,
      retries: 1,
      verbose: false,
      environment: 'integration',
      performance: true,
      mockExternals: false,
      useFakeTimers: false,
      coverage: false,
      reporter: {
        type: 'json',
        outputDir: './performance-results',
        includeStackTrace: false,
      },
    };
  }

  /**
   * Configuration for debugging tests
   */
  static debug(): TestConfig {
    return {
      timeout: 300000, // 5 minutes for debugging
      retries: 0,
      verbose: true,
      environment: 'unit',
      performance: false,
      mockExternals: true,
      useFakeTimers: false, // Real timers for debugging
      coverage: false,
      reporter: {
        type: 'console',
        includeStackTrace: true,
      },
    };
  }
}

/**
 * Test environment configuration manager
 */
export class TestEnvironmentConfig {
  private config: TestConfig;
  private dependencies: IDependencyContainer;

  constructor(config: TestConfig = TestConfigPresets.unit()) {
    this.config = { ...config };
    this.dependencies = new SimpleDependencyContainer();
    this.setupDependencies();
  }

  /**
   * Get current configuration
   */
  getConfig(): TestConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<TestConfig>): void {
    this.config = { ...this.config, ...updates };
    this.setupDependencies();
  }

  /**
   * Get dependency container
   */
  getDependencies(): IDependencyContainer {
    return this.dependencies;
  }

  /**
   * Setup test dependencies based on configuration
   */
  private setupDependencies(): void {
    this.dependencies.clear();

    if (this.config.mockExternals) {
      // Register test doubles
      const testDoubles = TestDoubleFactory.createFullSuite();
      this.dependencies.registerInstance('fileSystem', testDoubles.fileSystem);
      this.dependencies.registerInstance('httpClient', testDoubles.httpClient);
      this.dependencies.registerInstance('console', testDoubles.console);
      this.dependencies.registerInstance('timeProvider', testDoubles.timeProvider);
    } else {
      // Register real implementations
      const { DependencyFactory } = require('./dependency-interfaces');
      this.dependencies.registerInstance('fileSystem', DependencyFactory.createFileSystem());
      this.dependencies.registerInstance('httpClient', DependencyFactory.createHttpClient());
      this.dependencies.registerInstance('console', DependencyFactory.createConsole());
      this.dependencies.registerInstance('timeProvider', DependencyFactory.createTimeProvider());
    }

    // Register configuration provider
    const configProvider = new TestConfigProvider(this.config);
    this.dependencies.registerInstance('configProvider', configProvider);
  }

  /**
   * Create Jest configuration based on test config
   */
  toJestConfig(): any {
    const jestConfig: any = {
      testTimeout: this.config.timeout || 5000,
      verbose: this.config.verbose || false,
      collectCoverage: this.config.coverage || false,
    };

    if (this.config.retries && this.config.retries > 0) {
      jestConfig.jest_retries = this.config.retries;
    }

    if (this.config.useFakeTimers) {
      jestConfig.fakeTimers = {
        enableGlobally: true,
      };
    }

    if (this.config.reporter) {
      switch (this.config.reporter.type) {
        case 'json':
          jestConfig.reporters = [
            [
              'jest-json-reporter',
              {
                outputPath: this.config.reporter.outputDir || './test-results.json',
              },
            ],
          ];
          break;
        case 'html':
          jestConfig.reporters = [
            [
              'jest-html-reporter',
              {
                outputPath: this.config.reporter.outputDir || './test-results.html',
              },
            ],
          ];
          break;
        default:
          jestConfig.reporters = ['default'];
      }
    }

    return jestConfig;
  }
}

/**
 * Simple dependency container implementation for tests
 */
class SimpleDependencyContainer implements IDependencyContainer {
  private singletons = new Map<string, any>();
  private transients = new Map<string, () => any>();
  private instances = new Map<string, any>();

  registerSingleton<T>(token: string, factory: () => T): void {
    this.singletons.set(token, factory);
  }

  registerTransient<T>(token: string, factory: () => T): void {
    this.transients.set(token, factory);
  }

  registerInstance<T>(token: string, instance: T): void {
    this.instances.set(token, instance);
  }

  resolve<T>(token: string): T {
    // Check instances first
    if (this.instances.has(token)) {
      return this.instances.get(token);
    }

    // Check singletons
    if (this.singletons.has(token)) {
      const factory = this.singletons.get(token);
      const instance = factory();
      this.instances.set(token, instance); // Cache as instance
      return instance;
    }

    // Check transients
    if (this.transients.has(token)) {
      const factory = this.transients.get(token);
      if (factory) {
        return factory();
      }
    }

    throw new Error(`Service '${token}' not registered`);
  }

  isRegistered(token: string): boolean {
    return this.instances.has(token) || this.singletons.has(token) || this.transients.has(token);
  }

  clear(): void {
    this.instances.clear();
    this.singletons.clear();
    this.transients.clear();
  }
}

/**
 * Test-specific configuration provider
 */
class TestConfigProvider implements IConfigProvider {
  private config: Map<string, any> = new Map();

  constructor(testConfig: TestConfig) {
    // Convert test config to flat key-value pairs
    this.config.set('test.timeout', testConfig.timeout);
    this.config.set('test.retries', testConfig.retries);
    this.config.set('test.verbose', testConfig.verbose);
    this.config.set('test.environment', testConfig.environment);
    this.config.set('test.performance', testConfig.performance);
    this.config.set('test.mockExternals', testConfig.mockExternals);
    this.config.set('test.useFakeTimers', testConfig.useFakeTimers);
    this.config.set('test.testDataDir', testConfig.testDataDir);
    this.config.set('test.coverage', testConfig.coverage);

    if (testConfig.reporter) {
      this.config.set('test.reporter.type', testConfig.reporter.type);
      this.config.set('test.reporter.outputDir', testConfig.reporter.outputDir);
      this.config.set('test.reporter.includeStackTrace', testConfig.reporter.includeStackTrace);
    }
  }

  get<T = any>(key: string, defaultValue?: T): T {
    return this.config.get(key) ?? defaultValue;
  }

  set(key: string, value: any): void {
    this.config.set(key, value);
  }

  has(key: string): boolean {
    return this.config.has(key);
  }

  async loadFromFile(_path: string): Promise<void> {
    // Mock implementation for tests
    throw new Error('loadFromFile not implemented in test config provider');
  }

  async saveToFile(_path: string): Promise<void> {
    // Mock implementation for tests
    throw new Error('saveToFile not implemented in test config provider');
  }

  getAll(): Record<string, any> {
    return Object.fromEntries(this.config);
  }
}

/**
 * Test scenario configuration for specific test cases
 */
export class TestScenarioConfig {
  private scenarios: Map<string, TestConfig> = new Map();

  /**
   * Define a test scenario with specific configuration
   */
  defineScenario(name: string, config: TestConfig): void {
    this.scenarios.set(name, config);
  }

  /**
   * Get configuration for a scenario
   */
  getScenario(name: string): TestConfig | undefined {
    return this.scenarios.get(name);
  }

  /**
   * Create environment for a scenario
   */
  createEnvironment(scenarioName: string): TestEnvironmentConfig {
    const config = this.getScenario(scenarioName);
    if (!config) {
      throw new Error(`Test scenario '${scenarioName}' not found`);
    }
    return new TestEnvironmentConfig(config);
  }

  /**
   * Define common test scenarios
   */
  defineCommonScenarios(): void {
    this.defineScenario('fast-unit', TestConfigPresets.unit());
    this.defineScenario('slow-unit', {
      ...TestConfigPresets.unit(),
      timeout: 15000,
    });
    this.defineScenario('integration', TestConfigPresets.integration());
    this.defineScenario('e2e', TestConfigPresets.e2e());
    this.defineScenario('performance', TestConfigPresets.performance());
    this.defineScenario('debug', TestConfigPresets.debug());

    // Custom scenarios
    this.defineScenario('network-tests', {
      ...TestConfigPresets.integration(),
      timeout: 45000,
      retries: 5,
      mockExternals: false,
    });

    this.defineScenario('file-operations', {
      ...TestConfigPresets.unit(),
      mockExternals: true,
      testDataDir: './test-fixtures',
    });

    this.defineScenario('auth-tests', {
      ...TestConfigPresets.integration(),
      timeout: 20000,
      verbose: true,
    });
  }

  /**
   * Get all defined scenarios
   */
  getAllScenarios(): string[] {
    return Array.from(this.scenarios.keys());
  }
}

/**
 * Global test configuration manager
 */
export class GlobalTestConfig {
  private static instance: GlobalTestConfig;
  private currentEnvironment: TestEnvironmentConfig;
  private scenarios: TestScenarioConfig;

  private constructor() {
    this.currentEnvironment = new TestEnvironmentConfig();
    this.scenarios = new TestScenarioConfig();
    this.scenarios.defineCommonScenarios();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): GlobalTestConfig {
    if (!GlobalTestConfig.instance) {
      GlobalTestConfig.instance = new GlobalTestConfig();
    }
    return GlobalTestConfig.instance;
  }

  /**
   * Switch to a different test scenario
   */
  useScenario(scenarioName: string): void {
    this.currentEnvironment = this.scenarios.createEnvironment(scenarioName);
  }

  /**
   * Get current test environment
   */
  getCurrentEnvironment(): TestEnvironmentConfig {
    return this.currentEnvironment;
  }

  /**
   * Get scenario manager
   */
  getScenarios(): TestScenarioConfig {
    return this.scenarios;
  }

  /**
   * Reset to default configuration
   */
  reset(): void {
    this.currentEnvironment = new TestEnvironmentConfig();
  }
}
