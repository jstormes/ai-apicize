/**
 * File Reader - Responsible for reading files from the filesystem
 */

import { Result, success, failure } from '../../infrastructure/result';
import { ApicizeFileSystemError, ApicizeErrorCode } from '../../infrastructure/errors';
import { FileSystem } from '../../infrastructure/interfaces';
import { FileReader as IFileReader } from '../../domain/parsing/parsing-domain';

/**
 * File reader configuration
 */
export interface FileReaderConfig {
  maxFileSize?: number;
  defaultEncoding?: BufferEncoding;
  supportedExtensions?: string[];
  enableStrictExtensionCheck?: boolean;
}

/**
 * File metadata information
 */
export interface FileMetadata {
  size: number;
  modified: Date;
  path: string;
  extension: string;
  encoding?: BufferEncoding;
}

/**
 * File reader implementation
 */
export class ApicizeFileReader implements IFileReader {
  private config: FileReaderConfig;
  private fileSystem: FileSystem;

  constructor(fileSystem: FileSystem, config: FileReaderConfig = {}) {
    this.fileSystem = fileSystem;
    this.config = {
      maxFileSize: 10 * 1024 * 1024, // 10MB
      defaultEncoding: 'utf-8',
      supportedExtensions: ['.apicize', '.json'],
      enableStrictExtensionCheck: false,
      ...config,
    };
  }

  /**
   * Check if file exists
   */
  async exists(path: string): Promise<Result<boolean, ApicizeFileSystemError>> {
    try {
      const exists = await this.fileSystem.existsAsync(path);
      return success(exists);
    } catch (error) {
      return failure(
        new ApicizeFileSystemError(
          ApicizeErrorCode.FILE_READ_ERROR,
          `Failed to check if file exists: ${path}`,
          {
            filePath: path,
            operation: 'exists',
            cause: error as Error,
          }
        )
      );
    }
  }

  /**
   * Read file content
   */
  async readFile(
    path: string,
    encoding?: BufferEncoding
  ): Promise<Result<string, ApicizeFileSystemError>> {
    try {
      // Check if file exists first
      const existsResult = await this.exists(path);
      if (existsResult.isFailure()) {
        return existsResult as any;
      }

      if (!existsResult.data) {
        return failure(
          new ApicizeFileSystemError(ApicizeErrorCode.FILE_NOT_FOUND, `File not found: ${path}`, {
            filePath: path,
            operation: 'read',
          })
        );
      }

      // Validate file extension if strict checking is enabled
      if (this.config.enableStrictExtensionCheck) {
        const validationResult = this.validateFileExtension(path);
        if (validationResult.isFailure()) {
          return validationResult as any;
        }
      }

      // Get file stats to check size
      const statsResult = await this.getStats(path);
      if (statsResult.isFailure()) {
        return statsResult as any;
      }

      const stats = statsResult.data;
      if (stats.size > this.config.maxFileSize!) {
        return failure(
          new ApicizeFileSystemError(
            ApicizeErrorCode.FILE_READ_ERROR,
            `File size (${stats.size} bytes) exceeds maximum allowed size (${this.config.maxFileSize} bytes)`,
            {
              filePath: path,
              operation: 'read',
              context: { fileSize: stats.size, maxSize: this.config.maxFileSize },
            }
          )
        );
      }

      // Read file content
      const fileEncoding = encoding || this.config.defaultEncoding!;
      const content = await this.fileSystem.readFileAsync(path, fileEncoding);

      return success(content);
    } catch (error) {
      return failure(
        new ApicizeFileSystemError(
          ApicizeErrorCode.FILE_READ_ERROR,
          `Failed to read file: ${path}`,
          {
            filePath: path,
            operation: 'read',
            cause: error as Error,
          }
        )
      );
    }
  }

  /**
   * Read file with metadata
   */
  async readFileWithMetadata(
    path: string,
    encoding?: BufferEncoding
  ): Promise<Result<{ content: string; metadata: FileMetadata }, ApicizeFileSystemError>> {
    try {
      // Get file stats first
      const statsResult = await this.getStats(path);
      if (statsResult.isFailure()) {
        return statsResult as any;
      }

      // Read file content
      const contentResult = await this.readFile(path, encoding);
      if (contentResult.isFailure()) {
        return contentResult as any;
      }

      const stats = statsResult.data;
      const metadata: FileMetadata = {
        size: stats.size,
        modified: stats.modified,
        path: path,
        extension: this.getFileExtension(path),
        encoding: encoding || this.config.defaultEncoding,
      };

      return success({
        content: contentResult.data,
        metadata,
      });
    } catch (error) {
      return failure(
        new ApicizeFileSystemError(
          ApicizeErrorCode.FILE_READ_ERROR,
          `Failed to read file with metadata: ${path}`,
          {
            filePath: path,
            operation: 'readWithMetadata',
            cause: error as Error,
          }
        )
      );
    }
  }

  /**
   * Get file stats
   */
  async getStats(path: string): Promise<
    Result<
      {
        size: number;
        isFile: boolean;
        isDirectory: boolean;
        modified: Date;
      },
      ApicizeFileSystemError
    >
  > {
    try {
      const stats = await this.fileSystem.statAsync(path);

      return success({
        size: (stats as any).size || 0,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        modified: (stats as any).mtime || new Date(),
      });
    } catch (error) {
      return failure(
        new ApicizeFileSystemError(
          ApicizeErrorCode.FILE_READ_ERROR,
          `Failed to get file stats: ${path}`,
          {
            filePath: path,
            operation: 'stat',
            cause: error as Error,
          }
        )
      );
    }
  }

  /**
   * Read multiple files
   */
  async readFiles(
    paths: string[],
    encoding?: BufferEncoding
  ): Promise<
    Result<
      Array<{
        path: string;
        content: string;
        metadata: FileMetadata;
      }>,
      ApicizeFileSystemError
    >
  > {
    try {
      const results: Array<{
        path: string;
        content: string;
        metadata: FileMetadata;
      }> = [];

      const errors: string[] = [];

      for (const path of paths) {
        const result = await this.readFileWithMetadata(path, encoding);
        if (result.isSuccess()) {
          results.push({
            path,
            content: result.data.content,
            metadata: result.data.metadata,
          });
        } else {
          errors.push(`${path}: ${result.error.message}`);
        }
      }

      if (errors.length > 0 && results.length === 0) {
        return failure(
          new ApicizeFileSystemError(
            ApicizeErrorCode.FILE_READ_ERROR,
            `Failed to read any files. Errors: ${errors.join('; ')}`,
            {
              operation: 'readMultiple',
              context: { paths, errors },
            }
          )
        );
      }

      return success(results);
    } catch (error) {
      return failure(
        new ApicizeFileSystemError(
          ApicizeErrorCode.FILE_READ_ERROR,
          'Failed to read multiple files',
          {
            operation: 'readMultiple',
            cause: error as Error,
            context: { paths },
          }
        )
      );
    }
  }

  /**
   * Validate file extension
   */
  validateFileExtension(path: string): Result<boolean, ApicizeFileSystemError> {
    const extension = this.getFileExtension(path);

    if (!this.config.supportedExtensions!.includes(extension)) {
      return failure(
        new ApicizeFileSystemError(
          ApicizeErrorCode.INVALID_FORMAT,
          `Unsupported file extension: ${extension}. Supported extensions: ${this.config.supportedExtensions!.join(', ')}`,
          {
            filePath: path,
            operation: 'validate',
            context: {
              extension,
              supportedExtensions: this.config.supportedExtensions,
            },
          }
        )
      );
    }

    return success(true);
  }

  /**
   * Get file extension
   */
  private getFileExtension(path: string): string {
    const lastDotIndex = path.lastIndexOf('.');
    return lastDotIndex >= 0 ? path.substring(lastDotIndex) : '';
  }

  /**
   * Check if file is readable
   */
  async isReadable(path: string): Promise<Result<boolean, ApicizeFileSystemError>> {
    try {
      const statsResult = await this.getStats(path);
      if (statsResult.isFailure()) {
        return failure(statsResult.error);
      }

      const stats = statsResult.data;
      if (!stats.isFile) {
        return failure(
          new ApicizeFileSystemError(
            ApicizeErrorCode.INVALID_FORMAT,
            `Path is not a file: ${path}`,
            { filePath: path, operation: 'isReadable' }
          )
        );
      }

      return success(true);
    } catch (error) {
      return failure(
        new ApicizeFileSystemError(
          ApicizeErrorCode.FILE_READ_ERROR,
          `Failed to check if file is readable: ${path}`,
          {
            filePath: path,
            operation: 'isReadable',
            cause: error as Error,
          }
        )
      );
    }
  }

  /**
   * Get file content type based on extension
   */
  getContentType(path: string): string {
    const extension = this.getFileExtension(path).toLowerCase();

    switch (extension) {
      case '.apicize':
      case '.json':
        return 'application/json';
      case '.xml':
        return 'application/xml';
      case '.txt':
        return 'text/plain';
      case '.csv':
        return 'text/csv';
      case '.md':
        return 'text/markdown';
      default:
        return 'application/octet-stream';
    }
  }

  /**
   * Create a copy with different configuration
   */
  withConfig(newConfig: Partial<FileReaderConfig>): ApicizeFileReader {
    return new ApicizeFileReader(this.fileSystem, { ...this.config, ...newConfig });
  }

  /**
   * Get current configuration
   */
  getConfig(): FileReaderConfig {
    return { ...this.config };
  }
}
