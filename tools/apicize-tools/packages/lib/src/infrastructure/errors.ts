/**
 * Unified error hierarchy for the Apicize library
 * Provides structured error handling with codes and context
 */

/**
 * Error codes for different error types
 */
export enum ApicizeErrorCode {
  // Generic errors
  UNKNOWN = 'UNKNOWN',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  INVALID_ARGUMENT = 'INVALID_ARGUMENT',
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  PERMISSION_DENIED = 'PERMISSION_DENIED',

  // File system errors
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_READ_ERROR = 'FILE_READ_ERROR',
  FILE_WRITE_ERROR = 'FILE_WRITE_ERROR',
  DIRECTORY_NOT_FOUND = 'DIRECTORY_NOT_FOUND',
  DIRECTORY_CREATE_ERROR = 'DIRECTORY_CREATE_ERROR',

  // Parsing errors
  PARSE_ERROR = 'PARSE_ERROR',
  INVALID_JSON = 'INVALID_JSON',
  SCHEMA_VALIDATION_FAILED = 'SCHEMA_VALIDATION_FAILED',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',

  // Network errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  HTTP_ERROR = 'HTTP_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  ABORT_ERROR = 'ABORT_ERROR',
  SSL_ERROR = 'SSL_ERROR',
  DNS_ERROR = 'DNS_ERROR',

  // Configuration errors
  CONFIG_ERROR = 'CONFIG_ERROR',
  CONFIG_VALIDATION_FAILED = 'CONFIG_VALIDATION_FAILED',
  MISSING_CONFIG = 'MISSING_CONFIG',
  INVALID_CONFIG = 'INVALID_CONFIG',

  // Authentication errors
  AUTH_ERROR = 'AUTH_ERROR',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  AUTH_REQUIRED = 'AUTH_REQUIRED',

  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  CONSTRAINT_VIOLATION = 'CONSTRAINT_VIOLATION',
  TYPE_MISMATCH = 'TYPE_MISMATCH',
  RANGE_ERROR = 'RANGE_ERROR',

  // Execution errors
  EXECUTION_ERROR = 'EXECUTION_ERROR',
  RUNTIME_ERROR = 'RUNTIME_ERROR',
  DEPENDENCY_ERROR = 'DEPENDENCY_ERROR',
  INITIALIZATION_ERROR = 'INITIALIZATION_ERROR',

  // Configuration specific errors
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',

  // Variable errors
  VARIABLE_SUBSTITUTION_ERROR = 'VARIABLE_SUBSTITUTION_ERROR',
  VARIABLE_NOT_FOUND = 'VARIABLE_NOT_FOUND',
  VARIABLE_SOURCE_NOT_FOUND = 'VARIABLE_SOURCE_NOT_FOUND',
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Error context interface
 */
export interface ErrorContext {
  [key: string]: unknown;
  component?: string;
  operation?: string;
  file?: string;
  line?: number;
  timestamp?: string;
  requestId?: string;
  userId?: string;
}

/**
 * Error details interface
 */
export interface ErrorDetails {
  code: ApicizeErrorCode;
  message: string;
  severity: ErrorSeverity;
  context?: ErrorContext;
  cause?: Error;
  stack?: string;
  timestamp: string;
  retryable?: boolean;
  suggestions?: string[];
}

/**
 * Base error class for all Apicize errors
 */
export class ApicizeError extends Error {
  public readonly code: ApicizeErrorCode;
  public readonly severity: ErrorSeverity;
  public readonly context: ErrorContext;
  public readonly timestamp: string;
  public readonly retryable: boolean;
  public readonly suggestions: string[];
  public readonly originalError?: Error;

  constructor(
    code: ApicizeErrorCode,
    message: string,
    options: {
      severity?: ErrorSeverity;
      context?: ErrorContext;
      cause?: Error;
      retryable?: boolean;
      suggestions?: string[];
    } = {}
  ) {
    super(message);
    this.name = 'ApicizeError';
    this.code = code;
    this.severity = options.severity || ErrorSeverity.MEDIUM;
    this.context = options.context || {};
    this.timestamp = new Date().toISOString();
    this.retryable = options.retryable || false;
    this.suggestions = options.suggestions || [];
    if (options.cause !== undefined) {
      this.originalError = options.cause;
    }

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }

    // Chain cause is already set in constructor above as originalError
  }

  /**
   * Get error details
   */
  getDetails(): ErrorDetails {
    return {
      code: this.code,
      message: this.message,
      severity: this.severity,
      context: this.context,
      ...(this.originalError !== undefined && { cause: this.originalError }),
      ...(this.stack !== undefined && { stack: this.stack }),
      timestamp: this.timestamp,
      retryable: this.retryable,
      suggestions: this.suggestions,
    };
  }

  /**
   * Convert to JSON representation
   */
  toJSON(): object {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      severity: this.severity,
      context: this.context,
      timestamp: this.timestamp,
      retryable: this.retryable,
      suggestions: this.suggestions,
      stack: this.stack,
      cause: this.originalError
        ? {
            name: this.originalError.name,
            message: this.originalError.message,
            stack: this.originalError.stack,
          }
        : undefined,
    };
  }

  /**
   * Create a clone with additional context
   */
  withContext(additionalContext: ErrorContext): ApicizeError {
    return new ApicizeError(this.code, this.message, {
      severity: this.severity,
      context: { ...this.context, ...additionalContext },
      ...(this.originalError !== undefined && { cause: this.originalError }),
      retryable: this.retryable,
      suggestions: this.suggestions,
    });
  }

  /**
   * Create a clone with additional suggestions
   */
  withSuggestions(additionalSuggestions: string[]): ApicizeError {
    return new ApicizeError(this.code, this.message, {
      severity: this.severity,
      context: this.context,
      ...(this.originalError !== undefined && { cause: this.originalError }),
      retryable: this.retryable,
      suggestions: [...this.suggestions, ...additionalSuggestions],
    });
  }
}

/**
 * File system related errors
 */
export class ApicizeFileSystemError extends ApicizeError {
  constructor(
    code: ApicizeErrorCode,
    message: string,
    options: {
      filePath?: string;
      operation?: string;
      severity?: ErrorSeverity;
      context?: ErrorContext;
      cause?: Error;
      suggestions?: string[];
    } = {}
  ) {
    const context: ErrorContext = {
      component: 'filesystem',
      ...(options.operation !== undefined && { operation: options.operation }),
      ...(options.filePath !== undefined && { filePath: options.filePath }),
      ...options.context,
    };

    super(code, message, {
      severity: options.severity || ErrorSeverity.HIGH,
      context,
      ...(options.cause !== undefined && { cause: options.cause }),
      retryable: false,
      ...(options.suggestions !== undefined && { suggestions: options.suggestions }),
    });
    this.name = 'ApicizeFileSystemError';
  }
}

/**
 * Parsing related errors
 */
export class ApicizeParseError extends ApicizeError {
  constructor(
    message: string,
    options: {
      filePath?: string;
      line?: number;
      column?: number;
      details?: string[];
      severity?: ErrorSeverity;
      context?: ErrorContext;
      cause?: Error;
      suggestions?: string[];
    } = {}
  ) {
    const context: ErrorContext = {
      component: 'parser',
      ...(options.filePath !== undefined && { filePath: options.filePath }),
      ...(options.line !== undefined && { line: options.line }),
      ...(options.column !== undefined && { column: options.column }),
      ...(options.details !== undefined && { details: options.details }),
      ...options.context,
    };

    super(ApicizeErrorCode.PARSE_ERROR, message, {
      severity: options.severity || ErrorSeverity.HIGH,
      context,
      ...(options.cause !== undefined && { cause: options.cause }),
      retryable: false,
      ...(options.suggestions !== undefined && { suggestions: options.suggestions }),
    });
    this.name = 'ApicizeParseError';
  }
}

/**
 * Network related errors
 */
export class ApicizeNetworkError extends ApicizeError {
  constructor(
    code: ApicizeErrorCode,
    message: string,
    options: {
      url?: string;
      method?: string;
      status?: number;
      severity?: ErrorSeverity;
      context?: ErrorContext;
      cause?: Error;
      retryable?: boolean;
      suggestions?: string[];
    } = {}
  ) {
    const context: ErrorContext = {
      component: 'network',
      ...(options.url !== undefined && { url: options.url }),
      ...(options.method !== undefined && { method: options.method }),
      ...(options.status !== undefined && { status: options.status }),
      ...options.context,
    };

    super(code, message, {
      severity: options.severity || ErrorSeverity.MEDIUM,
      context,
      ...(options.cause !== undefined && { cause: options.cause }),
      retryable: options.retryable || true,
      ...(options.suggestions !== undefined && { suggestions: options.suggestions }),
    });
    this.name = 'ApicizeNetworkError';
  }
}

/**
 * Configuration related errors
 */
export class ApicizeConfigError extends ApicizeError {
  constructor(
    message: string,
    options: {
      configKey?: string;
      configValue?: unknown;
      severity?: ErrorSeverity;
      context?: ErrorContext;
      cause?: Error;
      suggestions?: string[];
    } = {}
  ) {
    const context: ErrorContext = {
      component: 'configuration',
      ...(options.configKey !== undefined && { configKey: options.configKey }),
      ...(options.configValue !== undefined && { configValue: options.configValue }),
      ...options.context,
    };

    super(ApicizeErrorCode.CONFIG_ERROR, message, {
      severity: options.severity || ErrorSeverity.MEDIUM,
      context,
      ...(options.cause !== undefined && { cause: options.cause }),
      retryable: false,
      ...(options.suggestions !== undefined && { suggestions: options.suggestions }),
    });
    this.name = 'ApicizeConfigError';
  }
}

/**
 * Validation related errors
 */
export class ApicizeValidationError extends ApicizeError {
  constructor(
    message: string,
    options: {
      field?: string;
      value?: unknown;
      rule?: string;
      severity?: ErrorSeverity;
      context?: ErrorContext;
      cause?: Error;
      suggestions?: string[];
    } = {}
  ) {
    const context: ErrorContext = {
      component: 'validation',
      ...(options.field !== undefined && { field: options.field }),
      ...(options.value !== undefined && { value: options.value }),
      ...(options.rule !== undefined && { rule: options.rule }),
      ...options.context,
    };

    super(ApicizeErrorCode.VALIDATION_ERROR, message, {
      severity: options.severity || ErrorSeverity.MEDIUM,
      context,
      ...(options.cause !== undefined && { cause: options.cause }),
      retryable: false,
      ...(options.suggestions !== undefined && { suggestions: options.suggestions }),
    });
    this.name = 'ApicizeValidationError';
  }
}

/**
 * Authentication related errors
 */
export class ApicizeAuthError extends ApicizeError {
  constructor(
    message: string,
    options: {
      authType?: string;
      provider?: string;
      severity?: ErrorSeverity;
      context?: ErrorContext;
      cause?: Error;
      suggestions?: string[];
    } = {}
  ) {
    const context: ErrorContext = {
      component: 'authentication',
      ...(options.authType !== undefined && { authType: options.authType }),
      ...(options.provider !== undefined && { provider: options.provider }),
      ...options.context,
    };

    super(ApicizeErrorCode.AUTH_ERROR, message, {
      severity: options.severity || ErrorSeverity.HIGH,
      context,
      ...(options.cause !== undefined && { cause: options.cause }),
      retryable: false,
      ...(options.suggestions !== undefined && { suggestions: options.suggestions }),
    });
    this.name = 'ApicizeAuthError';
  }
}

/**
 * Check if an error is an ApicizeError
 */
export function isApicizeError(error: unknown): error is ApicizeError {
  return error instanceof ApicizeError;
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  return isApicizeError(error) && error.retryable;
}

/**
 * Get error severity
 */
export function getErrorSeverity(error: unknown): ErrorSeverity {
  if (isApicizeError(error)) {
    return error.severity;
  }
  return ErrorSeverity.MEDIUM;
}

/**
 * Convert any error to ApicizeError
 */
export function toApicizeError(
  error: unknown,
  defaultCode = ApicizeErrorCode.UNKNOWN
): ApicizeError {
  if (isApicizeError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new ApicizeError(defaultCode, error.message, {
      cause: error,
      severity: ErrorSeverity.MEDIUM,
    });
  }

  return new ApicizeError(defaultCode, String(error), {
    severity: ErrorSeverity.MEDIUM,
  });
}
