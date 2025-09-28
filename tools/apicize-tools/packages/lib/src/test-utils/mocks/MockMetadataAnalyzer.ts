/**
 * Mock implementation of IMetadataAnalyzer for testing
 * Provides controllable behavior for unit tests
 */

import { IMetadataAnalyzer } from '../../domain/test-analysis/services/IMetadataAnalyzer';
import { ParsedMetadata } from '../../infrastructure/parsing/ParsedSource';
import { TestBlock } from '../../domain/test-analysis/entities/TestBlock';
import { CodeMetadata } from '../../domain/test-analysis/entities/CodeMetadata';
import { SourceCode } from '../../domain/test-analysis/value-objects/SourceCode';
import { SourcePosition } from '../../domain/test-analysis/value-objects/SourcePosition';
import { Result } from '../../domain/shared/Result';
import { DomainError, ValidationError, BusinessRuleError } from '../../domain/shared/DomainError';

// Import the types used by the interface
type RequestMetadata = any; // These would be defined elsewhere
type GroupMetadata = any;
type TestMetadata = any;
type MetadataValidationReport = {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  statistics: {
    totalMetadataBlocks: number;
    requestMetadataCount: number;
    groupMetadataCount: number;
    testMetadataCount: number;
    customMetadataCount: number;
    averageMetadataPerTest: number;
    metadataCoveragePercentage: number;
    duplicateIdCount: number;
    orphanedReferenceCount: number;
  };
  recommendations: string[];
};
type PositionalMetadata = {
  position: SourcePosition;
  requestMetadata: RequestMetadata[];
  groupMetadata: GroupMetadata[];
  testMetadata: TestMetadata[];
  customMetadata: Record<string, any>;
  isRequestSpecific: boolean;
};

/**
 * Mock metadata analyzer with configurable responses
 */
export class MockMetadataAnalyzer implements IMetadataAnalyzer {
  private responses = new Map<string, CodeMetadata>();
  private errors = new Map<string, DomainError>();
  private shouldThrow = false;
  private throwError: Error | null = null;
  private callHistory: { metadata: ParsedMetadata; testBlocks: TestBlock[] }[] = [];

  /**
   * Configure a mock response for specific metadata
   * @param metadataKey Key to identify the metadata (could be hash or unique identifier)
   * @param result Code metadata to return
   */
  mockAnalysisResult(metadataKey: string, result: CodeMetadata): void {
    this.responses.set(metadataKey, result);
  }

  /**
   * Configure an error response for specific metadata
   * @param metadataKey Key to identify the metadata
   * @param error Domain error to return
   */
  mockAnalysisError(metadataKey: string, error: DomainError): void {
    this.errors.set(metadataKey, error);
  }

  /**
   * Configure the analyzer to throw an error
   * @param error Error to throw, or null to stop throwing
   */
  setShouldThrow(error: Error | null): void {
    this.shouldThrow = !!error;
    this.throwError = error;
  }

  /**
   * Analyze metadata (mock implementation)
   */
  analyzeMetadata(sourceCode: SourceCode): Result<CodeMetadata, ValidationError> {
    // Track call history
    this.callHistory.push({ sourceCode });

    if (this.shouldThrow && this.throwError) {
      throw this.throwError;
    }

    // Create a simple key for lookups (could be improved with better hashing)
    const metadataKey = this.createMetadataKey(metadata, testBlocks);

    // Check for configured error
    const error = this.errors.get(metadataKey);
    if (error) {
      return Result.failure(error);
    }

    // Check for configured response
    const result = this.responses.get(metadataKey);
    if (result) {
      return Result.success(result);
    }

    // Default behavior: create simple analyzed metadata
    const metadataResult = CodeMetadata.create({
      id: 'mock-metadata',
      sourceFile: 'mock.ts'
    });

    if (!metadataResult.success) {
      return Result.failure(new ValidationError('METADATA_CREATION_FAILED', 'Failed to create mock metadata'));
    }

    const analyzedMetadata = metadataResult.data;

    return Result.success(analyzedMetadata);
  }

  /**
   * Create a key for metadata lookup
   * @param metadata Parsed metadata
   * @param testBlocks Test blocks
   * @returns String key for lookup
   */
  private createMetadataKey(metadata: ParsedMetadata, testBlocks: TestBlock[]): string {
    const commentCount = metadata.comments.length;
    const annotationCount = metadata.annotations.length;
    const testBlockCount = testBlocks.length;
    return `${commentCount}-${annotationCount}-${testBlockCount}`;
  }

  /**
   * Get call history for testing verification
   * @returns Array of all analyze calls made
   */
  getCallHistory(): { metadata: ParsedMetadata; testBlocks: TestBlock[] }[] {
    return [...this.callHistory];
  }

  /**
   * Get the number of times analyzeMetadata was called
   * @returns Number of calls
   */
  getCallCount(): number {
    return this.callHistory.length;
  }

  /**
   * Check if analyzeMetadata was called with specific parameters
   * @param metadata Metadata to check for
   * @param testBlocks Test blocks to check for
   * @returns True if called with these parameters
   */
  wasCalledWith(metadata: ParsedMetadata, testBlocks: TestBlock[]): boolean {
    return this.callHistory.some(
      call => call.metadata === metadata && call.testBlocks === testBlocks
    );
  }

  /**
   * Clear all mock data and call history
   */
  reset(): void {
    this.responses.clear();
    this.errors.clear();
    this.callHistory = [];
    this.shouldThrow = false;
    this.throwError = null;
  }

  /**
   * Create a mock that always returns empty metadata
   * @returns Configured mock analyzer
   */
  static emptyMetadata(): MockMetadataAnalyzer {
    const mock = new MockMetadataAnalyzer();

    // Override the default behavior
    mock.analyzeMetadata = (sourceCode: SourceCode) => {
      mock.callHistory.push({ sourceCode });
      const metadataResult = CodeMetadata.create({
        id: 'empty-metadata',
        sourceFile: 'empty.ts'
      });
      return metadataResult.success ? Result.success(metadataResult.data) : Result.failure(new ValidationError('CREATION_FAILED', 'Failed to create metadata'));
    };

    return mock;
  }

  /**
   * Create a mock that always returns rich metadata
   * @returns Configured mock analyzer
   */
  static richMetadata(): MockMetadataAnalyzer {
    const mock = new MockMetadataAnalyzer();

    // Override the default behavior
    mock.analyzeMetadata = (sourceCode: SourceCode) => {
      mock.callHistory.push({ sourceCode });

      const metadataResult = CodeMetadata.create({
        id: 'rich-metadata',
        sourceFile: 'rich.ts'
      });

      return metadataResult.success ? Result.success(metadataResult.data) : Result.failure(new ValidationError('CREATION_FAILED', 'Failed to create metadata'));
    };

    return mock;
  }

  /**
   * Create a mock that always returns an error
   * @param error Error to return
   * @returns Configured mock analyzer
   */
  static alwaysError(error: DomainError): MockMetadataAnalyzer {
    const mock = new MockMetadataAnalyzer();

    // Override the default behavior
    mock.analyzeMetadata = async (metadata: ParsedMetadata, testBlocks: TestBlock[]) => {
      mock.callHistory.push({ metadata, testBlocks });
      return Result.failure(error);
    };

    return mock;
  }

  /**
   * Create a mock with custom behavior
   * @param behavior Custom function to execute
   * @returns Configured mock analyzer
   */
  static withCustomBehavior(
    behavior: (
      metadata: ParsedMetadata,
      testBlocks: TestBlock[]
    ) => Promise<Result<CodeMetadata, DomainError>>
  ): MockMetadataAnalyzer {
    const mock = new MockMetadataAnalyzer();
    mock.analyzeMetadata = async (metadata: ParsedMetadata, testBlocks: TestBlock[]) => {
      mock.callHistory.push({ metadata, testBlocks });
      return behavior(metadata, testBlocks);
    };
    return mock;
  }

  /**
   * Extract request metadata (mock implementation)
   */
  extractRequestMetadata(sourceCode: SourceCode): Result<RequestMetadata[], ValidationError> {
    this.callHistory.push({ sourceCode });
    return Result.success([]);
  }

  /**
   * Extract group metadata (mock implementation)
   */
  extractGroupMetadata(sourceCode: SourceCode): Result<GroupMetadata[], ValidationError> {
    this.callHistory.push({ sourceCode });
    return Result.success([]);
  }

  /**
   * Extract test metadata (mock implementation)
   */
  extractTestMetadata(sourceCode: SourceCode): Result<TestMetadata[], ValidationError> {
    this.callHistory.push({ sourceCode });
    return Result.success([]);
  }

  /**
   * Validate metadata (mock implementation)
   */
  validateMetadata(metadata: CodeMetadata): Result<MetadataValidationReport, BusinessRuleError> {
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
        orphanedReferenceCount: 0
      },
      recommendations: []
    });
  }

  /**
   * Find metadata at position (mock implementation)
   */
  findMetadataAtPosition(metadata: CodeMetadata, position: SourcePosition): Result<PositionalMetadata, ValidationError> {
    return Result.success({
      position,
      requestMetadata: [],
      groupMetadata: [],
      testMetadata: [],
      customMetadata: {},
      isRequestSpecific: false
    });
  }
}
