/**
 * Infrastructure module exports
 * Provides all dependency injection, error handling, and debugging utilities
 */

// Phase 2: Hexagonal Architecture - Parsing Infrastructure
export * from './parsing';

// Phase 2: Dependency Injection Container
export * from './container';

// Interfaces
export * from './interfaces';

// Implementations
export * from './implementations';

// Factories
export * from './factories';

// Service Locator
export * from './service-locator';

// Configuration
export * from './configuration';

// Error Handling
export * from './errors';
export * from './error-factory';

// Result Pattern
export * from './result';

// Debug Utilities
export * from './debug';

// Phase 4: Performance & Reliability improvements
export * from './async-utilities';
export * from './caching';
export * from './performance-monitoring';

// Re-export legacy error types for compatibility
export {
  ApicizeRequestError,
  ApicizeTimeoutError,
  ApicizeNetworkError as LegacyApicizeNetworkError,
  ApicizeAbortError,
} from '../client/apicize-client';
