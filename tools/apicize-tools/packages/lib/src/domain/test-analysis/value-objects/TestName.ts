import { ValidationError } from '../../shared/DomainError';
import { Result } from '../../shared/Result';

/**
 * Value object representing a test name with validation rules
 */
export class TestName {
  private constructor(private readonly _value: string) {}

  /**
   * Creates a TestName from a string value
   */
  static create(value: string): Result<TestName, ValidationError> {
    if (!value || typeof value !== 'string') {
      return Result.fail(
        new ValidationError('INVALID_TEST_NAME', 'Test name must be a non-empty string', {
          value,
        })
      );
    }

    const trimmedValue = value.trim();
    if (trimmedValue.length === 0) {
      return Result.fail(
        new ValidationError('EMPTY_TEST_NAME', 'Test name cannot be empty or whitespace', {
          value,
        })
      );
    }

    if (trimmedValue.length > 200) {
      return Result.fail(
        new ValidationError('TEST_NAME_TOO_LONG', 'Test name cannot exceed 200 characters', {
          value,
          length: trimmedValue.length,
        })
      );
    }

    // Check for invalid characters that might break test runners
    const invalidChars = /[<>:"\\|?*\x00-\x1f]/;
    if (invalidChars.test(trimmedValue)) {
      return Result.fail(
        new ValidationError(
          'INVALID_TEST_NAME_CHARACTERS',
          'Test name contains invalid characters',
          {
            value,
            invalidPattern: invalidChars.toString(),
          }
        )
      );
    }

    return Result.ok(new TestName(trimmedValue));
  }

  /**
   * Gets the string value of the test name
   */
  get value(): string {
    return this._value;
  }

  /**
   * Checks if this test name matches a pattern
   */
  matches(pattern: RegExp): boolean {
    return pattern.test(this._value);
  }

  /**
   * Checks if this test name contains a substring (case-insensitive)
   */
  contains(substring: string): boolean {
    return this._value.toLowerCase().includes(substring.toLowerCase());
  }

  /**
   * Checks if this test name starts with a prefix (case-insensitive)
   */
  startsWith(prefix: string): boolean {
    return this._value.toLowerCase().startsWith(prefix.toLowerCase());
  }

  /**
   * Checks if this test name ends with a suffix (case-insensitive)
   */
  endsWith(suffix: string): boolean {
    return this._value.toLowerCase().endsWith(suffix.toLowerCase());
  }

  /**
   * Returns a normalized version of the test name for comparison
   */
  normalized(): string {
    return this._value.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  /**
   * Checks if this test name suggests it's request-specific
   */
  suggestsRequestSpecific(): boolean {
    const requestKeywords = ['request', 'api', 'http', 'endpoint', 'service', 'call'];
    const normalized = this.normalized();

    return requestKeywords.some(keyword => normalized.includes(keyword));
  }

  /**
   * Value object equality
   */
  equals(other: TestName): boolean {
    return this._value === other._value;
  }

  /**
   * String representation
   */
  toString(): string {
    return this._value;
  }

  /**
   * JSON serialization
   */
  toJSON(): string {
    return this._value;
  }
}
