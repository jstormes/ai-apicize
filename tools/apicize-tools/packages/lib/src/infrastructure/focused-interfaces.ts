/**
 * Focused Interfaces - Interface Segregation Principle applied
 * Split large interfaces into smaller, focused interfaces that clients actually need
 */

import { ApicizeConfig, EnvironmentConfig, AuthProvidersConfig } from '../types';
import { Result } from './result';
import { ApicizeError } from './errors';

// ============= File System Interfaces =============

/**
 * Read-only file system operations
 */
export interface FileReader {
  exists(path: string): boolean;
  existsAsync(path: string): Promise<boolean>;
  readFile(path: string, encoding?: BufferEncoding): string;
  readFileAsync(path: string, encoding?: BufferEncoding): Promise<string>;
  stat(path: string): { isDirectory(): boolean; isFile(): boolean };
  statAsync(path: string): Promise<{ isDirectory(): boolean; isFile(): boolean }>;
}

/**
 * Write-only file system operations
 */
export interface FileWriter {
  writeFile(path: string, data: string, encoding?: BufferEncoding): void;
  writeFileAsync(path: string, data: string, encoding?: BufferEncoding): Promise<void>;
  mkdir(path: string, options?: { recursive?: boolean }): void;
  mkdirAsync(path: string, options?: { recursive?: boolean }): Promise<void>;
}

/**
 * File existence checker
 */
export interface FileExistenceChecker {
  exists(path: string): boolean;
  existsAsync(path: string): Promise<boolean>;
}

/**
 * File metadata provider
 */
export interface FileMetadataProvider {
  stat(path: string): { isDirectory(): boolean; isFile(): boolean };
  statAsync(path: string): Promise<{ isDirectory(): boolean; isFile(): boolean }>;
}

// ============= Console Interfaces =============

/**
 * Basic logging operations
 */
export interface BasicLogger {
  log(message?: any, ...optionalParams: any[]): void;
  info(message?: any, ...optionalParams: any[]): void;
}

/**
 * Warning and error logging
 */
export interface ErrorLogger {
  warn(message?: any, ...optionalParams: any[]): void;
  error(message?: any, ...optionalParams: any[]): void;
}

/**
 * Debug logging
 */
export interface DebugLogger {
  debug(message?: any, ...optionalParams: any[]): void;
}

// ============= Process Interfaces =============

/**
 * Environment variable reader
 */
export interface EnvironmentReader {
  getEnv(key: string): string | undefined;
  getAllEnv(): Record<string, string | undefined>;
}

/**
 * Working directory provider
 */
export interface WorkingDirectoryProvider {
  getCwd(): string;
}

/**
 * Process controller
 */
export interface ProcessController {
  exit(code?: number): never;
}

// ============= HTTP Client Interfaces =============

/**
 * Basic HTTP request executor
 */
export interface HttpRequestExecutor {
  fetch(url: string, init?: RequestInit): Promise<Response>;
}

/**
 * Request timeout manager
 */
export interface RequestTimeoutManager {
  createTimeout(ms: number): AbortController;
  clearTimeout(controller: AbortController): void;
}

/**
 * Request retry handler
 */
export interface RequestRetryHandler {
  shouldRetry(error: unknown, attempt: number): boolean;
  calculateDelay(attempt: number): number;
}

// ============= JSON Interfaces =============

/**
 * JSON parser
 */
export interface JsonParser {
  parse<T = unknown>(text: string): T;
}

/**
 * JSON stringifier
 */
export interface JsonStringifier {
  stringify(value: any, replacer?: any, space?: any): string;
}

// ============= Timer Interfaces =============

/**
 * Timeout operations
 */
export interface TimeoutProvider {
  setTimeout(callback: (...args: any[]) => void, ms: number, ...args: any[]): NodeJS.Timeout;
  clearTimeout(timeoutId: NodeJS.Timeout): void;
}

/**
 * Interval operations
 */
export interface IntervalProvider {
  setInterval(callback: (...args: any[]) => void, ms: number, ...args: any[]): NodeJS.Timeout;
  clearInterval(intervalId: NodeJS.Timeout): void;
}

/**
 * Time provider
 */
export interface TimeProvider {
  now(): number;
}

// ============= Logging Interfaces =============

/**
 * Structured logger for operational logs
 */
export interface OperationalLogger {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

/**
 * Debug logger for development
 */
export interface DevelopmentLogger {
  trace(message: string, context?: Record<string, unknown>): void;
  debug(message: string, context?: Record<string, unknown>): void;
}

/**
 * Fatal error logger
 */
export interface FatalLogger {
  fatal(message: string, context?: Record<string, unknown>): void;
}

// ============= Telemetry Interfaces =============

/**
 * Span creator for tracing
 */
export interface SpanCreator {
  startSpan(name: string, attributes?: Record<string, unknown>): TelemetrySpan;
}

/**
 * Event recorder for telemetry
 */
export interface EventRecorder {
  recordEvent(name: string, attributes?: Record<string, unknown>): void;
}

/**
 * Metrics recorder
 */
export interface MetricsRecorder {
  recordMetric(name: string, value: number, attributes?: Record<string, unknown>): void;
}

/**
 * Telemetry span (kept same as original for compatibility)
 */
export interface TelemetrySpan {
  setAttribute(key: string, value: unknown): void;
  setAttributes(attributes: Record<string, unknown>): void;
  recordException(exception: Error): void;
  setStatus(status: 'ok' | 'error', message?: string): void;
  end(): void;
}

// ============= Configuration Interfaces =============

/**
 * Configuration reader
 */
export interface ConfigurationReader {
  get<T>(key: string): T | undefined;
  has(key: string): boolean;
  getAll(): Record<string, unknown>;
}

/**
 * Configuration writer
 */
export interface ConfigurationWriter {
  set<T>(key: string, value: T): void;
}

/**
 * Base configuration provider
 */
export interface BaseConfigProvider {
  getBaseConfig(): Promise<Result<ApicizeConfig, ApicizeError>>;
  reloadBaseConfig(): Promise<Result<ApicizeConfig, ApicizeError>>;
}

/**
 * Environment configuration provider
 */
export interface EnvironmentConfigProvider {
  getEnvironmentConfig(
    environment: string
  ): Promise<Result<EnvironmentConfig | null, ApicizeError>>;
  getActiveEnvironment(): string;
  setActiveEnvironment(environment: string): void;
}

/**
 * Auth configuration provider
 */
export interface AuthConfigProvider {
  getAuthConfig(): Promise<Result<AuthProvidersConfig | null, ApicizeError>>;
  getAuthProvider(providerName: string): Promise<Result<unknown, ApicizeError>>;
}

/**
 * URL resolver
 */
export interface UrlResolver {
  getBaseUrl(service: string): Promise<Result<string | undefined, ApicizeError>>;
  resolveUrl(service: string, path: string): Promise<Result<string, ApicizeError>>;
}

// ============= Request Building Interfaces =============

/**
 * URL builder
 */
export interface UrlBuilder {
  buildUrl(
    base: string,
    path?: string,
    params?: Record<string, string>
  ): Result<string, ApicizeError>;
  addQueryParams(url: string, params: Record<string, string>): Result<string, ApicizeError>;
}

/**
 * Header builder
 */
export interface HeaderBuilder {
  buildHeaders(headers: Array<{ name: string; value: string }>): Result<Headers, ApicizeError>;
  addAuthHeaders(
    headers: Headers,
    authType: string,
    authData: unknown
  ): Result<Headers, ApicizeError>;
}

/**
 * Body serializer
 */
export interface BodySerializer {
  serialize(
    body: unknown,
    contentType: string
  ): Result<string | FormData | ArrayBuffer, ApicizeError>;
  getContentType(body: unknown): string;
}

// ============= Response Processing Interfaces =============

/**
 * Response validator
 */
export interface ResponseValidator {
  isValidResponse(response: Response): boolean;
  isErrorResponse(response: Response): boolean;
  validateStatus(status: number): Result<boolean, ApicizeError>;
}

/**
 * Response parser
 */
export interface ResponseParser {
  parseBody(response: Response, contentType: string): Promise<Result<unknown, ApicizeError>>;
  extractHeaders(response: Response): Record<string, string>;
}

/**
 * Response timing calculator
 */
export interface ResponseTimingCalculator {
  calculateTiming(
    startTime: number,
    endTime: number
  ): {
    total: number;
    dns?: number;
    tcp?: number;
    tls?: number;
    request?: number;
    firstByte?: number;
    download?: number;
  };
}

// ============= Variable Interfaces =============

/**
 * Variable resolver
 */
export interface VariableResolver {
  resolve(template: string, variables: Record<string, string>): Result<string, ApicizeError>;
  extractVariables(template: string): string[];
}

/**
 * Variable provider
 */
export interface VariableProvider {
  getValue(key: string): Promise<string | undefined>;
  getAllVariables(): Promise<Record<string, string>>;
}

/**
 * Variable validator
 */
export interface VariableValidator {
  validateTemplate(template: string): Result<boolean, ApicizeError>;
  validateVariables(variables: Record<string, string>): Result<boolean, ApicizeError>;
}

// ============= Validation Interfaces =============

/**
 * Schema validator
 */
export interface SchemaValidator {
  validate(data: unknown, schema: string): Result<boolean, ApicizeError>;
  getSchema(schemaName: string): Result<object, ApicizeError>;
}

/**
 * Structure validator
 */
export interface StructureValidator {
  validateStructure(data: unknown): Result<boolean, ApicizeError>;
  validateField(fieldName: string, value: unknown): Result<boolean, ApicizeError>;
}

/**
 * Content validator
 */
export interface ContentValidator {
  validateContent(content: string, contentType: string): Result<boolean, ApicizeError>;
  validateJson(json: string): Result<boolean, ApicizeError>;
  validateXml(xml: string): Result<boolean, ApicizeError>;
}

// ============= Error Handling Interfaces =============

/**
 * Error classifier
 */
export interface ErrorClassifier {
  classify(error: unknown): string;
  isRetryable(error: unknown): boolean;
  getSeverity(error: unknown): 'low' | 'medium' | 'high';
}

/**
 * Error transformer
 */
export interface ErrorTransformer {
  transform(error: unknown): ApicizeError;
  addContext(error: ApicizeError, context: Record<string, unknown>): ApicizeError;
}

/**
 * Error suggester
 */
export interface ErrorSuggester {
  getSuggestions(error: ApicizeError): string[];
  getResolutionSteps(error: ApicizeError): string[];
}

// ============= Cache Interfaces =============

/**
 * Cache reader
 */
export interface CacheReader {
  get<T>(key: string): T | undefined;
  has(key: string): boolean;
  getStats(): { size: number; hitRate: number };
}

/**
 * Cache writer
 */
export interface CacheWriter {
  set<T>(key: string, value: T, ttl?: number): void;
  delete(key: string): boolean;
  clear(): void;
}

/**
 * Cache manager
 */
export interface CacheManager extends CacheReader, CacheWriter {
  evict(): void;
  resize(maxSize: number): void;
}

// ============= Export Aggregation Interfaces =============

/**
 * Common file operations (aggregates FileReader and FileWriter)
 */
export interface FileOperations extends FileReader, FileWriter {}

/**
 * Complete console operations (aggregates all console interfaces)
 */
export interface ConsoleOperations extends BasicLogger, ErrorLogger, DebugLogger {}

/**
 * Complete process operations (aggregates all process interfaces)
 */
export interface ProcessOperations
  extends EnvironmentReader,
    WorkingDirectoryProvider,
    ProcessController {}

/**
 * Complete timer operations (aggregates all timer interfaces)
 */
export interface TimerOperations extends TimeoutProvider, IntervalProvider, TimeProvider {}

/**
 * Complete logger (aggregates all logging interfaces)
 */
export interface CompleteLogger extends OperationalLogger, DevelopmentLogger, FatalLogger {}

/**
 * Complete telemetry (aggregates all telemetry interfaces)
 */
export interface CompleteTelemetry extends SpanCreator, EventRecorder, MetricsRecorder {}

/**
 * Complete configuration (aggregates all config interfaces)
 */
export interface CompleteConfiguration extends ConfigurationReader, ConfigurationWriter {}
