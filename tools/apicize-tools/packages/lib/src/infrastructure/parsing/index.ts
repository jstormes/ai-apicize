/**
 * Infrastructure parsing module exports
 * Provides all parsing-related infrastructure components
 */

// Core interface
export { ISourceCodeParser } from './ISourceCodeParser';

// Data structures
export {
  ParsedSource,
  ParsedImport,
  ParsedVariable,
  ParsedFunction,
  ParsedMetadata,
  ParsedComment,
  ParsedAnnotation,
} from './ParsedSource';

// Configuration
export {
  ParsingOptions,
  DEFAULT_PARSING_OPTIONS,
  DEFAULT_REQUEST_PATTERNS,
} from './ParsingOptions';

// Implementation
// export { TypeScriptParser } from './TypeScriptParser';

// Utilities
export { AstNavigator } from './AstNavigator';
export { SyntaxAnalyzer } from './SyntaxAnalyzer';
