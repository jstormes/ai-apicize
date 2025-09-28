/**
 * Strategy for classifying tests based on code content analysis
 * Identifies request-specific tests by analyzing the actual test code
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
 * Configuration for the code content strategy
 */
export interface CodeContentConfig {
  requestIndicators: string[];
  responseIndicators: string[];
  httpMethodPatterns: RegExp[];
  apiObjectPatterns: RegExp[];
  minIndicatorCount: number;
  weightings: {
    response: number;
    request: number;
    httpMethod: number;
    apiObject: number;
    statusCode: number;
  };
}

/**
 * Default configuration for code content strategy
 */
const DEFAULT_CONFIG: CodeContentConfig = {
  requestIndicators: [
    'request',
    'req',
    'context.execute',
    'context.send',
    'context.call',
    'makeRequest',
    'sendRequest',
    'callApi',
    'executeRequest',
  ],
  responseIndicators: ['response', 'res', 'result', 'apiResponse', 'httpResponse'],
  httpMethodPatterns: [
    /\.get\s*\(/,
    /\.post\s*\(/,
    /\.put\s*\(/,
    /\.delete\s*\(/,
    /\.patch\s*\(/,
    /\.head\s*\(/,
    /\.options\s*\(/,
    /method\s*:\s*['"`](GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)['"`]/i,
  ],
  apiObjectPatterns: [
    /response\.status/,
    /response\.body/,
    /response\.headers/,
    /response\.data/,
    /\.body\.type/,
    /BodyType\./,
    /response\.json\(\)/,
    /response\.text\(\)/,
    /\.statusCode/,
    /\.responseTime/,
  ],
  minIndicatorCount: 1,
  weightings: {
    response: 0.4,
    request: 0.3,
    httpMethod: 0.5,
    apiObject: 0.6,
    statusCode: 0.7,
  },
};

/**
 * Classification strategy based on analyzing test code content
 */
export class CodeContentStrategy implements IClassificationStrategy {
  readonly name = 'CodeContentStrategy';
  readonly priority = 150; // Medium priority - code content is good indicator

  private config: CodeContentConfig;

  constructor(config: Partial<CodeContentConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Classify test based on code content analysis
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
            'Code content strategy cannot classify this test block',
            { testBlockName: testBlock.name.value }
          )
        );
      }

      const analysisResult = this.analyzeCodeContent(testBlock);

      const result: TestClassificationResult = {
        testBlock,
        isRequestSpecific: analysisResult.isRequestSpecific,
        confidence: analysisResult.confidence,
        reasoning: analysisResult.reasoning,
      };

      return Result.success(result);
    } catch (error) {
      return Result.failure(
        new DomainError('CLASSIFICATION_ERROR', 'Error during code content classification', {
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  /**
   * Check if this strategy can classify the test block
   */
  canClassify(testBlock: TestBlock, context: ClassificationContext): boolean {
    // Can classify any test block that has code content
    return testBlock.code.value.trim().length > 0;
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
    this.config = { ...this.config, ...(config as Partial<CodeContentConfig>) };
  }

  /**
   * Analyze the code content of a test block
   */
  private analyzeCodeContent(testBlock: TestBlock): {
    isRequestSpecific: boolean;
    confidence: number;
    reasoning: string;
    indicators: Array<{ type: string; value: string; weight: number }>;
  } {
    const code = testBlock.code.value;
    const indicators: Array<{ type: string; value: string; weight: number }> = [];

    // Check for response indicators
    const responseMatches = this.findResponseIndicators(code);
    indicators.push(...responseMatches);

    // Check for request indicators
    const requestMatches = this.findRequestIndicators(code);
    indicators.push(...requestMatches);

    // Check for HTTP method patterns
    const httpMethodMatches = this.findHttpMethodPatterns(code);
    indicators.push(...httpMethodMatches);

    // Check for API object patterns
    const apiObjectMatches = this.findApiObjectPatterns(code);
    indicators.push(...apiObjectMatches);

    // Check for status code patterns
    const statusCodeMatches = this.findStatusCodePatterns(code);
    indicators.push(...statusCodeMatches);

    // Calculate confidence based on weighted indicators
    const totalWeight = indicators.reduce((sum, indicator) => sum + indicator.weight, 0);
    const indicatorCount = indicators.length;

    let confidence = 0;
    let isRequestSpecific = false;

    if (indicatorCount >= this.config.minIndicatorCount) {
      isRequestSpecific = true;

      // Base confidence from indicator count
      confidence = Math.min(indicatorCount * 0.2, 0.8);

      // Weighted confidence boost
      confidence += Math.min(totalWeight * 0.1, 0.4);

      // Strong indicators boost
      const strongIndicators = indicators.filter(i => i.weight >= 0.5);
      if (strongIndicators.length > 0) {
        confidence += 0.2;
      }

      // Multiple types of indicators boost
      const indicatorTypes = new Set(indicators.map(i => i.type));
      if (indicatorTypes.size >= 3) {
        confidence += 0.1;
      }

      confidence = Math.min(confidence, 1.0);
    }

    const reasoning = this.buildReasoning(indicators, isRequestSpecific, confidence);

    return {
      isRequestSpecific,
      confidence,
      reasoning,
      indicators,
    };
  }

  /**
   * Find response-related indicators in code
   */
  private findResponseIndicators(
    code: string
  ): Array<{ type: string; value: string; weight: number }> {
    const indicators: Array<{ type: string; value: string; weight: number }> = [];

    for (const indicator of this.config.responseIndicators) {
      const regex = new RegExp(`\\b${indicator}\\b`, 'gi');
      const matches = [...code.matchAll(regex)];

      for (const match of matches) {
        indicators.push({
          type: 'response',
          value: match[0],
          weight: this.config.weightings.response,
        });
      }
    }

    return indicators;
  }

  /**
   * Find request-related indicators in code
   */
  private findRequestIndicators(
    code: string
  ): Array<{ type: string; value: string; weight: number }> {
    const indicators: Array<{ type: string; value: string; weight: number }> = [];

    for (const indicator of this.config.requestIndicators) {
      const regex = new RegExp(indicator.replace('.', '\\.'), 'gi');
      const matches = [...code.matchAll(regex)];

      for (const match of matches) {
        indicators.push({
          type: 'request',
          value: match[0],
          weight: this.config.weightings.request,
        });
      }
    }

    return indicators;
  }

  /**
   * Find HTTP method patterns in code
   */
  private findHttpMethodPatterns(
    code: string
  ): Array<{ type: string; value: string; weight: number }> {
    const indicators: Array<{ type: string; value: string; weight: number }> = [];

    for (const pattern of this.config.httpMethodPatterns) {
      const matches = [...code.matchAll(pattern)];

      for (const match of matches) {
        indicators.push({
          type: 'httpMethod',
          value: match[0],
          weight: this.config.weightings.httpMethod,
        });
      }
    }

    return indicators;
  }

  /**
   * Find API object patterns in code
   */
  private findApiObjectPatterns(
    code: string
  ): Array<{ type: string; value: string; weight: number }> {
    const indicators: Array<{ type: string; value: string; weight: number }> = [];

    for (const pattern of this.config.apiObjectPatterns) {
      const matches = [...code.matchAll(pattern)];

      for (const match of matches) {
        indicators.push({
          type: 'apiObject',
          value: match[0],
          weight: this.config.weightings.apiObject,
        });
      }
    }

    return indicators;
  }

  /**
   * Find status code patterns in code
   */
  private findStatusCodePatterns(
    code: string
  ): Array<{ type: string; value: string; weight: number }> {
    const indicators: Array<{ type: string; value: string; weight: number }> = [];

    // Look for HTTP status codes (200, 201, 400, 404, 500, etc.)
    const statusCodePattern = /\b([1-5]\d{2})\b/g;
    const matches = [...code.matchAll(statusCodePattern)];

    for (const match of matches) {
      const statusCode = parseInt(match[1]);

      // Validate it's a real HTTP status code
      if (statusCode >= 100 && statusCode <= 599) {
        indicators.push({
          type: 'statusCode',
          value: match[0],
          weight: this.config.weightings.statusCode,
        });
      }
    }

    return indicators;
  }

  /**
   * Build human-readable reasoning for the classification
   */
  private buildReasoning(
    indicators: Array<{ type: string; value: string; weight: number }>,
    isRequestSpecific: boolean,
    confidence: number
  ): string {
    if (indicators.length === 0) {
      return 'No request/response indicators found in test code';
    }

    const indicatorSummary = indicators.reduce(
      (summary, indicator) => {
        summary[indicator.type] = (summary[indicator.type] || 0) + 1;
        return summary;
      },
      {} as Record<string, number>
    );

    const summaryParts = Object.entries(indicatorSummary)
      .map(([type, count]) => `${count} ${type} indicator(s)`)
      .join(', ');

    const baseReason = isRequestSpecific
      ? 'Classified as request-specific based on code content'
      : 'Insufficient indicators for request-specific classification';

    return `${baseReason}: ${summaryParts}; Confidence: ${(confidence * 100).toFixed(1)}%`;
  }

  /**
   * Add custom request indicator
   */
  addRequestIndicator(indicator: string): void {
    this.config.requestIndicators.push(indicator);
  }

  /**
   * Add custom response indicator
   */
  addResponseIndicator(indicator: string): void {
    this.config.responseIndicators.push(indicator);
  }

  /**
   * Add custom HTTP method pattern
   */
  addHttpMethodPattern(pattern: RegExp): void {
    this.config.httpMethodPatterns.push(pattern);
  }

  /**
   * Add custom API object pattern
   */
  addApiObjectPattern(pattern: RegExp): void {
    this.config.apiObjectPatterns.push(pattern);
  }

  /**
   * Get statistics about code analysis
   */
  getCodeAnalysisStatistics(): {
    requestIndicators: number;
    responseIndicators: number;
    httpMethodPatterns: number;
    apiObjectPatterns: number;
    minIndicatorCount: number;
  } {
    return {
      requestIndicators: this.config.requestIndicators.length,
      responseIndicators: this.config.responseIndicators.length,
      httpMethodPatterns: this.config.httpMethodPatterns.length,
      apiObjectPatterns: this.config.apiObjectPatterns.length,
      minIndicatorCount: this.config.minIndicatorCount,
    };
  }
}
