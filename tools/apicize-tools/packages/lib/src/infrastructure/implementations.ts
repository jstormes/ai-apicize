/**
 * Default implementations of infrastructure interfaces
 */

import * as fs from 'fs';
import {
  FileSystem,
  Console as IConsole,
  Process as IProcess,
  HttpClient,
  AbortControllerFactory,
  JsonParser,
  Timer,
  Logger,
  Telemetry,
  TelemetrySpan,
  ConfigurationProvider,
} from './interfaces';

/**
 * Default file system implementation using Node.js fs module
 */
export class DefaultFileSystem implements FileSystem {
  exists(path: string): boolean {
    return fs.existsSync(path);
  }

  async existsAsync(path: string): Promise<boolean> {
    try {
      await fs.promises.access(path);
      return true;
    } catch {
      return false;
    }
  }

  readFile(path: string, encoding: BufferEncoding = 'utf-8'): string {
    return fs.readFileSync(path, encoding);
  }

  async readFileAsync(path: string, encoding: BufferEncoding = 'utf-8'): Promise<string> {
    return fs.promises.readFile(path, encoding);
  }

  writeFile(path: string, data: string, encoding: BufferEncoding = 'utf-8'): void {
    fs.writeFileSync(path, data, encoding);
  }

  async writeFileAsync(
    path: string,
    data: string,
    encoding: BufferEncoding = 'utf-8'
  ): Promise<void> {
    await fs.promises.writeFile(path, data, encoding);
  }

  mkdir(path: string, options?: { recursive?: boolean }): void {
    fs.mkdirSync(path, options);
  }

  async mkdirAsync(path: string, options?: { recursive?: boolean }): Promise<void> {
    await fs.promises.mkdir(path, options);
  }

  stat(path: string): { isDirectory(): boolean; isFile(): boolean } {
    return fs.statSync(path);
  }

  async statAsync(path: string): Promise<{ isDirectory(): boolean; isFile(): boolean }> {
    return fs.promises.stat(path);
  }
}

/**
 * Default console implementation using global console
 */
export class DefaultConsole implements IConsole {
  log(message?: any, ...optionalParams: any[]): void {
    console.log(message, ...optionalParams);
  }

  info(message?: any, ...optionalParams: any[]): void {
    console.info(message, ...optionalParams);
  }

  warn(message?: any, ...optionalParams: any[]): void {
    console.warn(message, ...optionalParams);
  }

  error(message?: any, ...optionalParams: any[]): void {
    console.error(message, ...optionalParams);
  }

  debug(message?: any, ...optionalParams: any[]): void {
    console.debug(message, ...optionalParams);
  }
}

/**
 * Default process implementation using Node.js process
 */
export class DefaultProcess implements IProcess {
  getEnv(key: string): string | undefined {
    return process.env[key];
  }

  getAllEnv(): Record<string, string | undefined> {
    return { ...process.env };
  }

  getCwd(): string {
    return process.cwd();
  }

  exit(code?: number): never {
    process.exit(code);
  }
}

/**
 * Default HTTP client implementation using native fetch
 */
export class DefaultHttpClient implements HttpClient {
  async fetch(url: string, init?: RequestInit): Promise<Response> {
    return fetch(url, init);
  }
}

/**
 * Default abort controller factory
 */
export class DefaultAbortControllerFactory implements AbortControllerFactory {
  create(): AbortController {
    return new AbortController();
  }
}

/**
 * Default JSON parser implementation using global JSON
 */
export class DefaultJsonParser implements JsonParser {
  parse<T = unknown>(text: string): T {
    return JSON.parse(text);
  }

  stringify(value: any, replacer?: any, space?: any): string {
    return JSON.stringify(value, replacer, space);
  }
}

/**
 * Default timer implementation using Node.js timers
 */
export class DefaultTimer implements Timer {
  setTimeout(callback: (...args: any[]) => void, ms: number, ...args: any[]): NodeJS.Timeout {
    return setTimeout(callback, ms, ...args);
  }

  clearTimeout(timeoutId: NodeJS.Timeout): void {
    clearTimeout(timeoutId);
  }

  setInterval(callback: (...args: any[]) => void, ms: number, ...args: any[]): NodeJS.Timeout {
    return setInterval(callback, ms, ...args);
  }

  clearInterval(intervalId: NodeJS.Timeout): void {
    clearInterval(intervalId);
  }

  now(): number {
    return Date.now();
  }
}

/**
 * Log levels enum
 */
export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  FATAL = 5,
}

/**
 * Default logger implementation using console
 */
export class DefaultLogger implements Logger {
  constructor(
    private readonly console: IConsole = new DefaultConsole(),
    private readonly minLevel: LogLevel = LogLevel.INFO
  ) {}

  trace(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog(LogLevel.TRACE)) {
      this.log('TRACE', message, context);
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.log('DEBUG', message, context);
    }
  }

  info(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.log('INFO', message, context);
    }
  }

  warn(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog(LogLevel.WARN)) {
      this.log('WARN', message, context);
    }
  }

  error(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      this.log('ERROR', message, context);
    }
  }

  fatal(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog(LogLevel.FATAL)) {
      this.log('FATAL', message, context);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.minLevel;
  }

  private log(level: string, message: string, context?: Record<string, unknown>): void {
    const timestamp = new Date().toISOString();
    const logEntry = context
      ? `[${timestamp}] ${level}: ${message} ${JSON.stringify(context)}`
      : `[${timestamp}] ${level}: ${message}`;

    switch (level) {
      case 'ERROR':
      case 'FATAL':
        this.console.error(logEntry);
        break;
      case 'WARN':
        this.console.warn(logEntry);
        break;
      case 'DEBUG':
      case 'TRACE':
        this.console.debug(logEntry);
        break;
      default:
        this.console.info(logEntry);
    }
  }
}

/**
 * No-op telemetry span implementation
 */
export class NoOpTelemetrySpan implements TelemetrySpan {
  setAttribute(_key: string, _value: unknown): void {
    // No-op
  }

  setAttributes(_attributes: Record<string, unknown>): void {
    // No-op
  }

  recordException(_exception: Error): void {
    // No-op
  }

  setStatus(_status: 'ok' | 'error', _message?: string): void {
    // No-op
  }

  end(): void {
    // No-op
  }
}

/**
 * Default no-op telemetry implementation
 */
export class DefaultTelemetry implements Telemetry {
  startSpan(_name: string, _attributes?: Record<string, unknown>): TelemetrySpan {
    return new NoOpTelemetrySpan();
  }

  recordEvent(_name: string, _attributes?: Record<string, unknown>): void {
    // No-op
  }

  recordMetric(_name: string, _value: number, _attributes?: Record<string, unknown>): void {
    // No-op
  }
}

/**
 * In-memory configuration provider
 */
export class DefaultConfigurationProvider implements ConfigurationProvider {
  private config = new Map<string, unknown>();

  get<T>(key: string): T | undefined {
    return this.config.get(key) as T | undefined;
  }

  set<T>(key: string, value: T): void {
    this.config.set(key, value);
  }

  has(key: string): boolean {
    return this.config.has(key);
  }

  getAll(): Record<string, unknown> {
    return Object.fromEntries(this.config);
  }
}
