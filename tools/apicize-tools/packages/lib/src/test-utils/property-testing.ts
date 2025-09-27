/**
 * Property-based testing utilities for validation
 * Part of Phase 3: Testing Improvements
 */

import { ApicizeWorkbook, HttpMethod, BodyType, AuthorizationType } from '../types';

/**
 * Generator interface for property-based testing
 */
export interface Generator<T> {
  generate(): T;
  sample(count?: number): T[];
}

/**
 * Basic generators for primitive types
 */
export class BasicGenerators {
  /**
   * Generate random string
   */
  static string(minLength: number = 1, maxLength: number = 50): Generator<string> {
    return {
      generate(): string {
        const length = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join(
          ''
        );
      },
      sample(count = 10): string[] {
        return Array.from({ length: count }, () => this.generate());
      },
    };
  }

  /**
   * Generate random integer
   */
  static integer(min: number = 0, max: number = 1000): Generator<number> {
    return {
      generate(): number {
        return Math.floor(Math.random() * (max - min + 1)) + min;
      },
      sample(count = 10): number[] {
        return Array.from({ length: count }, () => this.generate());
      },
    };
  }

  /**
   * Generate random float
   */
  static float(min: number = 0, max: number = 1): Generator<number> {
    return {
      generate(): number {
        return Math.random() * (max - min) + min;
      },
      sample(count = 10): number[] {
        return Array.from({ length: count }, () => this.generate());
      },
    };
  }

  /**
   * Generate random boolean
   */
  static boolean(): Generator<boolean> {
    return {
      generate(): boolean {
        return Math.random() < 0.5;
      },
      sample(count = 10): boolean[] {
        return Array.from({ length: count }, () => this.generate());
      },
    };
  }

  /**
   * Generate random element from array
   */
  static oneOf<T>(items: T[]): Generator<T> {
    return {
      generate(): T {
        return items[Math.floor(Math.random() * items.length)];
      },
      sample(count = 10): T[] {
        return Array.from({ length: count }, () => this.generate());
      },
    };
  }

  /**
   * Generate arrays
   */
  static array<T>(
    itemGenerator: Generator<T>,
    minLength: number = 0,
    maxLength: number = 10
  ): Generator<T[]> {
    return {
      generate(): T[] {
        const length = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;
        return Array.from({ length }, () => itemGenerator.generate());
      },
      sample(count = 10): T[][] {
        return Array.from({ length: count }, () => this.generate());
      },
    };
  }

  /**
   * Generate optional values (may be undefined)
   */
  static optional<T>(generator: Generator<T>, probability: number = 0.5): Generator<T | undefined> {
    return {
      generate(): T | undefined {
        return Math.random() < probability ? generator.generate() : undefined;
      },
      sample(count = 10): (T | undefined)[] {
        return Array.from({ length: count }, () => this.generate());
      },
    };
  }
}

/**
 * Apicize-specific generators
 */
export class ApicizeGenerators {
  /**
   * Generate valid HTTP methods
   */
  static httpMethod(): Generator<HttpMethod> {
    const methods = Object.values(HttpMethod);
    return BasicGenerators.oneOf(methods);
  }

  /**
   * Generate valid body types
   */
  static bodyType(): Generator<BodyType> {
    const types = Object.values(BodyType);
    return BasicGenerators.oneOf(types);
  }

  /**
   * Generate valid authorization types
   */
  static authorizationType(): Generator<AuthorizationType> {
    const types = Object.values(AuthorizationType);
    return BasicGenerators.oneOf(types);
  }

  /**
   * Generate valid URLs
   */
  static url(): Generator<string> {
    const protocols = ['http', 'https'];
    const domains = ['api.example.com', 'test.api.com', 'localhost', 'api.test.io'];
    const paths = ['', '/users', '/items', '/auth', '/v1/data', '/api/v2/resources'];

    return {
      generate(): string {
        const protocol = protocols[Math.floor(Math.random() * protocols.length)];
        const domain = domains[Math.floor(Math.random() * domains.length)];
        const path = paths[Math.floor(Math.random() * paths.length)];
        const port = domain === 'localhost' ? `:${3000 + Math.floor(Math.random() * 1000)}` : '';
        return `${protocol}://${domain}${port}${path}`;
      },
      sample(count = 10): string[] {
        return Array.from({ length: count }, () => this.generate());
      },
    };
  }

  /**
   * Generate valid request headers
   */
  static headers(): Generator<Array<{ name: string; value: string }>> {
    const commonHeaders = [
      { name: 'Content-Type', value: 'application/json' },
      { name: 'Authorization', value: 'Bearer token-123' },
      { name: 'Accept', value: 'application/json' },
      { name: 'User-Agent', value: 'Apicize/1.0' },
      { name: 'X-API-Key', value: 'api-key-456' },
    ];

    return BasicGenerators.array(BasicGenerators.oneOf(commonHeaders), 0, 5);
  }

  /**
   * Generate valid query parameters
   */
  static queryParams(): Generator<Array<{ name: string; value: string }>> {
    const paramNames = ['page', 'limit', 'sort', 'filter', 'include', 'fields'];
    const paramValues = ['1', '10', 'asc', 'active', 'related', 'id,name'];

    const paramGenerator = {
      generate(): { name: string; value: string } {
        return {
          name: paramNames[Math.floor(Math.random() * paramNames.length)],
          value: paramValues[Math.floor(Math.random() * paramValues.length)],
        };
      },
      sample(count = 10): Array<{ name: string; value: string }> {
        return Array.from({ length: count }, () => this.generate());
      },
    };

    return BasicGenerators.array(paramGenerator, 0, 5);
  }

  /**
   * Generate valid request body
   */
  static requestBody(): Generator<{ type: BodyType; data?: any }> {
    return {
      generate(): { type: BodyType; data?: any } {
        const type = ApicizeGenerators.bodyType().generate();

        switch (type) {
          case BodyType.JSON:
            return {
              type,
              data: {
                id: BasicGenerators.integer(1, 1000).generate(),
                name: BasicGenerators.string(5, 20).generate(),
                active: BasicGenerators.boolean().generate(),
              },
            };
          case BodyType.Text:
            return {
              type,
              data: BasicGenerators.string(10, 100).generate(),
            };
          case BodyType.Form:
            return {
              type,
              data: [
                { name: 'field1', value: BasicGenerators.string().generate() },
                { name: 'field2', value: BasicGenerators.integer().generate().toString() },
              ],
            };
          case BodyType.None:
          default:
            return { type };
        }
      },
      sample(count = 10): Array<{ type: BodyType; data?: any }> {
        return Array.from({ length: count }, () => this.generate());
      },
    };
  }

  /**
   * Generate valid request configuration
   */
  static requestConfig(): Generator<any> {
    return {
      generate(): any {
        return {
          id: BasicGenerators.string(10, 20).generate(),
          name: BasicGenerators.string(5, 30).generate(),
          url: ApicizeGenerators.url().generate(),
          method: ApicizeGenerators.httpMethod().generate(),
          headers: ApicizeGenerators.headers().generate(),
          body: ApicizeGenerators.requestBody().generate(),
          queryStringParams: ApicizeGenerators.queryParams().generate(),
          timeout: BasicGenerators.optional(BasicGenerators.integer(1000, 60000)).generate(),
        };
      },
      sample(count = 10): any[] {
        return Array.from({ length: count }, () => this.generate());
      },
    };
  }

  /**
   * Generate valid scenario
   */
  static scenario(): Generator<any> {
    return {
      generate(): any {
        return {
          id: BasicGenerators.string(10, 20).generate(),
          name: BasicGenerators.string(5, 30).generate(),
          variables: BasicGenerators.array(
            {
              generate(): any {
                return {
                  name: BasicGenerators.string(3, 15).generate(),
                  value: BasicGenerators.string(1, 50).generate(),
                  type: BasicGenerators.oneOf(['TEXT', 'JSON', 'FILE-JSON', 'FILE-CSV']).generate(),
                };
              },
              sample(count = 10): any[] {
                return Array.from({ length: count }, () => this.generate());
              },
            },
            0,
            10
          ).generate(),
        };
      },
      sample(count = 10): any[] {
        return Array.from({ length: count }, () => this.generate());
      },
    };
  }

  /**
   * Generate valid workbook
   */
  static workbook(): Generator<ApicizeWorkbook> {
    return {
      generate(): ApicizeWorkbook {
        return {
          version: BasicGenerators.oneOf([1.0, 1.1, 1.2]).generate(),
          requests: BasicGenerators.array(ApicizeGenerators.requestConfig(), 0, 5).generate(),
          scenarios: BasicGenerators.array(ApicizeGenerators.scenario(), 0, 3).generate(),
          authorizations: BasicGenerators.array(
            {
              generate(): any {
                const type = ApicizeGenerators.authorizationType().generate();
                return {
                  id: BasicGenerators.string(10, 20).generate(),
                  name: BasicGenerators.string(5, 30).generate(),
                  type,
                  ...(type === AuthorizationType.Basic && {
                    username: BasicGenerators.string(3, 20).generate(),
                    password: BasicGenerators.string(6, 30).generate(),
                  }),
                  ...(type === AuthorizationType.ApiKey && {
                    header: BasicGenerators.oneOf(['X-API-Key', 'Authorization']).generate(),
                    value: BasicGenerators.string(10, 50).generate(),
                  }),
                };
              },
              sample(count = 10): any[] {
                return Array.from({ length: count }, () => this.generate());
              },
            },
            0,
            3
          ).generate(),
          certificates: [],
          proxies: [],
          data: [],
        };
      },
      sample(count = 10): ApicizeWorkbook[] {
        return Array.from({ length: count }, () => this.generate());
      },
    };
  }
}

/**
 * Property-based test runner
 */
export class PropertyTester {
  private maxIterations: number;

  constructor(maxIterations: number = 100, seed?: number) {
    this.maxIterations = maxIterations;
    if (seed !== undefined) {
      this.seedRandom(seed);
    }
  }

  /**
   * Test a property with generated inputs
   */
  test<T>(
    name: string,
    generator: Generator<T>,
    property: (value: T) => boolean | Promise<boolean>
  ): Promise<PropertyTestResult> {
    return this.testWithRetries(name, generator, property, this.maxIterations);
  }

  /**
   * Test a property and collect examples
   */
  async testWithExamples<T>(
    name: string,
    generator: Generator<T>,
    property: (value: T) => boolean | Promise<boolean>
  ): Promise<PropertyTestResultWithExamples<T>> {
    const startTime = Date.now();
    const examples: T[] = [];
    const counterexamples: T[] = [];

    for (let i = 0; i < this.maxIterations; i++) {
      const value = generator.generate();
      examples.push(value);

      try {
        const result = await property(value);
        if (!result) {
          counterexamples.push(value);
          return {
            name,
            passed: false,
            iterations: i + 1,
            counterexample: value,
            counterexamples,
            examples: examples.slice(0, 10), // Keep first 10 examples
            duration: Date.now() - startTime,
          };
        }
      } catch (error) {
        counterexamples.push(value);
        return {
          name,
          passed: false,
          iterations: i + 1,
          counterexample: value,
          counterexamples,
          examples: examples.slice(0, 10),
          error: error instanceof Error ? error : new Error(String(error)),
          duration: Date.now() - startTime,
        };
      }
    }

    return {
      name,
      passed: true,
      iterations: this.maxIterations,
      counterexamples,
      examples: examples.slice(0, 10),
      duration: Date.now() - startTime,
    };
  }

  /**
   * Test multiple properties as a suite
   */
  async testSuite(
    tests: Array<{
      name: string;
      generator: Generator<any>;
      property: (value: any) => boolean | Promise<boolean>;
    }>
  ): Promise<PropertyTestSuiteResult> {
    const startTime = Date.now();
    const results: PropertyTestResult[] = [];

    for (const test of tests) {
      const result = await this.test(test.name, test.generator, test.property);
      results.push(result);
    }

    const passed = results.every(r => r.passed);
    const totalIterations = results.reduce((sum, r) => sum + r.iterations, 0);

    return {
      passed,
      totalTests: tests.length,
      passedTests: results.filter(r => r.passed).length,
      failedTests: results.filter(r => !r.passed).length,
      totalIterations,
      results,
      duration: Date.now() - startTime,
    };
  }

  private async testWithRetries<T>(
    name: string,
    generator: Generator<T>,
    property: (value: T) => boolean | Promise<boolean>,
    maxIterations: number
  ): Promise<PropertyTestResult> {
    const startTime = Date.now();

    for (let i = 0; i < maxIterations; i++) {
      const value = generator.generate();

      try {
        const result = await property(value);
        if (!result) {
          return {
            name,
            passed: false,
            iterations: i + 1,
            counterexample: value,
            duration: Date.now() - startTime,
          };
        }
      } catch (error) {
        return {
          name,
          passed: false,
          iterations: i + 1,
          counterexample: value,
          error: error instanceof Error ? error : new Error(String(error)),
          duration: Date.now() - startTime,
        };
      }
    }

    return {
      name,
      passed: true,
      iterations: maxIterations,
      duration: Date.now() - startTime,
    };
  }

  private seedRandom(seed: number): void {
    // Simple seeded random number generator for reproducible tests
    let current = seed;
    Math.random = () => {
      current = (current * 9301 + 49297) % 233280;
      return current / 233280;
    };
  }
}

/**
 * Property test result interfaces
 */
export interface PropertyTestResult {
  name: string;
  passed: boolean;
  iterations: number;
  counterexample?: any;
  error?: Error;
  duration: number;
}

export interface PropertyTestResultWithExamples<T> extends PropertyTestResult {
  examples: T[];
  counterexamples: T[];
}

export interface PropertyTestSuiteResult {
  passed: boolean;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  totalIterations: number;
  results: PropertyTestResult[];
  duration: number;
}

/**
 * Common property tests for Apicize components
 */
export class ApicizePropertyTests {
  /**
   * Test that workbook serialization is idempotent
   */
  static serializationIdempotent() {
    return {
      name: 'Workbook serialization is idempotent',
      generator: ApicizeGenerators.workbook(),
      property: (workbook: ApicizeWorkbook) => {
        const serialized = JSON.stringify(workbook);
        const parsed = JSON.parse(serialized);
        const reSerialized = JSON.stringify(parsed);
        return serialized === reSerialized;
      },
    };
  }

  /**
   * Test that valid workbooks always pass validation
   */
  static validWorkbooksPassValidation() {
    return {
      name: 'Valid workbooks pass validation',
      generator: ApicizeGenerators.workbook(),
      property: (workbook: ApicizeWorkbook) => {
        // Basic validation rules
        return (
          typeof workbook.version === 'number' &&
          workbook.version > 0 &&
          Array.isArray(workbook.requests) &&
          Array.isArray(workbook.scenarios) &&
          Array.isArray(workbook.authorizations)
        );
      },
    };
  }

  /**
   * Test that request URLs are always valid
   */
  static requestUrlsAreValid() {
    return {
      name: 'Generated request URLs are valid',
      generator: ApicizeGenerators.url(),
      property: (url: string) => {
        try {
          new URL(url);
          return true;
        } catch {
          return false;
        }
      },
    };
  }

  /**
   * Test that HTTP methods are valid
   */
  static httpMethodsAreValid() {
    return {
      name: 'Generated HTTP methods are valid',
      generator: ApicizeGenerators.httpMethod(),
      property: (method: HttpMethod) => {
        const validMethods = Object.values(HttpMethod);
        return validMethods.includes(method);
      },
    };
  }

  /**
   * Get all common property tests
   */
  static getAllTests() {
    return [
      this.serializationIdempotent(),
      this.validWorkbooksPassValidation(),
      this.requestUrlsAreValid(),
      this.httpMethodsAreValid(),
    ];
  }
}
