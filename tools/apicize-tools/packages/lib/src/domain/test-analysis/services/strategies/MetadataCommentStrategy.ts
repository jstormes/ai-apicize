/**
 * Strategy for classifying tests based on metadata comments
 * Identifies request-specific tests by analyzing preceding metadata
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
 * Configuration for the metadata comment strategy
 */
export interface MetadataCommentConfig {
  metadataPatterns: RegExp[];
  searchDistance: number; // How far back to look for metadata (in characters)
  requireValidJson: boolean;
  trustLevel: number; // 0-1, how much to trust metadata indicators
}

/**
 * Default configuration for metadata comment strategy
 */
const DEFAULT_CONFIG: MetadataCommentConfig = {
  metadataPatterns: [
    /\/\*\s*@apicize-request-metadata\s*/i,
    /\/\*\s*@apicize-group-metadata\s*/i,
    /\/\/\s*@apicize-request:/i,
    /\/\/\s*@request-specific/i,
    /\/\*\s*@request\s*:\s*/i,
    /\/\*\s*@api\s*:\s*/i,
    /\/\*\s*@endpoint\s*:\s*/i,
  ],
  searchDistance: 1000, // Look back 1000 characters
  requireValidJson: false,
  trustLevel: 0.9, // High trust in explicit metadata
};

/**
 * Classification strategy based on metadata comments
 */
export class MetadataCommentStrategy implements IClassificationStrategy {
  readonly name = 'MetadataCommentStrategy';
  readonly priority = 200; // Higher priority than patterns - metadata is explicit

  private config: MetadataCommentConfig;

  constructor(config: Partial<MetadataCommentConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Classify test based on metadata comments
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
            'Metadata comment strategy cannot classify this test block',
            { testBlockName: testBlock.name.value }
          )
        );
      }

      const analysisResult = this.analyzeMetadata(testBlock, context);

      const result: TestClassificationResult = {
        testBlock,
        isRequestSpecific: analysisResult.hasRequestMetadata,
        confidence: analysisResult.confidence,
        reasoning: analysisResult.reasoning,
      };

      return Result.success(result);
    } catch (error) {
      return Result.failure(
        new DomainError('CLASSIFICATION_ERROR', 'Error during metadata-based classification', {
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  /**
   * Check if this strategy can classify the test block
   */
  canClassify(testBlock: TestBlock, context: ClassificationContext): boolean {
    // Can classify any test block if there's source code context
    return context.sourceCode && context.sourceCode.length > 0;
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
    this.config = { ...this.config, ...(config as Partial<MetadataCommentConfig>) };
  }

  /**
   * Analyze metadata around the test block
   */
  private analyzeMetadata(
    testBlock: TestBlock,
    context: ClassificationContext
  ): {
    hasRequestMetadata: boolean;
    confidence: number;
    reasoning: string;
    foundMetadata: Array<{ pattern: RegExp; match: string; position: number }>;
  } {
    const startPosition = testBlock.position.start;
    const searchStart = Math.max(0, startPosition - this.config.searchDistance);
    const searchContent = context.sourceCode.substring(searchStart, startPosition);

    const foundMetadata: Array<{ pattern: RegExp; match: string; position: number }> = [];

    // Search for metadata patterns
    for (const pattern of this.config.metadataPatterns) {
      const matches = [...searchContent.matchAll(new RegExp(pattern.source, pattern.flags + 'g'))];

      for (const match of matches) {
        if (match.index !== undefined) {
          foundMetadata.push({
            pattern,
            match: match[0],
            position: searchStart + match.index,
          });
        }
      }
    }

    // Analyze found metadata
    let hasRequestMetadata = false;
    let confidence = 0;
    const reasoningParts: string[] = [];

    if (foundMetadata.length === 0) {
      reasoningParts.push('No metadata comments found');
    } else {
      hasRequestMetadata = true;

      // Base confidence from having metadata
      confidence = this.config.trustLevel * 0.8;

      // Additional analysis for different types of metadata
      const apicizeMetadata = foundMetadata.filter(m => m.pattern.source.includes('apicize'));

      const requestMetadata = foundMetadata.filter(
        m => m.pattern.source.includes('request') || m.pattern.source.includes('api')
      );

      if (apicizeMetadata.length > 0) {
        confidence = this.config.trustLevel; // Full trust for Apicize metadata
        reasoningParts.push(`Found ${apicizeMetadata.length} Apicize metadata comment(s)`);

        // Try to parse JSON content for additional validation
        if (this.config.requireValidJson) {
          const validJsonCount = this.validateJsonMetadata(searchContent, apicizeMetadata);
          if (validJsonCount > 0) {
            confidence = Math.min(confidence + 0.1, 1.0);
            reasoningParts.push(`${validJsonCount} metadata comment(s) contain valid JSON`);
          }
        }
      } else if (requestMetadata.length > 0) {
        confidence = this.config.trustLevel * 0.9;
        reasoningParts.push(`Found ${requestMetadata.length} request-related metadata comment(s)`);
      } else {
        confidence = this.config.trustLevel * 0.7;
        reasoningParts.push(`Found ${foundMetadata.length} generic metadata comment(s)`);
      }

      // Proximity bonus - metadata closer to test gets higher confidence
      const closestMetadata = foundMetadata.reduce((closest, current) =>
        current.position > closest.position ? current : closest
      );

      const distance = startPosition - closestMetadata.position;
      if (distance < 100) {
        // Very close
        confidence = Math.min(confidence + 0.1, 1.0);
        reasoningParts.push('Metadata is very close to test block');
      } else if (distance < 300) {
        // Reasonably close
        confidence = Math.min(confidence + 0.05, 1.0);
        reasoningParts.push('Metadata is close to test block');
      }
    }

    const reasoning = hasRequestMetadata
      ? `Request-specific based on metadata: ${reasoningParts.join('; ')}`
      : reasoningParts.join('; ');

    return {
      hasRequestMetadata,
      confidence,
      reasoning,
      foundMetadata,
    };
  }

  /**
   * Validate JSON content in metadata comments
   */
  private validateJsonMetadata(
    content: string,
    metadataItems: Array<{ pattern: RegExp; match: string; position: number }>
  ): number {
    let validJsonCount = 0;

    for (const metadata of metadataItems) {
      try {
        // Extract content between metadata markers
        const metadataStart = content.indexOf(metadata.match);
        if (metadataStart >= 0) {
          const afterStart = content.substring(metadataStart + metadata.match.length);
          const endMarker =
            afterStart.indexOf('@apicize-') !== -1
              ? afterStart.indexOf('@apicize-')
              : afterStart.indexOf('*/');

          if (endMarker > 0) {
            const jsonContent = afterStart.substring(0, endMarker).trim();
            JSON.parse(jsonContent);
            validJsonCount++;
          }
        }
      } catch {
        // Invalid JSON, but we still count the metadata as present
        continue;
      }
    }

    return validJsonCount;
  }

  /**
   * Add a custom metadata pattern
   */
  addMetadataPattern(pattern: RegExp): void {
    this.config.metadataPatterns.push(pattern);
  }

  /**
   * Remove a metadata pattern
   */
  removeMetadataPattern(pattern: RegExp): void {
    const index = this.config.metadataPatterns.findIndex(p => p.source === pattern.source);
    if (index >= 0) {
      this.config.metadataPatterns.splice(index, 1);
    }
  }

  /**
   * Get statistics about metadata detection
   */
  getMetadataStatistics(): {
    totalPatterns: number;
    apicizePatterns: number;
    searchDistance: number;
    trustLevel: number;
  } {
    const apicizePatterns = this.config.metadataPatterns.filter(p =>
      p.source.includes('apicize')
    ).length;

    return {
      totalPatterns: this.config.metadataPatterns.length,
      apicizePatterns,
      searchDistance: this.config.searchDistance,
      trustLevel: this.config.trustLevel,
    };
  }
}
