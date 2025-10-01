// @apicize/lib - Core library for Apicize tools
// This file will export all public interfaces and utilities

// Type definitions
export * from './types';

// Validation utilities
export * from './validation/validator';

// Core utilities
export * from './config';
export * from './variables';
export * from './auth'; // ✅ Implemented in Phase 2 Step 2.4
export * from './parser'; // ✅ Implemented in Phase 3 Step 3.1
export * from './templates'; // ✅ Implemented in Phase 4 Step 4.1
export * from './generators'; // ✅ Implemented in Phase 4 Step 4.2
export * from './export'; // ✅ Implemented in Phase 4 Step 4.4
export * from './import'; // ✅ Implemented in Phase 5 Step 5.1

// Client exports (import specific items to avoid conflicts)
export {
  ApicizeClient,
  ClientConfig,
  RequestOptions,
  ApicizeRequestError,
  ApicizeTimeoutError,
  ApicizeNetworkError,
  IntegratedApicizeClient,
  TestHelper,
} from './client';

// Version information
export const version = '1.0.1';
