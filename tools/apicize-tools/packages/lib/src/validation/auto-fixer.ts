/**
 * Auto-fix common validation errors in .apicize files
 * Helps LLMs by automatically correcting common mistakes
 */

import { ApicizeWorkbook, Request, RequestGroup, HttpMethod, BodyType, ExecutionMode, VariableType } from '../types';

export interface FixResult {
  fixed: ApicizeWorkbook;
  changes: FixChange[];
  unfixable: string[];
}

export interface FixChange {
  type: 'fix' | 'warning' | 'info';
  path: string;
  message: string;
  before?: any;
  after?: any;
}

export class AutoFixer {
  private changes: FixChange[] = [];
  private unfixable: string[] = [];

  /**
   * Attempt to fix common validation errors
   */
  fix(workbook: ApicizeWorkbook): FixResult {
    this.changes = [];
    this.unfixable = [];

    // Deep clone to avoid mutating original
    const fixed = JSON.parse(JSON.stringify(workbook)) as ApicizeWorkbook;

    // Apply fixes in order
    this.fixVersion(fixed);
    this.fixRequests(fixed);
    this.fixScenarios(fixed);
    this.fixAuthorizations(fixed);
    this.fixDefaults(fixed);

    return {
      fixed,
      changes: this.changes,
      unfixable: this.unfixable,
    };
  }

  private fixVersion(workbook: ApicizeWorkbook): void {
    if (!workbook.version) {
      workbook.version = 1.0;
      this.addChange('fix', '/version', 'Added missing version field', undefined, 1.0);
    } else if (workbook.version !== 1.0) {
      const before = workbook.version;
      workbook.version = 1.0;
      this.addChange('fix', '/version', 'Fixed version to 1.0', before, 1.0);
    }
  }

  private fixRequests(workbook: ApicizeWorkbook): void {
    if (!workbook.requests) {
      workbook.requests = [];
      this.addChange('fix', '/requests', 'Added missing requests array', undefined, []);
      return;
    }

    workbook.requests.forEach((item, index) => {
      this.fixRequestOrGroup(item, `/requests/${index}`);
    });
  }

  private fixRequestOrGroup(item: Request | RequestGroup, path: string): void {
    // Fix ID
    if (!item.id) {
      item.id = this.generateId();
      this.addChange('fix', `${path}/id`, `Generated missing ID`, undefined, item.id);
    }

    // Fix name
    if (!item.name) {
      item.name = 'Unnamed';
      this.addChange('warning', `${path}/name`, 'Added default name for unnamed item', undefined, 'Unnamed');
    }

    // Check if it's a group (has children)
    if ('children' in item && item.children) {
      this.fixRequestGroup(item as RequestGroup, path);
    } else {
      this.fixRequest(item as Request, path);
    }
  }

  private fixRequestGroup(group: RequestGroup, path: string): void {
    // Fix execution mode
    if (!group.execution) {
      group.execution = ExecutionMode.SEQUENTIAL;
      this.addChange('fix', `${path}/execution`, 'Set default execution mode', undefined, 'SEQUENTIAL');
    }

    // Fix runs
    if (group.runs === undefined || group.runs === null) {
      group.runs = 1;
      this.addChange('fix', `${path}/runs`, 'Set default runs to 1', undefined, 1);
    }

    // Fix multiRunExecution
    if (!group.multiRunExecution) {
      group.multiRunExecution = ExecutionMode.SEQUENTIAL;
      this.addChange('fix', `${path}/multiRunExecution`, 'Set default multiRunExecution', undefined, 'SEQUENTIAL');
    }

    // Fix children
    if (!group.children) {
      group.children = [];
      this.addChange('warning', `${path}/children`, 'Group has no children', undefined, []);
    } else {
      group.children.forEach((child, index) => {
        this.fixRequestOrGroup(child, `${path}/children/${index}`);
      });
    }
  }

  private fixRequest(request: Request, path: string): void {
    // Fix URL
    if (!request.url) {
      request.url = '';
      this.addChange('warning', `${path}/url`, 'Request has empty URL', undefined, '');
      this.unfixable.push(`${path}: URL is required but empty`);
    }

    // Fix HTTP method (most common error!)
    if (!request.method) {
      request.method = HttpMethod.GET;
      this.addChange('fix', `${path}/method`, 'Set default method to GET', undefined, 'GET');
    } else if (typeof request.method === 'string') {
      const uppercase = request.method.toUpperCase();
      const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

      if (request.method !== uppercase && validMethods.includes(uppercase)) {
        const before = request.method;
        request.method = uppercase as HttpMethod;
        this.addChange('fix', `${path}/method`, 'Fixed method to uppercase', before, uppercase);
      } else if (!validMethods.includes(uppercase)) {
        this.unfixable.push(`${path}/method: Invalid method "${request.method}"`);
      }
    }

    // Fix timeout
    if (!request.timeout) {
      request.timeout = 30000;
      this.addChange('fix', `${path}/timeout`, 'Set default timeout to 30000ms', undefined, 30000);
    }

    // Fix headers
    if (!request.headers) {
      request.headers = [];
      this.addChange('fix', `${path}/headers`, 'Added empty headers array', undefined, []);
    }

    // Fix queryStringParams
    if (!request.queryStringParams) {
      request.queryStringParams = [];
      this.addChange('fix', `${path}/queryStringParams`, 'Added empty queryStringParams array', undefined, []);
    }

    // Fix body (common error for LLMs!)
    this.fixRequestBody(request, path);

    // Fix test code
    if (!request.test || request.test.trim() === '') {
      request.test = this.generateDefaultTest(request.method || HttpMethod.GET, request.name);
      this.addChange('warning', `${path}/test`, 'Generated default test code', undefined, '<generated>');
    }

    // Fix runs
    if (request.runs === undefined || request.runs === null) {
      request.runs = 1;
      this.addChange('fix', `${path}/runs`, 'Set default runs to 1', undefined, 1);
    }

    // Fix multiRunExecution
    if (!request.multiRunExecution) {
      request.multiRunExecution = ExecutionMode.SEQUENTIAL;
      this.addChange('fix', `${path}/multiRunExecution`, 'Set default multiRunExecution', undefined, 'SEQUENTIAL');
    }

    // Fix numberOfRedirects
    if (request.numberOfRedirects === undefined || request.numberOfRedirects === null) {
      request.numberOfRedirects = 10;
      this.addChange('fix', `${path}/numberOfRedirects`, 'Set default redirects to 10', undefined, 10);
    }

    // Fix boolean defaults
    if (request.keepAlive === undefined) {
      request.keepAlive = false;
    }
    if (request.acceptInvalidCerts === undefined) {
      request.acceptInvalidCerts = false;
    }
  }

  private fixRequestBody(request: Request, path: string): void {
    if (!request.body) {
      // null or undefined body - fix it
      request.body = { type: BodyType.None };
      this.addChange('fix', `${path}/body`, 'Fixed null/undefined body to {type: "None"}', null, request.body);
      return;
    }

    // Check if body has required 'type' field
    if (typeof request.body === 'object' && !('type' in request.body)) {
      // Body exists but missing type - try to infer
      if ('data' in request.body) {
        const data = (request.body as any).data;
        if (typeof data === 'object' && !Array.isArray(data)) {
          (request.body as any).type = BodyType.JSON;
          this.addChange('fix', `${path}/body/type`, 'Inferred body type as JSON from data', undefined, 'JSON');
        } else if (typeof data === 'string') {
          (request.body as any).type = BodyType.Text;
          this.addChange('fix', `${path}/body/type`, 'Inferred body type as Text from data', undefined, 'Text');
        } else {
          (request.body as any).type = BodyType.None;
          this.addChange('fix', `${path}/body/type`, 'Set body type to None (unknown data type)', undefined, 'None');
        }
      } else {
        (request.body as any).type = BodyType.None;
        this.addChange('fix', `${path}/body/type`, 'Set body type to None (no data)', undefined, 'None');
      }
    }

    // Validate body type values
    if ('type' in request.body && request.body.type) {
      const validTypes = ['None', 'JSON', 'Text', 'XML', 'Form', 'Raw'];
      if (!validTypes.includes(request.body.type)) {
        const before = request.body.type;
        request.body.type = BodyType.None;
        this.addChange('fix', `${path}/body/type`, `Invalid body type "${before}" changed to None`, before, 'None');
      }
    }
  }

  private fixScenarios(workbook: ApicizeWorkbook): void {
    if (!workbook.scenarios) {
      return; // Scenarios are optional
    }

    workbook.scenarios.forEach((scenario, index) => {
      const path = `/scenarios/${index}`;

      if (!scenario.id) {
        scenario.id = this.generateId();
        this.addChange('fix', `${path}/id`, 'Generated missing scenario ID', undefined, scenario.id);
      }

      if (!scenario.name) {
        scenario.name = `Scenario ${index + 1}`;
        this.addChange('fix', `${path}/name`, 'Generated missing scenario name', undefined, scenario.name);
      }

      if (!scenario.variables) {
        scenario.variables = [];
        this.addChange('fix', `${path}/variables`, 'Added empty variables array', undefined, []);
      } else {
        scenario.variables.forEach((variable, vIndex) => {
          if (!variable.name) {
            this.unfixable.push(`${path}/variables/${vIndex}: Variable has no name`);
          }
          if (variable.value === undefined || variable.value === null) {
            variable.value = '';
            this.addChange('fix', `${path}/variables/${vIndex}/value`, 'Set empty value', undefined, '');
          }
          if (!variable.type) {
            variable.type = VariableType.TEXT;
            this.addChange('fix', `${path}/variables/${vIndex}/type`, 'Set default type to TEXT', undefined, 'TEXT');
          }
        });
      }
    });
  }

  private fixAuthorizations(workbook: ApicizeWorkbook): void {
    if (!workbook.authorizations) {
      return; // Authorizations are optional
    }

    workbook.authorizations.forEach((auth, index) => {
      const path = `/authorizations/${index}`;

      if (!auth.id) {
        auth.id = this.generateId();
        this.addChange('fix', `${path}/id`, 'Generated missing auth ID', undefined, auth.id);
      }

      if (!auth.name) {
        auth.name = `Authorization ${index + 1}`;
        this.addChange('fix', `${path}/name`, 'Generated missing auth name', undefined, auth.name);
      }

      if (!auth.type) {
        this.unfixable.push(`${path}: Authorization missing required 'type' field`);
      }
    });
  }

  private fixDefaults(_workbook: ApicizeWorkbook): void {
    // Defaults are completely optional, no fixes needed
  }

  private generateId(): string {
    // Simple ID generation - LLMs can use this pattern too
    return `id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateDefaultTest(_method: HttpMethod | string, requestName: string): string {
    const safeName = requestName.replace(/'/g, "\\'");
    return `describe('${safeName}', () => {\n  it('should return success', () => {\n    expect(response.status).to.be.within(200, 299);\n  });\n});`;
  }

  private addChange(type: 'fix' | 'warning' | 'info', path: string, message: string, before?: any, after?: any): void {
    this.changes.push({ type, path, message, before, after });
  }

  /**
   * Format fix results for display
   */
  formatResults(result: FixResult): string {
    let output = '';

    if (result.changes.length === 0 && result.unfixable.length === 0) {
      return '✓ No fixes needed - file is valid\n';
    }

    // Group changes by type
    const fixes = result.changes.filter(c => c.type === 'fix');
    const warnings = result.changes.filter(c => c.type === 'warning');

    if (fixes.length > 0) {
      output += `\n✓ Applied ${fixes.length} fix${fixes.length > 1 ? 'es' : ''}:\n`;
      fixes.forEach(change => {
        output += `  • ${change.message}`;
        if (change.before !== undefined) {
          output += ` (${JSON.stringify(change.before)} → ${JSON.stringify(change.after)})`;
        }
        output += `\n`;
      });
    }

    if (warnings.length > 0) {
      output += `\n⚠ ${warnings.length} warning${warnings.length > 1 ? 's' : ''}:\n`;
      warnings.forEach(change => {
        output += `  • ${change.message}\n`;
      });
    }

    if (result.unfixable.length > 0) {
      output += `\n❌ ${result.unfixable.length} issue${result.unfixable.length > 1 ? 's' : ''} that need manual attention:\n`;
      result.unfixable.forEach(issue => {
        output += `  • ${issue}\n`;
      });
    }

    return output;
  }
}
