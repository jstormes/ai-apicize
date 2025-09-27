// @apicize/lib - Core library for Apicize tools
// This file will export all public interfaces and utilities

// Type definitions
export * from './types';

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
} from './parser';

// Version information
export const version = '1.0.0';
