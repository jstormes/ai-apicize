import { ValidationError } from '../../shared/DomainError';
import { Result } from '../../shared/Result';
import { TestName } from './TestName';

/**
 * Value object representing patterns used to identify request-specific tests
 */
export class RequestPattern {
  private constructor(
    private readonly _pattern: RegExp,
    private readonly _name: string,
    private readonly _description: string
  ) {}

  /**
   * Creates a RequestPattern from a regular expression
   */
  static create(
    pattern: RegExp,
    name: string,
    description: string
  ): Result<RequestPattern, ValidationError> {
    if (!(pattern instanceof RegExp)) {
      return Result.fail(
        new ValidationError('INVALID_PATTERN', 'Pattern must be a valid RegExp', {
          pattern: String(pattern),
        })
      );
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return Result.fail(
        new ValidationError('INVALID_PATTERN_NAME', 'Pattern name must be a non-empty string', {
          name,
        })
      );
    }

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return Result.fail(
        new ValidationError(
          'INVALID_PATTERN_DESCRIPTION',
          'Pattern description must be a non-empty string',
          {
            description,
          }
        )
      );
    }

    return Result.ok(new RequestPattern(pattern, name.trim(), description.trim()));
  }

  /**
   * Creates a RequestPattern from a string pattern
   */
  static fromString(
    patternString: string,
    flags: string = 'i',
    name: string,
    description: string
  ): Result<RequestPattern, ValidationError> {
    try {
      const regex = new RegExp(patternString, flags);
      return this.create(regex, name, description);
    } catch (error) {
      return Result.fail(
        new ValidationError('INVALID_REGEX_PATTERN', 'Invalid regular expression pattern', {
          pattern: patternString,
          flags,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  /**
   * Creates predefined patterns for common request-related test names
   */
  static createDefaultPatterns(): RequestPattern[] {
    const patterns = [
      {
        pattern: /\b(request|api|http|endpoint|service|call)\b/i,
        name: 'general-request-keywords',
        description: 'Matches test names containing general request-related keywords',
      },
      {
        pattern: /\b(get|post|put|patch|delete|head|options)\b/i,
        name: 'http-methods',
        description: 'Matches test names containing HTTP method names',
      },
      {
        pattern: /\b(response|status|body|headers?)\b/i,
        name: 'response-keywords',
        description: 'Matches test names containing response-related keywords',
      },
      {
        pattern: /\b(fetch|axios|curl|client)\b/i,
        name: 'client-keywords',
        description: 'Matches test names containing HTTP client keywords',
      },
      {
        pattern: /\b(rest|graphql|grpc|soap)\b/i,
        name: 'protocol-keywords',
        description: 'Matches test names containing API protocol keywords',
      },
      {
        pattern: /\b(auth|token|bearer|oauth|jwt)\b/i,
        name: 'authentication-keywords',
        description: 'Matches test names containing authentication keywords',
      },
    ];

    return patterns
      .map(({ pattern, name, description }) => this.create(pattern, name, description))
      .filter(Result.isOk)
      .map(result => result.data);
  }

  /**
   * Gets the regular expression pattern
   */
  get pattern(): RegExp {
    return this._pattern;
  }

  /**
   * Gets the pattern name
   */
  get name(): string {
    return this._name;
  }

  /**
   * Gets the pattern description
   */
  get description(): string {
    return this._description;
  }

  /**
   * Tests if the pattern matches a test name
   */
  matches(testName: TestName): boolean {
    return this._pattern.test(testName.value);
  }

  /**
   * Tests if the pattern matches a string
   */
  matchesString(text: string): boolean {
    return this._pattern.test(text);
  }

  /**
   * Gets all matches from a string
   */
  findMatches(text: string): RegExpMatchArray[] {
    const globalPattern = new RegExp(
      this._pattern.source,
      this._pattern.flags.includes('g') ? this._pattern.flags : this._pattern.flags + 'g'
    );
    return Array.from(text.matchAll(globalPattern));
  }

  /**
   * Creates a new pattern with additional flags
   */
  withFlags(flags: string): Result<RequestPattern, ValidationError> {
    return RequestPattern.fromString(this._pattern.source, flags, this._name, this._description);
  }

  /**
   * Creates a new pattern with case-sensitive matching
   */
  caseSensitive(): Result<RequestPattern, ValidationError> {
    const newFlags = this._pattern.flags.replace('i', '');
    return this.withFlags(newFlags);
  }

  /**
   * Creates a new pattern with case-insensitive matching
   */
  caseInsensitive(): Result<RequestPattern, ValidationError> {
    const newFlags = this._pattern.flags.includes('i')
      ? this._pattern.flags
      : this._pattern.flags + 'i';
    return this.withFlags(newFlags);
  }

  /**
   * Combines this pattern with another using OR logic
   */
  or(other: RequestPattern): Result<RequestPattern, ValidationError> {
    const combinedPattern = `(${this._pattern.source})|(${other._pattern.source})`;
    const combinedFlags = this._pattern.flags;
    const combinedName = `${this._name}-or-${other._name}`;
    const combinedDescription = `${this._description} OR ${other._description}`;

    return RequestPattern.fromString(
      combinedPattern,
      combinedFlags,
      combinedName,
      combinedDescription
    );
  }

  /**
   * Combines this pattern with another using AND logic (both must match)
   */
  and(other: RequestPattern): Result<RequestPattern, ValidationError> {
    const combinedPattern = `(?=.*${this._pattern.source})(?=.*${other._pattern.source})`;
    const combinedFlags = this._pattern.flags;
    const combinedName = `${this._name}-and-${other._name}`;
    const combinedDescription = `${this._description} AND ${other._description}`;

    return RequestPattern.fromString(
      combinedPattern,
      combinedFlags,
      combinedName,
      combinedDescription
    );
  }

  /**
   * Creates a negated version of this pattern
   */
  not(): Result<RequestPattern, ValidationError> {
    const negatedPattern = `^(?!.*${this._pattern.source}).*$`;
    const negatedName = `not-${this._name}`;
    const negatedDescription = `NOT ${this._description}`;

    return RequestPattern.fromString(
      negatedPattern,
      this._pattern.flags,
      negatedName,
      negatedDescription
    );
  }

  /**
   * Value object equality
   */
  equals(other: RequestPattern): boolean {
    return (
      this._pattern.source === other._pattern.source &&
      this._pattern.flags === other._pattern.flags &&
      this._name === other._name
    );
  }

  /**
   * String representation
   */
  toString(): string {
    return `${this._name}: ${this._pattern.toString()}`;
  }

  /**
   * JSON serialization
   */
  toJSON(): {
    pattern: string;
    flags: string;
    name: string;
    description: string;
  } {
    return {
      pattern: this._pattern.source,
      flags: this._pattern.flags,
      name: this._name,
      description: this._description,
    };
  }
}
