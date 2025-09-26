import { Scenario, Variable, VariableType } from '../types';

/**
 * Variable substitution context for tracking variable sources
 */
export interface VariableContext {
  scenario?: Scenario;
  outputs?: Record<string, unknown>;
  environmentVars?: Record<string, string>;
  csvData?: Record<string, unknown>[];
  jsonData?: Record<string, unknown>;
  currentRowIndex?: number;
}

/**
 * Variable resolution result
 */
export interface VariableResolution {
  value: unknown;
  source: 'scenario' | 'output' | 'environment' | 'csv' | 'json' | 'not_found';
  variableName: string;
}

/**
 * Variable Engine for Apicize tools
 * Handles {{variable}} substitution in strings, objects, and arrays
 */
export class VariableEngine {
  private context: VariableContext;
  private warnings: string[] = [];

  constructor(context: VariableContext = {}) {
    this.context = {
      outputs: {},
      environmentVars: process.env as Record<string, string>,
      ...context,
    };
  }

  /**
   * Update the variable context
   */
  updateContext(context: Partial<VariableContext>): void {
    this.context = { ...this.context, ...context };
    this.clearWarnings();
  }

  /**
   * Set scenario for variable resolution
   */
  setScenario(scenario: Scenario): void {
    this.context.scenario = scenario;
    this.clearWarnings();
  }

  /**
   * Set output variables from previous test executions
   */
  setOutputs(outputs: Record<string, unknown>): void {
    this.context.outputs = outputs;
  }

  /**
   * Add a single output variable
   */
  addOutput(key: string, value: unknown): void {
    if (!this.context.outputs) {
      this.context.outputs = {};
    }
    this.context.outputs[key] = value;
  }

  /**
   * Set CSV data for iteration
   */
  setCsvData(data: Record<string, unknown>[], currentRowIndex: number = 0): void {
    this.context.csvData = data;
    this.context.currentRowIndex = currentRowIndex;
  }

  /**
   * Set JSON data for variable resolution
   */
  setJsonData(data: Record<string, unknown>): void {
    this.context.jsonData = data;
  }

  /**
   * Substitute variables in a value (string, object, or array)
   */
  substitute(value: unknown): unknown {
    if (typeof value === 'string') {
      return this.substituteString(value);
    } else if (Array.isArray(value)) {
      return value.map(item => this.substitute(item));
    } else if (value && typeof value === 'object') {
      const result: any = {};
      for (const [key, val] of Object.entries(value)) {
        result[key] = this.substitute(val);
      }
      return result;
    }
    return value;
  }

  /**
   * Substitute variables in a string using {{variable}} syntax
   */
  substituteString(str: string): string {
    return str.replace(/\{\{([^}]+)\}\}/g, (match, variableName) => {
      const trimmedName = variableName.trim();
      const resolution = this.resolveVariable(trimmedName);

      if (resolution.source === 'not_found') {
        const warning = `Variable not found: ${trimmedName}`;
        this.addWarning(warning);
        console.warn(warning);
        return match; // Return original if not found
      }

      // Convert value to string for substitution
      return this.valueToString(resolution.value);
    });
  }

  /**
   * Resolve a variable from all available sources
   */
  resolveVariable(variableName: string): VariableResolution {
    // 1. Check outputs first (from previous test executions)
    if (this.context.outputs && variableName in this.context.outputs) {
      return {
        value: this.context.outputs[variableName],
        source: 'output',
        variableName,
      };
    }

    // 2. Check scenario variables
    if (this.context.scenario?.variables) {
      const scenarioVar = this.context.scenario.variables.find(
        v => v.name === variableName && !v.disabled
      );
      if (scenarioVar) {
        const value = this.resolveScenarioVariable(scenarioVar);
        return {
          value,
          source: 'scenario',
          variableName,
        };
      }
    }

    // 3. Check CSV data (current row)
    if (this.context.csvData && this.context.currentRowIndex !== undefined) {
      const currentRow = this.context.csvData[this.context.currentRowIndex];
      if (currentRow && variableName in currentRow) {
        return {
          value: currentRow[variableName],
          source: 'csv',
          variableName,
        };
      }
    }

    // 4. Check JSON data
    if (this.context.jsonData && variableName in this.context.jsonData) {
      return {
        value: this.context.jsonData[variableName],
        source: 'json',
        variableName,
      };
    }

    // 5. Check environment variables
    if (this.context.environmentVars && variableName in this.context.environmentVars) {
      return {
        value: this.context.environmentVars[variableName],
        source: 'environment',
        variableName,
      };
    }

    // Variable not found
    return {
      value: undefined,
      source: 'not_found',
      variableName,
    };
  }

  /**
   * Resolve a scenario variable based on its type
   */
  private resolveScenarioVariable(variable: Variable): unknown {
    switch (variable.type) {
      case VariableType.TEXT:
        return variable.value;

      case VariableType.JSON:
        try {
          return JSON.parse(variable.value);
        } catch (error) {
          this.addWarning(`Invalid JSON in variable ${variable.name}: ${variable.value}`);
          return variable.value; // Return as string if JSON parsing fails
        }

      case VariableType.FILE_JSON:
      case VariableType.FILE_CSV:
        // File variables should be resolved by external data loading
        // For now, return the file path
        this.addWarning(`File variable ${variable.name} requires external data loading`);
        return variable.value;

      default:
        return variable.value;
    }
  }

  /**
   * Convert a value to string for substitution
   */
  private valueToString(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }

  /**
   * Get all available variables from current context
   */
  getAvailableVariables(): Record<string, VariableResolution> {
    const variables: Record<string, VariableResolution> = {};

    // Add outputs
    if (this.context.outputs) {
      for (const [name, value] of Object.entries(this.context.outputs)) {
        variables[name] = {
          value,
          source: 'output',
          variableName: name,
        };
      }
    }

    // Add scenario variables
    if (this.context.scenario?.variables) {
      for (const variable of this.context.scenario.variables) {
        if (!variable.disabled) {
          variables[variable.name] = {
            value: this.resolveScenarioVariable(variable),
            source: 'scenario',
            variableName: variable.name,
          };
        }
      }
    }

    // Add CSV data (current row)
    if (this.context.csvData && this.context.currentRowIndex !== undefined) {
      const currentRow = this.context.csvData[this.context.currentRowIndex];
      if (currentRow) {
        for (const [name, value] of Object.entries(currentRow)) {
          if (!(name in variables)) { // Don't override higher priority variables
            variables[name] = {
              value,
              source: 'csv',
              variableName: name,
            };
          }
        }
      }
    }

    // Add JSON data
    if (this.context.jsonData) {
      for (const [name, value] of Object.entries(this.context.jsonData)) {
        if (!(name in variables)) { // Don't override higher priority variables
          variables[name] = {
            value,
            source: 'json',
            variableName: name,
          };
        }
      }
    }

    // Add environment variables (lowest priority)
    if (this.context.environmentVars) {
      for (const [name, value] of Object.entries(this.context.environmentVars)) {
        if (!(name in variables)) { // Don't override higher priority variables
          variables[name] = {
            value,
            source: 'environment',
            variableName: name,
          };
        }
      }
    }

    return variables;
  }

  /**
   * Check if a string contains any variables
   */
  hasVariables(str: string): boolean {
    return /\{\{[^}]+\}\}/.test(str);
  }

  /**
   * Extract all variable names from a string
   */
  extractVariableNames(str: string): string[] {
    const matches = str.match(/\{\{([^}]+)\}\}/g);
    if (!matches) return [];

    return matches.map(match => {
      const variableName = match.slice(2, -2).trim();
      return variableName;
    });
  }

  /**
   * Get all warnings generated during variable resolution
   */
  getWarnings(): string[] {
    return [...this.warnings];
  }

  /**
   * Clear all warnings
   */
  clearWarnings(): void {
    this.warnings = [];
  }

  /**
   * Add a warning message
   */
  private addWarning(message: string): void {
    if (!this.warnings.includes(message)) {
      this.warnings.push(message);
    }
  }

  /**
   * Get current context
   */
  getContext(): VariableContext {
    return { ...this.context };
  }

  /**
   * Create a copy of the engine with the same context
   */
  clone(): VariableEngine {
    const clonedContext = {
      ...this.context,
    };
    // Deep clone outputs to avoid shared references
    if (clonedContext.outputs) {
      clonedContext.outputs = { ...clonedContext.outputs };
    }
    return new VariableEngine(clonedContext);
  }

  /**
   * Create engine with CSV row data for iteration
   */
  withCsvRow(rowIndex: number): VariableEngine {
    const newEngine = this.clone();
    newEngine.context.currentRowIndex = rowIndex;
    return newEngine;
  }

  /**
   * Preview substitution without actually performing it
   */
  previewSubstitution(value: unknown): {
    result: unknown;
    variables: Record<string, VariableResolution>;
    warnings: string[];
  } {
    const engine = this.clone();
    const result = engine.substitute(value);

    // Extract variables that would be used
    const usedVariables: Record<string, VariableResolution> = {};
    if (typeof value === 'string') {
      const variableNames = engine.extractVariableNames(value);
      for (const name of variableNames) {
        usedVariables[name] = engine.resolveVariable(name);
      }
    }

    return {
      result,
      variables: usedVariables,
      warnings: engine.getWarnings(),
    };
  }
}