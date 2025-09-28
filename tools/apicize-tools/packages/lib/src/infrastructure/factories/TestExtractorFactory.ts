/**
 * Factory for creating test extractor instances
 * Provides convenient methods for creating pre-configured extractors
 * Enhanced with Factory pattern for parsers and Strategy pattern for classification
 */

import {
  TestExtractorFacade,
  TestExtractorBuilder,
  TestExtractorConfig,
} from '../../presentation/TestExtractorFacade';
import {
  getDefaultContainer,
  createContainer,
  ContainerConfig,
} from '../container/DependencyContainer';
import { ParsingOptions, DEFAULT_PARSING_OPTIONS } from '../parsing/ParsingOptions';
// import { ParserFactory, ParserType } from './ParserFactory';
// TODO: Re-enable strategy pattern after interface compatibility is resolved
// import {
//   createDefaultClassificationStrategy,
//   createConservativeClassificationStrategy,
//   createAggressiveClassificationStrategy,
//   CompositeClassificationStrategy
// } from '../../domain/test-analysis/services/strategies';

/**
 * Factory for creating test extractor instances with different configurations
 */
export class TestExtractorFactory {
  /**
   * Create a default test extractor with standard configuration
   * @returns Configured test extractor facade
   */
  static createDefault(): TestExtractorFacade {
    const container = getDefaultContainer();
    return container.createTestExtractorFacade({
      enableAnalysis: true,
      enableValidation: true,
      parsingOptions: DEFAULT_PARSING_OPTIONS,
    });
  }

  /**
   * Create a test extractor optimized for performance (minimal features)
   * @returns Performance-optimized test extractor facade
   */
  static createPerformanceOptimized(): TestExtractorFacade {
    const container = getDefaultContainer({
      defaultParsingOptions: {
        ...DEFAULT_PARSING_OPTIONS,
        includeComments: false,
        extractHelpers: false,
        includePositions: false,
        extractMetadata: false,
      },
    });

    return container.createTestExtractorFacade({
      enableAnalysis: false,
      enableValidation: false,
    });
  }

  /**
   * Create a test extractor with comprehensive analysis features
   * @returns Analysis-focused test extractor facade
   */
  static createAnalysisEnabled(): TestExtractorFacade {
    const container = getDefaultContainer({
      defaultParsingOptions: {
        ...DEFAULT_PARSING_OPTIONS,
        includeComments: true,
        extractHelpers: true,
        includePositions: true,
        extractMetadata: true,
      },
    });

    return container.createTestExtractorFacade({
      enableAnalysis: true,
      enableValidation: true,
    });
  }

  /**
   * Create a test extractor with custom configuration
   * @param config Custom configuration
   * @returns Configured test extractor facade
   */
  static createCustom(config: {
    containerConfig?: ContainerConfig;
    facadeConfig?: TestExtractorConfig;
  }): TestExtractorFacade {
    const container = config.containerConfig
      ? createContainer(config.containerConfig)
      : getDefaultContainer();

    return container.createTestExtractorFacade(config.facadeConfig);
  }

  /**
   * Create a test extractor using the builder pattern
   * @returns Test extractor builder instance
   */
  static builder(): TestExtractorBuilder {
    return new TestExtractorBuilder();
  }

  /**
   * Create a minimal test extractor for basic parsing only
   * @returns Minimal test extractor facade
   */
  static createMinimal(): TestExtractorFacade {
    const container = getDefaultContainer({
      defaultParsingOptions: {
        preserveFormatting: false,
        includeComments: false,
        extractHelpers: false,
        includePositions: false,
        extractMetadata: false,
        maxNestingDepth: false,
        validateSyntax: false,
        requestIdentifierPatterns: [],
        compilerOptions: {
          target: 'ES5',
          module: 'CommonJS',
          strict: false,
        },
      },
    });

    return container.createTestExtractorFacade({
      enableAnalysis: false,
      enableValidation: false,
    });
  }

  /**
   * Create a test extractor with specific request patterns
   * @param patterns Custom request identifier patterns
   * @returns Test extractor with custom patterns
   */
  static createWithPatterns(patterns: RegExp[]): TestExtractorFacade {
    const container = getDefaultContainer({
      defaultParsingOptions: {
        ...DEFAULT_PARSING_OPTIONS,
        requestIdentifierPatterns: patterns,
      },
    });

    return container.createTestExtractorFacade();
  }

  /**
   * Create a test extractor for a specific file type
   * @param fileType Parser type (typescript, javascript, tsx, jsx)
   * @param options Additional parsing options
   * @returns Test extractor configured for the file type
   */
  static createForFileType(
    fileType: string, // ParserType,
    options?: Partial<ParsingOptions>
  ): TestExtractorFacade {
    // TODO: Re-enable after strategy pattern compatibility is resolved
    throw new Error('createForFileType temporarily disabled - use createDefault instead');

    // const parser = ParserFactory.create({
    //   type: fileType,
    //   options,
    //   enableCaching: true,
    //   enableValidation: true,
    //   enableAnalysis: true
    // });

    // const container = createContainer({
    //   parser,
    //   classifier: createDefaultClassificationStrategy()
    // });

    // return container.createTestExtractorFacade();
  }

  // TODO: Re-enable these methods after strategy pattern compatibility is resolved
  // /**
  //  * Create a conservative test extractor (high precision, low recall)
  //  * @param fileType Parser type
  //  * @returns Conservative test extractor
  //  */
  // static createConservative(fileType: ParserType = 'typescript'): TestExtractorFacade {
  //   const parser = ParserFactory.create({
  //     type: fileType,
  //     enableCaching: true,
  //     enableValidation: true,
  //     enableAnalysis: true
  //   });

  //   const container = createContainer({
  //     parser,
  //     classifier: createConservativeClassificationStrategy()
  //   });

  //   return container.createTestExtractorFacade({
  //     enableAnalysis: true,
  //     enableValidation: true
  //   });
  // }
}

/**
 * Convenience functions for quick extractor creation
 */

/**
 * Create a default test extractor
 * @returns Default test extractor facade
 */
export function createTestExtractor(): TestExtractorFacade {
  return TestExtractorFactory.createDefault();
}

/**
 * Create a performance-optimized test extractor
 * @returns Performance-optimized test extractor facade
 */
export function createFastTestExtractor(): TestExtractorFacade {
  return TestExtractorFactory.createPerformanceOptimized();
}

/**
 * Create an analysis-enabled test extractor
 * @returns Analysis-enabled test extractor facade
 */
export function createAnalysisTestExtractor(): TestExtractorFacade {
  return TestExtractorFactory.createAnalysisEnabled();
}
