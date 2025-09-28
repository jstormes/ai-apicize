/**
 * Comprehensive builder for creating complex architectural configurations
 * Integrates Factory, Strategy, and Repository patterns
 */

import { TestExtractorFacade } from '../../presentation/TestExtractorFacade';
import { ParserFactory, ParserType, ParserConfig } from '../factories/ParserFactory';
import { TestExtractorFactory } from '../factories/TestExtractorFactory';
import {
  CompositeClassificationStrategy,
  RequestPatternStrategy,
  MetadataCommentStrategy,
  CodeContentStrategy,
  createDefaultClassificationStrategy,
  createConservativeClassificationStrategy,
  createAggressiveClassificationStrategy,
} from '../../domain/test-analysis/services/strategies';
import { ITestRepository } from '../../domain/test-analysis/repositories/ITestRepository';
import { InMemoryTestRepository } from '../repositories/InMemoryTestRepository';
import { FileSystemTestRepository } from '../repositories/FileSystemTestRepository';
import { ParsingOptions, DEFAULT_PARSING_OPTIONS } from '../parsing/ParsingOptions';
import { createContainer, ContainerConfig } from '../container/DependencyContainer';

/**
 * Repository configuration options
 */
export type RepositoryType = 'memory' | 'filesystem' | 'custom';

/**
 * Classification strategy preset types
 */
export type ClassificationPreset = 'default' | 'conservative' | 'aggressive' | 'custom';

/**
 * Environment configuration for different deployment scenarios
 */
export type EnvironmentType =
  | 'development'
  | 'testing'
  | 'staging'
  | 'production'
  | 'ci'
  | 'custom';

/**
 * Complete architecture configuration
 */
export interface ArchitectureConfig {
  environment: EnvironmentType;
  parserType: ParserType;
  repositoryType: RepositoryType;
  classificationPreset: ClassificationPreset;
  enableCaching: boolean;
  enableAnalysis: boolean;
  enableValidation: boolean;
  enableMetrics: boolean;
  customOptions?: {
    parsingOptions?: Partial<ParsingOptions>;
    repositoryConfig?: any;
    classificationStrategy?: CompositeClassificationStrategy;
    containerConfig?: Partial<ContainerConfig>;
  };
}

/**
 * Builder for creating comprehensive architectural configurations
 */
export class ArchitectureBuilder {
  private config: Partial<ArchitectureConfig> = {};

  /**
   * Set the deployment environment
   */
  forEnvironment(environment: EnvironmentType): this {
    this.config.environment = environment;
    this.applyEnvironmentDefaults();
    return this;
  }

  /**
   * Configure the parser type
   */
  withParser(parserType: ParserType): this {
    this.config.parserType = parserType;
    return this;
  }

  /**
   * Configure the repository type
   */
  withRepository(repositoryType: RepositoryType): this {
    this.config.repositoryType = repositoryType;
    return this;
  }

  /**
   * Configure the classification strategy
   */
  withClassificationStrategy(preset: ClassificationPreset): this {
    this.config.classificationPreset = preset;
    return this;
  }

  /**
   * Enable or disable caching
   */
  withCaching(enabled: boolean = true): this {
    this.config.enableCaching = enabled;
    return this;
  }

  /**
   * Enable or disable analysis features
   */
  withAnalysis(enabled: boolean = true): this {
    this.config.enableAnalysis = enabled;
    return this;
  }

  /**
   * Enable or disable validation
   */
  withValidation(enabled: boolean = true): this {
    this.config.enableValidation = enabled;
    return this;
  }

  /**
   * Enable or disable metrics collection
   */
  withMetrics(enabled: boolean = true): this {
    this.config.enableMetrics = enabled;
    return this;
  }

  /**
   * Add custom parsing options
   */
  withCustomParsingOptions(options: Partial<ParsingOptions>): this {
    this.config.customOptions = {
      ...this.config.customOptions,
      parsingOptions: { ...this.config.customOptions?.parsingOptions, ...options },
    };
    return this;
  }

  /**
   * Add custom repository configuration
   */
  withCustomRepositoryConfig(repositoryConfig: any): this {
    this.config.customOptions = {
      ...this.config.customOptions,
      repositoryConfig,
    };
    return this;
  }

  /**
   * Add custom classification strategy
   */
  withCustomClassificationStrategy(strategy: CompositeClassificationStrategy): this {
    this.config.customOptions = {
      ...this.config.customOptions,
      classificationStrategy: strategy,
    };
    return this;
  }

  /**
   * Add custom container configuration
   */
  withCustomContainerConfig(containerConfig: Partial<ContainerConfig>): this {
    this.config.customOptions = {
      ...this.config.customOptions,
      containerConfig,
    };
    return this;
  }

  /**
   * Build the test extractor facade with all configurations
   */
  build(): TestExtractorFacade {
    const finalConfig = this.resolveConfiguration();

    // Create parser using Factory pattern
    const parser = this.createParser(finalConfig);

    // Create repository using Factory pattern
    const repository = this.createRepository(finalConfig);

    // Create classification strategy using Strategy pattern
    const classifier = this.createClassificationStrategy(finalConfig);

    // Create container with all dependencies
    const container = createContainer({
      parser,
      repository,
      classifier,
      ...finalConfig.customOptions?.containerConfig,
    });

    // Create facade with configuration
    return container.createTestExtractorFacade({
      enableAnalysis: finalConfig.enableAnalysis,
      enableValidation: finalConfig.enableValidation,
      parsingOptions: {
        ...DEFAULT_PARSING_OPTIONS,
        ...finalConfig.customOptions?.parsingOptions,
      },
    });
  }

  /**
   * Build with factory method for specific environment
   */
  buildForEnvironment(environment: EnvironmentType): TestExtractorFacade {
    return this.forEnvironment(environment).build();
  }

  /**
   * Create a development-optimized configuration
   */
  static forDevelopment(): ArchitectureBuilder {
    return new ArchitectureBuilder()
      .forEnvironment('development')
      .withParser('typescript')
      .withRepository('memory')
      .withClassificationStrategy('default')
      .withCaching(true)
      .withAnalysis(true)
      .withValidation(true)
      .withMetrics(true);
  }

  /**
   * Create a production-optimized configuration
   */
  static forProduction(): ArchitectureBuilder {
    return new ArchitectureBuilder()
      .forEnvironment('production')
      .withParser('typescript')
      .withRepository('filesystem')
      .withClassificationStrategy('conservative')
      .withCaching(true)
      .withAnalysis(false) // Disable for performance
      .withValidation(true)
      .withMetrics(true);
  }

  /**
   * Create a testing-optimized configuration
   */
  static forTesting(): ArchitectureBuilder {
    return new ArchitectureBuilder()
      .forEnvironment('testing')
      .withParser('typescript')
      .withRepository('memory')
      .withClassificationStrategy('default')
      .withCaching(false) // Disable for test isolation
      .withAnalysis(false) // Disable for speed
      .withValidation(false) // Disable for speed
      .withMetrics(false);
  }

  /**
   * Create a CI/CD-optimized configuration
   */
  static forCI(): ArchitectureBuilder {
    return new ArchitectureBuilder()
      .forEnvironment('ci')
      .withParser('typescript')
      .withRepository('memory')
      .withClassificationStrategy('conservative')
      .withCaching(false)
      .withAnalysis(false)
      .withValidation(true) // Keep validation for quality
      .withMetrics(false);
  }

  /**
   * Apply environment-specific defaults
   */
  private applyEnvironmentDefaults(): void {
    const environment = this.config.environment;

    switch (environment) {
      case 'development':
        this.config = {
          ...this.config,
          parserType: 'typescript',
          repositoryType: 'memory',
          classificationPreset: 'default',
          enableCaching: true,
          enableAnalysis: true,
          enableValidation: true,
          enableMetrics: true,
        };
        break;

      case 'production':
        this.config = {
          ...this.config,
          parserType: 'typescript',
          repositoryType: 'filesystem',
          classificationPreset: 'conservative',
          enableCaching: true,
          enableAnalysis: false,
          enableValidation: true,
          enableMetrics: true,
        };
        break;

      case 'testing':
        this.config = {
          ...this.config,
          parserType: 'typescript',
          repositoryType: 'memory',
          classificationPreset: 'default',
          enableCaching: false,
          enableAnalysis: false,
          enableValidation: false,
          enableMetrics: false,
        };
        break;

      case 'ci':
        this.config = {
          ...this.config,
          parserType: 'typescript',
          repositoryType: 'memory',
          classificationPreset: 'conservative',
          enableCaching: false,
          enableAnalysis: false,
          enableValidation: true,
          enableMetrics: false,
        };
        break;

      case 'staging':
        this.config = {
          ...this.config,
          parserType: 'typescript',
          repositoryType: 'filesystem',
          classificationPreset: 'default',
          enableCaching: true,
          enableAnalysis: true,
          enableValidation: true,
          enableMetrics: true,
        };
        break;
    }
  }

  /**
   * Resolve final configuration with defaults
   */
  private resolveConfiguration(): Required<ArchitectureConfig> {
    return {
      environment: this.config.environment || 'development',
      parserType: this.config.parserType || 'typescript',
      repositoryType: this.config.repositoryType || 'memory',
      classificationPreset: this.config.classificationPreset || 'default',
      enableCaching: this.config.enableCaching ?? true,
      enableAnalysis: this.config.enableAnalysis ?? true,
      enableValidation: this.config.enableValidation ?? true,
      enableMetrics: this.config.enableMetrics ?? true,
      customOptions: this.config.customOptions || {},
    };
  }

  /**
   * Create parser using Factory pattern
   */
  private createParser(config: Required<ArchitectureConfig>) {
    const parserConfig: ParserConfig = {
      type: config.parserType,
      options: config.customOptions.parsingOptions,
      enableCaching: config.enableCaching,
      enableValidation: config.enableValidation,
      enableAnalysis: config.enableAnalysis,
    };

    return ParserFactory.create(parserConfig);
  }

  /**
   * Create repository using Factory pattern
   */
  private createRepository(config: Required<ArchitectureConfig>): ITestRepository {
    switch (config.repositoryType) {
      case 'memory':
        return new InMemoryTestRepository();

      case 'filesystem':
        return new FileSystemTestRepository(config.customOptions.repositoryConfig);

      case 'custom':
        if (config.customOptions.repositoryConfig?.repository) {
          return config.customOptions.repositoryConfig.repository;
        }
        throw new Error('Custom repository type requires repository instance in customOptions');

      default:
        return new InMemoryTestRepository();
    }
  }

  /**
   * Create classification strategy using Strategy pattern
   */
  private createClassificationStrategy(
    config: Required<ArchitectureConfig>
  ): CompositeClassificationStrategy {
    if (config.customOptions.classificationStrategy) {
      return config.customOptions.classificationStrategy;
    }

    switch (config.classificationPreset) {
      case 'default':
        return createDefaultClassificationStrategy();
      case 'conservative':
        return createConservativeClassificationStrategy();
      case 'aggressive':
        return createAggressiveClassificationStrategy();
      case 'custom':
        throw new Error('Custom classification preset requires strategy in customOptions');
      default:
        return createDefaultClassificationStrategy();
    }
  }
}

/**
 * Convenience functions for common configurations
 */

/**
 * Create a test extractor for development
 */
export function createDevelopmentExtractor(): TestExtractorFacade {
  return ArchitectureBuilder.forDevelopment().build();
}

/**
 * Create a test extractor for production
 */
export function createProductionExtractor(): TestExtractorFacade {
  return ArchitectureBuilder.forProduction().build();
}

/**
 * Create a test extractor for testing
 */
export function createTestingExtractor(): TestExtractorFacade {
  return ArchitectureBuilder.forTesting().build();
}

/**
 * Create a test extractor for CI/CD
 */
export function createCIExtractor(): TestExtractorFacade {
  return ArchitectureBuilder.forCI().build();
}

/**
 * Create a custom test extractor with fluent interface
 */
export function createCustomExtractor(): ArchitectureBuilder {
  return new ArchitectureBuilder();
}
