/**
 * Strategy for classifying tests based on naming patterns
 * Identifies request-specific tests by analyzing test names
 */

import {
  IClassificationStrategy,
  ClassificationContext,
  TestClassificationResult,
} from './IClassificationStrategy';
import { TestBlock } from '../../entities/TestBlock';
import { Result } from '../../../shared/Result';
import { DomainError } from '../../../shared/DomainError';

/**
 * Configuration for the request pattern strategy
 */
export interface RequestPatternConfig {
  patterns: RegExp[];
  minConfidence: number;
  caseSensitive: boolean;
  includeDescribeBlocks: boolean;
}

/**
 * Default configuration for request pattern strategy
 */
const DEFAULT_CONFIG: RequestPatternConfig = {
  patterns: [
    /should\s+(make|send|call|execute|perform)\s+.*?(request|api|endpoint)/i,
    /should\s+(get|post|put|delete|patch)\s+/i,
    /should\s+(create|update|delete|fetch|retrieve)\s+.*?(user|data|record)/i,
    /should\s+(return|respond|send)\s+.*?(status|response|data)/i,
    /api\s+/i,
    /endpoint\s+/i,
    /http\s+/i,
    /rest\s+/i,
    /(request|response)\s+(validation|handling|processing)/i,
    /should\s+(validate|handle|process)\s+.*?(request|response)/i,
  ],
  minConfidence: 0.7,
  caseSensitive: false,
  includeDescribeBlocks: true,
};

/**
 * Classification strategy based on request-related patterns in test names
 */
export class RequestPatternStrategy implements IClassificationStrategy {
  readonly name = 'RequestPatternStrategy';
  readonly priority = 100; // High priority for obvious patterns

  private config: RequestPatternConfig;

  constructor(config: Partial<RequestPatternConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Classify test based on naming patterns
   */
  async classify(
    testBlock: TestBlock,
    context: ClassificationContext
  ): Promise<Result<TestClassificationResult, DomainError>> {
    try {
      if (!this.canClassify(testBlock, context)) {
        return Result.failure(
          new DomainError(
            'CLASSIFICATION_NOT_APPLICABLE',
            'Request pattern strategy cannot classify this test block',
            { testBlockName: testBlock.name.value }
          )
        );
      }

      const testName = testBlock.name.value;
      const matchResults = this.analyzePatterns(testName);

      const isRequestSpecific = matchResults.confidence >= this.config.minConfidence;
      const confidence = Math.min(matchResults.confidence, 1.0);

      const result: TestClassificationResult = {
        testBlock,
        isRequestSpecific,
        confidence,
        reasoning: this.buildReasoning(matchResults, isRequestSpecific),
      };

      return Result.success(result);
    } catch (error) {
      return Result.failure(
        new DomainError('CLASSIFICATION_ERROR', 'Error during pattern-based classification', {
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  /**
   * Check if this strategy can classify the test block
   */
  canClassify(testBlock: TestBlock, context: ClassificationContext): boolean {
    // Can classify 'it' blocks and optionally 'describe' blocks
    if (testBlock.type === 'it') {
      return true;
    }

    if (testBlock.type === 'describe' && this.config.includeDescribeBlocks) {
      return true;
    }

    return false;
  }

  /**
   * Get current strategy configuration
   */
  getConfiguration(): Record<string, any> {
    return { ...this.config };
  }

  /**
   * Update strategy configuration
   */
  configure(config: Record<string, any>): void {
    this.config = { ...this.config, ...(config as Partial<RequestPatternConfig>) };
  }

  /**
   * Analyze patterns in the test name
   */
  private analyzePatterns(testName: string): {
    matchedPatterns: RegExp[];
    confidence: number;
    details: string[];
  } {
    const matchedPatterns: RegExp[] = [];
    const details: string[] = [];

    for (const pattern of this.config.patterns) {
      const patternToUse = this.config.caseSensitive
        ? new RegExp(pattern.source, pattern.flags.replace('i', ''))
        : pattern;

      if (patternToUse.test(testName)) {
        matchedPatterns.push(pattern);
        details.push(`Matched pattern: ${pattern.source}`);
      }
    }

    // Calculate confidence based on number and strength of matches
    let confidence = 0;

    if (matchedPatterns.length > 0) {
      // Base confidence from having matches
      confidence = 0.5 + matchedPatterns.length * 0.2;

      // Boost confidence for strong indicators
      const strongPatterns = [
        /should\s+(make|send|call|execute|perform)\s+.*?(request|api|endpoint)/i,
        /should\s+(get|post|put|delete|patch)\s+/i,
        /api\s+/i,
        /endpoint\s+/i,
      ];

      const hasStrongPattern = strongPatterns.some(strong =>
        matchedPatterns.some(matched => matched.source === strong.source)
      );

      if (hasStrongPattern) {
        confidence += 0.3;
      }

      // Additional confidence for multiple matches
      if (matchedPatterns.length >= 2) {
        confidence += 0.2;
      }
    }

    return {
      matchedPatterns,
      confidence: Math.min(confidence, 1.0),
      details,
    };
  }

  /**
   * Build human-readable reasoning for the classification
   */
  private buildReasoning(
    matchResults: { matchedPatterns: RegExp[]; confidence: number; details: string[] },
    isRequestSpecific: boolean
  ): string {
    if (matchResults.matchedPatterns.length === 0) {
      return 'No request-related patterns found in test name';
    }

    const baseReason = isRequestSpecific
      ? 'Classified as request-specific based on naming patterns'
      : 'Patterns found but confidence below threshold';

    const details = [
      baseReason,
      `Confidence: ${(matchResults.confidence * 100).toFixed(1)}%`,
      `Matched ${matchResults.matchedPatterns.length} pattern(s)`,
      ...matchResults.details,
    ];

    return details.join('; ');
  }

  /**
   * Add a custom pattern to the strategy
   */
  addPattern(pattern: RegExp): void {
    this.config.patterns.push(pattern);
  }

  /**
   * Remove a pattern from the strategy
   */
  removePattern(pattern: RegExp): void {
    const index = this.config.patterns.findIndex(p => p.source === pattern.source);
    if (index >= 0) {
      this.config.patterns.splice(index, 1);
    }
  }

  /**
   * Get statistics about pattern matching
   */
  getPatternStatistics(): {
    totalPatterns: number;
    strongPatterns: number;
    averagePatternLength: number;
  } {
    const strongPatternSources = [
      /should\s+(make|send|call|execute|perform)\s+.*?(request|api|endpoint)/i.source,
      /should\s+(get|post|put|delete|patch)\s+/i.source,
      /api\s+/i.source,
      /endpoint\s+/i.source,
    ];

    const strongPatterns = this.config.patterns.filter(p =>
      strongPatternSources.includes(p.source)
    ).length;

    const averagePatternLength =
      this.config.patterns.reduce((sum, pattern) => sum + pattern.source.length, 0) /
      this.config.patterns.length;

    return {
      totalPatterns: this.config.patterns.length,
      strongPatterns,
      averagePatternLength,
    };
  }
}
