/**
 * Facade for test extraction operations
 * Provides a simplified public API that hides the complexity of the underlying architecture
 */

import { TestExtractionService } from '../application/services/TestExtractionService';
import { TestAnalysisService } from '../application/services/TestAnalysisService';
import { TestExtractionResult } from '../application/dto/TestExtractionResult';
import { TestAnalysisReport } from '../application/services/TestAnalysisService';
import { ParsingOptions } from '../infrastructure/parsing/ParsingOptions';
import { Result } from '../domain/shared/Result';
import { DomainError } from '../domain/shared/DomainError';

/**
 * Configuration for the test extractor facade
 */
export interface TestExtractorConfig {
  parsingOptions?: ParsingOptions;
  enableAnalysis?: boolean;
  enableValidation?: boolean;
}

/**
 * Simple result type for public API
 */
export interface ExtractionResult {
  success: boolean;
  data?: TestExtractionResult;
  analysis?: TestAnalysisReport;
  error?: string;
  warnings?: string[];
}

/**
 * Public facade for test extraction functionality
 * This is the main entry point for external consumers
 */
export class TestExtractorFacade {
  constructor(
    private readonly extractionService: TestExtractionService,
    private readonly analysisService: TestAnalysisService,
    private readonly config: TestExtractorConfig = {}
  ) {}

  /**
   * Extract tests from TypeScript source code
   * @param content The TypeScript source code
   * @param options Optional configuration overrides
   * @returns Promise with extraction results
   */
  async extractTests(
    content: string,
    options?: Partial<TestExtractorConfig>
  ): Promise<ExtractionResult> {
    const effectiveConfig = { ...this.config, ...options };

    try {
      // Step 1: Validate if requested
      if (effectiveConfig.enableValidation) {
        const validationResult = await this.extractionService.validateSource(content);
        if (Result.isFail(validationResult)) {
          return {
            success: false,
            error: validationResult.error?.message || 'Validation failed',
            warnings: [],
          };
        }
      }

      // Step 2: Extract tests
      const extractionResult = await this.extractionService.extractTests(
        content,
        effectiveConfig.parsingOptions
      );

      if (Result.isFail(extractionResult)) {
        return {
          success: false,
          error: extractionResult.error?.message || 'Extraction failed',
          warnings: [],
        };
      }

      const data = extractionResult.data;

      // Step 3: Analyze if requested
      let analysis: TestAnalysisReport | undefined;
      if (effectiveConfig.enableAnalysis) {
        const analysisResult = await this.analysisService.analyzeTestSuite(data.testSuite);
        if (Result.isOk(analysisResult)) {
          analysis = analysisResult.data;
        }
        // Don't fail the entire operation if analysis fails, just skip it
      }

      return {
        success: true,
        data,
        analysis,
        warnings: data.warnings,
      };
    } catch (error) {
      return {
        success: false,
        error: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
        warnings: [],
      };
    }
  }

  /**
   * Extract tests from a file
   * @param filePath Path to the TypeScript file
   * @param options Optional configuration overrides
   * @returns Promise with extraction results
   */
  async extractTestsFromFile(
    filePath: string,
    options?: Partial<TestExtractorConfig>
  ): Promise<ExtractionResult> {
    const effectiveConfig = { ...this.config, ...options };

    try {
      const extractionResult = await this.extractionService.extractTestsFromFile(
        filePath,
        effectiveConfig.parsingOptions
      );

      if (Result.isFail(extractionResult)) {
        return {
          success: false,
          error: extractionResult.error?.message || 'Extraction failed',
          warnings: [],
        };
      }

      const data = extractionResult.data;

      // Analyze if requested
      let analysis: TestAnalysisReport | undefined;
      if (effectiveConfig.enableAnalysis) {
        const analysisResult = await this.analysisService.analyzeTestSuite(data.testSuite);
        if (Result.isOk(analysisResult)) {
          analysis = analysisResult.data;
        }
      }

      return {
        success: true,
        data,
        analysis,
        warnings: data.warnings,
      };
    } catch (error) {
      return {
        success: false,
        error: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
        warnings: [],
      };
    }
  }

  /**
   * Validate TypeScript source code without full extraction
   * @param content The TypeScript source code
   * @returns Promise with validation result
   */
  async validateSource(content: string): Promise<{ valid: boolean; error?: string }> {
    try {
      const result = await this.extractionService.validateSource(content);

      if (Result.isFail(result)) {
        return {
          valid: false,
          error: result.error?.message || 'Operation failed',
        };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: `Validation error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Get basic statistics about source code
   * @param content The TypeScript source code
   * @returns Promise with statistics
   */
  async getStatistics(content: string): Promise<{
    success: boolean;
    stats?: {
      totalBlocks: number;
      describeBlocks: number;
      itBlocks: number;
      importsCount: number;
      functionsCount: number;
      variablesCount: number;
    };
    error?: string;
  }> {
    try {
      const result = await this.extractionService.getSourceStatistics(content);

      if (Result.isFail(result)) {
        return {
          success: false,
          error: result.error?.message || 'Operation failed',
        };
      }

      return {
        success: true,
        stats: result.data,
      };
    } catch (error) {
      return {
        success: false,
        error: `Statistics error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Create a new facade instance with different configuration
   * @param config New configuration
   * @returns New facade instance
   */
  withConfig(config: Partial<TestExtractorConfig>): TestExtractorFacade {
    return new TestExtractorFacade(this.extractionService, this.analysisService, {
      ...this.config,
      ...config,
    });
  }

  /**
   * Get the current configuration
   * @returns Current configuration
   */
  getConfig(): TestExtractorConfig {
    return { ...this.config };
  }
}

/**
 * Builder for creating configured TestExtractorFacade instances
 */
export class TestExtractorBuilder {
  private config: TestExtractorConfig = {};

  /**
   * Set parsing options
   * @param options Parsing options
   * @returns Builder instance for chaining
   */
  withParsingOptions(options: ParsingOptions): this {
    this.config.parsingOptions = options;
    return this;
  }

  /**
   * Enable or disable analysis
   * @param enabled Whether to enable analysis
   * @returns Builder instance for chaining
   */
  withAnalysis(enabled: boolean = true): this {
    this.config.enableAnalysis = enabled;
    return this;
  }

  /**
   * Enable or disable validation
   * @param enabled Whether to enable validation
   * @returns Builder instance for chaining
   */
  withValidation(enabled: boolean = true): this {
    this.config.enableValidation = enabled;
    return this;
  }

  /**
   * Build the facade with the configured options
   * @param extractionService The extraction service instance
   * @param analysisService The analysis service instance
   * @returns Configured facade instance
   */
  build(
    extractionService: TestExtractionService,
    analysisService: TestAnalysisService
  ): TestExtractorFacade {
    return new TestExtractorFacade(extractionService, analysisService, this.config);
  }
}
