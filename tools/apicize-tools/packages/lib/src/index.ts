// @apicize/lib - Core library for Apicize tools
// This file will export all public interfaces and utilities

// Type definitions
export * from './types';

// Validation utilities
export * from './validation/validator';

// Core utilities
export * from './config';
export * from './variables';
// export * from './client';     // TODO: Implement in Phase 2 Step 2.3
// export * from './auth';       // TODO: Implement in Phase 2 Step 2.4

// Version information
export const version = '1.0.0';
