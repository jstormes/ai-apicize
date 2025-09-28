/**
 * Base class for all domain errors
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;
  abstract readonly category: 'validation' | 'business' | 'infrastructure';

  constructor(
    message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      category: this.category,
      context: this.context,
    };
  }
}

/**
 * Domain validation errors
 */
export class ValidationError extends DomainError {
  readonly category = 'validation' as const;

  constructor(
    public readonly code: string,
    message: string,
    context?: Record<string, unknown>
  ) {
    super(message, context);
  }
}

/**
 * Business rule violation errors
 */
export class BusinessRuleError extends DomainError {
  readonly category = 'business' as const;

  constructor(
    public readonly code: string,
    message: string,
    context?: Record<string, unknown>
  ) {
    super(message, context);
  }
}

/**
 * Infrastructure-related domain errors
 */
export class InfrastructureError extends DomainError {
  readonly category = 'infrastructure' as const;

  constructor(
    public readonly code: string,
    message: string,
    context?: Record<string, unknown>
  ) {
    super(message, context);
  }
}
