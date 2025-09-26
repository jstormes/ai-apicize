import Ajv, { ErrorObject, ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { ApicizeWorkbook } from '../types';
import apicizeSchema from '../schemas/apicize.schema.json';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  path: string;
  message: string;
  keyword: string;
  params: any;
  schemaPath: string;
}

export class ApicizeValidator {
  private ajv: Ajv;
  private validateFunction: ValidateFunction<ApicizeWorkbook>;

  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
      strict: false,
      allowUnionTypes: true
    });

    addFormats(this.ajv);

    this.validateFunction = this.ajv.compile<ApicizeWorkbook>(apicizeSchema);
  }

  /**
   * Validates an .apicize file data structure
   * @param data The parsed JSON data from an .apicize file
   * @returns ValidationResult with detailed error reporting
   */
  validateApicizeFile(data: unknown): ValidationResult {
    const valid = this.validateFunction(data as ApicizeWorkbook);

    if (valid) {
      return {
        valid: true,
        errors: []
      };
    }

    const errors = this.formatErrors(this.validateFunction.errors || []);
    return {
      valid: false,
      errors
    };
  }

  /**
   * Validates and type guards an .apicize file
   * @param data The parsed JSON data
   * @throws Error with detailed validation messages if invalid
   */
  assertValidApicizeFile(data: unknown): asserts data is ApicizeWorkbook {
    const result = this.validateApicizeFile(data);
    if (!result.valid) {
      const errorMessage = this.formatErrorMessage(result.errors);
      throw new Error(`Invalid .apicize file:\n${errorMessage}`);
    }
  }

  /**
   * Format AJV errors into more readable format
   */
  private formatErrors(ajvErrors: ErrorObject[]): ValidationError[] {
    return ajvErrors.map(error => ({
      path: error.instancePath || '/',
      message: this.getHumanReadableMessage(error),
      keyword: error.keyword,
      params: error.params,
      schemaPath: error.schemaPath
    }));
  }

  /**
   * Convert AJV error to human-readable message
   */
  private getHumanReadableMessage(error: ErrorObject): string {
    const path = error.instancePath || 'root';

    switch (error.keyword) {
      case 'required':
        return `Missing required property '${error.params.missingProperty}' at ${path}`;

      case 'enum':
        return `Value at ${path} must be one of: ${error.params.allowedValues.join(', ')}`;

      case 'type':
        return `Value at ${path} must be of type ${error.params.type}`;

      case 'pattern':
        return `Value at ${path} must match pattern ${error.params.pattern}`;

      case 'additionalProperties':
        return `Unknown property '${error.params.additionalProperty}' at ${path}`;

      case 'oneOf':
        return `Value at ${path} must match exactly one of the allowed schemas`;

      case 'minimum':
      case 'maximum':
        return `Value at ${path} must be ${error.keyword} ${error.params.limit}`;

      default:
        return error.message || `Validation error at ${path}`;
    }
  }

  /**
   * Format multiple errors into a single message
   */
  private formatErrorMessage(errors: ValidationError[]): string {
    return errors
      .map((error, index) => `  ${index + 1}. ${error.message}`)
      .join('\n');
  }

  /**
   * Validate a specific section of the .apicize file
   */
  validateSection(sectionName: keyof ApicizeWorkbook, data: unknown): ValidationResult {
    const sectionSchema = (apicizeSchema.properties as any)[sectionName];

    if (!sectionSchema) {
      return {
        valid: false,
        errors: [{
          path: `/${sectionName}`,
          message: `Unknown section '${sectionName}'`,
          keyword: 'unknown',
          params: {},
          schemaPath: ''
        }]
      };
    }

    const validateSection = this.ajv.compile(sectionSchema);
    const valid = validateSection(data);

    if (valid) {
      return { valid: true, errors: [] };
    }

    return {
      valid: false,
      errors: this.formatErrors(validateSection.errors || [])
    };
  }

  /**
   * Get the JSON schema for reference
   */
  getSchema() {
    return apicizeSchema;
  }
}

/**
 * Convenience function to validate an .apicize file
 */
export function validateApicizeFile(data: unknown): ValidationResult {
  const validator = new ApicizeValidator();
  return validator.validateApicizeFile(data);
}

/**
 * Convenience function to assert valid .apicize file
 */
export function assertValidApicizeFile(data: unknown): asserts data is ApicizeWorkbook {
  const validator = new ApicizeValidator();
  return validator.assertValidApicizeFile(data);
}