/**
 * Variable Substitutor - Responsible for variable substitution in configurations
 */

import { Result, success, failure } from '../../infrastructure/result';
import { ApicizeError, ApicizeErrorCode } from '../../infrastructure/errors';
import {
  VariableSubstitutor as IVariableSubstitutor,
  VariableContext,
  VariableSource,
} from '../../domain/configuration/configuration-domain';

/**
 * Variable substitutor configuration
 */
export interface VariableSubstitutorConfig {
  enableStrictMode?: boolean;
  allowUnknownVariables?: boolean;
  maxSubstitutionDepth?: number;
  warningCallback?: (message: string) => void;
}

/**
 * Built-in environment variable source
 */
export class EnvironmentVariableSource implements VariableSource {
  async getValue(key: string): Promise<string | undefined> {
    return process.env[key];
  }

  async hasKey(key: string): Promise<boolean> {
    return key in process.env;
  }

  async getAllKeys(): Promise<string[]> {
    return Object.keys(process.env);
  }
}

/**
 * Base URL variable source
 */
export class BaseUrlVariableSource implements VariableSource {
  constructor(private context: VariableContext) {}

  async getValue(key: string): Promise<string | undefined> {
    return this.context.environment?.baseUrls?.[key];
  }

  async hasKey(key: string): Promise<boolean> {
    return !!this.context.environment?.baseUrls?.[key];
  }

  async getAllKeys(): Promise<string[]> {
    return Object.keys(this.context.environment?.baseUrls || {});
  }
}

/**
 * Custom variables source
 */
export class CustomVariableSource implements VariableSource {
  constructor(private variables: Record<string, string>) {}

  async getValue(key: string): Promise<string | undefined> {
    return this.variables[key];
  }

  async hasKey(key: string): Promise<boolean> {
    return key in this.variables;
  }

  async getAllKeys(): Promise<string[]> {
    return Object.keys(this.variables);
  }
}

/**
 * Variable substitutor implementation
 */
export class ApicizeVariableSubstitutor implements IVariableSubstitutor {
  private config: VariableSubstitutorConfig;
  private variableSources = new Map<string, VariableSource>();

  constructor(config: VariableSubstitutorConfig = {}) {
    this.config = {
      enableStrictMode: false,
      allowUnknownVariables: true,
      maxSubstitutionDepth: 10,
      warningCallback: message => console.warn(message),
      ...config,
    };

    // Add default environment variable source
    this.variableSources.set('env', new EnvironmentVariableSource());
  }

  /**
   * Substitute variables in any value
   */
  async substitute(
    value: unknown,
    context?: VariableContext
  ): Promise<Result<unknown, ApicizeError>> {
    try {
      return await this.substituteRecursive(value, context, 0);
    } catch (error) {
      return failure(
        new ApicizeError(
          ApicizeErrorCode.VARIABLE_SUBSTITUTION_ERROR,
          'Failed to substitute variables',
          { cause: error as Error, context: { value, context } }
        )
      );
    }
  }

  /**
   * Substitute variables in a string
   */
  async substituteString(
    str: string,
    context?: VariableContext
  ): Promise<Result<string, ApicizeError>> {
    try {
      const result = await this.processString(str, context || {});
      return result;
    } catch (error) {
      return failure(
        new ApicizeError(
          ApicizeErrorCode.VARIABLE_SUBSTITUTION_ERROR,
          'Failed to substitute variables in string',
          {
            cause: error as Error,
            context: { string: str, context },
          }
        )
      );
    }
  }

  /**
   * Add variable source
   */
  addVariableSource(name: string, source: VariableSource): void {
    this.variableSources.set(name, source);
  }

  /**
   * Remove variable source
   */
  removeVariableSource(name: string): boolean {
    return this.variableSources.delete(name);
  }

  /**
   * Get all variable sources
   */
  getVariableSources(): Map<string, VariableSource> {
    return new Map(this.variableSources);
  }

  /**
   * Setup context-specific variable sources
   */
  setupContextSources(context: VariableContext): void {
    // Add baseUrls source if environment is available
    if (context.environment) {
      this.variableSources.set('baseUrls', new BaseUrlVariableSource(context));
    }

    // Add custom variables source if available
    if (context.customVariables) {
      this.variableSources.set('custom', new CustomVariableSource(context.customVariables));
    }
  }

  // Private helper methods

  private async substituteRecursive(
    value: unknown,
    context: VariableContext = {},
    depth: number
  ): Promise<Result<unknown, ApicizeError>> {
    if (depth > this.config.maxSubstitutionDepth!) {
      return failure(
        new ApicizeError(
          ApicizeErrorCode.VARIABLE_SUBSTITUTION_ERROR,
          `Maximum substitution depth (${this.config.maxSubstitutionDepth}) exceeded`,
          { context: { value, depth } }
        )
      );
    }

    if (typeof value === 'string') {
      return await this.processString(value, context);
    } else if (Array.isArray(value)) {
      const results: unknown[] = [];
      for (const item of value) {
        const result = await this.substituteRecursive(item, context, depth + 1);
        if (result.isFailure()) {
          return result;
        }
        results.push(result.data);
      }
      return success(results);
    } else if (value && typeof value === 'object') {
      const result: any = {};
      for (const [key, val] of Object.entries(value)) {
        const substitutedResult = await this.substituteRecursive(val, context, depth + 1);
        if (substitutedResult.isFailure()) {
          return substitutedResult;
        }
        result[key] = substitutedResult.data;
      }
      return success(result);
    }

    return success(value);
  }

  private async processString(
    str: string,
    context: VariableContext
  ): Promise<Result<string, ApicizeError>> {
    const variablePattern = /\$\{([^}]+)\}/g;
    let result = str;
    let match;
    const processedVariables = new Set<string>();

    // Setup context-specific sources
    this.setupContextSources(context);

    while ((match = variablePattern.exec(str)) !== null) {
      const fullMatch = match[0];
      const expression = match[1];

      // Prevent infinite loops
      if (processedVariables.has(fullMatch)) {
        continue;
      }
      processedVariables.add(fullMatch);

      const substitutionResult = await this.processVariable(expression, context);
      if (substitutionResult.isFailure()) {
        if (this.config.enableStrictMode) {
          return substitutionResult;
        } else {
          // In non-strict mode, just log warning and continue
          this.config.warningCallback?.(substitutionResult.error.message);
          continue;
        }
      }

      const substitutedValue = substitutionResult.data;
      if (substitutedValue !== undefined) {
        result = result.replace(fullMatch, substitutedValue);
      } else if (!this.config.allowUnknownVariables) {
        return failure(
          new ApicizeError(
            ApicizeErrorCode.VARIABLE_NOT_FOUND,
            `Variable not found: ${expression}`,
            { context: { expression, originalString: str } }
          )
        );
      }
    }

    return success(result);
  }

  private async processVariable(
    expression: string,
    _context: VariableContext
  ): Promise<Result<string, ApicizeError>> {
    try {
      const [sourceName, key] = this.parseVariableExpression(expression);

      if (!key) {
        return failure(
          new ApicizeError(
            ApicizeErrorCode.VARIABLE_SUBSTITUTION_ERROR,
            `Invalid variable expression: ${expression}`,
            { context: { expression } }
          )
        );
      }

      const source = this.variableSources.get(sourceName);
      if (!source) {
        return failure(
          new ApicizeError(
            ApicizeErrorCode.VARIABLE_SOURCE_NOT_FOUND,
            `Variable source not found: ${sourceName}`,
            {
              context: {
                sourceName,
                expression,
                availableSources: Array.from(this.variableSources.keys()),
              },
            }
          )
        );
      }

      const value = await source.getValue(key);
      if (value === undefined) {
        return failure(
          new ApicizeError(
            ApicizeErrorCode.VARIABLE_NOT_FOUND,
            `Variable not found: ${key} in source ${sourceName}`,
            { context: { sourceName, key, expression } }
          )
        );
      }

      return success(value);
    } catch (error) {
      return failure(
        new ApicizeError(
          ApicizeErrorCode.VARIABLE_SUBSTITUTION_ERROR,
          `Failed to process variable: ${expression}`,
          {
            cause: error as Error,
            context: { expression },
          }
        )
      );
    }
  }

  private parseVariableExpression(expression: string): [string, string] {
    const parts = expression.split('.');
    if (parts.length < 2) {
      return ['custom', expression]; // Default to custom variables
    }

    const sourceName = parts[0];
    const key = parts.slice(1).join('.');
    return [sourceName, key];
  }

  /**
   * Validate variable expression syntax
   */
  validateExpression(expression: string): Result<boolean, ApicizeError> {
    try {
      const variablePattern = /^\$\{([^}]+)\}$/;
      if (!variablePattern.test(expression)) {
        return failure(
          new ApicizeError(
            ApicizeErrorCode.VALIDATION_ERROR,
            `Invalid variable expression syntax: ${expression}`,
            {
              context: { expression },
              suggestions: ['Use ${source.key} format', 'Ensure no spaces in expression'],
            }
          )
        );
      }

      const match = expression.match(variablePattern);
      if (!match) {
        return failure(
          new ApicizeError(
            ApicizeErrorCode.VALIDATION_ERROR,
            `Failed to parse variable expression: ${expression}`,
            { context: { expression } }
          )
        );
      }

      const [sourceName, key] = this.parseVariableExpression(match[1]);
      if (!key) {
        return failure(
          new ApicizeError(
            ApicizeErrorCode.VALIDATION_ERROR,
            `Variable expression missing key: ${expression}`,
            { context: { expression, sourceName } }
          )
        );
      }

      return success(true);
    } catch (error) {
      return failure(
        new ApicizeError(
          ApicizeErrorCode.VALIDATION_ERROR,
          `Failed to validate variable expression: ${expression}`,
          {
            cause: error as Error,
            context: { expression },
          }
        )
      );
    }
  }

  /**
   * Get all variables from all sources
   */
  async getAllVariables(
    context?: VariableContext
  ): Promise<Result<Record<string, Record<string, string>>, ApicizeError>> {
    try {
      if (context) {
        this.setupContextSources(context);
      }

      const allVariables: Record<string, Record<string, string>> = {};

      for (const [sourceName, source] of this.variableSources) {
        try {
          const keys = await source.getAllKeys();
          const sourceVariables: Record<string, string> = {};

          for (const key of keys) {
            const value = await source.getValue(key);
            if (value !== undefined) {
              sourceVariables[key] = value;
            }
          }

          allVariables[sourceName] = sourceVariables;
        } catch (error) {
          // Log warning but continue with other sources
          this.config.warningCallback?.(
            `Failed to get variables from source '${sourceName}': ${(error as Error).message}`
          );
        }
      }

      return success(allVariables);
    } catch (error) {
      return failure(
        new ApicizeError(
          ApicizeErrorCode.VARIABLE_SUBSTITUTION_ERROR,
          'Failed to get all variables',
          { cause: error as Error }
        )
      );
    }
  }

  /**
   * Create a copy with different configuration
   */
  withConfig(newConfig: Partial<VariableSubstitutorConfig>): ApicizeVariableSubstitutor {
    const newSubstitutor = new ApicizeVariableSubstitutor({ ...this.config, ...newConfig });

    // Copy variable sources
    for (const [name, source] of this.variableSources) {
      newSubstitutor.addVariableSource(name, source);
    }

    return newSubstitutor;
  }

  /**
   * Get current configuration
   */
  getConfig(): VariableSubstitutorConfig {
    return { ...this.config };
  }
}
