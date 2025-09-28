/**
 * Custom assertion helpers for testing Apicize components
 * Provides domain-specific assertions and matchers
 */

import { TestBlock } from '../../domain/test-analysis/entities/TestBlock';
import { TestSuite } from '../../domain/test-analysis/entities/TestSuite';
import { CodeMetadata } from '../../domain/test-analysis/entities/CodeMetadata';
import { TestExtractionResult } from '../../application/dto/TestExtractionResult';
import { ParsedSource } from '../../infrastructure/parsing/ParsedSource';
import { Result } from '../../domain/shared/Result';
import { DomainError } from '../../domain/shared/DomainError';

/**
 * Custom assertions for TestBlock entities
 */
export class TestBlockAssertions {
  /**
   * Assert that a test block has the expected properties
   * @param testBlock Test block to check
   * @param expected Expected properties
   */
  static hasProperties(
    testBlock: TestBlock,
    expected: {
      type?: 'describe' | 'it';
      name?: string;
      depth?: number;
      isRequestSpecific?: boolean;
      hasChildren?: boolean;
      childrenCount?: number;
    }
  ): void {
    if (expected.type !== undefined) {
      expect(testBlock.type).toBe(expected.type);
    }

    if (expected.name !== undefined) {
      expect(testBlock.name.value).toBe(expected.name);
    }

    if (expected.depth !== undefined) {
      expect(testBlock.depth).toBe(expected.depth);
    }

    if (expected.isRequestSpecific !== undefined) {
      expect(testBlock.isRequestSpecific).toBe(expected.isRequestSpecific);
    }

    if (expected.hasChildren !== undefined) {
      const hasChildren = testBlock.children && testBlock.children.length > 0;
      expect(hasChildren).toBe(expected.hasChildren);
    }

    if (expected.childrenCount !== undefined) {
      const childrenCount = testBlock.children ? testBlock.children.length : 0;
      expect(childrenCount).toBe(expected.childrenCount);
    }
  }

  /**
   * Assert that a test block contains specific code patterns
   * @param testBlock Test block to check
   * @param patterns Patterns to look for
   */
  static containsCodePatterns(testBlock: TestBlock, patterns: (string | RegExp)[]): void {
    const code = testBlock.code.value;

    for (const pattern of patterns) {
      if (typeof pattern === 'string') {
        expect(code).toContain(pattern);
      } else {
        expect(pattern.test(code)).toBe(true);
      }
    }
  }

  /**
   * Assert that a test block has valid structure
   * @param testBlock Test block to check
   */
  static hasValidStructure(testBlock: TestBlock): void {
    expect(testBlock.name).toBeDefined();
    expect(testBlock.name.value).toBeTruthy();
    expect(testBlock.code).toBeDefined();
    expect(testBlock.position).toBeDefined();
    expect(testBlock.position.start).toBeGreaterThanOrEqual(0);
    expect(testBlock.position.end).toBeGreaterThanOrEqual(testBlock.position.start);
    expect(testBlock.position.lineNumber).toBeGreaterThan(0);
    expect(testBlock.depth).toBeGreaterThanOrEqual(0);
  }

  /**
   * Assert that test blocks form a valid hierarchy
   * @param testBlocks Test blocks to check
   */
  static hasValidHierarchy(testBlocks: TestBlock[]): void {
    for (const testBlock of testBlocks) {
      TestBlockAssertions.hasValidStructure(testBlock);

      if (testBlock.children) {
        // Children should have greater depth
        for (const child of testBlock.children) {
          expect(child.depth).toBeGreaterThan(testBlock.depth);
        }

        // Recursively check children
        TestBlockAssertions.hasValidHierarchy(testBlock.children);
      }
    }
  }
}

/**
 * Custom assertions for TestSuite entities
 */
export class TestSuiteAssertions {
  /**
   * Assert that a test suite has the expected structure
   * @param testSuite Test suite to check
   * @param expected Expected properties
   */
  static hasStructure(
    testSuite: TestSuite,
    expected: {
      name?: string;
      testBlockCount?: number;
      requestSpecificCount?: number;
      sharedTestCount?: number;
      hasMetadata?: boolean;
      maxDepth?: number;
    }
  ): void {
    if (expected.name !== undefined) {
      expect(testSuite.name).toBe(expected.name);
    }

    if (expected.testBlockCount !== undefined) {
      expect(testSuite.testBlocks.length).toBe(expected.testBlockCount);
    }

    const allTests = testSuite.getAllTestBlocks();

    if (expected.requestSpecificCount !== undefined) {
      const requestSpecific = allTests.filter(test => test.isRequestSpecific);
      expect(requestSpecific.length).toBe(expected.requestSpecificCount);
    }

    if (expected.sharedTestCount !== undefined) {
      const shared = allTests.filter(test => !test.isRequestSpecific);
      expect(shared.length).toBe(expected.sharedTestCount);
    }

    if (expected.hasMetadata !== undefined) {
      expect(testSuite.metadata.hasMetadata()).toBe(expected.hasMetadata);
    }

    if (expected.maxDepth !== undefined) {
      const maxDepth = Math.max(0, ...allTests.map(test => test.depth));
      expect(maxDepth).toBe(expected.maxDepth);
    }
  }

  /**
   * Assert that a test suite is valid
   * @param testSuite Test suite to check
   */
  static isValid(testSuite: TestSuite): void {
    expect(testSuite.id).toBeDefined();
    expect(testSuite.id.value).toBeTruthy();
    expect(testSuite.name).toBeTruthy();
    expect(testSuite.testBlocks).toBeDefined();
    expect(testSuite.metadata).toBeDefined();

    // Check hierarchy validity
    TestBlockAssertions.hasValidHierarchy(testSuite.testBlocks);
  }
}

/**
 * Custom assertions for extraction results
 */
export class ExtractionResultAssertions {
  /**
   * Assert that an extraction result has the expected structure
   * @param result Extraction result to check
   * @param expected Expected properties
   */
  static hasStructure(
    result: TestExtractionResult,
    expected: {
      totalTests?: number;
      requestSpecificCount?: number;
      sharedTestsCount?: number;
      importsCount?: number;
      globalVariablesCount?: number;
      helperFunctionsCount?: number;
      warningsCount?: number;
      isSuccessful?: boolean;
    }
  ): void {
    const stats = result.getStatistics();

    if (expected.totalTests !== undefined) {
      expect(stats.totalTests).toBe(expected.totalTests);
    }

    if (expected.requestSpecificCount !== undefined) {
      expect(stats.requestSpecificCount).toBe(expected.requestSpecificCount);
    }

    if (expected.sharedTestsCount !== undefined) {
      expect(stats.sharedTestsCount).toBe(expected.sharedTestsCount);
    }

    if (expected.importsCount !== undefined) {
      expect(stats.importsCount).toBe(expected.importsCount);
    }

    if (expected.globalVariablesCount !== undefined) {
      expect(stats.globalVariablesCount).toBe(expected.globalVariablesCount);
    }

    if (expected.helperFunctionsCount !== undefined) {
      expect(stats.helperFunctionsCount).toBe(expected.helperFunctionsCount);
    }

    if (expected.warningsCount !== undefined) {
      expect(stats.warningsCount).toBe(expected.warningsCount);
    }

    if (expected.isSuccessful !== undefined) {
      expect(result.isSuccessful()).toBe(expected.isSuccessful);
    }
  }

  /**
   * Assert that an extraction result contains tests with specific names
   * @param result Extraction result to check
   * @param testNames Expected test names
   */
  static containsTestsNamed(result: TestExtractionResult, testNames: string[]): void {
    const allTests = result.getAllTests();
    const testNameSet = new Set(allTests.map(test => test.name.value));

    for (const expectedName of testNames) {
      expect(testNameSet.has(expectedName)).toBe(true);
    }
  }

  /**
   * Assert that an extraction result has valid structure
   * @param result Extraction result to check
   */
  static isValid(result: TestExtractionResult): void {
    expect(result.testSuite).toBeDefined();
    expect(result.requestSpecificTests).toBeDefined();
    expect(result.sharedTests).toBeDefined();
    expect(result.imports).toBeDefined();
    expect(result.globalVariables).toBeDefined();
    expect(result.helperFunctions).toBeDefined();
    expect(result.metadata).toBeDefined();
    expect(result.warnings).toBeDefined();

    TestSuiteAssertions.isValid(result.testSuite);
  }
}

/**
 * Custom assertions for Result pattern
 */
export class ResultAssertions {
  /**
   * Assert that a result is successful
   * @param result Result to check
   */
  static isSuccess<T, E>(result: Result<T, E>): void {
    expect(result.isSuccess()).toBe(true);
    expect(result.isFailure()).toBe(false);
  }

  /**
   * Assert that a result is a failure
   * @param result Result to check
   */
  static isFailure<T, E>(result: Result<T, E>): void {
    expect(result.isFailure()).toBe(true);
    expect(result.isSuccess()).toBe(false);
  }

  /**
   * Assert that a successful result has expected value
   * @param result Result to check
   * @param expectedValue Expected value
   */
  static hasValue<T, E>(result: Result<T, E>, expectedValue: T): void {
    ResultAssertions.isSuccess(result);
    if (result.isSuccess()) {
      expect(result.value).toEqual(expectedValue);
    }
  }

  /**
   * Assert that a failed result has expected error
   * @param result Result to check
   * @param expectedError Expected error
   */
  static hasError<T, E>(result: Result<T, E>, expectedError: E): void {
    ResultAssertions.isFailure(result);
    if (result.isFailure()) {
      expect(result.error).toEqual(expectedError);
    }
  }

  /**
   * Assert that a failed result has error with specific code
   * @param result Result to check
   * @param errorCode Expected error code
   */
  static hasErrorCode<T>(result: Result<T, DomainError>, errorCode: string): void {
    ResultAssertions.isFailure(result);
    if (result.isFailure()) {
      expect(result.error.code).toBe(errorCode);
    }
  }
}

/**
 * Performance assertions for testing execution time and resource usage
 */
export class PerformanceAssertions {
  /**
   * Assert that an operation completes within expected time
   * @param operation Operation to time
   * @param maxTimeMs Maximum expected time in milliseconds
   */
  static async completesWithin<T>(operation: () => Promise<T>, maxTimeMs: number): Promise<T> {
    const startTime = Date.now();
    const result = await operation();
    const endTime = Date.now();
    const duration = endTime - startTime;

    expect(duration).toBeLessThanOrEqual(maxTimeMs);
    return result;
  }

  /**
   * Assert that an operation completes within expected time and returns expected result
   * @param operation Operation to time
   * @param maxTimeMs Maximum expected time in milliseconds
   * @param expectedResult Expected result
   */
  static async completesWithinAndReturns<T>(
    operation: () => Promise<T>,
    maxTimeMs: number,
    expectedResult: T
  ): Promise<void> {
    const result = await PerformanceAssertions.completesWithin(operation, maxTimeMs);
    expect(result).toEqual(expectedResult);
  }

  /**
   * Benchmark an operation and return timing information
   * @param operation Operation to benchmark
   * @param iterations Number of iterations to run
   * @returns Timing statistics
   */
  static async benchmark<T>(
    operation: () => Promise<T>,
    iterations: number = 10
  ): Promise<{
    averageTime: number;
    minTime: number;
    maxTime: number;
    totalTime: number;
    iterations: number;
  }> {
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      await operation();
      const endTime = Date.now();
      times.push(endTime - startTime);
    }

    const totalTime = times.reduce((sum, time) => sum + time, 0);
    const averageTime = totalTime / iterations;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);

    return {
      averageTime,
      minTime,
      maxTime,
      totalTime,
      iterations,
    };
  }
}

/**
 * Utility function to create custom Jest matchers
 */
export function createCustomMatchers() {
  return {
    toBeValidTestBlock(received: TestBlock) {
      try {
        TestBlockAssertions.hasValidStructure(received);
        return {
          message: () => 'Expected test block to be invalid',
          pass: true,
        };
      } catch (error) {
        return {
          message: () => `Expected test block to be valid: ${error}`,
          pass: false,
        };
      }
    },

    toBeValidTestSuite(received: TestSuite) {
      try {
        TestSuiteAssertions.isValid(received);
        return {
          message: () => 'Expected test suite to be invalid',
          pass: true,
        };
      } catch (error) {
        return {
          message: () => `Expected test suite to be valid: ${error}`,
          pass: false,
        };
      }
    },

    toBeSuccessfulResult<T, E>(received: Result<T, E>) {
      const pass = received.isSuccess();
      return {
        message: () => (pass ? 'Expected result to be failure' : 'Expected result to be success'),
        pass,
      };
    },

    toBeFailureResult<T, E>(received: Result<T, E>) {
      const pass = received.isFailure();
      return {
        message: () => (pass ? 'Expected result to be success' : 'Expected result to be failure'),
        pass,
      };
    },
  };
}
