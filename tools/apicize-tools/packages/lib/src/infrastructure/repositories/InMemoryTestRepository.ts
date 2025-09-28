/**
 * In-memory implementation of test repository
 * Useful for testing and development environments
 */

import {
  ITestRepository,
  RepositoryStatistics,
} from '../../domain/test-analysis/repositories/ITestRepository';
import { TestSuite } from '../../domain/test-analysis/entities/TestSuite';
import { Result } from '../../domain/shared/Result';
import { DomainError, InfrastructureError } from '../../domain/shared/DomainError';

/**
 * In-memory test repository implementation
 */
export class InMemoryTestRepository implements ITestRepository {
  private testSuites = new Map<string, TestSuite>();
  private lastModified = new Date();

  /**
   * Save a test suite
   */
  async save(testSuite: TestSuite): Promise<Result<void, InfrastructureError>> {
    try {
      this.testSuites.set(testSuite.id.value, testSuite);
      this.lastModified = new Date();
      return Result.success(undefined);
    } catch (error) {
      return Result.failure(
        new InfrastructureError('SAVE_FAILED', 'Failed to save test suite', {
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  /**
   * Find a test suite by ID
   */
  async findById(id: string): Promise<Result<TestSuite | undefined, InfrastructureError>> {
    try {
      const testSuite = this.testSuites.get(id);
      return Result.success(testSuite);
    } catch (error) {
      return Result.failure(
        new InfrastructureError('FIND_FAILED', 'Failed to find test suite by ID', {
          id,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  /**
   * Find test suites by name pattern
   */
  async findByNamePattern(pattern: string): Promise<Result<TestSuite[], InfrastructureError>> {
    try {
      const regex = new RegExp(pattern, 'i');
      const matchingSuites = Array.from(this.testSuites.values()).filter(suite =>
        regex.test(suite.name.value)
      );

      return Result.success(matchingSuites);
    } catch (error) {
      return Result.failure(
        new InfrastructureError('SEARCH_FAILED', 'Failed to search test suites by pattern', {
          pattern,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  /**
   * Find all test suites
   */
  async findAll(): Promise<Result<TestSuite[], InfrastructureError>> {
    try {
      const allSuites = Array.from(this.testSuites.values());
      return Result.success(allSuites);
    } catch (error) {
      return Result.failure(
        new InfrastructureError('FIND_ALL_FAILED', 'Failed to retrieve all test suites', {
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  /**
   * Delete a test suite by ID
   */
  async delete(id: string): Promise<Result<boolean, InfrastructureError>> {
    try {
      const deleted = this.testSuites.delete(id);
      if (deleted) {
        this.lastModified = new Date();
      }
      return Result.success(deleted);
    } catch (error) {
      return Result.failure(
        new InfrastructureError('DELETE_FAILED', 'Failed to delete test suite', {
          id,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  /**
   * Check if a test suite exists
   */
  async exists(id: string): Promise<Result<boolean, InfrastructureError>> {
    try {
      const exists = this.testSuites.has(id);
      return Result.success(exists);
    } catch (error) {
      return Result.failure(
        new InfrastructureError('EXISTS_CHECK_FAILED', 'Failed to check test suite existence', {
          id,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  /**
   * Get repository statistics
   */
  async getStatistics(): Promise<Result<RepositoryStatistics, InfrastructureError>> {
    try {
      const testSuites = Array.from(this.testSuites.values());
      const totalTestSuites = testSuites.length;

      // Calculate total test blocks
      const totalTestBlocks = testSuites.reduce(
        (count, suite) => count + suite.testBlocks.length,
        0
      );

      // Calculate request-specific percentage
      const requestSpecificBlocks = testSuites.reduce(
        (count, suite) => count + suite.testBlocks.filter(block => block.isRequestSpecific).length,
        0
      );

      const requestSpecificPercentage =
        totalTestBlocks > 0 ? (requestSpecificBlocks / totalTestBlocks) * 100 : 0;

      // Calculate average blocks per suite
      const averageBlocksPerSuite = totalTestSuites > 0 ? totalTestBlocks / totalTestSuites : 0;

      // Estimate storage size (rough calculation)
      const storageSize = this.estimateStorageSize();

      const statistics: RepositoryStatistics = {
        totalTestSuites,
        totalTestBlocks,
        totalMetadataRecords: 0, // Would need separate metadata tracking
        averageBlocksPerSuite,
        requestSpecificPercentage,
        storageSize,
        lastModified: this.lastModified,
      };

      return Result.success(statistics);
    } catch (error) {
      return Result.failure(
        new InfrastructureError('STATISTICS_FAILED', 'Failed to calculate repository statistics', {
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  /**
   * Clear all data (useful for testing)
   */
  async clear(): Promise<Result<void, InfrastructureError>> {
    try {
      this.testSuites.clear();
      this.lastModified = new Date();
      return Result.success(undefined);
    } catch (error) {
      return Result.failure(
        new InfrastructureError('CLEAR_FAILED', 'Failed to clear repository', {
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  /**
   * Get current size
   */
  size(): number {
    return this.testSuites.size;
  }

  /**
   * Check if repository is empty
   */
  isEmpty(): boolean {
    return this.testSuites.size === 0;
  }

  /**
   * Get all test suite IDs
   */
  getAllIds(): string[] {
    return Array.from(this.testSuites.keys());
  }

  /**
   * Estimate storage size in bytes
   */
  private estimateStorageSize(): number {
    const testSuites = Array.from(this.testSuites.values());

    return testSuites.reduce((size, suite) => {
      // Rough estimation: JSON stringify length as proxy for size
      try {
        const serialized = JSON.stringify({
          id: suite.id.value,
          name: suite.name.value,
          testBlocks: suite.testBlocks.map(block => ({
            id: block.id,
            name: block.name.value,
            code: block.code.value,
            type: block.type,
            isRequestSpecific: block.isRequestSpecific,
          })),
        });
        return size + serialized.length * 2; // Rough estimate for UTF-16
      } catch {
        return size + 1000; // Fallback estimate
      }
    }, 0);
  }

  /**
   * Bulk save operation
   */
  async bulkSave(testSuites: TestSuite[]): Promise<Result<void, InfrastructureError>> {
    try {
      for (const suite of testSuites) {
        this.testSuites.set(suite.id.value, suite);
      }
      this.lastModified = new Date();
      return Result.success(undefined);
    } catch (error) {
      return Result.failure(
        new InfrastructureError('BULK_SAVE_FAILED', 'Failed to bulk save test suites', {
          count: testSuites.length,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  /**
   * Find test suites by creation date range
   */
  async findByDateRange(from: Date, to: Date): Promise<Result<TestSuite[], InfrastructureError>> {
    try {
      // Note: In-memory implementation doesn't track creation dates
      // This would be implemented properly in a persistent repository
      const allSuites = Array.from(this.testSuites.values());
      return Result.success(allSuites);
    } catch (error) {
      return Result.failure(
        new InfrastructureError(
          'DATE_SEARCH_FAILED',
          'Failed to search test suites by date range',
          {
            from: from.toISOString(),
            to: to.toISOString(),
            error: error instanceof Error ? error.message : String(error),
          }
        )
      );
    }
  }

  /**
   * Count test suites matching a pattern
   */
  async countByPattern(pattern: string): Promise<Result<number, InfrastructureError>> {
    try {
      const result = await this.findByNamePattern(pattern);
      if (result.success) {
        return Result.success(result.data.length);
      } else {
        return Result.failure(result.error);
      }
    } catch (error) {
      return Result.failure(
        new InfrastructureError('COUNT_FAILED', 'Failed to count test suites by pattern', {
          pattern,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }
}
