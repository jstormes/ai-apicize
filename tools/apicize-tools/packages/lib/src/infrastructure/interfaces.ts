/**
 * Infrastructure interfaces for dependency injection
 * This module provides abstractions for external dependencies to enable testability
 */

/**
 * File system operations interface
 */
export interface FileSystem {
  exists(path: string): boolean;
  existsAsync(path: string): Promise<boolean>;
  readFile(path: string, encoding?: BufferEncoding): string;
  readFileAsync(path: string, encoding?: BufferEncoding): Promise<string>;
  writeFile(path: string, data: string, encoding?: BufferEncoding): void;
  writeFileAsync(path: string, data: string, encoding?: BufferEncoding): Promise<void>;
  mkdir(path: string, options?: { recursive?: boolean }): void;
  mkdirAsync(path: string, options?: { recursive?: boolean }): Promise<void>;
  stat(path: string): { isDirectory(): boolean; isFile(): boolean };
  statAsync(path: string): Promise<{ isDirectory(): boolean; isFile(): boolean }>;
}

/**
 * Console operations interface
 */
export interface Console {
  log(message?: any, ...optionalParams: any[]): void;
  info(message?: any, ...optionalParams: any[]): void;
  warn(message?: any, ...optionalParams: any[]): void;
  error(message?: any, ...optionalParams: any[]): void;
  debug(message?: any, ...optionalParams: any[]): void;
}

/**
 * Process operations interface
 */
export interface Process {
  getEnv(key: string): string | undefined;
  getAllEnv(): Record<string, string | undefined>;
  getCwd(): string;
  exit(code?: number): never;
}

/**
 * HTTP client interface (enhanced from existing)
 */
export interface HttpClient {
  fetch(url: string, init?: RequestInit): Promise<Response>;
}

/**
 * Abort controller factory interface (from existing)
 */
export interface AbortControllerFactory {
  create(): AbortController;
}

/**
 * JSON operations interface
 */
export interface JsonParser {
  parse<T = unknown>(text: string): T;
  stringify(value: any, replacer?: any, space?: any): string;
}

/**
 * Timer operations interface
 */
export interface Timer {
  setTimeout(callback: (...args: any[]) => void, ms: number, ...args: any[]): NodeJS.Timeout;
  clearTimeout(timeoutId: NodeJS.Timeout): void;
  setInterval(callback: (...args: any[]) => void, ms: number, ...args: any[]): NodeJS.Timeout;
  clearInterval(intervalId: NodeJS.Timeout): void;
  now(): number;
}

/**
 * Logger interface for structured logging
 */
export interface Logger {
  trace(message: string, context?: Record<string, unknown>): void;
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  fatal(message: string, context?: Record<string, unknown>): void;
}

/**
 * Telemetry interface for monitoring operations
 */
export interface Telemetry {
  startSpan(name: string, attributes?: Record<string, unknown>): TelemetrySpan;
  recordEvent(name: string, attributes?: Record<string, unknown>): void;
  recordMetric(name: string, value: number, attributes?: Record<string, unknown>): void;
}

/**
 * Telemetry span interface
 */
export interface TelemetrySpan {
  setAttribute(key: string, value: unknown): void;
  setAttributes(attributes: Record<string, unknown>): void;
  recordException(exception: Error): void;
  setStatus(status: 'ok' | 'error', message?: string): void;
  end(): void;
}

/**
 * Configuration interface
 */
export interface ConfigurationProvider {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): void;
  has(key: string): boolean;
  getAll(): Record<string, unknown>;
}
