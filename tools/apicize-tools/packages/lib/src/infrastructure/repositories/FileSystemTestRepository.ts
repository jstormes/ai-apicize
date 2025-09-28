/**
 * File system-based implementation of test repository
 * Persists test data to JSON files on disk
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import {
  ITestRepository,
  RepositoryStatistics,
} from '../../domain/test-analysis/repositories/ITestRepository';
import { TestSuite } from '../../domain/test-analysis/entities/TestSuite';
import { TestBlock } from '../../domain/test-analysis/entities/TestBlock';
import { TestName } from '../../domain/test-analysis/value-objects/TestName';
import { SourceCode } from '../../domain/test-analysis/value-objects/SourceCode';
import { TestSuiteId } from '../../domain/test-analysis/entities/TestSuite';
import { Result } from '../../domain/shared/Result';
import { InfrastructureError } from '../../domain/shared/DomainError';

/**
 * Configuration for file system repository
 */
export interface FileSystemRepositoryConfig {
  basePath: string;
  encoding: BufferEncoding;
  ensureDirectories: boolean;
  backupOnUpdate: boolean;
  compressionEnabled: boolean;
}

/**
 * Serializable representation of test suite for file storage
 */
interface SerializableTestSuite {
  id: string;
  name: string;
  testBlocks: SerializableTestBlock[];
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Serializable representation of test block
 */
interface SerializableTestBlock {
  id?: string;
  name: string;
  code: string;
  type: 'describe' | 'it';
  depth: number;
  isRequestSpecific: boolean;
  position?: {
    start: number;
    end: number;
  };
}

/**
 * File system-based test repository
 */
export class FileSystemTestRepository implements ITestRepository {
  private config: FileSystemRepositoryConfig;

  constructor(config: Partial<FileSystemRepositoryConfig> = {}) {
    this.config = {
      basePath: config.basePath || './test-repository',
      encoding: config.encoding || 'utf8',
      ensureDirectories: config.ensureDirectories ?? true,
      backupOnUpdate: config.backupOnUpdate ?? true,
      compressionEnabled: config.compressionEnabled ?? false,
    };
  }

  /**
   * Save a test suite to file system
   */
  async save(testSuite: TestSuite): Promise<Result<void, InfrastructureError>> {
    try {
      const filePath = this.getTestSuiteFilePath(testSuite.id.value);

      if (this.config.ensureDirectories) {
        await this.ensureDirectoryExists(dirname(filePath));
      }

      // Create backup if updating existing file
      if (this.config.backupOnUpdate && (await this.fileExists(filePath))) {
        await this.createBackup(filePath);
      }

      const serializable = this.serializeTestSuite(testSuite);
      const content = JSON.stringify(serializable, null, 2);

      await fs.writeFile(filePath, content, { encoding: this.config.encoding });

      return Result.success(undefined);
    } catch (error) {
      return Result.failure(
        new InfrastructureError('SAVE_FAILED', 'Failed to save test suite to file system', {
          testSuiteId: testSuite.id.value,
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
      const filePath = this.getTestSuiteFilePath(id);

      if (!(await this.fileExists(filePath))) {
        return Result.success(undefined);
      }

      const content = await fs.readFile(filePath, { encoding: this.config.encoding });
      const serializable: SerializableTestSuite = JSON.parse(content);

      const testSuite = this.deserializeTestSuite(serializable);
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
      const allSuites = await this.loadAllTestSuites();

      if (!allSuites.success) {
        return Result.failure(allSuites.error);
      }

      const matchingSuites = allSuites.data.filter(suite => regex.test(suite.name.value));

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
    return this.loadAllTestSuites();
  }

  /**
   * Delete a test suite by ID
   */
  async delete(id: string): Promise<Result<boolean, InfrastructureError>> {
    try {
      const filePath = this.getTestSuiteFilePath(id);

      if (!(await this.fileExists(filePath))) {
        return Result.success(false);
      }

      // Create backup before deletion
      if (this.config.backupOnUpdate) {
        await this.createBackup(filePath, '.deleted');
      }

      await fs.unlink(filePath);
      return Result.success(true);
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
      const filePath = this.getTestSuiteFilePath(id);
      const exists = await this.fileExists(filePath);
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
      const allSuites = await this.loadAllTestSuites();

      if (!allSuites.success) {
        return Result.failure(allSuites.error);
      }

      const testSuites = allSuites.data;
      const totalTestSuites = testSuites.length;

      // Calculate statistics
      const totalTestBlocks = testSuites.reduce(
        (count, suite) => count + suite.testBlocks.length,
        0
      );

      const requestSpecificBlocks = testSuites.reduce(
        (count, suite) => count + suite.testBlocks.filter(block => block.isRequestSpecific).length,
        0
      );

      const requestSpecificPercentage =
        totalTestBlocks > 0 ? (requestSpecificBlocks / totalTestBlocks) * 100 : 0;

      const averageBlocksPerSuite = totalTestSuites > 0 ? totalTestBlocks / totalTestSuites : 0;

      // Calculate storage size
      const storageSize = await this.calculateStorageSize();

      // Get last modified date
      const lastModified = await this.getLastModifiedDate();

      const statistics: RepositoryStatistics = {
        totalTestSuites,
        totalTestBlocks,
        totalMetadataRecords: 0, // Would implement with separate metadata tracking
        averageBlocksPerSuite,
        requestSpecificPercentage,
        storageSize: storageSize.success ? storageSize.data : 0,
        lastModified: lastModified.success ? lastModified.data : new Date(),
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
   * Get the file path for a test suite
   */
  private getTestSuiteFilePath(id: string): string {
    return join(this.config.basePath, 'test-suites', `${id}.json`);
  }

  /**
   * Check if a file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Ensure directory exists
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      // Ignore error if directory already exists
      if ((error as any).code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * Create backup of existing file
   */
  private async createBackup(filePath: string, suffix = '.backup'): Promise<void> {
    const backupPath = `${filePath}${suffix}.${Date.now()}`;
    await fs.copyFile(filePath, backupPath);
  }

  /**
   * Load all test suites from file system
   */
  private async loadAllTestSuites(): Promise<Result<TestSuite[], InfrastructureError>> {
    try {
      const testSuitesDir = join(this.config.basePath, 'test-suites');

      // Ensure directory exists
      if (!(await this.fileExists(testSuitesDir))) {
        return Result.success([]);
      }

      const files = await fs.readdir(testSuitesDir);
      const jsonFiles = files.filter(file => file.endsWith('.json'));

      const testSuites: TestSuite[] = [];

      for (const file of jsonFiles) {
        const filePath = join(testSuitesDir, file);
        try {
          const content = await fs.readFile(filePath, { encoding: this.config.encoding });
          const serializable: SerializableTestSuite = JSON.parse(content);
          const testSuite = this.deserializeTestSuite(serializable);
          testSuites.push(testSuite);
        } catch (error) {
          // Log error but continue with other files
          console.warn(`Failed to load test suite from ${file}:`, error);
        }
      }

      return Result.success(testSuites);
    } catch (error) {
      return Result.failure(
        new InfrastructureError('LOAD_ALL_FAILED', 'Failed to load all test suites', {
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  /**
   * Serialize test suite for file storage
   */
  private serializeTestSuite(testSuite: TestSuite): SerializableTestSuite {
    return {
      id: testSuite.id.value,
      name: testSuite.name.value,
      testBlocks: testSuite.testBlocks.map(block => ({
        id: block.id,
        name: block.name.value,
        code: block.code.value,
        type: block.type,
        depth: block.depth,
        isRequestSpecific: block.isRequestSpecific,
        position: block.position
          ? {
              start: block.position.start,
              end: block.position.end,
            }
          : undefined,
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Deserialize test suite from file storage
   */
  private deserializeTestSuite(serializable: SerializableTestSuite): TestSuite {
    // For now, return a simple TestSuite - full deserialization would need proper factory methods
    const testSuiteResult = TestSuite.create({
      id: serializable.id,
      name: serializable.name,
    });

    if (Result.isOk(testSuiteResult)) {
      return testSuiteResult.data;
    } else {
      throw new Error('Failed to deserialize test suite');
    }
  }

  /**
   * Calculate total storage size
   */
  private async calculateStorageSize(): Promise<Result<number, InfrastructureError>> {
    try {
      const testSuitesDir = join(this.config.basePath, 'test-suites');

      if (!(await this.fileExists(testSuitesDir))) {
        return Result.success(0);
      }

      const files = await fs.readdir(testSuitesDir);
      let totalSize = 0;

      for (const file of files) {
        const filePath = join(testSuitesDir, file);
        try {
          const stats = await fs.stat(filePath);
          totalSize += stats.size;
        } catch {
          // Ignore files that can't be accessed
        }
      }

      return Result.success(totalSize);
    } catch (error) {
      return Result.failure(
        new InfrastructureError('SIZE_CALCULATION_FAILED', 'Failed to calculate storage size', {
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  /**
   * Get last modified date
   */
  private async getLastModifiedDate(): Promise<Result<Date, InfrastructureError>> {
    try {
      const testSuitesDir = join(this.config.basePath, 'test-suites');

      if (!(await this.fileExists(testSuitesDir))) {
        return Result.success(new Date());
      }

      const files = await fs.readdir(testSuitesDir);
      let lastModified = new Date(0);

      for (const file of files) {
        const filePath = join(testSuitesDir, file);
        try {
          const stats = await fs.stat(filePath);
          if (stats.mtime > lastModified) {
            lastModified = stats.mtime;
          }
        } catch {
          // Ignore files that can't be accessed
        }
      }

      return Result.success(lastModified);
    } catch (error) {
      return Result.failure(
        new InfrastructureError('LAST_MODIFIED_FAILED', 'Failed to get last modified date', {
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  /**
   * Clear all data (removes all files)
   */
  async clear(): Promise<Result<void, InfrastructureError>> {
    try {
      const testSuitesDir = join(this.config.basePath, 'test-suites');

      if (await this.fileExists(testSuitesDir)) {
        const files = await fs.readdir(testSuitesDir);

        for (const file of files) {
          const filePath = join(testSuitesDir, file);
          await fs.unlink(filePath);
        }
      }

      return Result.success(undefined);
    } catch (error) {
      return Result.failure(
        new InfrastructureError('CLEAR_FAILED', 'Failed to clear repository', {
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }
}
