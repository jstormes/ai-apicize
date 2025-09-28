/**
 * Test data builder for TestBlock entities
 * Provides fluent interface for creating test data
 */

import { TestBlock, TestBlockType } from '../../domain/test-analysis/entities/TestBlock';
import { TestName } from '../../domain/test-analysis/value-objects/TestName';
import { SourceCode } from '../../domain/test-analysis/value-objects/SourceCode';
import { SourcePosition } from '../../domain/test-analysis/value-objects/SourcePosition';

/**
 * Builder for creating TestBlock instances with fluent interface
 */
export class TestBlockBuilder {
  private type: TestBlockType = TestBlockType.It;
  private name: string = 'Test Block';
  private code: string = 'expect(true).to.be.true;';
  private start: number = 0;
  private end: number = 100;
  private lineNumber: number = 1;
  private depth: number = 0;
  private children: TestBlock[] = [];
  private isRequestSpecific: boolean = false;

  /**
   * Set the test block type
   * @param type The type (TestBlockType.Describe or TestBlockType.It)
   * @returns Builder instance for chaining
   */
  withType(type: TestBlockType): this {
    this.type = type;
    return this;
  }

  /**
   * Set the test block name
   * @param name The test name
   * @returns Builder instance for chaining
   */
  withName(name: string): this {
    this.name = name;
    return this;
  }

  /**
   * Set the test code content
   * @param code The test code
   * @returns Builder instance for chaining
   */
  withCode(code: string): this {
    this.code = code;
    return this;
  }

  /**
   * Set the source position
   * @param start Start position
   * @param end End position
   * @param lineNumber Line number
   * @returns Builder instance for chaining
   */
  withPosition(start: number, end: number, lineNumber: number): this {
    this.start = start;
    this.end = end;
    this.lineNumber = lineNumber;
    return this;
  }

  /**
   * Set the nesting depth
   * @param depth The depth level
   * @returns Builder instance for chaining
   */
  withDepth(depth: number): this {
    this.depth = depth;
    return this;
  }

  /**
   * Add child test blocks
   * @param children Array of child test blocks
   * @returns Builder instance for chaining
   */
  withChildren(children: TestBlock[]): this {
    this.children = children;
    return this;
  }

  /**
   * Add a single child test block
   * @param child Child test block
   * @returns Builder instance for chaining
   */
  withChild(child: TestBlock): this {
    this.children.push(child);
    return this;
  }

  /**
   * Set whether this test is request-specific
   * @param isRequestSpecific Whether the test is request-specific
   * @returns Builder instance for chaining
   */
  asRequestSpecific(isRequestSpecific: boolean = true): this {
    this.isRequestSpecific = isRequestSpecific;
    return this;
  }

  /**
   * Mark as a describe block
   * @param name Optional name for the describe block
   * @returns Builder instance for chaining
   */
  asDescribe(name?: string): this {
    this.type = TestBlockType.Describe;
    if (name) {
      this.name = name;
    }
    return this;
  }

  /**
   * Mark as an it block
   * @param name Optional name for the it block
   * @returns Builder instance for chaining
   */
  asIt(name?: string): this {
    this.type = TestBlockType.It;
    if (name) {
      this.name = name;
    }
    return this;
  }

  /**
   * Build the TestBlock instance
   * @returns Constructed TestBlock
   */
  build(): TestBlock {
    const testNameResult = TestName.create(this.name);
    const sourceCodeResult = SourceCode.create(this.code);
    const positionResult = SourcePosition.create(this.start, this.end, this.lineNumber);

    if (!testNameResult.success) {
      throw new Error(`Failed to create TestName: ${testNameResult.error?.message}`);
    }
    if (!sourceCodeResult.success) {
      throw new Error(`Failed to create SourceCode: ${sourceCodeResult.error?.message}`);
    }
    if (!positionResult.success) {
      throw new Error(`Failed to create SourcePosition: ${positionResult.error?.message}`);
    }

    const testBlockResult = TestBlock.create({
      id: 'test-block-' + Date.now(),
      type: this.type,
      name: testNameResult.data,
      code: sourceCodeResult.data,
      fullCode: sourceCodeResult.data,
      position: positionResult.data,
      depth: this.depth,
      isRequestSpecific: this.isRequestSpecific
    });

    if (!testBlockResult.success) {
      throw new Error(`Failed to create TestBlock: ${testBlockResult.error?.message}`);
    }

    return testBlockResult.data;
  }

  /**
   * Create a new builder with the same configuration
   * @returns New builder instance
   */
  clone(): TestBlockBuilder {
    const builder = new TestBlockBuilder();
    builder.type = this.type;
    builder.name = this.name;
    builder.code = this.code;
    builder.start = this.start;
    builder.end = this.end;
    builder.lineNumber = this.lineNumber;
    builder.depth = this.depth;
    builder.children = [...this.children];
    builder.isRequestSpecific = this.isRequestSpecific;
    return builder;
  }
}

/**
 * Convenience function to create a TestBlockBuilder
 * @returns New TestBlockBuilder instance
 */
export function testBlock(): TestBlockBuilder {
  return new TestBlockBuilder();
}

/**
 * Predefined builder configurations for common scenarios
 */
export class TestBlockBuilderPresets {
  /**
   * Create a simple API test block
   * @param name Test name
   * @returns Configured builder
   */
  static apiTest(name: string = 'should make API request'): TestBlockBuilder {
    return new TestBlockBuilder()
      .asIt(name)
      .withCode(
        `
        expect(response.status).to.equal(200);
        expect(response.body.data).to.exist;
      `.trim()
      )
      .asRequestSpecific(true);
  }

  /**
   * Create a describe block for API endpoints
   * @param endpoint Endpoint name
   * @returns Configured builder
   */
  static apiEndpoint(endpoint: string): TestBlockBuilder {
    return new TestBlockBuilder().asDescribe(`${endpoint} endpoint`).asRequestSpecific(true);
  }

  /**
   * Create a shared utility test
   * @param name Test name
   * @returns Configured builder
   */
  static sharedTest(name: string = 'should work correctly'): TestBlockBuilder {
    return new TestBlockBuilder()
      .asIt(name)
      .withCode('expect(true).to.be.true;')
      .asRequestSpecific(false);
  }

  /**
   * Create a complex nested test structure
   * @returns Configured builder with nested children
   */
  static nestedApiTests(): TestBlockBuilder {
    return new TestBlockBuilder()
      .asDescribe('User Management API')
      .asRequestSpecific(true)
      .withChildren([
        TestBlockBuilderPresets.apiTest('should create user').build(),
        TestBlockBuilderPresets.apiTest('should get user').build(),
        TestBlockBuilderPresets.apiTest('should update user').build(),
        TestBlockBuilderPresets.apiTest('should delete user').build(),
      ]);
  }

  /**
   * Create a test with realistic complexity
   * @returns Configured builder
   */
  static complexTest(): TestBlockBuilder {
    return new TestBlockBuilder()
      .asIt('should handle complex validation scenario')
      .withCode(
        `
        // Arrange
        const userData = { name: 'John', email: 'john@example.com' };

        // Act
        const response = await createUser(userData);

        // Assert
        expect(response.status).to.equal(201);
        expect(response.body.data.id).to.be.a('string');
        expect(response.body.data.name).to.equal(userData.name);
        expect(response.body.data.email).to.equal(userData.email);
        expect(response.body.data.createdAt).to.be.a('string');

        // Cleanup
        output('userId', response.body.data.id);
      `.trim()
      )
      .asRequestSpecific(true);
  }
}
