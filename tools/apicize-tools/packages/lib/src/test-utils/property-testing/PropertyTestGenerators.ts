/**
 * Property-based test generators for Apicize components
 * Provides generators for creating test data with various properties
 */

/**
 * Simple property-based testing framework
 * (In production, you might use a library like fast-check)
 */

/**
 * Generator function type
 */
export type Generator<T> = () => T;

/**
 * Property test configuration
 */
export interface PropertyTestConfig {
  iterations?: number;
  seed?: number;
}

/**
 * Default property test configuration
 */
export const DEFAULT_PROPERTY_CONFIG: Required<PropertyTestConfig> = {
  iterations: 100,
  seed: Date.now(),
};

/**
 * Simple random number generator with seed support
 */
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  integer(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  boolean(): boolean {
    return this.next() < 0.5;
  }

  choice<T>(items: T[]): T {
    return items[this.integer(0, items.length - 1)];
  }

  string(minLength: number = 1, maxLength: number = 20): string {
    const length = this.integer(minLength, maxLength);
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars[this.integer(0, chars.length - 1)];
    }
    return result;
  }
}

/**
 * Property test generators for domain objects
 */
export class PropertyGenerators {
  private random: SeededRandom;

  constructor(seed?: number) {
    this.random = new SeededRandom(seed || Date.now());
  }

  /**
   * Generate random test names
   */
  testName(): Generator<string> {
    return () => {
      const prefixes = ['should', 'must', 'can', 'will', 'might', 'could'];

      const actions = [
        'create',
        'update',
        'delete',
        'validate',
        'process',
        'handle',
        'manage',
        'execute',
        'analyze',
        'extract',
      ];

      const objects = [
        'user',
        'data',
        'request',
        'response',
        'test',
        'metadata',
        'configuration',
        'result',
        'error',
        'content',
      ];

      const modifiers = [
        'correctly',
        'successfully',
        'properly',
        'efficiently',
        'gracefully',
        'accurately',
        'safely',
        'quickly',
      ];

      const prefix = this.random.choice(prefixes);
      const action = this.random.choice(actions);
      const object = this.random.choice(objects);
      const modifier = this.random.boolean() ? ` ${this.random.choice(modifiers)}` : '';

      return `${prefix} ${action} ${object}${modifier}`;
    };
  }

  /**
   * Generate random test code
   */
  testCode(): Generator<string> {
    return () => {
      const patterns = [
        () => `expect(${this.random.string(3, 10)}).to.equal(${this.random.integer(1, 100)});`,
        () => `expect(${this.random.string(3, 10)}).to.be.true;`,
        () => `expect(${this.random.string(3, 10)}).to.exist;`,
        () => `expect(response.status).to.equal(${this.random.choice([200, 201, 400, 404, 500])});`,
        () =>
          `expect(response.body.data).to.be.an('${this.random.choice(['object', 'array', 'string'])}');`,
        () => `output('${this.random.string(5, 15)}', ${this.random.string(3, 10)});`,
        () => `console.log('${this.random.string(10, 30)}');`,
      ];

      const patternCount = this.random.integer(1, 3);
      const lines = [];

      for (let i = 0; i < patternCount; i++) {
        const pattern = this.random.choice(patterns);
        lines.push(pattern());
      }

      return lines.join('\n');
    };
  }

  /**
   * Generate random source positions
   */
  sourcePosition(): Generator<{ start: number; end: number; lineNumber: number }> {
    return () => {
      const start = this.random.integer(0, 10000);
      const length = this.random.integer(10, 500);
      const lineNumber = this.random.integer(1, 1000);

      return {
        start,
        end: start + length,
        lineNumber,
      };
    };
  }

  /**
   * Generate random test types
   */
  testType(): Generator<'describe' | 'it'> {
    return () => this.random.choice(['describe', 'it']);
  }

  /**
   * Generate random depths
   */
  depth(): Generator<number> {
    return () => this.random.integer(0, 5);
  }

  /**
   * Generate random boolean values
   */
  boolean(): Generator<boolean> {
    return () => this.random.boolean();
  }

  /**
   * Generate random import statements
   */
  importStatement(): Generator<{ source: string; imports: string[]; isTypeImport: boolean }> {
    return () => {
      const sources = [
        'mocha',
        'chai',
        'lodash',
        'axios',
        '@apicize/lib',
        './helper',
        '../utils',
        '../../types',
      ];

      const importNames = [
        'describe',
        'it',
        'expect',
        'should',
        'beforeEach',
        'afterEach',
        'TestHelper',
        'ApicizeResponse',
        'BodyType',
      ];

      const source = this.random.choice(sources);
      const importCount = this.random.integer(1, 4);
      const imports = [];

      for (let i = 0; i < importCount; i++) {
        imports.push(this.random.choice(importNames));
      }

      return {
        source,
        imports: [...new Set(imports)], // Remove duplicates
        isTypeImport: this.random.boolean(),
      };
    };
  }

  /**
   * Generate random variable declarations
   */
  variableDeclaration(): Generator<{
    name: string;
    type: string;
    value?: string;
    isConst: boolean;
    lineNumber: number;
  }> {
    return () => {
      const names = [
        'response',
        'context',
        'helper',
        'config',
        'data',
        'result',
        'user',
        'product',
        'order',
      ];

      const types = [
        'any',
        'string',
        'number',
        'boolean',
        'object',
        'ApicizeResponse',
        'TestHelper',
        'UserData',
      ];

      const values = [
        undefined,
        'null',
        'undefined',
        '"test value"',
        '42',
        'true',
        'false',
        '{}',
        '[]',
        'new TestHelper()',
      ];

      return {
        name: this.random.choice(names),
        type: this.random.choice(types),
        value: this.random.choice(values),
        isConst: this.random.boolean(),
        lineNumber: this.random.integer(1, 100),
      };
    };
  }

  /**
   * Generate random function declarations
   */
  functionDeclaration(): Generator<{
    name: string;
    parameters: string[];
    returnType: string;
    code: string;
    lineNumber: number;
    isAsync: boolean;
  }> {
    return () => {
      const names = [
        'validateEmail',
        'formatDate',
        'calculateTotal',
        'setupTest',
        'cleanupTest',
        'processData',
        'handleError',
      ];

      const parameterNames = [
        'email: string',
        'date: Date',
        'amount: number',
        'data: any',
        'options: object',
      ];

      const returnTypes = ['void', 'boolean', 'string', 'number', 'Promise<void>', 'Promise<any>'];

      const paramCount = this.random.integer(0, 3);
      const parameters = [];

      for (let i = 0; i < paramCount; i++) {
        parameters.push(this.random.choice(parameterNames));
      }

      return {
        name: this.random.choice(names),
        parameters: [...new Set(parameters)],
        returnType: this.random.choice(returnTypes),
        code: `return ${this.random.string(5, 20)};`,
        lineNumber: this.random.integer(1, 100),
        isAsync: this.random.boolean(),
      };
    };
  }

  /**
   * Generate arrays of items using a generator
   */
  array<T>(generator: Generator<T>, minLength: number = 0, maxLength: number = 10): Generator<T[]> {
    return () => {
      const length = this.random.integer(minLength, maxLength);
      const items = [];

      for (let i = 0; i < length; i++) {
        items.push(generator());
      }

      return items;
    };
  }

  /**
   * Generate optional values
   */
  optional<T>(generator: Generator<T>, probability: number = 0.5): Generator<T | undefined> {
    return () => {
      return this.random.next() < probability ? generator() : undefined;
    };
  }
}

/**
 * Property-based test runner
 */
export class PropertyTestRunner {
  /**
   * Run a property-based test
   * @param property Property function to test
   * @param config Test configuration
   */
  static test<T>(
    property: (value: T) => boolean | void,
    generator: Generator<T>,
    config: PropertyTestConfig = {}
  ): void {
    const effectiveConfig = { ...DEFAULT_PROPERTY_CONFIG, ...config };
    const propertyGenerator = new PropertyGenerators(effectiveConfig.seed);

    for (let i = 0; i < effectiveConfig.iterations; i++) {
      try {
        const testValue = generator();
        const result = property(testValue);

        // If property returns false, the test fails
        if (result === false) {
          throw new Error(
            `Property test failed on iteration ${i + 1} with value: ${JSON.stringify(testValue)}`
          );
        }
      } catch (error) {
        throw new Error(
          `Property test failed on iteration ${i + 1}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  /**
   * Run a property-based test with async property
   * @param property Async property function to test
   * @param config Test configuration
   */
  static async testAsync<T>(
    property: (value: T) => Promise<boolean | void>,
    generator: Generator<T>,
    config: PropertyTestConfig = {}
  ): Promise<void> {
    const effectiveConfig = { ...DEFAULT_PROPERTY_CONFIG, ...config };

    for (let i = 0; i < effectiveConfig.iterations; i++) {
      try {
        const testValue = generator();
        const result = await property(testValue);

        // If property returns false, the test fails
        if (result === false) {
          throw new Error(
            `Async property test failed on iteration ${i + 1} with value: ${JSON.stringify(testValue)}`
          );
        }
      } catch (error) {
        throw new Error(
          `Async property test failed on iteration ${i + 1}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }
}

/**
 * Common property test patterns
 */
export const propertyPatterns = {
  /**
   * Test that a function is idempotent
   */
  idempotent:
    <T>(fn: (value: T) => T) =>
    (value: T) => {
      const result1 = fn(value);
      const result2 = fn(result1);
      return JSON.stringify(result1) === JSON.stringify(result2);
    },

  /**
   * Test that a function preserves certain properties
   */
  preserves:
    <T>(fn: (value: T) => T, check: (value: T) => boolean) =>
    (value: T) => {
      if (!check(value)) return true; // Skip if input doesn't satisfy precondition
      const result = fn(value);
      return check(result);
    },

  /**
   * Test round-trip property (serialize then deserialize should be identity)
   */
  roundTrip:
    <T>(serialize: (value: T) => string, deserialize: (value: string) => T) =>
    (value: T) => {
      try {
        const serialized = serialize(value);
        const deserialized = deserialize(serialized);
        return JSON.stringify(value) === JSON.stringify(deserialized);
      } catch {
        return false;
      }
    },

  /**
   * Test that a function never throws with valid input
   */
  neverThrows:
    <T>(fn: (value: T) => any, isValidInput: (value: T) => boolean) =>
    (value: T) => {
      if (!isValidInput(value)) return true;
      try {
        fn(value);
        return true;
      } catch {
        return false;
      }
    },
};
