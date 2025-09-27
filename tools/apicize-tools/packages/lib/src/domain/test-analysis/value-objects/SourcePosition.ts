import { ValidationError } from '../../shared/DomainError';
import { Result } from '../../shared/Result';

/**
 * Value object representing a position in source code
 */
export class SourcePosition {
  private constructor(
    private readonly _start: number,
    private readonly _end: number,
    private readonly _lineNumber: number
  ) {}

  /**
   * Creates a SourcePosition with validation
   */
  static create(start: number, end: number, lineNumber?: number): Result<SourcePosition, ValidationError> {
    // Validate start position
    if (!Number.isInteger(start) || start < 0) {
      return Result.fail(
        new ValidationError('INVALID_START_POSITION', 'Start position must be a non-negative integer', {
          start,
        })
      );
    }

    // Validate end position
    if (!Number.isInteger(end) || end < 0) {
      return Result.fail(
        new ValidationError('INVALID_END_POSITION', 'End position must be a non-negative integer', {
          end,
        })
      );
    }

    // Validate position relationship
    if (end < start) {
      return Result.fail(
        new ValidationError('INVALID_POSITION_RANGE', 'End position must be greater than or equal to start position', {
          start,
          end,
        })
      );
    }

    // Validate line number if provided
    const validLineNumber = lineNumber ?? this.calculateLineNumber(start);
    if (!Number.isInteger(validLineNumber) || validLineNumber < 1) {
      return Result.fail(
        new ValidationError('INVALID_LINE_NUMBER', 'Line number must be a positive integer', {
          lineNumber: validLineNumber,
        })
      );
    }

    return Result.ok(new SourcePosition(start, end, validLineNumber));
  }

  /**
   * Creates a SourcePosition for a single character
   */
  static createSingle(position: number, lineNumber?: number): Result<SourcePosition, ValidationError> {
    return this.create(position, position, lineNumber);
  }

  /**
   * Creates a SourcePosition spanning multiple lines
   */
  static createSpan(
    startPosition: number,
    endPosition: number,
    startLine?: number
  ): Result<SourcePosition, ValidationError> {
    return this.create(startPosition, endPosition, startLine);
  }

  /**
   * Gets the start position
   */
  get start(): number {
    return this._start;
  }

  /**
   * Gets the end position
   */
  get end(): number {
    return this._end;
  }

  /**
   * Gets the line number
   */
  get lineNumber(): number {
    return this._lineNumber;
  }

  /**
   * Gets the length of the position range
   */
  get length(): number {
    return this._end - this._start;
  }

  /**
   * Checks if this is a single-character position
   */
  get isSingleCharacter(): boolean {
    return this._start === this._end;
  }

  /**
   * Checks if this position contains another position
   */
  contains(other: SourcePosition): boolean {
    return this._start <= other._start && this._end >= other._end;
  }

  /**
   * Checks if this position overlaps with another position
   */
  overlaps(other: SourcePosition): boolean {
    return this._start < other._end && this._end > other._start;
  }

  /**
   * Checks if this position is adjacent to another position
   */
  isAdjacentTo(other: SourcePosition): boolean {
    return this._end === other._start || this._start === other._end;
  }

  /**
   * Gets the distance between this position and another
   */
  distanceTo(other: SourcePosition): number {
    if (this.overlaps(other)) {
      return 0;
    }
    return Math.min(
      Math.abs(this._start - other._end),
      Math.abs(this._end - other._start)
    );
  }

  /**
   * Creates a new position that spans from this position to another
   */
  spanTo(other: SourcePosition): Result<SourcePosition, ValidationError> {
    const newStart = Math.min(this._start, other._start);
    const newEnd = Math.max(this._end, other._end);
    const newLineNumber = Math.min(this._lineNumber, other._lineNumber);

    return SourcePosition.create(newStart, newEnd, newLineNumber);
  }

  /**
   * Creates a new position offset by the given amount
   */
  offset(amount: number): Result<SourcePosition, ValidationError> {
    return SourcePosition.create(
      this._start + amount,
      this._end + amount,
      this._lineNumber
    );
  }

  /**
   * Extracts the text from the given source content
   */
  extractText(sourceContent: string): string {
    if (this._start >= sourceContent.length) {
      return '';
    }

    const safeEnd = Math.min(this._end, sourceContent.length);
    return sourceContent.substring(this._start, safeEnd);
  }

  /**
   * Gets context around this position from the source content
   */
  getContext(sourceContent: string, contextLines = 2): {
    before: string;
    content: string;
    after: string;
    lineRange: { start: number; end: number };
  } {
    const lines = sourceContent.split('\n');
    const currentLine = this._lineNumber - 1; // Convert to 0-based index

    const startLine = Math.max(0, currentLine - contextLines);
    const endLine = Math.min(lines.length - 1, currentLine + contextLines);

    const before = lines.slice(startLine, currentLine).join('\n');
    const content = this.extractText(sourceContent);
    const after = lines.slice(currentLine + 1, endLine + 1).join('\n');

    return {
      before,
      content,
      after,
      lineRange: { start: startLine + 1, end: endLine + 1 }, // Convert back to 1-based
    };
  }

  /**
   * Value object equality
   */
  equals(other: SourcePosition): boolean {
    return (
      this._start === other._start &&
      this._end === other._end &&
      this._lineNumber === other._lineNumber
    );
  }

  /**
   * String representation
   */
  toString(): string {
    if (this.isSingleCharacter) {
      return `${this._start}:${this._lineNumber}`;
    }
    return `${this._start}-${this._end}:${this._lineNumber}`;
  }

  /**
   * JSON serialization
   */
  toJSON(): { start: number; end: number; lineNumber: number; length: number } {
    return {
      start: this._start,
      end: this._end,
      lineNumber: this._lineNumber,
      length: this.length,
    };
  }

  /**
   * Helper method to calculate line number from position (simplified)
   */
  private static calculateLineNumber(position: number): number {
    // This is a simplified implementation
    // In a real implementation, you'd need the source content to count newlines
    return 1;
  }
}