/**
 * Mock implementation of ITestClassifier for testing
 * Provides controllable behavior for unit tests
 */

import { ITestClassifier, IClassificationStrategy } from '../../domain/test-analysis/services/ITestClassifier';
import { TestSuite } from '../../domain/test-analysis/entities/TestSuite';
import { TestBlock } from '../../domain/test-analysis/entities/TestBlock';
import { RequestPattern } from '../../domain/test-analysis/value-objects/RequestPattern';
import { Result } from '../../domain/shared/Result';
import { DomainError, BusinessRuleError } from '../../domain/shared/DomainError';

// Mock types for the interface
type BatchClassificationResult = {
  totalBlocks: number;
  classifiedBlocks: number;
  changedBlocks: number;
  requestSpecificBlocks: number;
  sharedBlocks: number;
  results: {
    testBlockId: string;
    isRequestSpecific: boolean;
    confidence: number;
    strategyUsed: string;
    reasons: string[];
    wasChanged: boolean;
  }[];
  errors: string[];
};

/**
 * Classification result interface
 */
export interface ClassificationResult {
  requestSpecificTests: TestBlock[];
  sharedTests: TestBlock[];
}

/**
 * Mock test classifier with configurable responses
 */
export class MockTestClassifier implements ITestClassifier {
  private responses = new Map<string, ClassificationResult>();
  private errors = new Map<string, DomainError>();
  private shouldThrow = false;
  private throwError: Error | null = null;
  private callHistory: { testSuite: TestSuite }[] = [];

  /**
   * Configure a mock response for a specific test suite
   * @param suiteId Test suite ID to match
   * @param result Classification result to return
   */
  mockClassificationResult(suiteId: string, result: ClassificationResult): void {
    this.responses.set(suiteId, result);
  }

  /**
   * Configure an error response for a specific test suite
   * @param suiteId Test suite ID to match
   * @param error Domain error to return
   */
  mockClassificationError(suiteId: string, error: DomainError): void {
    this.errors.set(suiteId, error);
  }

  /**
   * Configure the classifier to throw an error
   * @param error Error to throw, or null to stop throwing
   */
  setShouldThrow(error: Error | null): void {
    this.shouldThrow = !!error;
    this.throwError = error;
  }

  /**
   * Classify tests (mock implementation)
   */
  classifyTests(testBlocks: TestBlock[], patterns: RequestPattern[]): Result<BatchClassificationResult, BusinessRuleError> {
    // Track call history
    this.callHistory.push({ testBlocks, patterns });

    if (this.shouldThrow && this.throwError) {
      throw this.throwError;
    }

    // Default behavior: classify based on isRequestSpecific property
    const results = testBlocks.map(block => ({
      testBlockId: block.id || 'mock-block-id',
      isRequestSpecific: block.isRequestSpecific,
      confidence: 1.0,
      strategyUsed: 'mock',
      reasons: ['Mock classification'],
      wasChanged: false
    }));

    return Result.success({
      totalBlocks: testBlocks.length,
      classifiedBlocks: testBlocks.length,
      changedBlocks: 0,
      requestSpecificBlocks: testBlocks.filter(b => b.isRequestSpecific).length,
      sharedBlocks: testBlocks.filter(b => !b.isRequestSpecific).length,
      results,
      errors: []
    });
  }

  /**
   * Get call history for testing verification
   * @returns Array of all classify calls made
   */
  getCallHistory(): { testSuite: TestSuite }[] {
    return [...this.callHistory];
  }

  /**
   * Get the number of times classifyTests was called
   * @returns Number of calls
   */
  getCallCount(): number {
    return this.callHistory.length;
  }

  /**
   * Check if classifyTests was called with a specific test suite
   * @param testSuite Test suite to check for
   * @returns True if called with this test suite
   */
  wasCalledWith(testSuite: TestSuite): boolean {
    return this.callHistory.some(call => call.testSuite.id.value === testSuite.id.value);
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
   * Create a simple classification result for testing
   * @param requestSpecific Array of request-specific tests
   * @param shared Array of shared tests
   * @returns Classification result
   */
  static createResult(requestSpecific: TestBlock[], shared: TestBlock[]): ClassificationResult {
    return {
      requestSpecificTests: requestSpecific,
      sharedTests: shared,
    };
  }

  /**
   * Create a mock that always classifies tests as request-specific
   * @returns Configured mock classifier
   */
  static allRequestSpecific(): MockTestClassifier {
    const mock = new MockTestClassifier();

    // Override the default behavior
    mock.classifyTests = async (testSuite: TestSuite) => {
      mock.callHistory.push({ testSuite });
      return Result.success({
        requestSpecificTests: [...testSuite.testBlocks],
        sharedTests: [],
      });
    };

    return mock;
  }

  /**
   * Create a mock that always classifies tests as shared
   * @returns Configured mock classifier
   */
  static allShared(): MockTestClassifier {
    const mock = new MockTestClassifier();

    // Override the default behavior
    mock.classifyTests = async (testSuite: TestSuite) => {
      mock.callHistory.push({ testSuite });
      return Result.success({
        requestSpecificTests: [],
        sharedTests: [...testSuite.testBlocks],
      });
    };

    return mock;
  }

  /**
   * Create a mock that always returns an error
   * @param error Error to return
   * @returns Configured mock classifier
   */
  static alwaysError(error: DomainError): MockTestClassifier {
    const mock = new MockTestClassifier();

    // Override the default behavior
    mock.classifyTests = async (testSuite: TestSuite) => {
      mock.callHistory.push({ testSuite });
      return Result.failure(error);
    };

    return mock;
  }

  /**
   * Add a classification strategy (mock implementation)
   */
  addStrategy(strategy: IClassificationStrategy): void {
    // Mock implementation - just track that it was called
  }

  /**
   * Remove a classification strategy (mock implementation)
   */
  removeStrategy(strategyName: string): boolean {
    // Mock implementation - always return false
    return false;
  }

  /**
   * Get all classification strategies (mock implementation)
   */
  getStrategies(): readonly IClassificationStrategy[] {
    return [];
  }
}
