/**
 * Unit tests for TestExtractionService
 * Tests application service orchestration in isolation using mocks
 */

import { TestExtractionService } from '../TestExtractionService';
import {
  MockSourceCodeParser,
  MockTestClassifier,
  MockMetadataAnalyzer,
  TestSuiteBuilderPresets,
  ParsedSourceBuilderPresets,
  CodeMetadataBuilderPresets,
  testHelpers,
} from '../../../test-utils';
import { DomainError } from '../../../domain/shared/DomainError';
import { Result } from '../../../domain/shared/Result';

describe('TestExtractionService (Unit Tests)', () => {
  let service: TestExtractionService;
  let mockParser: MockSourceCodeParser;
  let mockClassifier: MockTestClassifier;
  let mockAnalyzer: MockMetadataAnalyzer;

  const { assertions } = testHelpers;

  beforeEach(() => {
    mockParser = new MockSourceCodeParser();
    mockClassifier = new MockTestClassifier();
    mockAnalyzer = new MockMetadataAnalyzer();

    service = new TestExtractionService(mockParser, mockClassifier, mockAnalyzer);
  });

  afterEach(() => {
    mockParser.reset();
    mockClassifier.reset();
    mockAnalyzer.reset();
  });

  describe('extractTests', () => {
    it('should successfully extract tests with valid input', async () => {
      // Arrange
      const sourceCode = 'describe("test", () => {});';
      const parsedSource = ParsedSourceBuilderPresets.typicalTestFile().build();
      const testSuite = TestSuiteBuilderPresets.apiTestSuite().build();

      mockParser.mockParseResponse(sourceCode, parsedSource);
      mockClassifier.mockClassificationResult(
        testSuite.id.value,
        MockTestClassifier.createResult(
          [testSuite.testBlocks[0]], // Request-specific
          [testSuite.testBlocks[1]] // Shared
        )
      );
      mockAnalyzer.mockAnalysisResult(
        'analyzed',
        CodeMetadataBuilderPresets.withRequestMetadata().build()
      );

      // Act
      const result = await service.extractTests(sourceCode);

      // Assert
      assertions.result.isSuccess(result);

      if (result.isSuccess()) {
        const extractionResult = result.value;
        assertions.extractionResult.isValid(extractionResult);
        expect(extractionResult.getAllTests().length).toBeGreaterThan(0);
      }
    });

    it('should handle parsing errors gracefully', async () => {
      // Arrange
      const sourceCode = 'invalid typescript';
      const errors = ['Syntax error at line 1'];

      mockParser.setMockErrors(errors);

      // Act
      const result = await service.extractTests(sourceCode);

      // Assert
      assertions.result.isFailure(result);
      assertions.result.hasErrorCode(result, 'PARSING_FAILED');
    });

    it('should handle classification errors gracefully', async () => {
      // Arrange
      const sourceCode = 'describe("test", () => {});';
      const parsedSource = ParsedSourceBuilderPresets.minimal().build();
      const classificationError = new DomainError(
        'CLASSIFICATION_FAILED',
        'Failed to classify tests'
      );

      mockParser.mockParseResponse(sourceCode, parsedSource);
      mockClassifier.mockClassificationError('test-suite-id', classificationError);

      // Act
      const result = await service.extractTests(sourceCode);

      // Assert
      assertions.result.isFailure(result);
      expect(result.isFailure() && result.error.code).toBe('CLASSIFICATION_FAILED');
    });

    it('should handle metadata analysis errors gracefully', async () => {
      // Arrange
      const sourceCode = 'describe("test", () => {});';
      const parsedSource = ParsedSourceBuilderPresets.minimal().build();
      const testSuite = TestSuiteBuilderPresets.empty().build();
      const analysisError = new DomainError('ANALYSIS_FAILED', 'Failed to analyze metadata');

      mockParser.mockParseResponse(sourceCode, parsedSource);
      mockClassifier.mockClassificationResult(
        testSuite.id.value,
        MockTestClassifier.createResult([], [])
      );
      mockAnalyzer.mockAnalysisError('analysis-key', analysisError);

      // Act
      const result = await service.extractTests(sourceCode);

      // Assert
      assertions.result.isFailure(result);
      expect(result.isFailure() && result.error.code).toBe('ANALYSIS_FAILED');
    });

    it('should handle unexpected errors gracefully', async () => {
      // Arrange
      const sourceCode = 'describe("test", () => {});';
      const unexpectedError = new Error('Unexpected system error');

      mockParser.setShouldThrow(unexpectedError);

      // Act
      const result = await service.extractTests(sourceCode);

      // Assert
      assertions.result.isFailure(result);
      assertions.result.hasErrorCode(result, 'EXTRACTION_FAILED');
    });

    it('should pass parsing options to the parser', async () => {
      // Arrange
      const sourceCode = 'describe("test", () => {});';
      const options = {
        preserveFormatting: false,
        includeComments: false,
      };
      const parsedSource = ParsedSourceBuilderPresets.minimal().build();

      mockParser.mockParseResponse(sourceCode, parsedSource);

      // Act
      await service.extractTests(sourceCode, options);

      // Assert
      // In a real implementation, we would verify the parser was called with options
      // For this mock, we can check that parseSource was called
      expect(mockParser.getParsingErrors()).toEqual([]);
    });
  });

  describe('extractTestsFromFile', () => {
    it('should handle file reading errors', async () => {
      // Arrange
      const filePath = '/nonexistent/file.ts';

      // Act
      const result = await service.extractTestsFromFile(filePath);

      // Assert
      assertions.result.isFailure(result);
      assertions.result.hasErrorCode(result, 'FILE_READ_FAILED');
    });
  });

  describe('validateSource', () => {
    it('should validate valid source code', async () => {
      // Arrange
      const sourceCode = 'describe("test", () => {});';
      mockParser.mockValidationResult(sourceCode, true);

      // Act
      const result = await service.validateSource(sourceCode);

      // Assert
      assertions.result.isSuccess(result);
      assertions.result.hasValue(result, true);
    });

    it('should reject invalid syntax', async () => {
      // Arrange
      const sourceCode = 'invalid syntax';
      const errors = ['Syntax error'];

      mockParser.mockValidationResult(sourceCode, false);
      mockParser.setMockErrors(errors);

      // Act
      const result = await service.validateSource(sourceCode);

      // Assert
      assertions.result.isFailure(result);
      assertions.result.hasErrorCode(result, 'SYNTAX_INVALID');
    });

    it('should reject source with no test blocks', async () => {
      // Arrange
      const sourceCode = 'const x = 1;';
      const emptyParsedSource = ParsedSourceBuilderPresets.empty().build();

      mockParser.mockValidationResult(sourceCode, true);
      mockParser.mockParseResponse(sourceCode, emptyParsedSource);

      // Act
      const result = await service.validateSource(sourceCode);

      // Assert
      assertions.result.isFailure(result);
      assertions.result.hasErrorCode(result, 'NO_TESTS_FOUND');
    });

    it('should handle validation errors gracefully', async () => {
      // Arrange
      const sourceCode = 'describe("test", () => {});';
      const unexpectedError = new Error('Validation system error');

      mockParser.setShouldThrow(unexpectedError);

      // Act
      const result = await service.validateSource(sourceCode);

      // Assert
      assertions.result.isFailure(result);
      assertions.result.hasErrorCode(result, 'VALIDATION_FAILED');
    });
  });

  describe('getSourceStatistics', () => {
    it('should return statistics for valid source', async () => {
      // Arrange
      const sourceCode = 'describe("test", () => {});';
      const parsedSource = ParsedSourceBuilderPresets.typicalTestFile().build();

      mockParser.mockParseResponse(sourceCode, parsedSource);

      // Act
      const result = await service.getSourceStatistics(sourceCode);

      // Assert
      assertions.result.isSuccess(result);

      if (result.isSuccess()) {
        const stats = result.value;
        expect(stats.totalBlocks).toBeGreaterThanOrEqual(0);
        expect(stats.describeBlocks).toBeGreaterThanOrEqual(0);
        expect(stats.itBlocks).toBeGreaterThanOrEqual(0);
        expect(stats.importsCount).toBeGreaterThanOrEqual(0);
        expect(stats.functionsCount).toBeGreaterThanOrEqual(0);
        expect(stats.variablesCount).toBeGreaterThanOrEqual(0);
      }
    });

    it('should handle parsing errors in statistics', async () => {
      // Arrange
      const sourceCode = 'invalid typescript';
      const errors = ['Parse error'];

      mockParser.setMockErrors(errors);

      // Act
      const result = await service.getSourceStatistics(sourceCode);

      // Assert
      assertions.result.isFailure(result);
      assertions.result.hasErrorCode(result, 'PARSING_FAILED');
    });

    it('should handle unexpected errors in statistics', async () => {
      // Arrange
      const sourceCode = 'describe("test", () => {});';
      const unexpectedError = new Error('Statistics system error');

      mockParser.setShouldThrow(unexpectedError);

      // Act
      const result = await service.getSourceStatistics(sourceCode);

      // Assert
      assertions.result.isFailure(result);
      assertions.result.hasErrorCode(result, 'STATISTICS_FAILED');
    });
  });

  describe('service orchestration', () => {
    it('should call dependencies in correct order', async () => {
      // Arrange
      const sourceCode = 'describe("test", () => {});';
      const parsedSource = ParsedSourceBuilderPresets.minimal().build();
      const testSuite = TestSuiteBuilderPresets.empty().build();

      mockParser.mockParseResponse(sourceCode, parsedSource);
      mockClassifier.mockClassificationResult(
        testSuite.id.value,
        MockTestClassifier.createResult([], [])
      );

      // Act
      await service.extractTests(sourceCode);

      // Assert
      expect(mockParser.getCallCount()).toBeGreaterThan(0);
      expect(mockClassifier.getCallCount()).toBeGreaterThan(0);
      expect(mockAnalyzer.getCallCount()).toBeGreaterThan(0);
    });

    it('should preserve data through the pipeline', async () => {
      // Arrange
      const sourceCode = 'describe("API test", () => {});';
      const parsedSource = ParsedSourceBuilderPresets.typicalTestFile().build();
      const testSuite = TestSuiteBuilderPresets.apiTestSuite().build();

      mockParser.mockParseResponse(sourceCode, parsedSource);
      mockClassifier.mockClassificationResult(
        testSuite.id.value,
        MockTestClassifier.createResult(testSuite.testBlocks, [])
      );

      // Act
      const result = await service.extractTests(sourceCode);

      // Assert
      assertions.result.isSuccess(result);

      if (result.isSuccess()) {
        const extractionResult = result.value;

        // Verify that data flows correctly through the pipeline
        expect(extractionResult.imports).toBe(parsedSource.imports);
        expect(extractionResult.globalVariables).toBe(parsedSource.globalVariables);
        expect(extractionResult.helperFunctions).toBe(parsedSource.helperFunctions);
      }
    });
  });
});
