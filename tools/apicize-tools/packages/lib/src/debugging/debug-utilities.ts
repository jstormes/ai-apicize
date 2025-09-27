/**
 * Debugging Support Utilities - Phase 5 Developer Experience Enhancement
 *
 * Provides comprehensive debugging tools, inspection utilities,
 * and development helpers for the Apicize library.
 */

import { RequestConfig, ApicizeResponse, BodyType } from '../types';

/**
 * Debug mode configuration
 */
export interface DebugConfig {
  /** Enable debug logging */
  enabled: boolean;
  /** Log level threshold */
  level: 'debug' | 'info' | 'warn' | 'error';
  /** Include request/response bodies in logs */
  includeBody: boolean;
  /** Include headers in logs */
  includeHeaders: boolean;
  /** Include timing information */
  includeTiming: boolean;
  /** Maximum body size to log (in characters) */
  maxBodySize: number;
  /** Custom logger function */
  logger?: DebugLogger;
}

/**
 * Debug logger interface
 */
export interface DebugLogger {
  debug(message: string, data?: any): void;
  info(message: string, data?: any): void;
  warn(message: string, data?: any): void;
  error(message: string, error?: Error, data?: any): void;
}

/**
 * Default console logger implementation
 */
export class ConsoleDebugLogger implements DebugLogger {
  debug(message: string, data?: any): void {
    console.debug(`[DEBUG] ${message}`, data || '');
  }

  info(message: string, data?: any): void {
    console.info(`[INFO] ${message}`, data || '');
  }

  warn(message: string, data?: any): void {
    console.warn(`[WARN] ${message}`, data || '');
  }

  error(message: string, error?: Error, data?: any): void {
    console.error(`[ERROR] ${message}`, error || '', data || '');
  }
}

/**
 * Debug utilities class with various inspection and logging methods
 */
export class DebugUtilities {
  private static instance?: DebugUtilities;
  private config: DebugConfig;
  public logger: DebugLogger;
  private requestCounter = 0;

  private constructor(config: Partial<DebugConfig> = {}) {
    this.config = {
      enabled: process.env.NODE_ENV === 'development',
      level: 'debug',
      includeBody: true,
      includeHeaders: true,
      includeTiming: true,
      maxBodySize: 10000,
      ...config,
    };
    this.logger = this.config.logger || new ConsoleDebugLogger();
  }

  /**
   * Gets the singleton debug utilities instance
   */
  static getInstance(config?: Partial<DebugConfig>): DebugUtilities {
    if (!DebugUtilities.instance) {
      DebugUtilities.instance = new DebugUtilities(config);
    }
    return DebugUtilities.instance;
  }

  /**
   * Creates a new debug utilities instance with custom configuration
   */
  static create(config: Partial<DebugConfig>): DebugUtilities {
    return new DebugUtilities(config);
  }

  /**
   * Enables debug mode
   */
  enable(): void {
    this.config.enabled = true;
  }

  /**
   * Disables debug mode
   */
  disable(): void {
    this.config.enabled = false;
  }

  /**
   * Sets the debug level
   */
  setLevel(level: DebugConfig['level']): void {
    this.config.level = level;
  }

  /**
   * Logs a request with detailed information
   */
  logRequest(request: RequestConfig, requestId?: string): string {
    if (!this.config.enabled) return '';

    const id = requestId || `req-${++this.requestCounter}`;

    this.logger.info(`🚀 Starting request ${id}`, {
      method: request.method,
      url: request.url,
      timeout: request.timeout,
    });

    if (this.config.includeHeaders && request.headers) {
      if (Array.isArray(request.headers)) {
        this.logger.debug(`📋 Request headers for ${id}`, this.formatHeaders(request.headers));
      } else {
        this.logger.debug(`📋 Request headers for ${id}`, request.headers);
      }
    }

    if (this.config.includeBody && request.body) {
      if (
        typeof request.body === 'object' &&
        'type' in request.body &&
        request.body.type !== BodyType.None
      ) {
        this.logger.debug(`📦 Request body for ${id}`, this.formatBody(request.body));
      } else if (typeof request.body === 'string' || Buffer.isBuffer(request.body)) {
        this.logger.debug(`📦 Request body for ${id}`, request.body);
      }
    }

    if (request.queryStringParams?.length) {
      this.logger.debug(
        `🔍 Query parameters for ${id}`,
        this.formatHeaders(request.queryStringParams)
      );
    }

    return id;
  }

  /**
   * Logs a response with detailed information
   */
  logResponse(response: ApicizeResponse, requestId: string): void {
    if (!this.config.enabled) return;

    this.logger.info(`✅ Response received for ${requestId}`, {
      status: response.status,
      statusText: response.statusText,
    });

    if (this.config.includeTiming && response.timing) {
      this.logger.debug(`⏱️  Timing for ${requestId}`, {
        total: `${response.timing.total}ms`,
        started: new Date(response.timing.started).toISOString(),
        dns: response.timing.dns ? `${response.timing.dns}ms` : 'N/A',
        tcp: response.timing.tcp ? `${response.timing.tcp}ms` : 'N/A',
        request: response.timing.request ? `${response.timing.request}ms` : 'N/A',
      });
    }

    if (this.config.includeHeaders && response.headers) {
      this.logger.debug(`📋 Response headers for ${requestId}`, response.headers);
    }

    if (this.config.includeBody && response.body && response.body.type !== BodyType.None) {
      this.logger.debug(`📦 Response body for ${requestId}`, this.formatBody(response.body));
    }

    if (response.redirects?.length) {
      this.logger.debug(`🔄 Redirects for ${requestId}`, response.redirects);
    }
  }

  /**
   * Logs an error with detailed context
   */
  logError(error: Error, context?: any, requestId?: string): void {
    if (!this.config.enabled) return;

    const id = requestId || 'unknown';
    this.logger.error(`❌ Error in request ${id}`, error, context);
  }

  /**
   * Creates a trace for debugging complex operations
   */
  createTrace(operation: string): OperationTrace {
    return new OperationTrace(operation, this);
  }

  /**
   * Inspects and formats an object for debugging
   */
  inspect(obj: any, _depth = 3): string {
    if (!this.config.enabled) return '';

    try {
      return JSON.stringify(obj, null, 2);
    } catch (error) {
      return `[Object: Unable to serialize - ${error}]`;
    }
  }

  /**
   * Formats headers for logging
   */
  private formatHeaders(headers: Array<{ name: string; value: string }>): Record<string, string> {
    return headers.reduce(
      (acc, header) => {
        acc[header.name] = header.value;
        return acc;
      },
      {} as Record<string, string>
    );
  }

  /**
   * Formats body content for logging
   */
  private formatBody(body: any): any {
    if (!body || !body.data) return '[Empty body]';

    const content = body.data;
    let formatted: any;

    switch (body.type) {
      case BodyType.JSON:
        formatted = typeof content === 'object' ? content : JSON.parse(content);
        break;
      case BodyType.Text:
      case BodyType.XML:
        formatted = content.toString();
        break;
      case BodyType.Form:
        formatted = Array.isArray(content) ? this.formatHeaders(content) : content;
        break;
      case BodyType.Raw:
        formatted = `[Binary data: ${content.length} bytes]`;
        break;
      default:
        formatted = '[Unknown body type]';
    }

    // Truncate if too large
    if (typeof formatted === 'string' && formatted.length > this.config.maxBodySize) {
      return formatted.substring(0, this.config.maxBodySize) + '... [truncated]';
    }

    return formatted;
  }
}

/**
 * Operation trace for debugging complex multi-step operations
 */
export class OperationTrace {
  private steps: TraceStep[] = [];
  private startTime: number;

  constructor(
    private operation: string,
    private debug: DebugUtilities
  ) {
    this.startTime = Date.now();
    this.debug.logger.debug(`🔍 Starting trace: ${operation}`);
  }

  /**
   * Adds a step to the trace
   */
  step(name: string, data?: any): void {
    const timestamp = Date.now();
    const duration = timestamp - (this.steps[this.steps.length - 1]?.timestamp || this.startTime);

    this.steps.push({
      name,
      timestamp,
      duration,
      data,
    });

    this.debug.logger.debug(`  📍 ${name} (+${duration}ms)`, data);
  }

  /**
   * Marks an error in the trace
   */
  error(message: string, error: Error): void {
    this.step(`ERROR: ${message}`, { error: error.message, stack: error.stack });
  }

  /**
   * Completes the trace
   */
  complete(): TraceResult {
    const totalDuration = Date.now() - this.startTime;

    this.debug.logger.debug(`✅ Trace completed: ${this.operation} (${totalDuration}ms)`);

    return {
      operation: this.operation,
      totalDuration,
      steps: [...this.steps],
      completed: true,
    };
  }

  /**
   * Aborts the trace
   */
  abort(reason: string): TraceResult {
    const totalDuration = Date.now() - this.startTime;

    this.debug.logger.warn(`❌ Trace aborted: ${this.operation} - ${reason} (${totalDuration}ms)`);

    return {
      operation: this.operation,
      totalDuration,
      steps: [...this.steps],
      completed: false,
      abortReason: reason,
    };
  }
}

/**
 * Individual trace step
 */
export interface TraceStep {
  name: string;
  timestamp: number;
  duration: number;
  data?: any;
}

/**
 * Trace result
 */
export interface TraceResult {
  operation: string;
  totalDuration: number;
  steps: TraceStep[];
  completed: boolean;
  abortReason?: string;
}

/**
 * Performance profiler for debugging slow operations
 */
export class PerformanceProfiler {
  private marks: Map<string, number> = new Map();
  private measures: Map<string, number> = new Map();

  /**
   * Marks the start of a performance measurement
   */
  mark(name: string): void {
    this.marks.set(name, Date.now());
  }

  /**
   * Measures the time between two marks
   */
  measure(name: string, startMark: string, endMark?: string): number {
    const start = this.marks.get(startMark);
    const end = endMark ? this.marks.get(endMark) : Date.now();

    if (!start) {
      throw new Error(`Start mark '${startMark}' not found`);
    }

    if (endMark && !end) {
      throw new Error(`End mark '${endMark}' not found`);
    }

    const duration = (end || Date.now()) - start;
    this.measures.set(name, duration);
    return duration;
  }

  /**
   * Gets all measurements
   */
  getMeasures(): Map<string, number> {
    return new Map(this.measures);
  }

  /**
   * Clears all marks and measures
   */
  clear(): void {
    this.marks.clear();
    this.measures.clear();
  }

  /**
   * Gets a performance report
   */
  getReport(): PerformanceReport {
    return {
      marks: Object.fromEntries(this.marks),
      measures: Object.fromEntries(this.measures),
      timestamp: Date.now(),
    };
  }
}

/**
 * Performance report interface
 */
export interface PerformanceReport {
  marks: Record<string, number>;
  measures: Record<string, number>;
  timestamp: number;
}

/**
 * Memory usage tracker for debugging memory issues
 */
export class MemoryTracker {
  private snapshots: MemorySnapshot[] = [];

  /**
   * Takes a memory snapshot
   */
  snapshot(label: string): MemorySnapshot {
    const snapshot: MemorySnapshot = {
      label,
      timestamp: Date.now(),
      heapUsed: process.memoryUsage().heapUsed,
      heapTotal: process.memoryUsage().heapTotal,
      external: process.memoryUsage().external,
      rss: process.memoryUsage().rss,
    };

    this.snapshots.push(snapshot);
    return snapshot;
  }

  /**
   * Gets the difference between two snapshots
   */
  diff(snapshot1: MemorySnapshot, snapshot2: MemorySnapshot): MemoryDiff {
    return {
      heapUsedDiff: snapshot2.heapUsed - snapshot1.heapUsed,
      heapTotalDiff: snapshot2.heapTotal - snapshot1.heapTotal,
      externalDiff: snapshot2.external - snapshot1.external,
      rssDiff: snapshot2.rss - snapshot1.rss,
      timeDiff: snapshot2.timestamp - snapshot1.timestamp,
    };
  }

  /**
   * Gets all snapshots
   */
  getSnapshots(): MemorySnapshot[] {
    return [...this.snapshots];
  }

  /**
   * Clears all snapshots
   */
  clear(): void {
    this.snapshots = [];
  }
}

/**
 * Memory snapshot interface
 */
export interface MemorySnapshot {
  label: string;
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
}

/**
 * Memory difference interface
 */
export interface MemoryDiff {
  heapUsedDiff: number;
  heapTotalDiff: number;
  externalDiff: number;
  rssDiff: number;
  timeDiff: number;
}

/**
 * Validation helpers for development
 */
export class ValidationHelpers {
  /**
   * Validates a request configuration
   */
  static validateRequest(request: RequestConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!request.url) {
      errors.push('URL is required');
    } else if (!this.isValidUrl(request.url)) {
      errors.push('URL format is invalid');
    }

    if (!request.method) {
      errors.push('HTTP method is required');
    }

    // Warnings
    if (request.timeout && request.timeout < 1000) {
      warnings.push('Timeout is very short (< 1 second)');
    }

    if (request.timeout && request.timeout > 300000) {
      warnings.push('Timeout is very long (> 5 minutes)');
    }

    if (request.numberOfRedirects && request.numberOfRedirects > 20) {
      warnings.push('High number of redirects may cause performance issues');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validates a URL format
   */
  private static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Global debug utilities instance
 */
export const debugUtils = DebugUtilities.getInstance();

/**
 * Convenience function to enable debug mode
 */
export function enableDebugMode(config?: Partial<DebugConfig>): void {
  const debug = DebugUtilities.getInstance(config);
  debug.enable();
}

/**
 * Convenience function to disable debug mode
 */
export function disableDebugMode(): void {
  debugUtils.disable();
}

/**
 * Convenience function to create a trace
 */
export function trace(operation: string): OperationTrace {
  return debugUtils.createTrace(operation);
}

/**
 * Convenience function to inspect an object
 */
export function inspect(obj: any, depth?: number): string {
  return debugUtils.inspect(obj, depth);
}

export default DebugUtilities;
