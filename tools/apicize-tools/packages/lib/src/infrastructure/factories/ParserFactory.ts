/**
 * Factory for creating parser instances using the Factory pattern
 * Provides flexible creation of different parser types with various configurations
 */

import { ISourceCodeParser } from '../parsing/ISourceCodeParser';
import { TypeScriptParser } from '../parsing/TypeScriptParser';
import { ParsingOptions, DEFAULT_PARSING_OPTIONS } from '../parsing/ParsingOptions';

/**
 * Supported parser types
 */
export type ParserType = 'typescript' | 'javascript' | 'tsx' | 'jsx';

/**
 * Parser configuration options
 */
export interface ParserConfig {
  type: ParserType;
  options?: Partial<ParsingOptions>;
  enableCaching?: boolean;
  enableValidation?: boolean;
  enableAnalysis?: boolean;
}

/**
 * Parser creation strategies
 */
export interface ParserCreationStrategy {
  canCreate(type: ParserType): boolean;
  create(config: ParserConfig): ISourceCodeParser;
}

/**
 * TypeScript parser creation strategy
 */
class TypeScriptParserStrategy implements ParserCreationStrategy {
  canCreate(type: ParserType): boolean {
    return type === 'typescript' || type === 'tsx';
  }

  create(config: ParserConfig): ISourceCodeParser {
    const options = { ...DEFAULT_PARSING_OPTIONS, ...config.options };

    // Adjust options based on type
    if (config.type === 'tsx') {
      options.compilerOptions = {
        ...options.compilerOptions,
        jsx: 'react' as any,
        allowJs: true,
      };
    }

    return new TypeScriptParser(options);
  }
}

/**
 * JavaScript parser creation strategy (uses TypeScript parser with JS settings)
 */
class JavaScriptParserStrategy implements ParserCreationStrategy {
  canCreate(type: ParserType): boolean {
    return type === 'javascript' || type === 'jsx';
  }

  create(config: ParserConfig): ISourceCodeParser {
    const options = { ...DEFAULT_PARSING_OPTIONS, ...config.options };

    // Configure for JavaScript
    options.compilerOptions = {
      ...options.compilerOptions,
      allowJs: true,
      checkJs: false,
      target: 'ES2020' as any,
      module: 'ESNext' as any,
    };

    if (config.type === 'jsx') {
      options.compilerOptions.jsx = 'react' as any;
    }

    return new TypeScriptParser(options);
  }
}

/**
 * Factory for creating parser instances
 */
export class ParserFactory {
  private static strategies: ParserCreationStrategy[] = [
    new TypeScriptParserStrategy(),
    new JavaScriptParserStrategy(),
  ];

  /**
   * Create a parser for the specified type
   */
  static create(config: ParserConfig): ISourceCodeParser {
    const strategy = this.findStrategy(config.type);
    if (!strategy) {
      throw new Error(`No parser strategy found for type: ${config.type}`);
    }

    const parser = strategy.create(config);

    // Apply additional decorators based on config
    return this.applyDecorators(parser, config);
  }

  /**
   * Create a TypeScript parser with default configuration
   */
  static createTypeScript(options?: Partial<ParsingOptions>): ISourceCodeParser {
    return this.create({
      type: 'typescript',
      options,
      enableCaching: true,
      enableValidation: true,
      enableAnalysis: true,
    });
  }

  /**
   * Create a JavaScript parser with default configuration
   */
  static createJavaScript(options?: Partial<ParsingOptions>): ISourceCodeParser {
    return this.create({
      type: 'javascript',
      options,
      enableCaching: true,
      enableValidation: false, // Less strict for JS
      enableAnalysis: true,
    });
  }

  /**
   * Create a TSX (React TypeScript) parser
   */
  static createTSX(options?: Partial<ParsingOptions>): ISourceCodeParser {
    return this.create({
      type: 'tsx',
      options,
      enableCaching: true,
      enableValidation: true,
      enableAnalysis: true,
    });
  }

  /**
   * Create a JSX (React JavaScript) parser
   */
  static createJSX(options?: Partial<ParsingOptions>): ISourceCodeParser {
    return this.create({
      type: 'jsx',
      options,
      enableCaching: true,
      enableValidation: false,
      enableAnalysis: true,
    });
  }

  /**
   * Create a performance-optimized parser
   */
  static createPerformanceOptimized(type: ParserType = 'typescript'): ISourceCodeParser {
    return this.create({
      type,
      options: {
        preserveFormatting: false,
        includeComments: false,
        extractHelpers: false,
        includePositions: false,
        extractMetadata: false,
        validateSyntax: false,
      },
      enableCaching: false,
      enableValidation: false,
      enableAnalysis: false,
    });
  }

  /**
   * Create a parser with comprehensive analysis features
   */
  static createAnalysisEnabled(type: ParserType = 'typescript'): ISourceCodeParser {
    return this.create({
      type,
      options: {
        preserveFormatting: true,
        includeComments: true,
        extractHelpers: true,
        includePositions: true,
        extractMetadata: true,
        validateSyntax: true,
        maxNestingDepth: 10,
      },
      enableCaching: true,
      enableValidation: true,
      enableAnalysis: true,
    });
  }

  /**
   * Create a parser from file extension
   */
  static createFromExtension(
    extension: string,
    options?: Partial<ParsingOptions>
  ): ISourceCodeParser {
    const type = this.mapExtensionToType(extension);
    return this.create({ type, options });
  }

  /**
   * Create a parser with custom patterns
   */
  static createWithPatterns(
    type: ParserType,
    patterns: RegExp[],
    options?: Partial<ParsingOptions>
  ): ISourceCodeParser {
    return this.create({
      type,
      options: {
        ...options,
        requestIdentifierPatterns: patterns,
      },
    });
  }

  /**
   * Register a custom parser strategy
   */
  static registerStrategy(strategy: ParserCreationStrategy): void {
    this.strategies.push(strategy);
  }

  /**
   * Get all supported parser types
   */
  static getSupportedTypes(): ParserType[] {
    return ['typescript', 'javascript', 'tsx', 'jsx'];
  }

  /**
   * Check if a parser type is supported
   */
  static isTypeSupported(type: string): type is ParserType {
    return this.getSupportedTypes().includes(type as ParserType);
  }

  /**
   * Find the appropriate strategy for a parser type
   */
  private static findStrategy(type: ParserType): ParserCreationStrategy | undefined {
    return this.strategies.find(strategy => strategy.canCreate(type));
  }

  /**
   * Apply decorators based on configuration
   */
  private static applyDecorators(
    parser: ISourceCodeParser,
    config: ParserConfig
  ): ISourceCodeParser {
    let decoratedParser = parser;

    // Add caching decorator if enabled
    if (config.enableCaching) {
      decoratedParser = new CachingParserDecorator(decoratedParser);
    }

    // Add validation decorator if enabled
    if (config.enableValidation) {
      decoratedParser = new ValidatingParserDecorator(decoratedParser);
    }

    // Add analysis decorator if enabled
    if (config.enableAnalysis) {
      decoratedParser = new AnalysisParserDecorator(decoratedParser);
    }

    return decoratedParser;
  }

  /**
   * Map file extension to parser type
   */
  private static mapExtensionToType(extension: string): ParserType {
    const ext = extension.toLowerCase().replace('.', '');

    switch (ext) {
      case 'ts':
        return 'typescript';
      case 'tsx':
        return 'tsx';
      case 'js':
        return 'javascript';
      case 'jsx':
        return 'jsx';
      default:
        return 'typescript'; // Default fallback
    }
  }
}

/**
 * Caching decorator for parsers
 */
class CachingParserDecorator implements ISourceCodeParser {
  private cache = new Map<string, any>();

  constructor(private parser: ISourceCodeParser) {}

  async parseSource(sourceCode: string, filePath?: string) {
    const cacheKey = this.getCacheKey(sourceCode, filePath);

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const result = await this.parser.parseSource(sourceCode, filePath);
    this.cache.set(cacheKey, result);

    return result;
  }

  validateSyntax(sourceCode: string, filePath?: string) {
    return this.parser.validateSyntax(sourceCode, filePath);
  }

  getParsingErrors() {
    return this.parser.getParsingErrors();
  }

  getParsingWarnings() {
    return this.parser.getParsingWarnings();
  }

  private getCacheKey(sourceCode: string, filePath?: string): string {
    // Simple hash of source code + file path
    return `${filePath || 'unknown'}_${sourceCode.length}_${sourceCode.slice(0, 100)}`;
  }

  clearCache(): void {
    this.cache.clear();
  }
}

/**
 * Validating decorator for parsers
 */
class ValidatingParserDecorator implements ISourceCodeParser {
  constructor(private parser: ISourceCodeParser) {}

  async parseSource(sourceCode: string, filePath?: string) {
    // Pre-validation
    if (!sourceCode || sourceCode.trim().length === 0) {
      throw new Error('Source code cannot be empty');
    }

    // Validate syntax before parsing
    const isValid = this.parser.validateSyntax(sourceCode, filePath);
    if (!isValid && this.parser.getParsingErrors().length > 0) {
      throw new Error(`Syntax validation failed: ${this.parser.getParsingErrors().join(', ')}`);
    }

    return this.parser.parseSource(sourceCode, filePath);
  }

  validateSyntax(sourceCode: string, filePath?: string) {
    return this.parser.validateSyntax(sourceCode, filePath);
  }

  getParsingErrors() {
    return this.parser.getParsingErrors();
  }

  getParsingWarnings() {
    return this.parser.getParsingWarnings();
  }
}

/**
 * Analysis decorator for parsers
 */
class AnalysisParserDecorator implements ISourceCodeParser {
  constructor(private parser: ISourceCodeParser) {}

  async parseSource(sourceCode: string, filePath?: string) {
    const startTime = performance.now();

    try {
      const result = await this.parser.parseSource(sourceCode, filePath);

      // Add analysis metadata
      const endTime = performance.now();
      const analysisMetadata = {
        parsingTime: endTime - startTime,
        sourceSize: sourceCode.length,
        testBlockCount: result.testBlocks.length,
        analysis: {
          timestamp: new Date().toISOString(),
          performance: {
            parsingTimeMs: endTime - startTime,
            sourceSizeBytes: sourceCode.length,
          },
        },
      };

      return {
        ...result,
        metadata: {
          ...result.metadata,
          ...analysisMetadata,
        },
      };
    } catch (error) {
      const endTime = performance.now();
      console.warn(`Parser analysis failed after ${endTime - startTime}ms:`, error);
      throw error;
    }
  }

  validateSyntax(sourceCode: string, filePath?: string) {
    return this.parser.validateSyntax(sourceCode, filePath);
  }

  getParsingErrors() {
    return this.parser.getParsingErrors();
  }

  getParsingWarnings() {
    return this.parser.getParsingWarnings();
  }
}

/**
 * Convenience functions for common parser creation patterns
 */

/**
 * Create a parser based on file extension
 */
export function createParserForFile(
  filePath: string,
  options?: Partial<ParsingOptions>
): ISourceCodeParser {
  const extension = filePath.split('.').pop() || '';
  return ParserFactory.createFromExtension(extension, options);
}

/**
 * Create a default parser (TypeScript with caching and validation)
 */
export function createDefaultParser(): ISourceCodeParser {
  return ParserFactory.createTypeScript();
}

/**
 * Create a fast parser (minimal features for performance)
 */
export function createFastParser(): ISourceCodeParser {
  return ParserFactory.createPerformanceOptimized();
}

/**
 * Create a comprehensive parser (all analysis features enabled)
 */
export function createComprehensiveParser(): ISourceCodeParser {
  return ParserFactory.createAnalysisEnabled();
}
