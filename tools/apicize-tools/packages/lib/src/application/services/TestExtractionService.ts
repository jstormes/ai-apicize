/**
 * Application service for test extraction orchestration
 * Coordinates between domain services and infrastructure components
 */

import { ISourceCodeParser } from '../../infrastructure/parsing/ISourceCodeParser';
import { ITestClassifier } from '../../domain/test-analysis/services/ITestClassifier';
import { IMetadataAnalyzer } from '../../domain/test-analysis/services/IMetadataAnalyzer';
import { TestSuite } from '../../domain/test-analysis/entities/TestSuite';
import { Result } from '../../domain/shared/Result';
import { DomainError, InfrastructureError } from '../../domain/shared/DomainError';
import { TestExtractionResult } from '../dto/TestExtractionResult';
import { ParsingOptions } from '../../infrastructure/parsing/ParsingOptions';

/**
 * Application service responsible for orchestrating test extraction
 * This is the main entry point for test extraction operations
 */
export class TestExtractionService {
  constructor(
    private readonly parser: ISourceCodeParser,
    private readonly classifier: ITestClassifier,
    private readonly metadataAnalyzer: IMetadataAnalyzer
  ) {}

  /**
   * Extract tests from TypeScript source code
   * @param content The TypeScript source code
   * @param options Optional parsing configuration
   * @returns Result containing extracted test information
   */
  async extractTests(
    content: string,
    options?: ParsingOptions
  ): Promise<Result<TestExtractionResult, DomainError>> {
    try {
      // Step 1: Parse the source code
      const parsedSource = this.parser.parseSource(content, options);

      // Check for parsing errors
      const parsingErrors = this.parser.getParsingErrors();
      if (parsingErrors.length > 0) {
        return Result.failure(
          new InfrastructureError('PARSING_FAILED', 'Failed to parse source code', {
            errors: parsingErrors,
          })
        );
      }

      // Step 2: Create test suite from parsed data
      const testSuiteResult = TestSuite.create({
        id: 'extracted-test-suite',
        name: 'Extracted Test Suite',
      });

      if (Result.isFail(testSuiteResult)) {
        return Result.failure(testSuiteResult.error);
      }

      const testSuite = testSuiteResult.data;

      // Step 3: Classify tests as request-specific or shared
      const classificationResult = this.classifier.classifyTests(parsedSource.testBlocks, []);
      if (Result.isFail(classificationResult)) {
        return Result.failure(classificationResult.error);
      }

      const classification = classificationResult.data;

      // Step 4: Analyze metadata
      const metadataResult = this.metadataAnalyzer.analyzeMetadata(parsedSource.sourceCode);
      if (Result.isFail(metadataResult)) {
        return Result.failure(metadataResult.error);
      }

      const metadata = metadataResult.data;

      // Step 5: Create extraction result
      const requestSpecificTests = parsedSource.testBlocks.filter(block => block.isRequestSpecific);
      const sharedTests = parsedSource.testBlocks.filter(block => !block.isRequestSpecific);

      const extractionResult = new TestExtractionResult(
        testSuite,
        requestSpecificTests,
        sharedTests,
        parsedSource.imports,
        parsedSource.globalVariables,
        parsedSource.helperFunctions,
        metadata,
        this.parser.getParsingWarnings()
      );

      return Result.success(extractionResult);
    } catch (error) {
      return Result.failure(
        new InfrastructureError('EXTRACTION_FAILED', 'Unexpected error during test extraction', {
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  /**
   * Extract tests from a file path
   * @param filePath Path to the TypeScript file
   * @param options Optional parsing configuration
   * @returns Result containing extracted test information
   */
  async extractTestsFromFile(
    filePath: string,
    options?: ParsingOptions
  ): Promise<Result<TestExtractionResult, DomainError>> {
    try {
      // Read file content (this would typically be handled by a file service)
      const fs = await import('fs');
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return this.extractTests(content, options);
    } catch (error) {
      return Result.failure(
        new InfrastructureError('FILE_READ_FAILED', `Failed to read file: ${filePath}`, {
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  /**
   * Validate that source code can be parsed and extracted
   * @param content The TypeScript source code
   * @returns Result indicating validation success or failure
   */
  async validateSource(content: string): Promise<Result<boolean, DomainError>> {
    try {
      // Check syntax validity
      const isValid = this.parser.validateSyntax(content);
      if (!isValid) {
        const errors = this.parser.getParsingErrors();
        return Result.failure(
          new InfrastructureError('SYNTAX_INVALID', 'Source code has syntax errors', { errors })
        );
      }

      // Perform basic parsing to check for structure
      const parsedSource = this.parser.parseSource(content);
      const parsingErrors = this.parser.getParsingErrors();

      if (parsingErrors.length > 0) {
        return Result.failure(
          new InfrastructureError('STRUCTURE_INVALID', 'Source code has structural issues', {
            errors: parsingErrors,
          })
        );
      }

      // Check if we found any test blocks
      if (parsedSource.testBlocks.length === 0) {
        return Result.failure(
          new InfrastructureError('NO_TESTS_FOUND', 'No test blocks found in source code', {})
        );
      }

      return Result.success(true);
    } catch (error) {
      return Result.failure(
        new InfrastructureError('VALIDATION_FAILED', 'Unexpected error during validation', {
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  /**
   * Get statistics about the source code without full extraction
   * @param content The TypeScript source code
   * @returns Result containing basic statistics
   */
  async getSourceStatistics(content: string): Promise<
    Result<
      {
        totalBlocks: number;
        describeBlocks: number;
        itBlocks: number;
        importsCount: number;
        functionsCount: number;
        variablesCount: number;
      },
      DomainError
    >
  > {
    try {
      const parsedSource = this.parser.parseSource(content, {
        extractHelpers: true,
        includeComments: false, // Don't need comments for stats
      });

      const parsingErrors = this.parser.getParsingErrors();
      if (parsingErrors.length > 0) {
        return Result.failure(
          new InfrastructureError('PARSING_FAILED', 'Failed to parse source for statistics', {
            errors: parsingErrors,
          })
        );
      }

      const stats = parsedSource.getStatistics();

      return Result.success({
        totalBlocks: stats.totalTestBlocks,
        describeBlocks: stats.describeBlocks,
        itBlocks: stats.itBlocks,
        importsCount: stats.importsCount,
        functionsCount: stats.helperFunctionsCount,
        variablesCount: stats.globalVariablesCount,
      });
    } catch (error) {
      return Result.failure(
        new InfrastructureError('STATISTICS_FAILED', 'Failed to get source statistics', {
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }
}
