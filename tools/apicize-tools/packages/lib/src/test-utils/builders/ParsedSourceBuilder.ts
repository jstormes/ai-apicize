/**
 * Test data builder for ParsedSource objects
 * Provides fluent interface for creating parsed source data
 */

import {
  ParsedSource,
  ParsedImport,
  ParsedVariable,
  ParsedFunction,
  ParsedMetadata,
} from '../../infrastructure/parsing/ParsedSource';
import { TestBlock } from '../../domain/test-analysis/entities/TestBlock';
import { SourceCode } from '../../domain/test-analysis/value-objects/SourceCode';
import { TestBlockBuilder } from './TestBlockBuilder';

/**
 * Builder for creating ParsedSource instances with fluent interface
 */
export class ParsedSourceBuilder {
  private testBlocks: TestBlock[] = [];
  private imports: ParsedImport[] = [];
  private globalVariables: ParsedVariable[] = [];
  private helperFunctions: ParsedFunction[] = [];
  private sourceCode: SourceCode;
  private metadata: ParsedMetadata;

  constructor() {
    // Initialize with defaults
    const defaultSourceResult = SourceCode.create('');
    if (!defaultSourceResult.success) {
      throw new Error('Failed to create default SourceCode');
    }
    this.sourceCode = defaultSourceResult.data;
    this.metadata = new ParsedMetadata();
  }

  /**
   * Set test blocks
   * @param testBlocks Array of test blocks
   * @returns Builder instance for chaining
   */
  withTestBlocks(testBlocks: TestBlock[]): this {
    this.testBlocks = testBlocks;
    return this;
  }

  /**
   * Add a test block
   * @param testBlock Test block to add
   * @returns Builder instance for chaining
   */
  withTestBlock(testBlock: TestBlock): this {
    this.testBlocks.push(testBlock);
    return this;
  }

  /**
   * Add a test block using a builder
   * @param builder Test block builder
   * @returns Builder instance for chaining
   */
  withTestBlockBuilder(builder: TestBlockBuilder): this {
    this.testBlocks.push(builder.build());
    return this;
  }

  /**
   * Set imports
   * @param imports Array of parsed imports
   * @returns Builder instance for chaining
   */
  withImports(imports: ParsedImport[]): this {
    this.imports = imports;
    return this;
  }

  /**
   * Add an import
   * @param source Import source
   * @param imports Import names
   * @param isTypeImport Whether it's a type import
   * @param fullStatement Full import statement
   * @returns Builder instance for chaining
   */
  withImport(
    source: string,
    imports: string[],
    isTypeImport: boolean = false,
    fullStatement?: string
  ): this {
    const statement = fullStatement || `import { ${imports.join(', ')} } from '${source}';`;
    this.imports.push(new ParsedImport(source, imports, isTypeImport, statement));
    return this;
  }

  /**
   * Set global variables
   * @param variables Array of parsed variables
   * @returns Builder instance for chaining
   */
  withGlobalVariables(variables: ParsedVariable[]): this {
    this.globalVariables = variables;
    return this;
  }

  /**
   * Add a global variable
   * @param name Variable name
   * @param type Variable type
   * @param value Variable value
   * @param isConst Whether it's a const
   * @param lineNumber Line number
   * @returns Builder instance for chaining
   */
  withGlobalVariable(
    name: string,
    type: string = 'any',
    value?: string,
    isConst: boolean = true,
    lineNumber: number = 1
  ): this {
    this.globalVariables.push(new ParsedVariable(name, type, value, isConst, lineNumber));
    return this;
  }

  /**
   * Set helper functions
   * @param functions Array of parsed functions
   * @returns Builder instance for chaining
   */
  withHelperFunctions(functions: ParsedFunction[]): this {
    this.helperFunctions = functions;
    return this;
  }

  /**
   * Add a helper function
   * @param name Function name
   * @param parameters Function parameters
   * @param returnType Return type
   * @param code Function code
   * @param lineNumber Line number
   * @param isAsync Whether it's async
   * @returns Builder instance for chaining
   */
  withHelperFunction(
    name: string,
    parameters: string[] = [],
    returnType: string = 'void',
    code: string = '',
    lineNumber: number = 1,
    isAsync: boolean = false
  ): this {
    this.helperFunctions.push(
      new ParsedFunction(name, parameters, returnType, code, lineNumber, isAsync)
    );
    return this;
  }

  /**
   * Set source code
   * @param code Source code content
   * @returns Builder instance for chaining
   */
  withSourceCode(code: string): this {
    const result = SourceCode.create(code);
    if (!result.success) {
      throw new Error(`Failed to create SourceCode: ${result.error?.message}`);
    }
    this.sourceCode = result.data;
    return this;
  }

  /**
   * Set metadata
   * @param metadata Parsed metadata
   * @returns Builder instance for chaining
   */
  withMetadata(metadata: ParsedMetadata): this {
    this.metadata = metadata;
    return this;
  }

  /**
   * Build the ParsedSource instance
   * @returns Constructed ParsedSource
   */
  build(): ParsedSource {
    return new ParsedSource(
      this.testBlocks,
      this.imports,
      this.globalVariables,
      this.helperFunctions,
      this.sourceCode,
      this.metadata
    );
  }

  /**
   * Create a new builder with the same configuration
   * @returns New builder instance
   */
  clone(): ParsedSourceBuilder {
    const builder = new ParsedSourceBuilder();
    builder.testBlocks = [...this.testBlocks];
    builder.imports = [...this.imports];
    builder.globalVariables = [...this.globalVariables];
    builder.helperFunctions = [...this.helperFunctions];
    builder.sourceCode = this.sourceCode;
    builder.metadata = this.metadata;
    return builder;
  }
}

/**
 * Convenience function to create a ParsedSourceBuilder
 * @returns New ParsedSourceBuilder instance
 */
export function parsedSource(): ParsedSourceBuilder {
  return new ParsedSourceBuilder();
}

/**
 * Predefined builder configurations for common parsed source scenarios
 */
export class ParsedSourceBuilderPresets {
  /**
   * Create a typical test file structure
   * @returns Configured builder
   */
  static typicalTestFile(): ParsedSourceBuilder {
    return new ParsedSourceBuilder()
      .withImport('mocha', ['describe', 'it', 'beforeEach'])
      .withImport('chai', ['expect'])
      .withImport('@apicize/lib', ['ApicizeResponse', 'BodyType'], true)
      .withGlobalVariable('response', 'ApicizeResponse', undefined, false, 5)
      .withGlobalVariable('context', 'ApicizeContext', undefined, false, 6)
      .withTestBlockBuilder(
        new TestBlockBuilder()
          .asDescribe('API Tests')
          .withChildren([
            new TestBlockBuilder().asIt('should work').asRequestSpecific(true).build(),
          ])
      )
      .withSourceCode(
        `
import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';
import type { ApicizeResponse, BodyType } from '@apicize/lib';

let response: ApicizeResponse;
let context: ApicizeContext;

describe('API Tests', () => {
  it('should work', () => {
    expect(response.status).to.equal(200);
  });
});
      `.trim()
      );
  }

  /**
   * Create a complex test file with helpers
   * @returns Configured builder
   */
  static complexTestFile(): ParsedSourceBuilder {
    return new ParsedSourceBuilder()
      .withImport('mocha', ['describe', 'it', 'before', 'after'])
      .withImport('chai', ['expect', 'assert'])
      .withImport('lodash', ['_'], false, "import _ from 'lodash';")
      .withGlobalVariable('baseUrl', 'string', "'https://api.example.com'", true, 4)
      .withGlobalVariable('timeout', 'number', '30000', true, 5)
      .withHelperFunction(
        'validateResponse',
        ['response: any'],
        'boolean',
        'return response && response.status >= 200 && response.status < 300;',
        7,
        false
      )
      .withHelperFunction(
        'setupTestData',
        [],
        'Promise<void>',
        'await createTestUser(); await createTestProduct();',
        15,
        true
      )
      .withTestBlockBuilder(
        new TestBlockBuilder()
          .asDescribe('Complex API Tests')
          .withChildren([
            new TestBlockBuilder().asIt('should validate response').asRequestSpecific(true).build(),
            new TestBlockBuilder().asIt('should setup test data').asRequestSpecific(false).build(),
          ])
      );
  }

  /**
   * Create a minimal test file
   * @returns Minimal configured builder
   */
  static minimal(): ParsedSourceBuilder {
    return new ParsedSourceBuilder()
      .withImport('mocha', ['it'])
      .withTestBlockBuilder(new TestBlockBuilder().asIt('basic test'))
      .withSourceCode("import { it } from 'mocha'; it('basic test', () => {});");
  }

  /**
   * Create an empty parsed source
   * @returns Empty builder
   */
  static empty(): ParsedSourceBuilder {
    return new ParsedSourceBuilder().withSourceCode('');
  }

  /**
   * Create a source with only imports
   * @returns Builder with only imports
   */
  static importsOnly(): ParsedSourceBuilder {
    return new ParsedSourceBuilder()
      .withImport('mocha', ['describe', 'it'])
      .withImport('chai', ['expect'])
      .withImport('axios', ['AxiosResponse'], true)
      .withSourceCode(
        `
import { describe, it } from 'mocha';
import { expect } from 'chai';
import type { AxiosResponse } from 'axios';
      `.trim()
      );
  }

  /**
   * Create a source with realistic complexity
   * @returns Builder with realistic test structure
   */
  static realistic(): ParsedSourceBuilder {
    return new ParsedSourceBuilder()
      .withImport('mocha', ['describe', 'it', 'beforeEach', 'afterEach'])
      .withImport('chai', ['expect'])
      .withImport('@apicize/lib', ['TestHelper', 'ApicizeContext', 'BodyType'])
      .withGlobalVariable('helper', 'TestHelper', 'new TestHelper()', true, 4)
      .withGlobalVariable('context', 'ApicizeContext', undefined, false, 5)
      .withHelperFunction(
        'setupAuth',
        ['token: string'],
        'void',
        'context.setHeader("Authorization", `Bearer ${token}`);',
        7
      )
      .withTestBlockBuilder(
        new TestBlockBuilder().asDescribe('E-commerce API').withChildren([
          new TestBlockBuilder()
            .asDescribe('User Management')
            .asRequestSpecific(true)
            .withChildren([
              new TestBlockBuilder().asIt('should create user').asRequestSpecific(true).build(),
              new TestBlockBuilder().asIt('should get user').asRequestSpecific(true).build(),
            ])
            .build(),
          new TestBlockBuilder()
            .asDescribe('Utilities')
            .asRequestSpecific(false)
            .withChildren([
              new TestBlockBuilder()
                .asIt('should format currency')
                .asRequestSpecific(false)
                .build(),
            ])
            .build(),
        ])
      );
  }
}
