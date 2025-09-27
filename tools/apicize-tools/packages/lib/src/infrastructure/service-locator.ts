/**
 * Service locator pattern for centralized dependency management
 * Provides a central registry for services and dependencies
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
import { Dependencies, DependencyFactory, FactoryConfig } from './factories';

/**
 * Service registration interface
 */
export interface ServiceRegistration<T = any> {
  instance?: T;
  factory?: () => T;
  singleton?: boolean;
}

/**
 * Service locator for dependency management
 */
export class ServiceLocator {
  private static instance: ServiceLocator | null = null;
  private services = new Map<string, ServiceRegistration>();
  private singletonInstances = new Map<string, any>();
  private dependencyFactory: DependencyFactory;

  constructor(config?: FactoryConfig) {
    this.dependencyFactory = new DependencyFactory(config);
    this.initializeDefaultServices();
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: FactoryConfig): ServiceLocator {
    if (!ServiceLocator.instance) {
      ServiceLocator.instance = new ServiceLocator(config);
    }
    return ServiceLocator.instance;
  }

  /**
   * Reset singleton instance (mainly for testing)
   */
  static resetInstance(): void {
    ServiceLocator.instance = null;
  }

  /**
   * Register a service
   */
  register<T>(key: string, registration: ServiceRegistration<T>): void {
    this.services.set(key, registration);

    // If it's a singleton and we have an instance, store it
    if (registration.singleton && registration.instance) {
      this.singletonInstances.set(key, registration.instance);
    }
  }

  /**
   * Register a singleton service instance
   */
  registerSingleton<T>(key: string, instance: T): void {
    this.register(key, { instance, singleton: true });
  }

  /**
   * Register a factory for creating services
   */
  registerFactory<T>(key: string, factory: () => T, singleton = false): void {
    this.register(key, { factory, singleton });
  }

  /**
   * Get a service by key
   */
  get<T>(key: string): T {
    const registration = this.services.get(key);
    if (!registration) {
      throw new Error(`Service not registered: ${key}`);
    }

    // Return singleton instance if already created
    if (registration.singleton && this.singletonInstances.has(key)) {
      return this.singletonInstances.get(key) as T;
    }

    let instance: T;

    // Create instance
    if (registration.instance) {
      instance = registration.instance;
    } else if (registration.factory) {
      instance = registration.factory();
    } else {
      throw new Error(`Invalid service registration for: ${key}`);
    }

    // Store singleton instance
    if (registration.singleton) {
      this.singletonInstances.set(key, instance);
    }

    return instance;
  }

  /**
   * Check if a service is registered
   */
  has(key: string): boolean {
    return this.services.has(key);
  }

  /**
   * Unregister a service
   */
  unregister(key: string): void {
    this.services.delete(key);
    this.singletonInstances.delete(key);
  }

  /**
   * Clear all services
   */
  clear(): void {
    this.services.clear();
    this.singletonInstances.clear();
    this.initializeDefaultServices();
  }

  /**
   * Get all dependencies as a bundle
   */
  getDependencies(): Dependencies {
    return {
      fileSystem: this.get<FileSystem>('fileSystem'),
      console: this.get<Console>('console'),
      process: this.get<Process>('process'),
      httpClient: this.get<HttpClient>('httpClient'),
      abortControllerFactory: this.get<AbortControllerFactory>('abortControllerFactory'),
      jsonParser: this.get<JsonParser>('jsonParser'),
      timer: this.get<Timer>('timer'),
      logger: this.get<Logger>('logger'),
      telemetry: this.get<Telemetry>('telemetry'),
      configurationProvider: this.get<ConfigurationProvider>('configurationProvider'),
    };
  }

  /**
   * Initialize default services
   */
  private initializeDefaultServices(): void {
    const defaults = this.dependencyFactory.getDefaultDependencies();

    // Register all default dependencies as singletons
    this.registerSingleton('fileSystem', defaults.fileSystem);
    this.registerSingleton('console', defaults.console);
    this.registerSingleton('process', defaults.process);
    this.registerSingleton('httpClient', defaults.httpClient);
    this.registerSingleton('abortControllerFactory', defaults.abortControllerFactory);
    this.registerSingleton('jsonParser', defaults.jsonParser);
    this.registerSingleton('timer', defaults.timer);
    this.registerSingleton('logger', defaults.logger);
    this.registerSingleton('telemetry', defaults.telemetry);
    this.registerSingleton('configurationProvider', defaults.configurationProvider);
  }
}

/**
 * Service locator builder for easy configuration
 */
export class ServiceLocatorBuilder {
  private registrations = new Map<string, ServiceRegistration>();
  private config?: FactoryConfig;

  /**
   * Set factory configuration
   */
  withConfig(config: FactoryConfig): ServiceLocatorBuilder {
    this.config = config;
    return this;
  }

  /**
   * Register a singleton service
   */
  registerSingleton<T>(key: string, instance: T): ServiceLocatorBuilder {
    this.registrations.set(key, { instance, singleton: true });
    return this;
  }

  /**
   * Register a factory
   */
  registerFactory<T>(key: string, factory: () => T, singleton = false): ServiceLocatorBuilder {
    this.registrations.set(key, { factory, singleton });
    return this;
  }

  /**
   * Register an instance
   */
  registerInstance<T>(key: string, instance: T): ServiceLocatorBuilder {
    this.registrations.set(key, { instance, singleton: false });
    return this;
  }

  /**
   * Build the service locator
   */
  build(): ServiceLocator {
    const locator = new ServiceLocator(this.config);

    // Register all custom services
    this.registrations.forEach((registration, key) => {
      locator.register(key, registration);
    });

    return locator;
  }
}

/**
 * Convenience function to get the default service locator
 */
export function getServiceLocator(): ServiceLocator {
  return ServiceLocator.getInstance();
}

/**
 * Convenience function to create a service locator builder
 */
export function createServiceLocatorBuilder(): ServiceLocatorBuilder {
  return new ServiceLocatorBuilder();
}
