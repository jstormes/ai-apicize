/**
 * Structure Validator - Responsible for validating workbook structure
 */

import { ApicizeWorkbook } from '../../types';
import { Result, success, failure } from '../../infrastructure/result';
import { ApicizeValidationError, ApicizeError } from '../../infrastructure/errors';
import { StructureValidator as IStructureValidator } from '../../domain/parsing/parsing-domain';
import { ApicizeValidator } from '../../validation/validator';

/**
 * Structure validator configuration
 */
export interface StructureValidatorConfig {
  enableStrictValidation?: boolean;
  allowUnknownProperties?: boolean;
  validateReferences?: boolean;
  maxValidationErrors?: number;
  customValidationRules?: Map<string, (data: unknown) => Result<boolean, ApicizeError>>;
}

/**
 * Validation rule interface
 */
export interface ValidationRule {
  name: string;
  description: string;
  validate: (data: unknown) => Result<boolean, ApicizeValidationError>;
}

/**
 * Validation context
 */
export interface ValidationContext {
  path: string;
  parent?: unknown;
  root: unknown;
  depth: number;
}

/**
 * Enhanced validation error with context
 */
export interface StructureValidationError {
  code: string;
  message: string;
  path: string;
  value?: unknown;
  suggestions?: string[];
}

/**
 * Structure validator implementation
 */
export class ApicizeStructureValidator implements IStructureValidator {
  private config: StructureValidatorConfig;
  private validator: ApicizeValidator;
  private customRules: Map<string, (data: unknown) => Result<boolean, ApicizeError>>;

  constructor(config: StructureValidatorConfig = {}) {
    this.config = {
      enableStrictValidation: true,
      allowUnknownProperties: false,
      validateReferences: true,
      maxValidationErrors: 100,
      customValidationRules: new Map(),
      ...config,
    };

    this.validator = new ApicizeValidator();
    this.customRules = new Map(this.config.customValidationRules);
  }

  /**
   * Validate workbook structure
   */
  validateWorkbook(data: unknown): Result<ApicizeWorkbook, ApicizeValidationError> {
    try {
      const errors: StructureValidationError[] = [];

      // Basic type validation
      if (!data || typeof data !== 'object') {
        return failure(
          new ApicizeValidationError('Workbook data must be an object', {
            field: 'root',
            value: data,
            rule: 'must be an object',
          })
        );
      }

      const workbook = data as any;

      // Use existing validator for schema validation
      const schemaValidation = this.validator.validateApicizeFile(data);
      if (!schemaValidation.valid) {
        const schemaErrors = schemaValidation.errors.map(error => ({
          code: 'SCHEMA_VALIDATION',
          message: error.message,
          path: (error as any).instancePath || 'root',
          suggestions: ['Check the structure against the .apicize schema'],
        }));

        if (this.config.enableStrictValidation) {
          return failure(
            new ApicizeValidationError(
              `Schema validation failed: ${schemaErrors.map(e => e.message).join('; ')}`,
              {
                field: 'structure',
                value: data,
                rule: 'must conform to .apicize schema',
                context: { errors: schemaErrors },
              }
            )
          );
        } else {
          errors.push(...schemaErrors);
        }
      }

      // Additional structural validations
      this.validateVersion(workbook, errors);
      this.validateRequests(workbook, errors);

      if (this.config.validateReferences) {
        this.validateReferences(workbook, errors);
      }

      // Apply custom validation rules
      this.applyCustomRules(workbook, errors);

      // Check if we have too many errors
      if (errors.length > this.config.maxValidationErrors!) {
        return failure(
          new ApicizeValidationError(
            `Too many validation errors (${errors.length} > ${this.config.maxValidationErrors})`,
            {
              field: 'structure',
              value: data,
              rule: 'must have fewer validation errors',
              context: { errorCount: errors.length, maxErrors: this.config.maxValidationErrors },
            }
          )
        );
      }

      // Return errors if in strict mode and we have any
      if (this.config.enableStrictValidation && errors.length > 0) {
        return failure(
          new ApicizeValidationError(
            `Validation failed: ${errors.map(e => e.message).join('; ')}`,
            {
              field: 'structure',
              value: data,
              rule: 'must pass all validation checks',
              context: { errors },
            }
          )
        );
      }

      return success(workbook as ApicizeWorkbook);
    } catch (error) {
      return failure(
        new ApicizeValidationError('Failed to validate workbook structure', {
          field: 'structure',
          value: data,
          rule: 'must be a valid structure',
          cause: error as Error,
        })
      );
    }
  }

  /**
   * Validate partial structure
   */
  validatePartial(data: unknown, schema: string): Result<boolean, ApicizeValidationError> {
    try {
      // For now, use the main validator for partial validation
      // In a full implementation, this would support validating specific schema sections
      const isValid = this.validator.validateApicizeFile(data);
      if (!isValid.valid) {
        return failure(
          new ApicizeValidationError(`Partial validation failed for schema '${schema}'`, {
            field: schema,
            value: data,
            rule: `must conform to ${schema} schema`,
            context: { errors: isValid.errors },
          })
        );
      }

      return success(true);
    } catch (error) {
      return failure(
        new ApicizeValidationError(`Failed to validate partial structure for schema '${schema}'`, {
          field: schema,
          value: data,
          rule: 'must be valid',
          cause: error as Error,
        })
      );
    }
  }

  /**
   * Get validation schema
   */
  getSchema(schemaName: string): Result<object, ApicizeValidationError> {
    try {
      // Return the internal schema used by the validator
      // In a full implementation, this would return specific sub-schemas
      const schema = {
        name: schemaName,
        type: 'object',
        description: `Schema for ${schemaName}`,
        // This would contain the actual JSON schema
      };

      return success(schema);
    } catch (error) {
      return failure(
        new ApicizeValidationError(`Failed to get schema '${schemaName}'`, {
          field: 'schema',
          value: schemaName,
          rule: 'must be a valid schema name',
          cause: error as Error,
        })
      );
    }
  }

  /**
   * Add custom validation rule
   */
  addCustomRule(name: string, rule: (data: unknown) => Result<boolean, ApicizeError>): void {
    this.customRules.set(name, rule);
  }

  /**
   * Remove custom validation rule
   */
  removeCustomRule(name: string): boolean {
    return this.customRules.delete(name);
  }

  /**
   * Get all custom rules
   */
  getCustomRules(): Map<string, (data: unknown) => Result<boolean, ApicizeError>> {
    return new Map(this.customRules);
  }

  // Private validation methods

  private validateVersion(workbook: any, errors: StructureValidationError[]): void {
    if (!workbook.version) {
      errors.push({
        code: 'MISSING_VERSION',
        message: 'Workbook version is required',
        path: 'version',
        suggestions: ['Add version field with value 1.0'],
      });
    } else if (workbook.version !== 1.0) {
      errors.push({
        code: 'INVALID_VERSION',
        message: `Unsupported version: ${workbook.version}`,
        path: 'version',
        value: workbook.version,
        suggestions: ['Use version 1.0'],
      });
    }
  }

  private validateRequests(workbook: any, errors: StructureValidationError[]): void {
    if (!workbook.requests) {
      errors.push({
        code: 'MISSING_REQUESTS',
        message: 'Requests array is required',
        path: 'requests',
        suggestions: ['Add requests array'],
      });
      return;
    }

    if (!Array.isArray(workbook.requests)) {
      errors.push({
        code: 'INVALID_REQUESTS_TYPE',
        message: 'Requests must be an array',
        path: 'requests',
        value: typeof workbook.requests,
        suggestions: ['Change requests to an array'],
      });
      return;
    }

    // Validate individual requests/groups
    workbook.requests.forEach((item: any, index: number) => {
      this.validateRequestOrGroup(item, `requests[${index}]`, errors);
    });
  }

  private validateRequestOrGroup(
    item: any,
    path: string,
    errors: StructureValidationError[]
  ): void {
    if (!item || typeof item !== 'object') {
      errors.push({
        code: 'INVALID_REQUEST_TYPE',
        message: 'Request/Group must be an object',
        path,
        value: typeof item,
        suggestions: ['Ensure each item in requests is an object'],
      });
      return;
    }

    // Check for required ID
    if (!item.id || typeof item.id !== 'string') {
      errors.push({
        code: 'MISSING_ID',
        message: 'Request/Group must have a string ID',
        path: `${path}.id`,
        value: item.id,
        suggestions: ['Add a unique string ID'],
      });
    }

    // Check for required name
    if (!item.name || typeof item.name !== 'string') {
      errors.push({
        code: 'MISSING_NAME',
        message: 'Request/Group must have a string name',
        path: `${path}.name`,
        value: item.name,
        suggestions: ['Add a descriptive name'],
      });
    }

    // Determine if it's a request or group
    if ('url' in item && 'method' in item) {
      // It's a request
      this.validateRequest(item, path, errors);
    } else if ('children' in item) {
      // It's a group
      this.validateRequestGroup(item, path, errors);
    } else {
      errors.push({
        code: 'AMBIGUOUS_REQUEST_TYPE',
        message: 'Item must be either a request (with url/method) or group (with children)',
        path,
        suggestions: ['Add url/method for request or children for group'],
      });
    }
  }

  private validateRequest(request: any, path: string, errors: StructureValidationError[]): void {
    // Validate URL
    if (!request.url || typeof request.url !== 'string') {
      errors.push({
        code: 'INVALID_URL',
        message: 'Request must have a valid URL string',
        path: `${path}.url`,
        value: request.url,
        suggestions: ['Provide a valid URL string'],
      });
    }

    // Validate method
    const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
    if (!request.method || !validMethods.includes(request.method)) {
      errors.push({
        code: 'INVALID_METHOD',
        message: `Request method must be one of: ${validMethods.join(', ')}`,
        path: `${path}.method`,
        value: request.method,
        suggestions: [`Use one of: ${validMethods.join(', ')}`],
      });
    }

    // Validate optional timeout
    if (
      request.timeout !== undefined &&
      (typeof request.timeout !== 'number' || request.timeout < 0)
    ) {
      errors.push({
        code: 'INVALID_TIMEOUT',
        message: 'Timeout must be a positive number',
        path: `${path}.timeout`,
        value: request.timeout,
        suggestions: ['Use a positive number in milliseconds'],
      });
    }
  }

  private validateRequestGroup(group: any, path: string, errors: StructureValidationError[]): void {
    // Validate children
    if (!Array.isArray(group.children)) {
      errors.push({
        code: 'INVALID_CHILDREN',
        message: 'Group children must be an array',
        path: `${path}.children`,
        value: typeof group.children,
        suggestions: ['Change children to an array'],
      });
      return;
    }

    // Validate each child
    group.children.forEach((child: any, index: number) => {
      this.validateRequestOrGroup(child, `${path}.children[${index}]`, errors);
    });
  }

  private validateReferences(workbook: any, errors: StructureValidationError[]): void {
    // Collect all IDs
    const allIds = new Set<string>();
    const duplicateIds = new Set<string>();

    const collectIds = (items: any[], basePath: string) => {
      items.forEach((item, index) => {
        if (item && item.id) {
          if (allIds.has(item.id)) {
            duplicateIds.add(item.id);
          } else {
            allIds.add(item.id);
          }
        }

        if (item && item.children && Array.isArray(item.children)) {
          collectIds(item.children, `${basePath}[${index}].children`);
        }
      });
    };

    // Collect IDs from requests
    if (workbook.requests && Array.isArray(workbook.requests)) {
      collectIds(workbook.requests, 'requests');
    }

    // Collect IDs from other sections
    ['scenarios', 'authorizations', 'certificates', 'proxies', 'data'].forEach(section => {
      if (workbook[section] && Array.isArray(workbook[section])) {
        workbook[section].forEach((item: any, _index: number) => {
          if (item && item.id) {
            if (allIds.has(item.id)) {
              duplicateIds.add(item.id);
            } else {
              allIds.add(item.id);
            }
          }
        });
      }
    });

    // Report duplicate IDs
    if (duplicateIds.size > 0) {
      errors.push({
        code: 'DUPLICATE_IDS',
        message: `Duplicate IDs found: ${Array.from(duplicateIds).join(', ')}`,
        path: 'ids',
        suggestions: ['Ensure all IDs are unique across the workbook'],
      });
    }

    // Validate references in defaults
    if (workbook.defaults) {
      this.validateDefaultReferences(workbook.defaults, allIds, errors);
    }
  }

  private validateDefaultReferences(
    defaults: any,
    allIds: Set<string>,
    errors: StructureValidationError[]
  ): void {
    const referenceFields = [
      'selectedAuthorization',
      'selectedCertificate',
      'selectedProxy',
      'selectedScenario',
    ];

    referenceFields.forEach(field => {
      const ref = defaults[field];
      if (ref && ref.id && !allIds.has(ref.id)) {
        errors.push({
          code: 'INVALID_REFERENCE',
          message: `Invalid reference in defaults.${field}: ${ref.id}`,
          path: `defaults.${field}.id`,
          value: ref.id,
          suggestions: ['Use a valid ID that exists in the workbook'],
        });
      }
    });
  }

  private applyCustomRules(workbook: any, errors: StructureValidationError[]): void {
    for (const [name, rule] of this.customRules) {
      try {
        const result = rule(workbook);
        if (result.isFailure()) {
          errors.push({
            code: `CUSTOM_RULE_${name.toUpperCase()}`,
            message: `Custom rule '${name}' failed: ${result.error.message}`,
            path: 'root',
            suggestions: [`Fix issues related to custom rule: ${name}`],
          });
        }
      } catch (error) {
        errors.push({
          code: 'CUSTOM_RULE_ERROR',
          message: `Custom rule '${name}' threw an error: ${(error as Error).message}`,
          path: 'root',
          suggestions: ['Check the custom rule implementation'],
        });
      }
    }
  }

  /**
   * Create a copy with different configuration
   */
  withConfig(newConfig: Partial<StructureValidatorConfig>): ApicizeStructureValidator {
    return new ApicizeStructureValidator({ ...this.config, ...newConfig });
  }

  /**
   * Get current configuration
   */
  getConfig(): StructureValidatorConfig {
    return { ...this.config };
  }
}
