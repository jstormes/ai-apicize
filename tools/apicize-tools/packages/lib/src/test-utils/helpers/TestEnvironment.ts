/**
 * Test environment utilities for managing test execution context
 * Provides consistent setup and teardown for different test types
 */

import { TestExtractorFacade } from '../../presentation/TestExtractorFacade';
import {
  DependencyContainer,
  createContainer,
} from '../../infrastructure/container/DependencyContainer';
import { MockSourceCodeParser } from '../mocks/MockSourceCodeParser';
import { MockTestClassifier } from '../mocks/MockTestClassifier';
import { MockMetadataAnalyzer } from '../mocks/MockMetadataAnalyzer';

/**
 * Test environment configuration
 */
export interface TestEnvironmentConfig {
  useMocks?: boolean;
  enableAnalysis?: boolean;
  enableValidation?: boolean;
  mockResponses?: {
    parser?: boolean;
    classifier?: boolean;
    analyzer?: boolean;
  };
}

/**
 * Test environment for managing test dependencies and setup
 */
export class TestEnvironment {
  private container: DependencyContainer;
  private config: TestEnvironmentConfig;
  private mocks: {
    parser?: MockSourceCodeParser;
    classifier?: MockTestClassifier;
    analyzer?: MockMetadataAnalyzer;
  } = {};

  constructor(config: TestEnvironmentConfig = {}) {
    this.config = {
      useMocks: true,
      enableAnalysis: true,
      enableValidation: true,
      mockResponses: {
        parser: true,
        classifier: true,
        analyzer: true,
      },
      ...config,
    };

    this.container = createContainer();
    this.setupMocks();
  }

  /**
   * Setup mock implementations if configured
   */
  private setupMocks(): void {
    if (!this.config.useMocks) {
      return;
    }

    // Setup mock parser
    if (this.config.mockResponses?.parser) {
      this.mocks.parser = new MockSourceCodeParser();
      this.container.registerSourceCodeParser(this.mocks.parser);
    }

    // Setup mock classifier
    if (this.config.mockResponses?.classifier) {
      this.mocks.classifier = new MockTestClassifier();
      this.container.registerTestClassifier(this.mocks.classifier);
    }

    // Setup mock analyzer
    if (this.config.mockResponses?.analyzer) {
      this.mocks.analyzer = new MockMetadataAnalyzer();
      this.container.registerMetadataAnalyzer(this.mocks.analyzer);
    }
  }

  /**
   * Create a test extractor facade for testing
   * @returns Configured test extractor facade
   */
  createTestExtractor(): TestExtractorFacade {
    return this.container.createTestExtractorFacade({
      enableAnalysis: this.config.enableAnalysis,
      enableValidation: this.config.enableValidation,
    });
  }

  /**
   * Get mock parser for test configuration
   * @returns Mock parser instance
   */
  getMockParser(): MockSourceCodeParser | undefined {
    return this.mocks.parser;
  }

  /**
   * Get mock classifier for test configuration
   * @returns Mock classifier instance
   */
  getMockClassifier(): MockTestClassifier | undefined {
    return this.mocks.classifier;
  }

  /**
   * Get mock analyzer for test configuration
   * @returns Mock analyzer instance
   */
  getMockAnalyzer(): MockMetadataAnalyzer | undefined {
    return this.mocks.analyzer;
  }

  /**
   * Reset all mocks and environment state
   */
  reset(): void {
    this.mocks.parser?.reset();
    this.mocks.classifier?.reset();
    this.mocks.analyzer?.reset();
    this.container.reset();
  }

  /**
   * Create a unit test environment with full mocking
   * @returns Unit test environment
   */
  static forUnitTests(): TestEnvironment {
    return new TestEnvironment({
      useMocks: true,
      enableAnalysis: false,
      enableValidation: false,
      mockResponses: {
        parser: true,
        classifier: true,
        analyzer: true,
      },
    });
  }

  /**
   * Create an integration test environment with minimal mocking
   * @returns Integration test environment
   */
  static forIntegrationTests(): TestEnvironment {
    return new TestEnvironment({
      useMocks: false,
      enableAnalysis: true,
      enableValidation: true,
      mockResponses: {
        parser: false,
        classifier: false,
        analyzer: false,
      },
    });
  }

  /**
   * Create a performance test environment
   * @returns Performance test environment
   */
  static forPerformanceTests(): TestEnvironment {
    return new TestEnvironment({
      useMocks: false,
      enableAnalysis: false,
      enableValidation: false,
    });
  }

  /**
   * Create a custom test environment
   * @param config Custom configuration
   * @returns Custom test environment
   */
  static custom(config: TestEnvironmentConfig): TestEnvironment {
    return new TestEnvironment(config);
  }
}
