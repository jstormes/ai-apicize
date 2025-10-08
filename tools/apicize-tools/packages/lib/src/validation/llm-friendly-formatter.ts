/**
 * LLM-friendly error formatting for validation errors
 * Provides clear, actionable error messages with examples
 */

import { ValidationError } from './validator';

export interface LLMFormattedError {
  path: string;
  message: string;
  example?: string;
  fix?: string;
}

export class LLMFriendlyFormatter {
  /**
   * Format validation errors in an LLM-friendly way
   */
  formatErrors(errors: ValidationError[]): string {
    if (errors.length === 0) {
      return '✓ No errors found';
    }

    const formatted = errors.map((error, index) => {
      return this.formatSingleError(error, index + 1);
    });

    const summary = `\n❌ Found ${errors.length} error${errors.length > 1 ? 's' : ''}\n`;
    return summary + '\n' + formatted.join('\n\n---\n\n');
  }

  /**
   * Format a single validation error
   */
  private formatSingleError(error: ValidationError, errorNum: number): string {
    const { path, keyword, params } = error;

    let message = `Error #${errorNum} at: ${path || 'root'}\n\n`;

    switch (keyword) {
      case 'required':
        message += this.formatRequiredError(path, params);
        break;
      case 'enum':
        message += this.formatEnumError(path, params, error);
        break;
      case 'type':
        message += this.formatTypeError(path, params);
        break;
      case 'additionalProperties':
        message += this.formatAdditionalPropertiesError(path, params);
        break;
      case 'pattern':
        message += this.formatPatternError(path, params);
        break;
      case 'minimum':
      case 'maximum':
        message += this.formatRangeError(path, keyword, params);
        break;
      case 'oneOf':
      case 'anyOf':
        message += this.formatOneOfError(path, keyword, params);
        break;
      default:
        message += `❌ Validation failed: ${error.message}\n`;
    }

    // Add contextual examples
    const example = this.getExampleForPath(path, keyword, params);
    if (example) {
      message += `\n📝 Example:\n${example}\n`;
    }

    return message;
  }

  private formatRequiredError(_path: string, params: any): string {
    const field = params.missingProperty;
    let message = `❌ Missing required field: '${field}'\n\n`;

    message += `Fix: Add this field to your JSON:\n`;
    message += `"${field}": <value>\n`;

    return message;
  }

  private formatEnumError(path: string, params: any, _error: ValidationError): string {
    const allowed = params.allowedValues;
    let message = `❌ Invalid value for enumeration\n\n`;

    message += `Allowed values:\n`;
    allowed.forEach((val: any) => {
      message += `  - "${val}"\n`;
    });

    // Try to detect common mistakes
    if (path.includes('method')) {
      message += `\n💡 Tip: HTTP methods must be UPPERCASE (e.g., "GET", not "get")\n`;
    }

    return message;
  }

  private formatTypeError(_path: string, params: any): string {
    const expectedType = params.type;
    let message = `❌ Wrong data type\n\n`;

    message += `Expected type: ${expectedType}\n`;

    if (expectedType === 'object') {
      message += `\nFix: Use {} for objects, not null or primitives\n`;
    } else if (expectedType === 'array') {
      message += `\nFix: Use [] for arrays, not null or objects\n`;
    } else if (expectedType === 'string') {
      message += `\nFix: Wrap value in quotes "like this"\n`;
    } else if (expectedType === 'number' || expectedType === 'integer') {
      message += `\nFix: Use numeric value without quotes (e.g., 30000, not "30000")\n`;
    }

    return message;
  }

  private formatAdditionalPropertiesError(_path: string, params: any): string {
    const additionalProperty = params.additionalProperty;
    let message = `❌ Unexpected field: '${additionalProperty}'\n\n`;

    message += `This field is not allowed at this location.\n`;
    message += `\nFix: Remove this field or check spelling\n`;

    return message;
  }

  private formatPatternError(_path: string, params: any): string {
    const pattern = params.pattern;
    let message = `❌ Value doesn't match required pattern\n\n`;

    message += `Pattern: ${pattern}\n`;

    return message;
  }

  private formatRangeError(_path: string, keyword: string, params: any): string {
    const limit = params.limit;
    let message = `❌ Value out of range\n\n`;

    if (keyword === 'minimum') {
      message += `Value must be >= ${limit}\n`;
    } else {
      message += `Value must be <= ${limit}\n`;
    }

    return message;
  }

  private formatOneOfError(path: string, _keyword: string, _params: any): string {
    let message = `❌ Value doesn't match any allowed schema\n\n`;

    if (path.includes('body')) {
      message += `Body must be one of:\n`;
      message += `  - {type: "None"}\n`;
      message += `  - {type: "JSON", data: {...}}\n`;
      message += `  - {type: "Text", data: "string"}\n`;
      message += `  - {type: "XML", data: "string"}\n`;
      message += `  - {type: "Form", data: [{name: "...", value: "..."}]}\n`;
      message += `  - {type: "Raw", data: "base64..."}\n`;
    }

    return message;
  }

  /**
   * Get contextual examples based on the error path
   */
  private getExampleForPath(path: string, keyword: string, _params: any): string | null {
    // Body examples
    if (path.includes('/body')) {
      return this.getBodyExample();
    }

    // Request examples
    if (path.includes('/requests') && keyword === 'required') {
      return this.getRequestExample();
    }

    // Scenario examples
    if (path.includes('/scenarios')) {
      return this.getScenarioExample();
    }

    // Method examples
    if (path.includes('/method')) {
      return this.getMethodExample();
    }

    // Headers examples
    if (path.includes('/headers')) {
      return this.getHeaderExample();
    }

    // Test code examples
    if (path.includes('/test')) {
      return this.getTestExample();
    }

    return null;
  }

  private getBodyExample(): string {
    return `
// JSON body
{
  "type": "JSON",
  "data": {
    "username": "admin",
    "password": "pass123"
  }
}

// No body
{
  "type": "None"
}

// Text body
{
  "type": "Text",
  "data": "Plain text content"
}`;
  }

  private getRequestExample(): string {
    return `
{
  "id": "req-001",
  "name": "Get Users",
  "url": "{{baseUrl}}/users",
  "method": "GET",
  "timeout": 30000,
  "headers": [],
  "queryStringParams": [],
  "test": "describe('Get Users', () => {\\n  it('should return 200', () => {\\n    expect(response.status).to.equal(200);\\n  });\\n});"
}`;
  }

  private getScenarioExample(): string {
    return `
{
  "id": "dev",
  "name": "Development",
  "variables": [
    {
      "name": "baseUrl",
      "value": "http://localhost:3000",
      "type": "TEXT"
    },
    {
      "name": "apiKey",
      "value": "test-key-123",
      "type": "TEXT"
    }
  ]
}`;
  }

  private getMethodExample(): string {
    return `
Valid HTTP methods (UPPERCASE):
  - "GET"
  - "POST"
  - "PUT"
  - "DELETE"
  - "PATCH"
  - "HEAD"
  - "OPTIONS"

❌ Wrong: "get", "Post", "put"
✓ Correct: "GET", "POST", "PUT"`;
  }

  private getHeaderExample(): string {
    return `
[
  {
    "name": "Content-Type",
    "value": "application/json"
  },
  {
    "name": "Authorization",
    "value": "Bearer {{token}}"
  }
]`;
  }

  private getTestExample(): string {
    return `
"test": "describe('Test Name', () => {\\n  it('should work', () => {\\n    expect(response.status).to.equal(200);\\n  });\\n});"

Note: Test code must be a JSON-escaped string:
- Use \\n for newlines
- Escape quotes with \\"
- No actual line breaks in the JSON string`;
  }

  /**
   * Format errors as a concise summary (for CLI output)
   */
  formatSummary(errors: ValidationError[]): string {
    if (errors.length === 0) {
      return '✓ Validation passed - no errors found';
    }

    let summary = `❌ Validation failed with ${errors.length} error${errors.length > 1 ? 's' : ''}:\n\n`;

    errors.forEach((error, index) => {
      const path = error.path || 'root';
      const location = path.split('/').filter(p => p).join(' → ');
      summary += `  ${index + 1}. ${error.message}\n`;
      if (location) {
        summary += `     Location: ${location}\n`;
      }
    });

    summary += `\nUse --llm-friendly flag for detailed explanations and examples\n`;

    return summary;
  }
}
