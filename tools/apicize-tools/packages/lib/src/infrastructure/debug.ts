/**
 * Debug utilities for development
 * Provides debugging, tracing, and inspection utilities
 */

import { Logger } from './interfaces';
import { DefaultLogger, LogLevel } from './implementations';
import { ApicizeError } from './errors';

/**
 * Debug level enumeration
 */
export enum DebugLevel {
  NONE = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4,
  TRACE = 5,
}

/**
 * Debug configuration
 */
export interface DebugConfig {
  enabled: boolean;
  level: DebugLevel;
  enableStackTrace: boolean;
  enableTimestamps: boolean;
  enableColors: boolean;
  prefix?: string;
}

/**
 * Performance timing information
 */
export interface PerformanceInfo {
  operation: string;
  startTime: number;
  endTime: number;
  duration: number;
  metadata?: Record<string, unknown>;
}

/**
 * Debug inspector for objects
 */
export interface ObjectInspection {
  type: string;
  value: unknown;
  properties: Record<string, unknown>;
  methods: string[];
  prototype: string;
  size?: number;
}

/**
 * Debug utilities class
 */
export class DebugUtils {
  private static instance: DebugUtils | null = null;
  private config: DebugConfig;
  private logger: Logger;
  private timers = new Map<string, number>();
  private counters = new Map<string, number>();
  private traces = new Map<string, string[]>();

  constructor(config: Partial<DebugConfig> = {}, logger?: Logger) {
    this.config = {
      enabled: process.env.NODE_ENV === 'development' || process.env.APICIZE_DEBUG === 'true',
      level: DebugLevel.INFO,
      enableStackTrace: true,
      enableTimestamps: true,
      enableColors: true,
      prefix: '[APICIZE]',
      ...config,
    };
    this.logger = logger || new DefaultLogger(undefined, LogLevel.DEBUG);
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<DebugConfig>, logger?: Logger): DebugUtils {
    if (!DebugUtils.instance) {
      DebugUtils.instance = new DebugUtils(config, logger);
    }
    return DebugUtils.instance;
  }

  /**
   * Reset singleton instance (mainly for testing)
   */
  static resetInstance(): void {
    DebugUtils.instance = null;
  }

  /**
   * Check if debugging is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Set debug configuration
   */
  setConfig(config: Partial<DebugConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Log debug message
   */
  debug(message: string, data?: unknown): void {
    if (!this.shouldLog(DebugLevel.DEBUG)) return;

    const formattedMessage = this.formatMessage('DEBUG', message);
    this.logger.debug(formattedMessage, data ? { data } : undefined);
  }

  /**
   * Log info message
   */
  info(message: string, data?: unknown): void {
    if (!this.shouldLog(DebugLevel.INFO)) return;

    const formattedMessage = this.formatMessage('INFO', message);
    this.logger.info(formattedMessage, data ? { data } : undefined);
  }

  /**
   * Log warning message
   */
  warn(message: string, data?: unknown): void {
    if (!this.shouldLog(DebugLevel.WARN)) return;

    const formattedMessage = this.formatMessage('WARN', message);
    this.logger.warn(formattedMessage, data ? { data } : undefined);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error | ApicizeError): void {
    if (!this.shouldLog(DebugLevel.ERROR)) return;

    const formattedMessage = this.formatMessage('ERROR', message);
    const context: Record<string, unknown> = {};

    if (error) {
      context.error = {
        name: error.name,
        message: error.message,
        stack: this.config.enableStackTrace ? error.stack : undefined,
      };

      if (error instanceof ApicizeError) {
        context.errorDetails = error.getDetails();
      }
    }

    this.logger.error(formattedMessage, context);
  }

  /**
   * Log trace message
   */
  trace(operation: string, message: string, data?: unknown): void {
    if (!this.shouldLog(DebugLevel.TRACE)) return;

    const traceId = this.generateTraceId();
    const formattedMessage = this.formatMessage('TRACE', `[${operation}:${traceId}] ${message}`);

    // Store trace for operation flow tracking
    if (!this.traces.has(operation)) {
      this.traces.set(operation, []);
    }
    this.traces.get(operation)!.push(`${traceId}: ${message}`);

    this.logger.trace(
      formattedMessage,
      data ? { data, operation, traceId } : { operation, traceId }
    );
  }

  /**
   * Start performance timer
   */
  startTimer(operation: string): void {
    this.timers.set(operation, Date.now());
    this.debug(`Started timer for operation: ${operation}`);
  }

  /**
   * End performance timer and return duration
   */
  endTimer(operation: string, metadata?: Record<string, unknown>): PerformanceInfo | null {
    const startTime = this.timers.get(operation);
    if (!startTime) {
      this.warn(`No timer found for operation: ${operation}`);
      return null;
    }

    const endTime = Date.now();
    const duration = endTime - startTime;
    this.timers.delete(operation);

    const perfInfo: PerformanceInfo = {
      operation,
      startTime,
      endTime,
      duration,
      ...(metadata !== undefined && { metadata }),
    };

    this.debug(`Completed operation: ${operation} in ${duration}ms`, perfInfo);
    return perfInfo;
  }

  /**
   * Measure function execution time
   */
  async measureAsync<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, unknown>
  ): Promise<{ result: T; performance: PerformanceInfo }> {
    this.startTimer(operation);
    try {
      const result = await fn();
      const performance = this.endTimer(operation, metadata)!;
      return { result, performance };
    } catch (error) {
      this.endTimer(operation, { ...metadata, error: true });
      throw error;
    }
  }

  /**
   * Measure synchronous function execution time
   */
  measureSync<T>(
    operation: string,
    fn: () => T,
    metadata?: Record<string, unknown>
  ): { result: T; performance: PerformanceInfo } {
    this.startTimer(operation);
    try {
      const result = fn();
      const performance = this.endTimer(operation, metadata)!;
      return { result, performance };
    } catch (error) {
      this.endTimer(operation, { ...metadata, error: true });
      throw error;
    }
  }

  /**
   * Increment a counter
   */
  incrementCounter(name: string, amount: number = 1): number {
    const current = this.counters.get(name) || 0;
    const newValue = current + amount;
    this.counters.set(name, newValue);
    this.trace('counter', `Incremented ${name} by ${amount} to ${newValue}`);
    return newValue;
  }

  /**
   * Get counter value
   */
  getCounter(name: string): number {
    return this.counters.get(name) || 0;
  }

  /**
   * Reset counter
   */
  resetCounter(name: string): void {
    this.counters.set(name, 0);
    this.debug(`Reset counter: ${name}`);
  }

  /**
   * Get all counters
   */
  getAllCounters(): Record<string, number> {
    return Object.fromEntries(this.counters);
  }

  /**
   * Inspect an object for debugging
   */
  inspect(obj: unknown, depth: number = 2): ObjectInspection {
    const type = this.getType(obj);
    const inspection: ObjectInspection = {
      type,
      value: obj,
      properties: {},
      methods: [],
      prototype: 'Object',
    };

    if (obj && typeof obj === 'object') {
      // Get properties
      try {
        const props = Object.getOwnPropertyNames(obj);
        for (const prop of props) {
          if (depth > 0) {
            try {
              const value = (obj as any)[prop];
              inspection.properties[prop] =
                typeof value === 'object' && value !== null && depth > 1
                  ? this.inspect(value, depth - 1)
                  : value;
            } catch {
              inspection.properties[prop] = '[inaccessible]';
            }
          }
        }

        // Get methods
        let current = obj;
        while (current && current !== Object.prototype) {
          const methodNames = Object.getOwnPropertyNames(current)
            .filter(name => typeof (current as any)[name] === 'function')
            .filter(name => !inspection.methods.includes(name));
          inspection.methods.push(...methodNames);
          current = Object.getPrototypeOf(current);
        }

        // Get prototype
        const proto = Object.getPrototypeOf(obj);
        if (proto && proto.constructor) {
          inspection.prototype = proto.constructor.name;
        }

        // Get size for arrays and collections
        if (Array.isArray(obj)) {
          inspection.size = obj.length;
        } else if (obj instanceof Map || obj instanceof Set) {
          inspection.size = obj.size;
        }
      } catch (error) {
        this.warn('Failed to inspect object', error);
      }
    }

    return inspection;
  }

  /**
   * Log object inspection
   */
  inspectAndLog(obj: unknown, label: string = 'Object', depth: number = 2): void {
    const inspection = this.inspect(obj, depth);
    this.debug(`${label} inspection:`, inspection);
  }

  /**
   * Dump current state for debugging
   */
  dumpState(): void {
    const state = {
      config: this.config,
      activeTimers: Array.from(this.timers.keys()),
      counters: this.getAllCounters(),
      traceOperations: Array.from(this.traces.keys()),
      memory: this.getMemoryUsage(),
    };

    this.info('Debug state dump:', state);
  }

  /**
   * Get memory usage information
   */
  getMemoryUsage(): Record<string, number> {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      return {
        rss: Math.round((usage.rss / 1024 / 1024) * 100) / 100, // MB
        heapTotal: Math.round((usage.heapTotal / 1024 / 1024) * 100) / 100, // MB
        heapUsed: Math.round((usage.heapUsed / 1024 / 1024) * 100) / 100, // MB
        external: Math.round((usage.external / 1024 / 1024) * 100) / 100, // MB
      };
    }
    return {};
  }

  /**
   * Clear all debug data
   */
  clear(): void {
    this.timers.clear();
    this.counters.clear();
    this.traces.clear();
    this.debug('Cleared all debug data');
  }

  /**
   * Get operation traces
   */
  getTraces(operation?: string): Record<string, string[]> {
    if (operation) {
      const traces = this.traces.get(operation);
      return traces ? { [operation]: traces } : {};
    }
    return Object.fromEntries(this.traces);
  }

  // Private methods

  private shouldLog(level: DebugLevel): boolean {
    return this.config.enabled && level <= this.config.level;
  }

  private formatMessage(level: string, message: string): string {
    let formatted = '';

    if (this.config.prefix) {
      formatted += `${this.config.prefix} `;
    }

    if (this.config.enableTimestamps) {
      formatted += `[${new Date().toISOString()}] `;
    }

    formatted += `${level}: ${message}`;

    return formatted;
  }

  private generateTraceId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private getType(obj: unknown): string {
    if (obj === null) return 'null';
    if (obj === undefined) return 'undefined';
    if (Array.isArray(obj)) return 'array';
    if (obj instanceof Date) return 'date';
    if (obj instanceof RegExp) return 'regexp';
    if (obj instanceof Map) return 'map';
    if (obj instanceof Set) return 'set';
    if (obj instanceof Error) return 'error';
    return typeof obj;
  }
}

/**
 * Get the default debug utils instance
 */
export function getDebugUtils(): DebugUtils {
  return DebugUtils.getInstance();
}

/**
 * Create debug utils with custom configuration
 */
export function createDebugUtils(config?: Partial<DebugConfig>, logger?: Logger): DebugUtils {
  return new DebugUtils(config, logger);
}

/**
 * Decorator for measuring method execution time
 */
export function measureTime(operation?: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const debugUtils = getDebugUtils();
    const opName = operation || `${target.constructor.name}.${propertyName}`;

    descriptor.value = async function (...args: any[]) {
      if (debugUtils.isEnabled()) {
        const { result } = await debugUtils.measureAsync(opName, () => method.apply(this, args));
        return result;
      } else {
        return method.apply(this, args);
      }
    };

    return descriptor;
  };
}

/**
 * Decorator for tracing method calls
 */
export function trace(operation?: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const debugUtils = getDebugUtils();
    const opName = operation || `${target.constructor.name}.${propertyName}`;

    descriptor.value = function (...args: any[]) {
      if (debugUtils.isEnabled()) {
        debugUtils.trace(opName, `Called with ${args.length} arguments`);
      }
      return method.apply(this, args);
    };

    return descriptor;
  };
}
