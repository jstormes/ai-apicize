/**
 * Dependency injection container for the test extraction system
 * Manages creation and lifetime of service dependencies
 */

import { ISourceCodeParser } from '../parsing/ISourceCodeParser';
// import { TypeScriptParser } from '../parsing/TypeScriptParser';
// import { AstNavigator } from '../parsing/AstNavigator';
// import { SyntaxAnalyzer } from '../parsing/SyntaxAnalyzer';
import { ITestClassifier } from '../../domain/test-analysis/services/ITestClassifier';
import { IMetadataAnalyzer } from '../../domain/test-analysis/services/IMetadataAnalyzer';
import { TestExtractionService } from '../../application/services/TestExtractionService';
import { TestAnalysisService } from '../../application/services/TestAnalysisService';
import { TestExtractorFacade, TestExtractorConfig } from '../../presentation/TestExtractorFacade';
import { ParsingOptions } from '../parsing/ParsingOptions';

/**
 * Configuration for the dependency container
 */
export interface ContainerConfig {
  defaultParsingOptions?: ParsingOptions;
  testClassifierType?: 'default' | 'pattern-based' | 'metadata-based';
  metadataAnalyzerType?: 'default' | 'enhanced';
}

/**
 * Dependency injection container
 * Provides centralized management of service dependencies
 */
export class DependencyContainer {
  private sourceCodeParser?: ISourceCodeParser;
  private testClassifier?: ITestClassifier;
  private metadataAnalyzer?: IMetadataAnalyzer;
  private extractionService?: TestExtractionService;
  private analysisService?: TestAnalysisService;

  constructor(private readonly config: ContainerConfig = {}) {}

  /**
   * Get or create source code parser instance
   * @returns Source code parser instance
   */
  getSourceCodeParser(): ISourceCodeParser {
    if (!this.sourceCodeParser) {
      // Placeholder implementation - replace with actual parser when needed
      this.sourceCodeParser = {
        parseSource: (content: string, options?: any) => {
          const { ParsedSource } = require('../parsing/ParsedSource');
          const { SourceCode } = require('../../domain/test-analysis/value-objects/SourceCode');
          const sourceCode = SourceCode.create(content);
          return new ParsedSource([], [], [], [], sourceCode.success ? sourceCode.data : undefined);
        },
        getParsingErrors: () => [],
        getParsingWarnings: () => [],
        validateSyntax: (content: string) => true,
      } as ISourceCodeParser;
    }
    return this.sourceCodeParser!;
  }

  /**
   * Get or create test classifier instance
   * @returns Test classifier instance
   */
  getTestClassifier(): ITestClassifier {
    if (!this.testClassifier) {
      // For now, we'll create a placeholder implementation
      // In the future, this would create the actual implementation based on config
      this.testClassifier = this.createTestClassifier();
    }
    return this.testClassifier;
  }

  /**
   * Get or create metadata analyzer instance
   * @returns Metadata analyzer instance
   */
  getMetadataAnalyzer(): IMetadataAnalyzer {
    if (!this.metadataAnalyzer) {
      // For now, we'll create a placeholder implementation
      // In the future, this would create the actual implementation based on config
      this.metadataAnalyzer = this.createMetadataAnalyzer();
    }
    return this.metadataAnalyzer;
  }

  /**
   * Get or create test extraction service instance
   * @returns Test extraction service instance
   */
  getTestExtractionService(): TestExtractionService {
    if (!this.extractionService) {
      this.extractionService = new TestExtractionService(
        this.getSourceCodeParser(),
        this.getTestClassifier(),
        this.getMetadataAnalyzer()
      );
    }
    return this.extractionService;
  }

  /**
   * Get or create test analysis service instance
   * @returns Test analysis service instance
   */
  getTestAnalysisService(): TestAnalysisService {
    if (!this.analysisService) {
      this.analysisService = new TestAnalysisService(
        this.getTestClassifier(),
        this.getMetadataAnalyzer()
      );
    }
    return this.analysisService;
  }

  /**
   * Create a configured test extractor facade
   * @param facadeConfig Configuration for the facade
   * @returns Configured facade instance
   */
  createTestExtractorFacade(facadeConfig?: TestExtractorConfig): TestExtractorFacade {
    const defaultConfig: TestExtractorConfig = {
      parsingOptions: this.config.defaultParsingOptions,
      enableAnalysis: true,
      enableValidation: true,
      ...facadeConfig,
    };

    return new TestExtractorFacade(
      this.getTestExtractionService(),
      this.getTestAnalysisService(),
      defaultConfig
    );
  }

  /**
   * Register a custom source code parser
   * @param parser Custom parser implementation
   */
  registerSourceCodeParser(parser: ISourceCodeParser): void {
    this.sourceCodeParser = parser;
    // Reset dependent services
    this.extractionService = undefined;
  }

  /**
   * Register a custom test classifier
   * @param classifier Custom classifier implementation
   */
  registerTestClassifier(classifier: ITestClassifier): void {
    this.testClassifier = classifier;
    // Reset dependent services
    this.extractionService = undefined;
    this.analysisService = undefined;
  }

  /**
   * Register a custom metadata analyzer
   * @param analyzer Custom analyzer implementation
   */
  registerMetadataAnalyzer(analyzer: IMetadataAnalyzer): void {
    this.metadataAnalyzer = analyzer;
    // Reset dependent services
    this.extractionService = undefined;
    this.analysisService = undefined;
  }

  /**
   * Clear all cached instances
   * Forces recreation of services on next access
   */
  reset(): void {
    this.sourceCodeParser = undefined;
    this.testClassifier = undefined;
    this.metadataAnalyzer = undefined;
    this.extractionService = undefined;
    this.analysisService = undefined;
  }

  /**
   * Create test classifier based on configuration
   */
  private createTestClassifier(): ITestClassifier {
    // Placeholder implementation - this would be replaced with actual implementations
    return {
      classifyTests(testBlocks, patterns) {
        const { Result } = require('../../domain/shared/Result');

        // Simple classification logic for now
        const results = testBlocks.map(block => ({
          testBlockId: block.id,
          isRequestSpecific: block.isRequestSpecific,
          confidence: 1.0,
          strategyUsed: 'default',
          reasons: ['Existing classification'],
          wasChanged: false,
        }));

        return Result.success({
          totalBlocks: testBlocks.length,
          classifiedBlocks: testBlocks.length,
          changedBlocks: 0,
          requestSpecificBlocks: testBlocks.filter(b => b.isRequestSpecific).length,
          sharedBlocks: testBlocks.filter(b => !b.isRequestSpecific).length,
          results,
          errors: [],
        });
      },

      classify(testBlock, context) {
        const { Result } = require('../../domain/shared/Result');
        return Result.success({
          testBlockId: testBlock.id,
          isRequestSpecific: testBlock.isRequestSpecific,
          confidence: 1.0,
          strategyUsed: 'default',
          reasons: ['Existing classification'],
          wasChanged: false,
        });
      },

      classifyBatch(testBlocks, context) {
        return this.classifyTests(testBlocks, context.patterns);
      },

      addStrategy(strategy) {
        // No-op for placeholder
      },

      removeStrategy(strategyName) {
        return false;
      },

      getStrategies() {
        return [];
      },
    };
  }

  /**
   * Create metadata analyzer based on configuration
   */
  private createMetadataAnalyzer(): IMetadataAnalyzer {
    // Placeholder implementation - this would be replaced with actual implementations
    return {
      analyze(sourceCode, options) {
        const { Result } = require('../../domain/shared/Result');
        const { CodeMetadata } = require('../../domain/test-analysis/entities/CodeMetadata');

        // Simple metadata analysis for now
        const metadataResult = CodeMetadata.create({
          id: 'default-metadata',
          sourceFile: 'source.ts',
        });

        return metadataResult;
      },

      analyzeMetadata(sourceCode) {
        return this.analyze(sourceCode);
      },

      extractRequestMetadata(sourceCode) {
        const { Result } = require('../../domain/shared/Result');
        return Result.success([]);
      },

      extractGroupMetadata(sourceCode) {
        const { Result } = require('../../domain/shared/Result');
        return Result.success([]);
      },

      extractTestMetadata(sourceCode) {
        const { Result } = require('../../domain/shared/Result');
        return Result.success([]);
      },

      validateMetadata(metadata) {
        const { Result } = require('../../domain/shared/Result');
        return Result.success({
          isValid: true,
          errors: [],
          warnings: [],
          statistics: {
            totalMetadataBlocks: 0,
            requestMetadataCount: 0,
            groupMetadataCount: 0,
            testMetadataCount: 0,
            customMetadataCount: 0,
            averageMetadataPerTest: 0,
            metadataCoveragePercentage: 0,
            duplicateIdCount: 0,
            orphanedReferenceCount: 0,
          },
          recommendations: [],
        });
      },

      findMetadataAtPosition(metadata, position) {
        const { Result } = require('../../domain/shared/Result');
        return Result.success({
          position,
          requestMetadata: [],
          groupMetadata: [],
          testMetadata: [],
          customMetadata: {},
          isRequestSpecific: false,
        });
      },
    };
  }
}

/**
 * Singleton instance of the dependency container
 */
let defaultContainer: DependencyContainer | undefined;

/**
 * Get the default dependency container instance
 * @param config Optional configuration for the container
 * @returns Default container instance
 */
export function getDefaultContainer(config?: ContainerConfig): DependencyContainer {
  if (!defaultContainer) {
    defaultContainer = new DependencyContainer(config);
  }
  return defaultContainer;
}

/**
 * Create a new dependency container instance
 * @param config Configuration for the container
 * @returns New container instance
 */
export function createContainer(config?: ContainerConfig): DependencyContainer {
  return new DependencyContainer(config);
}

/**
 * Reset the default container
 * Forces recreation on next access
 */
export function resetDefaultContainer(): void {
  if (defaultContainer) {
    defaultContainer.reset();
    defaultContainer = undefined;
  }
}
