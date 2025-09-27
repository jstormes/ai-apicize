/**
 * Error factory for consistent error creation
 * Provides convenient methods to create properly structured errors
 */

import {
  ApicizeError,
  ApicizeErrorCode,
  ErrorSeverity,
  ErrorContext,
  ApicizeFileSystemError,
  ApicizeParseError,
  ApicizeNetworkError,
  ApicizeConfigError,
  ApicizeValidationError,
  ApicizeAuthError,
} from './errors';

/**
 * Error creation options
 */
interface ErrorOptions {
  severity?: ErrorSeverity;
  context?: ErrorContext;
  cause?: Error;
  retryable?: boolean;
  suggestions?: string[];
}

/**
 * Factory class for creating standardized errors
 */
export class ErrorFactory {
  private static instance: ErrorFactory | null = null;
  private defaultContext: ErrorContext = {};

  constructor(defaultContext: ErrorContext = {}) {
    this.defaultContext = defaultContext;
  }

  /**
   * Get singleton instance
   */
  static getInstance(defaultContext?: ErrorContext): ErrorFactory {
    if (!ErrorFactory.instance) {
      ErrorFactory.instance = new ErrorFactory(defaultContext);
    }
    return ErrorFactory.instance;
  }

  /**
   * Reset singleton instance (mainly for testing)
   */
  static resetInstance(): void {
    ErrorFactory.instance = null;
  }

  /**
   * Set default context for all errors
   */
  setDefaultContext(context: ErrorContext): void {
    this.defaultContext = context;
  }

  /**
   * Merge context with defaults
   */
  private mergeContext(context?: ErrorContext): ErrorContext {
    return { ...this.defaultContext, ...context };
  }

  /**
   * Create a generic ApicizeError
   */
  createError(code: ApicizeErrorCode, message: string, options: ErrorOptions = {}): ApicizeError {
    return new ApicizeError(code, message, {
      ...options,
      context: this.mergeContext(options.context),
    });
  }

  // File System Errors

  /**
   * Create file not found error
   */
  createFileNotFoundError(filePath: string, options: ErrorOptions = {}): ApicizeFileSystemError {
    return new ApicizeFileSystemError(
      ApicizeErrorCode.FILE_NOT_FOUND,
      `File not found: ${filePath}`,
      {
        ...options,
        filePath,
        operation: 'read',
        context: this.mergeContext(options.context),
        suggestions: [
          'Verify the file path is correct',
          'Check if the file exists',
          'Ensure you have read permissions',
          ...(options.suggestions || []),
        ],
      }
    );
  }

  /**
   * Create file read error
   */
  createFileReadError(
    filePath: string,
    cause?: Error,
    options: ErrorOptions = {}
  ): ApicizeFileSystemError {
    return new ApicizeFileSystemError(
      ApicizeErrorCode.FILE_READ_ERROR,
      `Failed to read file: ${filePath}`,
      {
        ...options,
        filePath,
        operation: 'read',
        ...(cause !== undefined && { cause }),
        context: this.mergeContext(options.context),
        suggestions: [
          'Check file permissions',
          'Verify the file is not locked by another process',
          'Ensure sufficient disk space',
          ...(options.suggestions || []),
        ],
      }
    );
  }

  /**
   * Create file write error
   */
  createFileWriteError(
    filePath: string,
    cause?: Error,
    options: ErrorOptions = {}
  ): ApicizeFileSystemError {
    return new ApicizeFileSystemError(
      ApicizeErrorCode.FILE_WRITE_ERROR,
      `Failed to write file: ${filePath}`,
      {
        ...options,
        filePath,
        operation: 'write',
        ...(cause !== undefined && { cause }),
        context: this.mergeContext(options.context),
        suggestions: [
          'Check write permissions',
          'Verify sufficient disk space',
          'Ensure the directory exists',
          ...(options.suggestions || []),
        ],
      }
    );
  }

  /**
   * Create directory not found error
   */
  createDirectoryNotFoundError(
    dirPath: string,
    options: ErrorOptions = {}
  ): ApicizeFileSystemError {
    return new ApicizeFileSystemError(
      ApicizeErrorCode.DIRECTORY_NOT_FOUND,
      `Directory not found: ${dirPath}`,
      {
        ...options,
        filePath: dirPath,
        operation: 'access',
        context: this.mergeContext(options.context),
        suggestions: [
          'Verify the directory path is correct',
          'Create the directory if it should exist',
          'Check parent directory permissions',
          ...(options.suggestions || []),
        ],
      }
    );
  }

  // Parse Errors

  /**
   * Create JSON parse error
   */
  createJsonParseError(
    filePath?: string,
    cause?: Error,
    options: ErrorOptions = {}
  ): ApicizeParseError {
    return new ApicizeParseError(`Invalid JSON format${filePath ? ` in ${filePath}` : ''}`, {
      ...options,
      ...(filePath !== undefined && { filePath }),
      ...(cause !== undefined && { cause }),
      context: this.mergeContext(options.context),
      suggestions: [
        'Check for syntax errors in the JSON',
        'Validate JSON format using a JSON validator',
        'Ensure proper escaping of special characters',
        ...(options.suggestions || []),
      ],
    });
  }

  /**
   * Create schema validation error
   */
  createSchemaValidationError(
    details: string[],
    filePath?: string,
    options: ErrorOptions = {}
  ): ApicizeParseError {
    return new ApicizeParseError(`Schema validation failed${filePath ? ` for ${filePath}` : ''}`, {
      ...options,
      ...(filePath !== undefined && { filePath }),
      details,
      context: this.mergeContext(options.context),
      suggestions: [
        'Check the file format against the schema',
        'Verify all required fields are present',
        'Ensure field types match the schema',
        ...(options.suggestions || []),
      ],
    });
  }

  // Network Errors

  /**
   * Create timeout error
   */
  createTimeoutError(
    url?: string,
    timeout?: number,
    options: ErrorOptions = {}
  ): ApicizeNetworkError {
    const timeoutMsg = timeout ? ` after ${timeout}ms` : '';
    return new ApicizeNetworkError(
      ApicizeErrorCode.TIMEOUT_ERROR,
      `Request timed out${timeoutMsg}${url ? ` for ${url}` : ''}`,
      {
        ...options,
        ...(url !== undefined && { url }),
        retryable: true,
        context: this.mergeContext({ timeout, ...options.context }),
        suggestions: [
          'Increase the timeout value',
          'Check network connectivity',
          'Verify the server is responding',
          ...(options.suggestions || []),
        ],
      }
    );
  }

  /**
   * Create HTTP error
   */
  createHttpError(
    status: number,
    statusText: string,
    url?: string,
    options: ErrorOptions = {}
  ): ApicizeNetworkError {
    return new ApicizeNetworkError(
      ApicizeErrorCode.HTTP_ERROR,
      `HTTP ${status} ${statusText}${url ? ` for ${url}` : ''}`,
      {
        ...options,
        ...(url !== undefined && { url }),
        status,
        retryable: status >= 500, // Retry server errors but not client errors
        context: this.mergeContext({ status, statusText, ...options.context }),
        suggestions: this.getHttpErrorSuggestions(status, options.suggestions),
      }
    );
  }

  /**
   * Create network connectivity error
   */
  createNetworkError(url?: string, cause?: Error, options: ErrorOptions = {}): ApicizeNetworkError {
    return new ApicizeNetworkError(
      ApicizeErrorCode.NETWORK_ERROR,
      `Network error${url ? ` for ${url}` : ''}`,
      {
        ...options,
        ...(url !== undefined && { url }),
        ...(cause !== undefined && { cause }),
        retryable: true,
        context: this.mergeContext(options.context),
        suggestions: [
          'Check internet connectivity',
          'Verify the URL is correct',
          'Check if the server is accessible',
          'Try again later',
          ...(options.suggestions || []),
        ],
      }
    );
  }

  // Configuration Errors

  /**
   * Create configuration error
   */
  createConfigError(
    message: string,
    configKey?: string,
    options: ErrorOptions = {}
  ): ApicizeConfigError {
    return new ApicizeConfigError(message, {
      ...options,
      ...(configKey !== undefined && { configKey }),
      context: this.mergeContext(options.context),
      suggestions: [
        'Check configuration file syntax',
        'Verify all required configuration values',
        'Ensure configuration file exists',
        ...(options.suggestions || []),
      ],
    });
  }

  /**
   * Create missing configuration error
   */
  createMissingConfigError(configKey: string, options: ErrorOptions = {}): ApicizeConfigError {
    return new ApicizeConfigError(`Missing required configuration: ${configKey}`, {
      ...options,
      configKey,
      context: this.mergeContext(options.context),
      suggestions: [
        `Add the '${configKey}' configuration value`,
        'Check the configuration file',
        'Verify environment variables are set',
        ...(options.suggestions || []),
      ],
    });
  }

  // Validation Errors

  /**
   * Create validation error
   */
  createValidationError(
    field: string,
    value: unknown,
    rule: string,
    options: ErrorOptions = {}
  ): ApicizeValidationError {
    return new ApicizeValidationError(`Validation failed for field '${field}': ${rule}`, {
      ...options,
      field,
      value,
      rule,
      context: this.mergeContext(options.context),
      suggestions: [
        `Check the value for field '${field}'`,
        `Ensure the value meets the requirement: ${rule}`,
        'Refer to the documentation for valid values',
        ...(options.suggestions || []),
      ],
    });
  }

  /**
   * Create type mismatch error
   */
  createTypeMismatchError(
    field: string,
    expectedType: string,
    actualType: string,
    options: ErrorOptions = {}
  ): ApicizeValidationError {
    return new ApicizeValidationError(
      `Type mismatch for field '${field}': expected ${expectedType}, got ${actualType}`,
      {
        ...options,
        field,
        rule: `must be of type ${expectedType}`,
        context: this.mergeContext({ expectedType, actualType, ...options.context }),
        suggestions: [
          `Convert the value to ${expectedType}`,
          'Check the data source',
          'Verify the field mapping',
          ...(options.suggestions || []),
        ],
      }
    );
  }

  // Authentication Errors

  /**
   * Create authentication error
   */
  createAuthError(
    message: string,
    authType?: string,
    options: ErrorOptions = {}
  ): ApicizeAuthError {
    return new ApicizeAuthError(message, {
      ...options,
      ...(authType !== undefined && { authType }),
      context: this.mergeContext(options.context),
      suggestions: [
        'Check authentication credentials',
        'Verify the authentication method',
        'Ensure tokens are not expired',
        ...(options.suggestions || []),
      ],
    });
  }

  /**
   * Create token expired error
   */
  createTokenExpiredError(options: ErrorOptions = {}): ApicizeAuthError {
    return new ApicizeAuthError('Authentication token has expired', {
      ...options,
      context: this.mergeContext(options.context),
      suggestions: [
        'Refresh the authentication token',
        'Re-authenticate with the service',
        'Check token expiration times',
        ...(options.suggestions || []),
      ],
    });
  }

  // Utility Methods

  /**
   * Get HTTP error suggestions based on status code
   */
  private getHttpErrorSuggestions(status: number, additionalSuggestions: string[] = []): string[] {
    const baseSuggestions = [...additionalSuggestions];

    if (status >= 400 && status < 500) {
      // Client errors
      baseSuggestions.push(
        'Check request parameters',
        'Verify authentication credentials',
        'Ensure proper request format'
      );
    } else if (status >= 500) {
      // Server errors
      baseSuggestions.push(
        'Retry the request',
        'Contact the service provider',
        'Check service status'
      );
    }

    switch (status) {
      case 401:
        baseSuggestions.push('Provide valid authentication credentials');
        break;
      case 403:
        baseSuggestions.push('Check user permissions');
        break;
      case 404:
        baseSuggestions.push('Verify the endpoint URL is correct');
        break;
      case 429:
        baseSuggestions.push('Reduce request rate', 'Implement backoff strategy');
        break;
      case 500:
        baseSuggestions.push('Report the error to the service provider');
        break;
    }

    return baseSuggestions;
  }

  /**
   * Create error from unknown cause
   */
  createFromUnknown(
    cause: unknown,
    defaultCode: ApicizeErrorCode = ApicizeErrorCode.UNKNOWN,
    context?: ErrorContext
  ): ApicizeError {
    if (cause instanceof ApicizeError) {
      return cause.withContext(this.mergeContext(context));
    }

    if (cause instanceof Error) {
      return this.createError(defaultCode, cause.message, {
        cause,
        ...(context !== undefined && { context }),
        suggestions: ['Check the error details', 'Verify the operation parameters'],
      });
    }

    return this.createError(defaultCode, String(cause), {
      context: this.mergeContext({ originalCause: cause, ...context }),
      suggestions: ['Check the operation parameters', 'Review the logs for more details'],
    });
  }
}

/**
 * Get the default error factory instance
 */
export function getErrorFactory(): ErrorFactory {
  return ErrorFactory.getInstance();
}

/**
 * Create an error factory with custom default context
 */
export function createErrorFactory(defaultContext: ErrorContext = {}): ErrorFactory {
  return new ErrorFactory(defaultContext);
}
