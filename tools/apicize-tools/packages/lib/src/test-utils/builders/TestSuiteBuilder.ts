/**
 * Test data builder for TestSuite entities
 * Provides fluent interface for creating test suite data
 */

import { TestSuite } from '../../domain/test-analysis/entities/TestSuite';
import { TestBlock } from '../../domain/test-analysis/entities/TestBlock';
import { CodeMetadata } from '../../domain/test-analysis/entities/CodeMetadata';
import { TestBlockBuilder, TestBlockBuilderPresets } from './TestBlockBuilder';
import { CodeMetadataBuilder } from './CodeMetadataBuilder';

/**
 * Builder for creating TestSuite instances with fluent interface
 */
export class TestSuiteBuilder {
  private name: string = 'Test Suite';
  private testBlocks: TestBlock[] = [];
  private metadata: CodeMetadata = new CodeMetadataBuilder().build();

  /**
   * Set the test suite name
   * @param name The suite name
   * @returns Builder instance for chaining
   */
  withName(name: string): this {
    this.name = name;
    return this;
  }

  /**
   * Set the test blocks
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
   * Set the metadata
   * @param metadata Code metadata
   * @returns Builder instance for chaining
   */
  withMetadata(metadata: CodeMetadata): this {
    this.metadata = metadata;
    return this;
  }

  /**
   * Set metadata using a builder
   * @param builder Metadata builder
   * @returns Builder instance for chaining
   */
  withMetadataBuilder(builder: CodeMetadataBuilder): this {
    this.metadata = builder.build();
    return this;
  }

  /**
   * Build the TestSuite instance
   * @returns Constructed TestSuite
   */
  build(): TestSuite {
    const result = TestSuite.create({
      id: 'test-suite-' + Date.now(),
      name: this.name
    });

    if (!result.success) {
      throw new Error(`Failed to create TestSuite: ${result.error?.message}`);
    }

    return result.data;
  }

  /**
   * Create a new builder with the same configuration
   * @returns New builder instance
   */
  clone(): TestSuiteBuilder {
    const builder = new TestSuiteBuilder();
    builder.name = this.name;
    builder.testBlocks = [...this.testBlocks];
    builder.metadata = this.metadata;
    return builder;
  }
}

/**
 * Convenience function to create a TestSuiteBuilder
 * @returns New TestSuiteBuilder instance
 */
export function testSuite(): TestSuiteBuilder {
  return new TestSuiteBuilder();
}

/**
 * Predefined builder configurations for common test suite scenarios
 */
export class TestSuiteBuilderPresets {
  /**
   * Create a simple API test suite
   * @param apiName API name
   * @returns Configured builder
   */
  static apiTestSuite(apiName: string = 'REST API'): TestSuiteBuilder {
    return new TestSuiteBuilder().withName(`${apiName} Tests`).withTestBlocks([
      TestBlockBuilderPresets.apiEndpoint('users')
        .withChildren([
          TestBlockBuilderPresets.apiTest('should create user').build(),
          TestBlockBuilderPresets.apiTest('should get user').build(),
        ])
        .build(),
      TestBlockBuilderPresets.apiEndpoint('products')
        .withChildren([
          TestBlockBuilderPresets.apiTest('should list products').build(),
          TestBlockBuilderPresets.apiTest('should get product').build(),
        ])
        .build(),
    ]);
  }

  /**
   * Create a mixed test suite with both API and shared tests
   * @returns Configured builder
   */
  static mixedTestSuite(): TestSuiteBuilder {
    return new TestSuiteBuilder().withName('Mixed Test Suite').withTestBlocks([
      TestBlockBuilderPresets.apiEndpoint('authentication')
        .withChildren([
          TestBlockBuilderPresets.apiTest('should login successfully').build(),
          TestBlockBuilderPresets.apiTest('should handle invalid credentials').build(),
        ])
        .build(),
      new TestBlockBuilder()
        .asDescribe('Utility Functions')
        .asRequestSpecific(false)
        .withChildren([
          TestBlockBuilderPresets.sharedTest('should validate email format').build(),
          TestBlockBuilderPresets.sharedTest('should format dates correctly').build(),
        ])
        .build(),
    ]);
  }

  /**
   * Create a comprehensive test suite with realistic structure
   * @returns Configured builder
   */
  static comprehensiveTestSuite(): TestSuiteBuilder {
    return new TestSuiteBuilder().withName('E-commerce API Test Suite').withTestBlocks([
      // Authentication tests
      TestBlockBuilderPresets.apiEndpoint('authentication')
        .withChildren([
          TestBlockBuilderPresets.apiTest('should register new user').build(),
          TestBlockBuilderPresets.apiTest('should login with valid credentials').build(),
          TestBlockBuilderPresets.apiTest('should reject invalid credentials').build(),
          TestBlockBuilderPresets.apiTest('should refresh authentication token').build(),
        ])
        .build(),

      // User management tests
      TestBlockBuilderPresets.apiEndpoint('users')
        .withChildren([
          TestBlockBuilderPresets.apiTest('should get user profile').build(),
          TestBlockBuilderPresets.apiTest('should update user profile').build(),
          TestBlockBuilderPresets.apiTest('should delete user account').build(),
        ])
        .build(),

      // Product management tests
      TestBlockBuilderPresets.apiEndpoint('products')
        .withChildren([
          TestBlockBuilderPresets.apiTest('should list all products').build(),
          TestBlockBuilderPresets.apiTest('should get product by id').build(),
          TestBlockBuilderPresets.apiTest('should search products').build(),
          TestBlockBuilderPresets.complexTest().build(),
        ])
        .build(),

      // Shared utility tests
      new TestBlockBuilder()
        .asDescribe('Shared Utilities')
        .asRequestSpecific(false)
        .withChildren([
          TestBlockBuilderPresets.sharedTest('should validate input data').build(),
          TestBlockBuilderPresets.sharedTest('should format currency').build(),
          TestBlockBuilderPresets.sharedTest('should calculate tax').build(),
        ])
        .build(),
    ]);
  }

  /**
   * Create an empty test suite
   * @returns Empty test suite builder
   */
  static empty(): TestSuiteBuilder {
    return new TestSuiteBuilder().withName('Empty Test Suite').withTestBlocks([]);
  }

  /**
   * Create a test suite with only request-specific tests
   * @returns Request-specific test suite builder
   */
  static requestSpecificOnly(): TestSuiteBuilder {
    return new TestSuiteBuilder()
      .withName('Request-Specific Tests Only')
      .withTestBlocks([
        TestBlockBuilderPresets.apiTest('API test 1').build(),
        TestBlockBuilderPresets.apiTest('API test 2').build(),
        TestBlockBuilderPresets.apiTest('API test 3').build(),
      ]);
  }

  /**
   * Create a test suite with only shared tests
   * @returns Shared test suite builder
   */
  static sharedOnly(): TestSuiteBuilder {
    return new TestSuiteBuilder()
      .withName('Shared Tests Only')
      .withTestBlocks([
        TestBlockBuilderPresets.sharedTest('Shared test 1').build(),
        TestBlockBuilderPresets.sharedTest('Shared test 2').build(),
        TestBlockBuilderPresets.sharedTest('Shared test 3').build(),
      ]);
  }

  /**
   * Create a deeply nested test suite
   * @returns Nested test suite builder
   */
  static deeplyNested(): TestSuiteBuilder {
    const level3Tests = [
      TestBlockBuilderPresets.apiTest('Level 3 test 1').withDepth(3).build(),
      TestBlockBuilderPresets.apiTest('Level 3 test 2').withDepth(3).build(),
    ];

    const level2Tests = [
      new TestBlockBuilder()
        .asDescribe('Level 2 Group 1')
        .withDepth(2)
        .withChildren(level3Tests)
        .build(),
      new TestBlockBuilder()
        .asDescribe('Level 2 Group 2')
        .withDepth(2)
        .withChildren([...level3Tests])
        .build(),
    ];

    const level1Tests = [
      new TestBlockBuilder()
        .asDescribe('Level 1 Group')
        .withDepth(1)
        .withChildren(level2Tests)
        .build(),
    ];

    return new TestSuiteBuilder().withName('Deeply Nested Test Suite').withTestBlocks(level1Tests);
  }
}
