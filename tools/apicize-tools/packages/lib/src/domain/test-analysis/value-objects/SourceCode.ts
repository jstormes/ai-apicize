import { ValidationError } from '../../shared/DomainError';
import { Result } from '../../shared/Result';

/**
 * Value object representing source code with behavior and validation
 */
export class SourceCode {
  private constructor(
    private readonly _content: string,
    private readonly _language: CodeLanguage = CodeLanguage.TypeScript
  ) {}

  /**
   * Creates a SourceCode instance with validation
   */
  static create(
    content: string,
    language: CodeLanguage = CodeLanguage.TypeScript
  ): Result<SourceCode, ValidationError> {
    if (typeof content !== 'string') {
      return Result.fail(
        new ValidationError('INVALID_SOURCE_CONTENT', 'Source code must be a string', {
          content: typeof content,
        })
      );
    }

    // Allow empty content for valid use cases
    if (content.length > 1000000) {
      // 1MB limit
      return Result.fail(
        new ValidationError('SOURCE_CODE_TOO_LARGE', 'Source code exceeds maximum size limit', {
          size: content.length,
          limit: 1000000,
        })
      );
    }

    return Result.ok(new SourceCode(content, language));
  }

  /**
   * Creates SourceCode from a template with parameters
   */
  static fromTemplate(
    template: string,
    parameters: Record<string, string>
  ): Result<SourceCode, ValidationError> {
    let content = template;

    for (const [key, value] of Object.entries(parameters)) {
      const placeholder = `{{${key}}}`;
      content = content.replace(new RegExp(placeholder, 'g'), value);
    }

    // Check for remaining unresolved placeholders
    const unresolvedPlaceholders = content.match(/\{\{[^}]+\}\}/g);
    if (unresolvedPlaceholders) {
      return Result.fail(
        new ValidationError(
          'UNRESOLVED_TEMPLATE_PLACEHOLDERS',
          'Template contains unresolved placeholders',
          {
            placeholders: unresolvedPlaceholders,
          }
        )
      );
    }

    return this.create(content);
  }

  /**
   * Gets the raw content
   */
  get content(): string {
    return this._content;
  }

  /**
   * Gets the raw content (alias for compatibility)
   */
  get value(): string {
    return this._content;
  }

  /**
   * Gets the programming language
   */
  get language(): CodeLanguage {
    return this._language;
  }

  /**
   * Gets the number of lines in the code
   */
  get lineCount(): number {
    if (this._content === '') {
      return 0;
    }
    return this._content.split('\n').length;
  }

  /**
   * Gets the number of characters
   */
  get characterCount(): number {
    return this._content.length;
  }

  /**
   * Checks if the code is empty or whitespace-only
   */
  get isEmpty(): boolean {
    return this._content.trim() === '';
  }

  /**
   * Gets all lines as an array
   */
  getLines(): string[] {
    if (this._content === '') {
      return [];
    }
    return this._content.split('\n');
  }

  /**
   * Gets a specific line (1-based indexing)
   */
  getLine(lineNumber: number): string | undefined {
    const lines = this.getLines();
    return lines[lineNumber - 1];
  }

  /**
   * Gets a range of lines (1-based indexing, inclusive)
   */
  getLineRange(startLine: number, endLine: number): string[] {
    const lines = this.getLines();
    const start = Math.max(0, startLine - 1);
    const end = Math.min(lines.length, endLine);
    return lines.slice(start, end);
  }

  /**
   * Checks if the code contains specific patterns
   */
  contains(pattern: string | RegExp): boolean {
    if (typeof pattern === 'string') {
      return this._content.includes(pattern);
    }
    return pattern.test(this._content);
  }

  /**
   * Finds all matches of a pattern
   */
  findMatches(pattern: RegExp): RegExpMatchArray[] {
    const globalPattern = new RegExp(
      pattern.source,
      pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g'
    );
    return Array.from(this._content.matchAll(globalPattern));
  }

  /**
   * Extracts function calls from the code
   */
  extractFunctionCalls(): string[] {
    const functionCallPattern = /(\w+)\s*\(/g;
    const matches = this.findMatches(functionCallPattern);
    return matches.map(match => match[1]).filter(Boolean);
  }

  /**
   * Extracts import statements
   */
  extractImports(): ImportStatement[] {
    const importPattern = /import\s+(?:\{([^}]+)\}|(\w+)|\*\s+as\s+(\w+))\s+from\s+['"](.*?)['"]/g;
    const matches = this.findMatches(importPattern);

    return matches.map(match => ({
      namedImports: match[1] ? match[1].split(',').map(s => s.trim()) : [],
      defaultImport: match[2] || undefined,
      namespaceImport: match[3] || undefined,
      module: match[4],
      fullStatement: match[0],
    }));
  }

  /**
   * Checks if the code appears to be test code
   */
  looksLikeTestCode(): boolean {
    const testPatterns = [
      /\bdescribe\s*\(/,
      /\bit\s*\(/,
      /\btest\s*\(/,
      /\bexpect\s*\(/,
      /\bassert\./,
      /\.to\.(equal|be|have)\b/,
    ];

    return testPatterns.some(pattern => this.contains(pattern));
  }

  /**
   * Checks if the code contains async/await patterns
   */
  hasAsyncPatterns(): boolean {
    return this.contains(/\basync\b/) || this.contains(/\bawait\b/);
  }

  /**
   * Extracts variable declarations
   */
  extractVariableDeclarations(): VariableDeclaration[] {
    const variablePattern = /\b(const|let|var)\s+(\w+)(?:\s*:\s*([^=]+))?\s*=\s*([^;]+)/g;
    const matches = this.findMatches(variablePattern);

    return matches.map(match => ({
      kind: match[1] as 'const' | 'let' | 'var',
      name: match[2],
      type: match[3]?.trim(),
      initializer: match[4]?.trim(),
    }));
  }

  /**
   * Gets the indentation level of the first non-empty line
   */
  getBaseIndentation(): number {
    const lines = this.getLines();
    for (const line of lines) {
      if (line.trim()) {
        const match = line.match(/^(\s*)/);
        return match ? match[1].length : 0;
      }
    }
    return 0;
  }

  /**
   * Normalizes indentation (removes common leading whitespace)
   */
  normalizeIndentation(): SourceCode {
    const lines = this.getLines();
    const baseIndentation = this.getBaseIndentation();

    const normalizedLines = lines.map(line => {
      if (line.trim() === '') {
        return '';
      }
      return line.substring(baseIndentation);
    });

    return new SourceCode(normalizedLines.join('\n'), this._language);
  }

  /**
   * Formats the code with basic indentation
   */
  format(indentSize = 2): SourceCode {
    // This is a simplified formatter - in practice, you'd use a real formatter
    const lines = this.getLines();
    let indentLevel = 0;
    const indent = ' '.repeat(indentSize);

    const formattedLines = lines.map(line => {
      const trimmed = line.trim();
      if (!trimmed) {
        return '';
      }

      // Decrease indent for closing braces
      if (trimmed.startsWith('}')) {
        indentLevel = Math.max(0, indentLevel - 1);
      }

      const formattedLine = indent.repeat(indentLevel) + trimmed;

      // Increase indent for opening braces
      if (trimmed.endsWith('{')) {
        indentLevel++;
      }

      return formattedLine;
    });

    return new SourceCode(formattedLines.join('\n'), this._language);
  }

  /**
   * Appends code to this source code
   */
  append(other: SourceCode): SourceCode {
    const newContent = this._content + '\n' + other._content;
    return new SourceCode(newContent, this._language);
  }

  /**
   * Prepends code to this source code
   */
  prepend(other: SourceCode): SourceCode {
    const newContent = other._content + '\n' + this._content;
    return new SourceCode(newContent, this._language);
  }

  /**
   * Value object equality
   */
  equals(other: SourceCode): boolean {
    return this._content === other._content && this._language === other._language;
  }

  /**
   * String representation
   */
  toString(): string {
    return this._content;
  }

  /**
   * JSON serialization
   */
  toJSON(): { content: string; language: string; lineCount: number; characterCount: number } {
    return {
      content: this._content,
      language: this._language,
      lineCount: this.lineCount,
      characterCount: this.characterCount,
    };
  }
}

/**
 * Enumeration of supported programming languages
 */
export enum CodeLanguage {
  TypeScript = 'typescript',
  JavaScript = 'javascript',
  JSON = 'json',
  Markdown = 'markdown',
}

/**
 * Interface for import statements
 */
export interface ImportStatement {
  namedImports: string[];
  defaultImport?: string;
  namespaceImport?: string;
  module: string;
  fullStatement: string;
}

/**
 * Interface for variable declarations
 */
export interface VariableDeclaration {
  kind: 'const' | 'let' | 'var';
  name: string;
  type?: string;
  initializer?: string;
}
