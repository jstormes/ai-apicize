/**
 * Configuration Builder - Phase 5 Developer Experience Enhancement
 *
 * Provides fluent builder patterns for creating and configuring
 * ApicizeClient and other complex configurations.
 */

import { ClientConfig } from '../client/apicize-client';

export interface IConfigBuilder {
  defaultTimeout(milliseconds: number): IConfigBuilder;
  maxRedirects(count: number): IConfigBuilder;
  userAgent(agent: string): IConfigBuilder;
  acceptInvalidCerts(enabled?: boolean): IConfigBuilder;
  keepAlive(enabled?: boolean): IConfigBuilder;
  build(): ClientConfig;
}

/**
 * Client Configuration Builder
 *
 * Example usage:
 * ```typescript
 * const config = ClientConfigBuilder.create()
 *   .timeout(10000)
 *   .maxRedirects(5)
 *   .retryAttempts(3)
 *   .validateCertificates(false)
 *   .build();
 *
 * const client = new ApicizeClient(config);
 * ```
 */
export class ClientConfigBuilder implements IConfigBuilder {
  private config: Partial<ClientConfig> = {};

  private constructor() {}

  /**
   * Creates a new client configuration builder
   */
  static create(): ClientConfigBuilder {
    return new ClientConfigBuilder();
  }

  /**
   * Creates a builder with default production settings
   */
  static production(): ClientConfigBuilder {
    return new ClientConfigBuilder()
      .defaultTimeout(30000)
      .maxRedirects(10)
      .acceptInvalidCerts(false)
      .keepAlive(true);
  }

  /**
   * Creates a builder with default development settings
   */
  static development(): ClientConfigBuilder {
    return new ClientConfigBuilder()
      .defaultTimeout(60000)
      .maxRedirects(20)
      .acceptInvalidCerts(true)
      .keepAlive(false);
  }

  /**
   * Creates a builder with default testing settings
   */
  static testing(): ClientConfigBuilder {
    return new ClientConfigBuilder()
      .defaultTimeout(5000)
      .maxRedirects(5)
      .acceptInvalidCerts(true)
      .keepAlive(false);
  }

  /**
   * Sets the default timeout for requests
   */
  defaultTimeout(milliseconds: number): ClientConfigBuilder {
    this.config.defaultTimeout = milliseconds;
    return this;
  }

  /**
   * Sets the maximum number of redirects to follow
   */
  maxRedirects(count: number): ClientConfigBuilder {
    this.config.maxRedirects = count;
    return this;
  }

  /**
   * Sets the user agent string
   */
  userAgent(agent: string): ClientConfigBuilder {
    this.config.userAgent = agent;
    return this;
  }

  /**
   * Enables or disables accepting invalid certificates
   */
  acceptInvalidCerts(enabled = true): ClientConfigBuilder {
    this.config.acceptInvalidCerts = enabled;
    return this;
  }

  /**
   * Enables or disables keep-alive connections
   */
  keepAlive(enabled = true): ClientConfigBuilder {
    this.config.keepAlive = enabled;
    return this;
  }

  /**
   * Builds and returns the client configuration
   */
  build(): ClientConfig {
    return {
      defaultTimeout: this.config.defaultTimeout,
      maxRedirects: this.config.maxRedirects,
      userAgent: this.config.userAgent,
      acceptInvalidCerts: this.config.acceptInvalidCerts,
      keepAlive: this.config.keepAlive,
    };
  }

  /**
   * Merges another configuration into this builder
   */
  merge(other: Partial<ClientConfig>): ClientConfigBuilder {
    Object.assign(this.config, other);
    return this;
  }

  /**
   * Clones the current builder state
   */
  clone(): ClientConfigBuilder {
    const cloned = new ClientConfigBuilder();
    cloned.config = { ...this.config };
    return cloned;
  }

  /**
   * Resets the builder to initial state
   */
  reset(): ClientConfigBuilder {
    this.config = {};
    return this;
  }
}

export interface IEnvironmentConfigBuilder {
  name(name: string): IEnvironmentConfigBuilder;
  baseUrl(service: string, url: string): IEnvironmentConfigBuilder;
  baseUrls(urls: Record<string, string>): IEnvironmentConfigBuilder;
  header(name: string, value: string): IEnvironmentConfigBuilder;
  headers(headers: Record<string, string>): IEnvironmentConfigBuilder;
  timeout(type: 'default' | 'long', milliseconds: number): IEnvironmentConfigBuilder;
  feature(name: string, enabled: boolean): IEnvironmentConfigBuilder;
  features(features: Record<string, boolean>): IEnvironmentConfigBuilder;
  build(): Record<string, any>;
}

/**
 * Environment Configuration Builder
 *
 * Example usage:
 * ```typescript
 * const envConfig = EnvironmentConfigBuilder.create()
 *   .name('development')
 *   .baseUrl('api', 'http://localhost:3000')
 *   .baseUrl('auth', 'http://localhost:4000')
 *   .header('X-Environment', 'dev')
 *   .timeout('default', 30000)
 *   .feature('debugMode', true)
 *   .build();
 * ```
 */
export class EnvironmentConfigBuilder implements IEnvironmentConfigBuilder {
  private config: Partial<Record<string, any>> = {
    baseUrls: {},
    headers: {},
    timeouts: {},
    features: {},
  };

  private constructor() {}

  /**
   * Creates a new environment configuration builder
   */
  static create(): EnvironmentConfigBuilder {
    return new EnvironmentConfigBuilder();
  }

  /**
   * Creates a development environment configuration
   */
  static development(): EnvironmentConfigBuilder {
    return new EnvironmentConfigBuilder()
      .name('development')
      .baseUrl('api', 'http://localhost:3000')
      .baseUrl('auth', 'http://localhost:4000')
      .header('X-Environment', 'dev')
      .header('X-Debug', 'true')
      .timeout('default', 30000)
      .timeout('long', 60000)
      .feature('debugMode', true)
      .feature('mockResponses', true)
      .feature('rateLimiting', false);
  }

  /**
   * Creates a production environment configuration
   */
  static production(): EnvironmentConfigBuilder {
    return new EnvironmentConfigBuilder()
      .name('production')
      .baseUrl('api', 'https://api.example.com')
      .baseUrl('auth', 'https://auth.example.com')
      .header('X-Environment', 'prod')
      .timeout('default', 30000)
      .timeout('long', 120000)
      .feature('debugMode', false)
      .feature('mockResponses', false)
      .feature('rateLimiting', true);
  }

  /**
   * Creates a staging environment configuration
   */
  static staging(): EnvironmentConfigBuilder {
    return new EnvironmentConfigBuilder()
      .name('staging')
      .baseUrl('api', 'https://staging-api.example.com')
      .baseUrl('auth', 'https://staging-auth.example.com')
      .header('X-Environment', 'staging')
      .timeout('default', 30000)
      .timeout('long', 90000)
      .feature('debugMode', true)
      .feature('mockResponses', false)
      .feature('rateLimiting', true);
  }

  /**
   * Sets the environment name
   */
  name(name: string): EnvironmentConfigBuilder {
    this.config.name = name;
    return this;
  }

  /**
   * Sets a base URL for a service
   */
  baseUrl(service: string, url: string): EnvironmentConfigBuilder {
    if (!this.config.baseUrls) {
      this.config.baseUrls = {};
    }
    this.config.baseUrls[service] = url;
    return this;
  }

  /**
   * Sets multiple base URLs
   */
  baseUrls(urls: Record<string, string>): EnvironmentConfigBuilder {
    this.config.baseUrls = { ...this.config.baseUrls, ...urls };
    return this;
  }

  /**
   * Sets a default header
   */
  header(name: string, value: string): EnvironmentConfigBuilder {
    if (!this.config.headers) {
      this.config.headers = {};
    }
    this.config.headers[name] = value;
    return this;
  }

  /**
   * Sets multiple default headers
   */
  headers(headers: Record<string, string>): EnvironmentConfigBuilder {
    this.config.headers = { ...this.config.headers, ...headers };
    return this;
  }

  /**
   * Sets a timeout value
   */
  timeout(type: 'default' | 'long', milliseconds: number): EnvironmentConfigBuilder {
    if (!this.config.timeouts) {
      this.config.timeouts = {};
    }
    this.config.timeouts[type] = milliseconds;
    return this;
  }

  /**
   * Sets a feature flag
   */
  feature(name: string, enabled: boolean): EnvironmentConfigBuilder {
    if (!this.config.features) {
      this.config.features = {};
    }
    this.config.features[name] = enabled;
    return this;
  }

  /**
   * Sets multiple feature flags
   */
  features(features: Record<string, boolean>): EnvironmentConfigBuilder {
    this.config.features = { ...this.config.features, ...features };
    return this;
  }

  /**
   * Builds and returns the environment configuration
   */
  build(): Record<string, any> {
    return {
      name: this.config.name || 'default',
      baseUrls: this.config.baseUrls || {},
      headers: this.config.headers || {},
      timeouts: this.config.timeouts || { default: 30000 },
      features: this.config.features || {},
    };
  }

  /**
   * Merges another configuration into this builder
   */
  merge(other: Partial<Record<string, any>>): EnvironmentConfigBuilder {
    if (other.baseUrls) {
      this.config.baseUrls = { ...this.config.baseUrls, ...other.baseUrls };
    }
    if (other.headers) {
      this.config.headers = { ...this.config.headers, ...other.headers };
    }
    if (other.timeouts) {
      this.config.timeouts = { ...this.config.timeouts, ...other.timeouts };
    }
    if (other.features) {
      this.config.features = { ...this.config.features, ...other.features };
    }
    if (other.name) {
      this.config.name = other.name;
    }
    return this;
  }

  /**
   * Clones the current builder state
   */
  clone(): EnvironmentConfigBuilder {
    const cloned = new EnvironmentConfigBuilder();
    cloned.config = JSON.parse(JSON.stringify(this.config));
    return cloned;
  }

  /**
   * Resets the builder to initial state
   */
  reset(): EnvironmentConfigBuilder {
    this.config = {
      baseUrls: {},
      headers: {},
      timeouts: {},
      features: {},
    };
    return this;
  }
}
