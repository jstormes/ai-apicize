/**
 * Test builders module exports
 * Provides fluent builders for creating test data
 */

// Core builders
export { TestBlockBuilder, TestBlockBuilderPresets, testBlock } from './TestBlockBuilder';
export { TestSuiteBuilder, TestSuiteBuilderPresets, testSuite } from './TestSuiteBuilder';
export { CodeMetadataBuilder, CodeMetadataBuilderPresets, codeMetadata } from './CodeMetadataBuilder';
export { ParsedSourceBuilder, ParsedSourceBuilderPresets, parsedSource } from './ParsedSourceBuilder';

// Import for re-export
import { testBlock } from './TestBlockBuilder';
import { testSuite } from './TestSuiteBuilder';
import { codeMetadata } from './CodeMetadataBuilder';
import { parsedSource } from './ParsedSourceBuilder';
import { TestBlockBuilderPresets } from './TestBlockBuilder';
import { TestSuiteBuilderPresets } from './TestSuiteBuilder';
import { CodeMetadataBuilderPresets } from './CodeMetadataBuilder';
import { ParsedSourceBuilderPresets } from './ParsedSourceBuilder';

// Convenience functions for common scenarios
export const builders = {
  testBlock,
  testSuite,
  codeMetadata,
  parsedSource,
};

export const presets = {
  TestBlock: TestBlockBuilderPresets,
  TestSuite: TestSuiteBuilderPresets,
  CodeMetadata: CodeMetadataBuilderPresets,
  ParsedSource: ParsedSourceBuilderPresets,
};
