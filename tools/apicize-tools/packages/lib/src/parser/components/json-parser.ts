/**
 * JSON Parser - Responsible for parsing and validating JSON content
 */

import { Result, success, failure } from '../../infrastructure/result';
import { ApicizeError, ApicizeErrorCode } from '../../infrastructure/errors';
import { JsonParser as IParsingJsonParser } from '../../domain/parsing/parsing-domain';

/**
 * JSON parser configuration
 */
export interface JsonParserConfig {
  maxDepth?: number;
  allowComments?: boolean;
  allowTrailingCommas?: boolean;
  preserveOrder?: boolean;
  reviver?: (key: string, value: any) => any;
  replacer?: (key: string, value: any) => any;
  indentSize?: number;
}

/**
 * Parse location information
 */
export interface ParseLocation {
  line: number;
  column: number;
  offset: number;
}

/**
 * Enhanced JSON parser implementation
 */
export class ApicizeJsonParser implements IParsingJsonParser {
  private config: JsonParserConfig;

  constructor(config: JsonParserConfig = {}) {
    this.config = {
      maxDepth: 100,
      allowComments: false,
      allowTrailingCommas: false,
      preserveOrder: false,
      indentSize: 2,
      ...config,
    };
  }

  /**
   * Parse JSON string
   */
  parse<T = unknown>(content: string): Result<T, ApicizeError> {
    try {
      if (!content || typeof content !== 'string') {
        return failure(
          new ApicizeError(
            ApicizeErrorCode.INVALID_ARGUMENT,
            'Content must be a non-empty string',
            { context: { contentType: typeof content } }
          )
        );
      }

      // Pre-process content if needed
      let processedContent = content.trim();

      if (this.config.allowComments) {
        processedContent = this.removeComments(processedContent);
      }

      if (this.config.allowTrailingCommas) {
        processedContent = this.removeTrailingCommas(processedContent);
      }

      // Validate depth before parsing
      const depthResult = this.validateDepth(processedContent);
      if (depthResult.isFailure()) {
        return depthResult as any;
      }

      // Parse JSON
      let result: T;
      try {
        result = JSON.parse(processedContent, this.config.reviver);
      } catch (parseError) {
        const enhancedError = this.enhanceParseError(parseError as Error, content);
        return failure(enhancedError);
      }

      return success(result);
    } catch (error) {
      return failure(
        new ApicizeError(ApicizeErrorCode.PARSE_ERROR, 'Failed to parse JSON content', {
          cause: error as Error,
        })
      );
    }
  }

  /**
   * Parse JSON with location information
   */
  parseWithLocation<T = unknown>(
    content: string
  ): Result<
    {
      data: T;
      locations: Record<string, ParseLocation>;
    },
    ApicizeError
  > {
    // Note: This is a simplified implementation.
    // A full implementation would require a custom JSON parser that tracks positions.
    const parseResult = this.parse<T>(content);
    if (parseResult.isFailure()) {
      return parseResult as any;
    }

    // For now, return empty locations - would need custom parser for full implementation
    const locations: Record<string, ParseLocation> = {};

    return success({
      data: parseResult.data,
      locations,
    });
  }

  /**
   * Validate JSON syntax without parsing
   */
  validateSyntax(content: string): Result<boolean, ApicizeError> {
    try {
      JSON.parse(content);
      return success(true);
    } catch (error) {
      const enhancedError = this.enhanceParseError(error as Error, content);
      return failure(enhancedError);
    }
  }

  /**
   * Stringify with formatting
   */
  stringify(
    data: unknown,
    options?: {
      indent?: number;
      sortKeys?: boolean;
    }
  ): Result<string, ApicizeError> {
    try {
      const indent = options?.indent ?? this.config.indentSize;
      let replacer = this.config.replacer;

      // Handle key sorting
      if (options?.sortKeys) {
        replacer = (key: string, value: any) => {
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            const sortedObj: any = {};
            Object.keys(value)
              .sort()
              .forEach(sortedKey => {
                sortedObj[sortedKey] = value[sortedKey];
              });
            return sortedObj;
          }
          return this.config.replacer ? this.config.replacer(key, value) : value;
        };
      }

      const result = JSON.stringify(data, replacer as any, indent);
      return success(result);
    } catch (error) {
      return failure(
        new ApicizeError(ApicizeErrorCode.PARSE_ERROR, 'Failed to stringify data to JSON', {
          cause: error as Error,
          context: { dataType: typeof data },
        })
      );
    }
  }

  /**
   * Minify JSON string
   */
  minify(content: string): Result<string, ApicizeError> {
    const parseResult = this.parse(content);
    if (parseResult.isFailure()) {
      return parseResult as any;
    }

    return this.stringify(parseResult.data, { indent: 0 });
  }

  /**
   * Format JSON string with indentation
   */
  format(content: string, indent?: number): Result<string, ApicizeError> {
    const parseResult = this.parse(content);
    if (parseResult.isFailure()) {
      return parseResult as any;
    }

    const options: { indent?: number; sortKeys: boolean } = {
      sortKeys: this.config.preserveOrder ? false : true,
    };
    if (indent !== undefined) {
      options.indent = indent;
    } else if (this.config.indentSize !== undefined) {
      options.indent = this.config.indentSize;
    }
    return this.stringify(parseResult.data, options);
  }

  /**
   * Extract specific value from JSON using JSONPath-like syntax
   */
  extractValue(content: string, path: string): Result<unknown, ApicizeError> {
    const parseResult = this.parse(content);
    if (parseResult.isFailure()) {
      return parseResult as any;
    }

    try {
      const pathParts = path.split('.');
      let current = parseResult.data;

      for (const part of pathParts) {
        if (part === '') continue; // Skip empty parts from leading dots

        // Handle array indices
        const arrayMatch = part.match(/^(.+)\[(\d+)\]$/);
        if (arrayMatch) {
          const [, key, index] = arrayMatch;
          current = (current as any)[key];
          if (Array.isArray(current)) {
            current = current[parseInt(index, 10)];
          } else {
            return failure(
              new ApicizeError(
                ApicizeErrorCode.INVALID_ARGUMENT,
                `Cannot access array index on non-array at path: ${key}`,
                { context: { path, key, valueType: typeof current } }
              )
            );
          }
        } else {
          if (current && typeof current === 'object') {
            current = (current as any)[part];
          } else {
            return failure(
              new ApicizeError(
                ApicizeErrorCode.INVALID_ARGUMENT,
                `Cannot access property '${part}' on non-object`,
                { context: { path, part, valueType: typeof current } }
              )
            );
          }
        }

        if (current === undefined) {
          return failure(
            new ApicizeError(ApicizeErrorCode.NOT_FOUND, `Value not found at path: ${path}`, {
              context: { path, lastValidPart: part },
            })
          );
        }
      }

      return success(current);
    } catch (error) {
      return failure(
        new ApicizeError(
          ApicizeErrorCode.PARSE_ERROR,
          `Failed to extract value from path: ${path}`,
          {
            cause: error as Error,
            context: { path },
          }
        )
      );
    }
  }

  /**
   * Merge two JSON objects
   */
  merge(target: string, source: string): Result<string, ApicizeError> {
    const targetResult = this.parse(target);
    if (targetResult.isFailure()) {
      return targetResult as any;
    }

    const sourceResult = this.parse(source);
    if (sourceResult.isFailure()) {
      return sourceResult as any;
    }

    try {
      const merged = this.deepMerge(targetResult.data, sourceResult.data);
      return this.stringify(merged);
    } catch (error) {
      return failure(
        new ApicizeError(ApicizeErrorCode.PARSE_ERROR, 'Failed to merge JSON objects', {
          cause: error as Error,
        })
      );
    }
  }

  // Private helper methods

  private removeComments(content: string): string {
    // Remove single-line comments
    content = content.replace(/\/\/.*$/gm, '');

    // Remove multi-line comments
    content = content.replace(/\/\*[\s\S]*?\*\//g, '');

    return content;
  }

  private removeTrailingCommas(content: string): string {
    // Remove trailing commas in objects and arrays
    return content
      .replace(/,(\s*})/g, '$1') // Remove trailing comma before }
      .replace(/,(\s*\])/g, '$1'); // Remove trailing comma before ]
  }

  private validateDepth(content: string): Result<void, ApicizeError> {
    let depth = 0;
    let maxDepth = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = 0; i < content.length; i++) {
      const char = content[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\' && inString) {
        escapeNext = true;
        continue;
      }

      if (char === '"' && !escapeNext) {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === '{' || char === '[') {
          depth++;
          maxDepth = Math.max(maxDepth, depth);
        } else if (char === '}' || char === ']') {
          depth--;
        }
      }
    }

    if (maxDepth > this.config.maxDepth!) {
      return failure(
        new ApicizeError(
          ApicizeErrorCode.VALIDATION_ERROR,
          `JSON depth (${maxDepth}) exceeds maximum allowed depth (${this.config.maxDepth})`,
          { context: { actualDepth: maxDepth, maxDepth: this.config.maxDepth } }
        )
      );
    }

    return success(undefined);
  }

  private enhanceParseError(error: Error, content: string): ApicizeError {
    let line = 1;
    let column = 1;

    // Try to extract line/column from error message
    const lineMatch = error.message.match(/line (\d+)/i);
    const columnMatch = error.message.match(/column (\d+)/i);
    const positionMatch = error.message.match(/position (\d+)/i);

    if (lineMatch) {
      line = parseInt(lineMatch[1], 10);
    }

    if (columnMatch) {
      column = parseInt(columnMatch[1], 10);
    } else if (positionMatch) {
      // Calculate line/column from position
      const position = parseInt(positionMatch[1], 10);
      const beforePosition = content.substring(0, position);
      line = (beforePosition.match(/\n/g) || []).length + 1;
      column = position - beforePosition.lastIndexOf('\n');
    }

    return new ApicizeError(ApicizeErrorCode.INVALID_JSON, `JSON parse error: ${error.message}`, {
      cause: error,
      context: {
        line,
        column,
        parseError: error.message,
      },
      suggestions: [
        'Check for syntax errors in the JSON',
        'Validate JSON format using a JSON validator',
        'Ensure proper escaping of special characters',
        `Check line ${line}, column ${column}`,
      ],
    });
  }

  private deepMerge(target: any, source: any): any {
    if (source === null || source === undefined) {
      return target;
    }

    if (Array.isArray(source)) {
      return source;
    }

    if (typeof source !== 'object') {
      return source;
    }

    const result = Array.isArray(target) ? [] : { ...target };

    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        if (
          typeof source[key] === 'object' &&
          source[key] !== null &&
          !Array.isArray(source[key]) &&
          typeof target[key] === 'object' &&
          target[key] !== null &&
          !Array.isArray(target[key])
        ) {
          result[key] = this.deepMerge(target[key], source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }

    return result;
  }

  /**
   * Create a copy with different configuration
   */
  withConfig(newConfig: Partial<JsonParserConfig>): ApicizeJsonParser {
    return new ApicizeJsonParser({ ...this.config, ...newConfig });
  }

  /**
   * Get current configuration
   */
  getConfig(): JsonParserConfig {
    return { ...this.config };
  }
}
