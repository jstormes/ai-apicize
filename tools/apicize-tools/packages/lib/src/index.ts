// @apicize/lib - Core library for Apicize tools
// This file will export all public interfaces and utilities

// Phase 2: Hexagonal Architecture - Domain & Application Layers
export * from './domain';
export * from './application';
export * from './presentation';

// Type definitions - Core types
export {
  HttpMethod,
  BodyType,
  ExecutionMode,
  RequestMode,
  NameValuePair,
  SelectedItem,
  RequestBody,
  RequestBodyBase,
  RequestBodyNone,
  RequestBodyText,
  RequestBodyJSON,
  RequestBodyXML,
  RequestBodyForm,
  RequestBodyRaw,
  Request,
  RequestGroup,
  Variable,
  Scenario,
  Authorization,
  BasicAuthorization,
  OAuth2ClientAuthorization,
  OAuth2PkceAuthorization,
  ApiKeyAuthorization,
  Certificate,
  Proxy,
  ExternalData,
  ApicizeWorkbook,
  ApicizeResponseHeaders,
  ApicizeResponseBody,
  ApicizeResponse,
  ApicizeContext,
  RequestConfig,
  TestHelper,
  ApicizeMetadata,
} from './types';

// Enhanced types
export {
  TypedResponse,
  ExtractBodyType,
  ConfigSchema,
  Result,
  TimingInfo,
  ValidationError,
  Optional,
  RequiredFields,
  DeepReadonly,
  isJsonResponse,
  isTextResponse,
  isXmlResponse,
  isFormResponse,
  isRawResponse,
  isEmptyResponse,
  ResultHelpers,
} from './types/enhanced-types';

// Infrastructure (Phase 1 refactoring)
export * from './infrastructure';

// Validation utilities
export * from './validation/validator';

// Core utilities
export * from './config';
export * from './variables';

// Client exports (explicitly to avoid conflicts)
export {
  ApicizeClient,
  ApicizeRequestBuilder,
  ApicizeResponseProcessor,
  ApicizeRedirectHandler,
  ApicizeErrorHandler,
  ModularHttpClient,
} from './client';

// Auth exports
export * from './auth';

// Parser exports (explicitly to avoid conflicts)
export {
  ApicizeParser,
  ParseResult,
  ParseOptions,
  parseApicizeFile,
  parseApicizeContent,
  MetadataExtractor,
  MetadataExtractionError,
  ExtractedMetadata,
  ExtractedRequestMetadata,
  ExtractedGroupMetadata,
  MetadataExtractionOptions,
  extractMetadataFromFile,
  extractMetadataFromContent,
  TestExtractor,
  TestExtractionError,
  ExtractedTestCode,
  ExtractedTestBlock,
  ExtractedImport,
  ExtractedVariable,
  ExtractedFunction,
  TestExtractionOptions,
  extractTestCodeFromFile,
  extractTestCodeFromContent,
} from './parser';

// Phase 5: Developer Experience Enhancements

// Fluent interfaces and builders
export {
  RequestBuilder,
  IFluentRequestBuilder,
  ClientConfigBuilder,
  EnvironmentConfigBuilder,
  IConfigBuilder,
  IEnvironmentConfigBuilder,
} from './fluent';

// Enhanced debugging utilities
export {
  DebugUtilities,
  OperationTrace,
  PerformanceProfiler,
  MemoryTracker,
  ValidationHelpers,
  debugUtils,
  enableDebugMode,
  disableDebugMode,
  trace,
  inspect,
} from './debugging/debug-utilities';

// Version information
export const version = '1.0.0';
