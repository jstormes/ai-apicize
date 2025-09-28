/**
 * Application service for test analysis operations
 * Provides higher-level analysis and reporting capabilities
 */

import { TestBlock } from '../../domain/test-analysis/entities/TestBlock';
import { TestSuite } from '../../domain/test-analysis/entities/TestSuite';
import { ITestClassifier } from '../../domain/test-analysis/services/ITestClassifier';
import { IMetadataAnalyzer } from '../../domain/test-analysis/services/IMetadataAnalyzer';
import { Result } from '../../domain/shared/Result';
import { DomainError, InfrastructureError } from '../../domain/shared/DomainError';

/**
 * Analysis result for a test suite
 */
export interface TestAnalysisReport {
  testSuite: TestSuite;
  requestSpecificTests: TestBlock[];
  sharedTests: TestBlock[];
  analysisMetrics: {
    totalTests: number;
    requestSpecificPercentage: number;
    averageTestDepth: number;
    maxNestingDepth: number;
    testComplexityDistribution: ComplexityDistribution;
  };
  qualityMetrics: {
    testsWithAssertions: number;
    testsWithoutAssertions: number;
    asyncTests: number;
    testsWithLoops: number;
    testsWithConditionals: number;
  };
  recommendations: string[];
  issues: AnalysisIssue[];
}

/**
 * Complexity distribution of tests
 */
export interface ComplexityDistribution {
  simple: number; // 1-5 lines
  medium: number; // 6-15 lines
  complex: number; // 16+ lines
}

/**
 * Analysis issue found in tests
 */
export interface AnalysisIssue {
  severity: 'warning' | 'error' | 'info';
  message: string;
  testBlock?: TestBlock;
  recommendation?: string;
}

/**
 * Application service for analyzing test suites and providing insights
 */
export class TestAnalysisService {
  constructor(
    private readonly classifier: ITestClassifier,
    private readonly metadataAnalyzer: IMetadataAnalyzer
  ) {}

  /**
   * Perform comprehensive analysis of a test suite
   * @param testSuite The test suite to analyze
   * @returns Result containing analysis report
   */
  async analyzeTestSuite(testSuite: TestSuite): Promise<Result<TestAnalysisReport, DomainError>> {
    try {
      // Step 1: Classify tests
      const classificationResult = this.classifier.classifyTests(testSuite.testBlocks, []);
      if (Result.isFail(classificationResult)) {
        return Result.failure(classificationResult.error);
      }

      const classification = classificationResult.data;

      // Extract tests from results
      const requestSpecificTests = testSuite.testBlocks.filter(block => block.isRequestSpecific);
      const sharedTests = testSuite.testBlocks.filter(block => !block.isRequestSpecific);

      // Step 2: Calculate metrics
      const analysisMetrics = this.calculateAnalysisMetrics(requestSpecificTests, sharedTests);

      // Step 3: Calculate quality metrics
      const qualityMetrics = this.calculateQualityMetrics([
        ...requestSpecificTests,
        ...sharedTests,
      ]);

      // Step 4: Generate recommendations
      const recommendations = this.generateRecommendations(
        requestSpecificTests,
        sharedTests,
        analysisMetrics,
        qualityMetrics
      );

      // Step 5: Identify issues
      const issues = this.identifyIssues([...requestSpecificTests, ...sharedTests]);

      const report: TestAnalysisReport = {
        testSuite,
        requestSpecificTests,
        sharedTests,
        analysisMetrics,
        qualityMetrics,
        recommendations,
        issues,
      };

      return Result.success(report);
    } catch (error) {
      return Result.failure(
        new InfrastructureError('ANALYSIS_FAILED', 'Failed to analyze test suite', {
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  /**
   * Analyze test classification accuracy
   * @param testBlocks Array of test blocks to analyze
   * @returns Result containing classification insights
   */
  async analyzeClassification(testBlocks: TestBlock[]): Promise<
    Result<
      {
        totalTests: number;
        requestSpecificTests: number;
        sharedTests: number;
        ambiguousTests: TestBlock[];
        confidenceScore: number;
      },
      DomainError
    >
  > {
    try {
      let requestSpecificCount = 0;
      let sharedCount = 0;
      const ambiguousTests: TestBlock[] = [];

      for (const test of testBlocks) {
        if (test.isRequestSpecific === undefined) {
          ambiguousTests.push(test);
        } else if (test.isRequestSpecific) {
          requestSpecificCount++;
        } else {
          sharedCount++;
        }
      }

      const totalTests = testBlocks.length;
      const classifiedTests = requestSpecificCount + sharedCount;
      const confidenceScore = totalTests > 0 ? (classifiedTests / totalTests) * 100 : 0;

      return Result.success({
        totalTests,
        requestSpecificTests: requestSpecificCount,
        sharedTests: sharedCount,
        ambiguousTests,
        confidenceScore,
      });
    } catch (error) {
      return Result.failure(
        new InfrastructureError(
          'CLASSIFICATION_ANALYSIS_FAILED',
          'Failed to analyze test classification',
          {
            error: error instanceof Error ? error.message : String(error),
          }
        )
      );
    }
  }

  /**
   * Calculate analysis metrics
   */
  private calculateAnalysisMetrics(requestSpecificTests: TestBlock[], sharedTests: TestBlock[]) {
    const allTests = [...requestSpecificTests, ...sharedTests];
    const totalTests = allTests.length;

    const requestSpecificPercentage =
      totalTests > 0 ? (requestSpecificTests.length / totalTests) * 100 : 0;

    const averageTestDepth =
      totalTests > 0 ? allTests.reduce((sum, test) => sum + test.depth, 0) / totalTests : 0;

    const maxNestingDepth = Math.max(0, ...allTests.map(test => test.depth));

    const testComplexityDistribution = this.calculateComplexityDistribution(allTests);

    return {
      totalTests,
      requestSpecificPercentage,
      averageTestDepth,
      maxNestingDepth,
      testComplexityDistribution,
    };
  }

  /**
   * Calculate quality metrics
   */
  private calculateQualityMetrics(testBlocks: TestBlock[]) {
    let testsWithAssertions = 0;
    let testsWithoutAssertions = 0;
    let asyncTests = 0;
    let testsWithLoops = 0;
    let testsWithConditionals = 0;

    for (const test of testBlocks) {
      const code = test.code.value;

      // Check for assertions
      if (this.hasAssertions(code)) {
        testsWithAssertions++;
      } else {
        testsWithoutAssertions++;
      }

      // Check for async operations
      if (/await\s+|\.then\(|\.catch\(|async\s+/.test(code)) {
        asyncTests++;
      }

      // Check for loops
      if (/\b(for|while|do)\s*\(/.test(code)) {
        testsWithLoops++;
      }

      // Check for conditionals
      if (/\b(if|switch|case)\s*\(/.test(code)) {
        testsWithConditionals++;
      }
    }

    return {
      testsWithAssertions,
      testsWithoutAssertions,
      asyncTests,
      testsWithLoops,
      testsWithConditionals,
    };
  }

  /**
   * Calculate complexity distribution
   */
  private calculateComplexityDistribution(testBlocks: TestBlock[]): ComplexityDistribution {
    let simple = 0;
    let medium = 0;
    let complex = 0;

    for (const test of testBlocks) {
      const lineCount = test.code.value.split('\n').filter(line => line.trim().length > 0).length;

      if (lineCount <= 5) {
        simple++;
      } else if (lineCount <= 15) {
        medium++;
      } else {
        complex++;
      }
    }

    return { simple, medium, complex };
  }

  /**
   * Generate recommendations based on analysis
   */
  private generateRecommendations(
    requestSpecificTests: TestBlock[],
    sharedTests: TestBlock[],
    analysisMetrics: any,
    qualityMetrics: any
  ): string[] {
    const recommendations: string[] = [];

    // Request-specific test recommendations
    if (analysisMetrics.requestSpecificPercentage < 30) {
      recommendations.push('Consider adding more request-specific tests to improve API coverage');
    } else if (analysisMetrics.requestSpecificPercentage > 80) {
      recommendations.push('Consider extracting common test logic into shared helper functions');
    }

    // Complexity recommendations
    if (analysisMetrics.testComplexityDistribution.complex > 5) {
      recommendations.push(
        'Consider breaking down complex tests into smaller, more focused test cases'
      );
    }

    // Quality recommendations
    if (qualityMetrics.testsWithoutAssertions > 0) {
      recommendations.push(
        `${qualityMetrics.testsWithoutAssertions} tests lack assertions - add expect/assert statements`
      );
    }

    // Depth recommendations
    if (analysisMetrics.maxNestingDepth > 3) {
      recommendations.push('Consider reducing test nesting depth for better readability');
    }

    return recommendations;
  }

  /**
   * Identify issues in test blocks
   */
  private identifyIssues(testBlocks: TestBlock[]): AnalysisIssue[] {
    const issues: AnalysisIssue[] = [];

    for (const test of testBlocks) {
      const code = test.code.value;

      // Check for missing assertions
      if (!this.hasAssertions(code) && test.type === 'it') {
        issues.push({
          severity: 'warning',
          message: 'Test block lacks assertion statements',
          testBlock: test,
          recommendation: 'Add expect() or assert() statements to verify behavior',
        });
      }

      // Check for empty tests
      if (code.trim().length === 0) {
        issues.push({
          severity: 'error',
          message: 'Test block is empty',
          testBlock: test,
          recommendation: 'Add test implementation or remove empty test',
        });
      }

      // Check for hardcoded values
      if (/\b(localhost|127\.0\.0\.1|192\.168)\b/.test(code)) {
        issues.push({
          severity: 'warning',
          message: 'Test contains hardcoded URLs or IP addresses',
          testBlock: test,
          recommendation: 'Use configuration variables for URLs and endpoints',
        });
      }

      // Check for console statements
      if (/console\.(log|info|warn|error)/.test(code)) {
        issues.push({
          severity: 'info',
          message: 'Test contains console statements',
          testBlock: test,
          recommendation: 'Consider removing console statements or using proper logging',
        });
      }
    }

    return issues;
  }

  /**
   * Check if test code contains assertions
   */
  private hasAssertions(code: string): boolean {
    const assertionPatterns = [
      /expect\(/,
      /assert\./,
      /should\./,
      /\.to\./,
      /\.equal\(/,
      /\.be\./,
      /\.have\./,
    ];

    return assertionPatterns.some(pattern => pattern.test(code));
  }
}
