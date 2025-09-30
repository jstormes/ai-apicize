import { ApicizeWorkbook, Request, RequestGroup, ExecutionMode } from '../types';

export interface TemplateContext {
  [key: string]: any;
}

export interface TemplateOptions {
  indent?: string;
  includeMetadata?: boolean;
  splitByGroup?: boolean;
  generateHelpers?: boolean;
}

export class TemplateEngine {
  private readonly defaultOptions: TemplateOptions = {
    indent: '    ',
    includeMetadata: true,
    splitByGroup: true,
    generateHelpers: true,
  };

  /**
   * Render a template with the given context
   */
  public render(template: string, context: TemplateContext, options?: TemplateOptions): string {
    const opts = { ...this.defaultOptions, ...options };
    let result = template;

    // Process control structures first so they can create proper variable contexts
    // Handle loops {{#each items}}...{{/each}}
    result = this.handleLoops(result, context);

    // Handle conditionals {{#if condition}}...{{/if}}
    result = this.handleConditionals(result, context);

    // Simple template variable substitution {{variable}} - do this last
    result = this.substituteVariables(result, context);

    // Apply formatting
    result = this.applyFormatting(result, opts);

    return result;
  }

  /**
   * Generate the main index.spec.ts file
   */
  public generateMainIndex(workbook: ApicizeWorkbook, options?: TemplateOptions): string {
    const context: TemplateContext = {
      workbookName: this.sanitizeFileName('api-tests'),
      workbook,
      hasRequests: workbook.requests && workbook.requests.length > 0,
      requestGroups: this.getTopLevelGroups(workbook.requests || []),
      hasScenarios: workbook.scenarios && workbook.scenarios.length > 0,
      scenarios: workbook.scenarios || [],
      defaultScenario: workbook.defaults?.selectedScenario,
      exportDate: new Date().toISOString(),
      ...options,
    };

    return this.render(this.getMainIndexTemplate(), context, options);
  }

  /**
   * Generate a request group test file
   */
  public generateRequestGroup(
    group: RequestGroup,
    workbook: ApicizeWorkbook,
    options?: TemplateOptions
  ): string {
    const subGroups = this.getSubGroups(group);
    const subGroupsWithContent = subGroups.map(subGroup => ({
      ...subGroup,
      nestedContent: this.generateNestedGroupContent(subGroup, workbook, options),
    }));

    const context: TemplateContext = {
      groupName: group.name,
      group,
      workbook,
      requests: this.getRequestsFromGroup(group),
      subGroups: subGroupsWithContent,
      hasSubGroups: subGroups.length > 0,
      hasRequests: this.getRequestsFromGroup(group).length > 0,
      executionMode: group.execution || 'SEQUENTIAL',
      ...options,
    };

    return this.render(this.getRequestGroupTemplate(), context, options);
  }

  /**
   * Generate nested group content for recursive groups
   */
  private generateNestedGroupContent(
    group: RequestGroup,
    workbook: ApicizeWorkbook,
    options?: TemplateOptions
  ): string {
    const requests = this.getRequestsFromGroup(group);
    const subGroups = this.getSubGroups(group);

    const subGroupsWithContent = subGroups.map(subGroup => ({
      ...subGroup,
      nestedContent: this.generateNestedGroupContent(subGroup, workbook, options),
    }));

    const context: TemplateContext = {
      groupName: group.name,
      group,
      workbook,
      requests,
      subGroups: subGroupsWithContent,
      hasSubGroups: subGroups.length > 0,
      hasRequests: requests.length > 0,
      executionMode: group.execution || 'SEQUENTIAL',
      ...options,
    };

    return this.render(this.getNestedGroupTemplate(), context, options);
  }

  /**
   * Generate an individual request test
   */
  public generateIndividualRequest(
    request: Request,
    workbook: ApicizeWorkbook,
    options?: TemplateOptions
  ): string {
    // Ensure all required properties have default values
    const requestWithDefaults = {
      ...request,
      keepAlive: request.keepAlive ?? false,
      acceptInvalidCerts: request.acceptInvalidCerts ?? false,
      runs: request.runs ?? 1,
      multiRunExecution: request.multiRunExecution ?? ExecutionMode.SEQUENTIAL,
      numberOfRedirects: request.numberOfRedirects ?? 10,
      timeout: request.timeout ?? 30000,
    };

    const context: TemplateContext = {
      requestName: requestWithDefaults.name,
      request: requestWithDefaults,
      workbook,
      method: requestWithDefaults.method,
      url: requestWithDefaults.url,
      hasHeaders: requestWithDefaults.headers && requestWithDefaults.headers.length > 0,
      headers: requestWithDefaults.headers || [],
      hasBody: requestWithDefaults.body && requestWithDefaults.body.type !== 'None',
      body: requestWithDefaults.body,
      hasQueryParams:
        requestWithDefaults.queryStringParams && requestWithDefaults.queryStringParams.length > 0,
      queryParams: requestWithDefaults.queryStringParams || [],
      testCode: requestWithDefaults.test || this.getDefaultTestCode(),
      timeout: requestWithDefaults.timeout,
      ...options,
    };

    return this.render(this.getIndividualRequestTemplate(), context, options);
  }

  /**
   * Generate package.json for exported project
   */
  public generatePackageJson(workbook: ApicizeWorkbook, options?: TemplateOptions): string {
    const context: TemplateContext = {
      projectName: this.sanitizePackageName('apicize-tests'),
      workbook,
      ...options,
    };

    return this.render(this.getPackageJsonTemplate(), context, options);
  }

  /**
   * Generate tsconfig.json for exported project
   */
  public generateTsConfig(options?: TemplateOptions): string {
    const context: TemplateContext = {
      ...options,
    };

    return this.render(this.getTsConfigTemplate(), context, options);
  }

  /**
   * Generate mocha configuration
   */
  public generateMochaConfig(options?: TemplateOptions): string {
    const context: TemplateContext = {
      ...options,
    };

    return this.render(this.getMochaConfigTemplate(), context, options);
  }

  private substituteVariables(template: string, context: TemplateContext): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const trimmedKey = key.trim();

      // Handle JSON.stringify expressions
      if (trimmedKey.startsWith('JSON.stringify(') && trimmedKey.endsWith(')')) {
        const property = trimmedKey.substring(15, trimmedKey.length - 1);
        const value = this.getNestedProperty(context, property);
        try {
          // Use proper JSON serialization with null replacer to ensure safe formatting
          return JSON.stringify(value || null, null, 0);
        } catch (error) {
          console.warn(`Failed to serialize ${property}:`, error);
          return 'null';
        }
      }

      const value = this.getNestedProperty(context, trimmedKey);

      if (value !== undefined) {
        return String(value);
      }

      return match;
    });
  }

  private handleConditionals(template: string, context: TemplateContext): string {
    const conditionalRegex = /\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
    return template.replace(conditionalRegex, (_, condition, content) => {
      const conditionValue = this.evaluateCondition(condition.trim(), context);
      return conditionValue ? content : '';
    });
  }

  private handleLoops(template: string, context: TemplateContext): string {
    const loopRegex = /\{\{#each\s+([^}]+)\}\}([\s\S]*?)\{\{\/each\}\}/g;
    return template.replace(loopRegex, (_, arrayKey, content) => {
      const array = this.getNestedProperty(context, arrayKey.trim());
      if (!Array.isArray(array)) return '';

      return array
        .map((item, index) => {
          const itemContext = { ...context, this: item, index, '@index': index };

          // Process nested loops and conditionals first, then variables
          let processedContent = this.handleLoops(content, itemContext);
          processedContent = this.handleConditionals(processedContent, itemContext);
          processedContent = this.substituteVariables(processedContent, itemContext);

          return processedContent;
        })
        .join('');
    });
  }

  private applyFormatting(template: string, options: TemplateOptions): string {
    // Remove excess blank lines
    let formatted = template.replace(/\n\s*\n\s*\n/g, '\n\n');

    // Ensure proper indentation
    if (options.indent) {
      formatted = this.normalizeIndentation(formatted, options.indent);
    }

    return formatted.trim() + '\n';
  }

  private normalizeIndentation(text: string, indent: string): string {
    const lines = text.split('\n');
    let indentLevel = 0;

    return lines
      .map(line => {
        const trimmed = line.trim();
        if (!trimmed) return '';

        // Adjust indent level for closing braces
        if (trimmed.includes('}') && !trimmed.includes('{')) {
          indentLevel = Math.max(0, indentLevel - 1);
        }

        const result = indent.repeat(indentLevel) + trimmed;

        // Adjust indent level for opening braces
        if (trimmed.includes('{') && !trimmed.includes('}')) {
          indentLevel++;
        }

        return result;
      })
      .join('\n');
  }

  private getNestedProperty(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  private evaluateCondition(condition: string, context: TemplateContext): boolean {
    const value = this.getNestedProperty(context, condition);
    return Boolean(value);
  }

  private getTopLevelGroups(requests: (Request | RequestGroup)[]): RequestGroup[] {
    return requests.filter((item): item is RequestGroup => 'children' in item);
  }

  private getRequestsFromGroup(group: RequestGroup): Request[] {
    return (group.children || [])
      .filter((item): item is Request => !('children' in item))
      .map(request => ({
        ...request,
        keepAlive: request.keepAlive ?? false,
        acceptInvalidCerts: request.acceptInvalidCerts ?? false,
        runs: request.runs ?? 1,
        multiRunExecution: request.multiRunExecution ?? ExecutionMode.SEQUENTIAL,
        numberOfRedirects: request.numberOfRedirects ?? 10,
        timeout: request.timeout ?? 30000,
      }));
  }

  private getSubGroups(group: RequestGroup): RequestGroup[] {
    return (group.children || []).filter((item): item is RequestGroup => 'children' in item);
  }

  private sanitizeFileName(name: string): string {
    return name.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
  }

  private sanitizePackageName(name: string): string {
    return name.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
  }

  private getDefaultTestCode(): string {
    return `describe('should pass', () => {
    it('has successful response', () => {
        expect(response.status).to.be.oneOf([200, 201, 204]);
    });
});`;
  }

  private getMainIndexTemplate(): string {
    return `// Auto-generated from {{workbookName}}.apicize
import { describe, before, after } from 'mocha';
import { expect } from 'chai';
import {
    TestHelper,
    ApicizeContext,
    ApicizeResponse,
    BodyType
} from '@jstormes/apicize-lib';

{{#if includeMetadata}}
/* @apicize-file-metadata
{
    "version": {{workbook.version}},
    "source": "{{workbookName}}.apicize",
    "exportDate": "{{exportDate}}",
    "workbook": {{JSON.stringify(workbook)}}
}
@apicize-file-metadata-end */
{{/if}}

// Global test context
let context: ApicizeContext;
let response: ApicizeResponse;
let $: Record<string, any>;

const output = (key: string, value: any): void => {
    context?.output(key, value);
};

describe('API Tests', function() {
    this.timeout(30000);

    before(async function() {
        const helper = new TestHelper();
        context = await helper.setupWorkbook('{{workbookName}}');
        $ = context.$;
    });

    after(async function() {
        await context?.cleanup();
    });

{{#if hasRequests}}
{{#each requestGroups}}
    describe('{{this.name}}', function() {
        // Group will be implemented in separate file: suites/{{@index}}-{{this.name}}.spec.ts
    });
{{/each}}
{{/if}}
});

// Import group test suites
{{#each requestGroups}}
import './suites/{{@index}}-{{this.name}}.spec';
{{/each}}
`;
  }

  private getRequestGroupTemplate(): string {
    return `// Auto-generated request group: {{groupName}}
import { describe, it, beforeEach, before } from 'mocha';
import { expect } from 'chai';
import {
    TestHelper,
    ApicizeContext,
    ApicizeResponse,
    BodyType
} from '@jstormes/apicize-lib';

{{#if includeMetadata}}
/* @apicize-group-metadata
{
    "id": "{{group.id}}",
    "name": "{{group.name}}",
    "execution": "{{group.execution}}",
    "runs": {{group.runs}},
    "multiRunExecution": "{{group.multiRunExecution}}",
    "selectedScenario": {{JSON.stringify(group.selectedScenario)}},
    "selectedData": {{JSON.stringify(group.selectedData)}}
}
@apicize-group-metadata-end */
{{/if}}

// Test context for this group
let context: ApicizeContext;
let response: ApicizeResponse;
let $: Record<string, any>;

const output = (key: string, value: any): void => {
    context?.output(key, value);
};

describe('{{groupName}}', function() {
    before(async function() {
        const helper = new TestHelper();
        context = await helper.setupGroup('{{group.id}}');
        $ = context.$;
    });

{{#if hasRequests}}
{{#each requests}}
    describe('{{this.name}}', function() {
        {{#if includeMetadata}}
        /* @apicize-request-metadata
        {
            "id": "{{this.id}}",
            "name": "{{this.name}}",
            "url": "{{this.url}}",
            "method": "{{this.method}}",
            "headers": {{JSON.stringify(this.headers)}},
            "body": {{JSON.stringify(this.body)}},
            "queryStringParams": {{JSON.stringify(this.queryStringParams)}},
            "timeout": {{this.timeout}},
            "numberOfRedirects": {{this.numberOfRedirects}},
            "runs": {{this.runs}},
            "multiRunExecution": "{{this.multiRunExecution}}",
            "keepAlive": {{this.keepAlive}},
            "acceptInvalidCerts": {{this.acceptInvalidCerts}},
            "test": {{JSON.stringify(this.test)}}
        }
        @apicize-request-metadata-end */
        {{/if}}

        beforeEach(async function() {
            this.timeout({{this.timeout}});

            response = await context.execute({
                id: '{{this.id}}',
                method: '{{this.method}}',
                url: '{{this.url}}',
                headers: {{JSON.stringify(this.headers)}},
                body: {{JSON.stringify(this.body)}},
                queryStringParams: {{JSON.stringify(this.queryStringParams)}},
                timeout: {{this.timeout}},
                numberOfRedirects: {{this.numberOfRedirects}},
                acceptInvalidCerts: {{this.acceptInvalidCerts}}
            });

            $ = context.$;
        });

        {{this.test}}
    });
{{/each}}
{{/if}}

{{#if hasSubGroups}}
{{#each subGroups}}
    {{this.nestedContent}}
{{/each}}
{{/if}}
});
`;
  }

  private getNestedGroupTemplate(): string {
    return `describe('{{groupName}}', function() {
    {{#if includeMetadata}}
    /* @apicize-group-metadata
    {
        "id": "{{group.id}}",
        "name": "{{group.name}}",
        "execution": "{{group.execution}}",
        "runs": {{group.runs}},
        "multiRunExecution": "{{group.multiRunExecution}}",
        "selectedScenario": {{JSON.stringify(group.selectedScenario)}},
        "selectedData": {{JSON.stringify(group.selectedData)}}
    }
    @apicize-group-metadata-end */
    {{/if}}

    before(async function() {
        const helper = new TestHelper();
        context = await helper.setupGroup('{{group.id}}');
        $ = context.$;
    });

{{#if hasRequests}}
{{#each requests}}
    describe('{{this.name}}', function() {
        {{#if includeMetadata}}
        /* @apicize-request-metadata
        {
            "id": "{{this.id}}",
            "name": "{{this.name}}",
            "url": "{{this.url}}",
            "method": "{{this.method}}",
            "headers": {{JSON.stringify(this.headers)}},
            "body": {{JSON.stringify(this.body)}},
            "queryStringParams": {{JSON.stringify(this.queryStringParams)}},
            "timeout": {{this.timeout}},
            "numberOfRedirects": {{this.numberOfRedirects}},
            "runs": {{this.runs}},
            "multiRunExecution": "{{this.multiRunExecution}}",
            "keepAlive": {{this.keepAlive}},
            "acceptInvalidCerts": {{this.acceptInvalidCerts}},
            "test": {{JSON.stringify(this.test)}}
        }
        @apicize-request-metadata-end */
        {{/if}}

        beforeEach(async function() {
            this.timeout({{this.timeout}});

            response = await context.execute({
                id: '{{this.id}}',
                method: '{{this.method}}',
                url: '{{this.url}}',
                headers: {{JSON.stringify(this.headers)}},
                body: {{JSON.stringify(this.body)}},
                queryStringParams: {{JSON.stringify(this.queryStringParams)}},
                timeout: {{this.timeout}},
                numberOfRedirects: {{this.numberOfRedirects}},
                acceptInvalidCerts: {{this.acceptInvalidCerts}}
            });

            $ = context.$;
        });

        it('should pass the embedded test', function() {
            {{{this.test}}}
        });
    });
{{/each}}
{{/if}}

{{#if hasSubGroups}}
{{#each subGroups}}
    {{this.nestedContent}}
{{/each}}
{{/if}}
});`;
  }

  private getIndividualRequestTemplate(): string {
    return `// Auto-generated individual request: {{requestName}}
import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';
import {
    TestHelper,
    ApicizeContext,
    ApicizeResponse,
    BodyType
} from '@jstormes/apicize-lib';

{{#if includeMetadata}}
/* @apicize-request-metadata
{
    "id": "{{request.id}}",
    "name": "{{request.name}}",
    "url": "{{request.url}}",
    "method": "{{request.method}}",
    "headers": {{JSON.stringify(request.headers)}},
    "body": {{JSON.stringify(request.body)}},
    "queryStringParams": {{JSON.stringify(request.queryStringParams)}},
    "timeout": {{request.timeout}},
    "numberOfRedirects": {{request.numberOfRedirects}},
    "runs": {{request.runs}},
    "multiRunExecution": "{{request.multiRunExecution}}",
    "keepAlive": {{request.keepAlive}},
    "acceptInvalidCerts": {{request.acceptInvalidCerts}}
}
@apicize-request-metadata-end */
{{/if}}

// Test context
let context: ApicizeContext;
let response: ApicizeResponse;
let $: Record<string, any>;

const output = (key: string, value: any): void => {
    context?.output(key, value);
};

describe('{{requestName}}', function() {
    beforeEach(async function() {
        this.timeout({{timeout}});

        const helper = new TestHelper();
        context = await helper.setupRequest('{{request.id}}');

        response = await context.execute({
            id: '{{request.id}}',
            method: '{{method}}',
            url: '{{url}}',
            headers: {{JSON.stringify(headers)}},
            body: {{JSON.stringify(body)}},
            queryStringParams: {{JSON.stringify(queryParams)}},
            timeout: {{timeout}},
            numberOfRedirects: {{request.numberOfRedirects}},
            acceptInvalidCerts: {{request.acceptInvalidCerts}}
        });

        $ = context.$;
    });

    {{testCode}}
});
`;
  }

  private getPackageJsonTemplate(): string {
    return `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "private": true,
  "description": "Generated TypeScript tests from Apicize workbook",
  "scripts": {
    "test": "mocha",
    "test:watch": "mocha --watch",
    "test:debug": "mocha --inspect-brk",
    "test:scenario": "cross-env SCENARIO=$1 mocha",
    "test:env": "cross-env ENV=$1 mocha",
    "test:single": "mocha --grep",
    "test:report": "mocha --reporter mochawesome",
    "test:coverage": "nyc mocha",
    "import": "apicize import .",
    "validate": "apicize validate",
    "build": "tsc",
    "clean": "rimraf dist coverage .nyc_output"
  },
  "dependencies": {
    "@jstormes/apicize-lib": "^1.0.0"
  },
  "devDependencies": {
    "@types/mocha": "^10.0.0",
    "@types/chai": "^4.3.0",
    "@types/node": "^20.0.0",
    "mocha": "^10.0.0",
    "chai": "^4.3.0",
    "typescript": "^5.0.0",
    "ts-node": "^10.0.0",
    "cross-env": "^7.0.3",
    "mochawesome": "^7.1.0",
    "nyc": "^15.1.0",
    "rimraf": "^5.0.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
`;
  }

  private getTsConfigTemplate(): string {
    return `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "typeRoots": ["node_modules/@types"],
    "types": ["mocha", "chai", "node"]
  },
  "include": [
    "tests/**/*",
    "lib/**/*",
    "config/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "coverage"
  ],
  "ts-node": {
    "esm": false,
    "compilerOptions": {
      "module": "commonjs"
    }
  }
}
`;
  }

  private getMochaConfigTemplate(): string {
    return `{
  "require": ["ts-node/register"],
  "extensions": ["ts"],
  "spec": "tests/**/*.spec.ts",
  "timeout": 30000,
  "recursive": true,
  "exit": true,
  "reporter": "spec",
  "ui": "bdd"
}
`;
  }
}
