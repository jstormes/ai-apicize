/**
 * Integration tests for complete test extraction flow
 * Tests the full pipeline from source code to extraction results
 */

import { TestExtractorFactory } from '../../infrastructure/factories/TestExtractorFactory';
import { testHelpers } from '../../test-utils';

describe('Test Extraction Flow (Integration Tests)', () => {
  const { assertions } = testHelpers;

  describe('end-to-end extraction', () => {
    it('should extract tests from realistic TypeScript content', async () => {
      // Arrange
      const extractor = TestExtractorFactory.createDefault();
      const sourceCode = `
        import { describe, it, beforeEach } from 'mocha';
        import { expect } from 'chai';
        import { TestHelper, ApicizeResponse, BodyType } from '@apicize/lib';

        let response: ApicizeResponse;
        let context: any;
        const helper = new TestHelper();

        /* @apicize-request-metadata
        {
          "id": "user-create-request",
          "method": "POST",
          "url": "/api/users",
          "headers": [{"name": "Content-Type", "value": "application/json"}]
        }
        @apicize-request-metadata-end */

        describe('User Management API', () => {
          beforeEach(async () => {
            context = await helper.setupTest('user-management');
            response = await context.execute({
              method: 'POST',
              url: '/api/users',
              body: { name: 'John Doe', email: 'john@example.com' }
            });
          });

          describe('User Creation', () => {
            it('should create a new user successfully', () => {
              expect(response.status).to.equal(201);

              const data = (response.body.type === BodyType.JSON)
                ? response.body.data
                : expect.fail('Response body is not JSON');

              expect(data.id).to.be.a('string');
              expect(data.name).to.equal('John Doe');
              expect(data.email).to.equal('john@example.com');
              expect(data.createdAt).to.be.a('string');

              // Pass user ID to next test
              output('userId', data.id);
            });

            it('should validate required fields', () => {
              expect(response.status).to.not.equal(400);

              if (response.status === 400) {
                const errorData = (response.body.type === BodyType.JSON)
                  ? response.body.data
                  : expect.fail('Error response body is not JSON');

                expect(errorData.message).to.include('required');
              }
            });
          });

          describe('User Retrieval', () => {
            it('should get user by ID', () => {
              expect(response.status).to.equal(200);

              const data = (response.body.type === BodyType.JSON)
                ? response.body.data
                : expect.fail('Response body is not JSON');

              expect(data.id).to.equal($.userId);
              expect(data.name).to.exist;
              expect(data.email).to.exist;
            });
          });
        });

        describe('Utility Functions', () => {
          it('should validate email format', () => {
            const validEmail = 'test@example.com';
            const invalidEmail = 'invalid-email';

            expect(validateEmail(validEmail)).to.be.true;
            expect(validateEmail(invalidEmail)).to.be.false;
          });

          it('should format user display name', () => {
            const user = { firstName: 'John', lastName: 'Doe' };
            const displayName = formatDisplayName(user);

            expect(displayName).to.equal('John Doe');
          });
        });

        function validateEmail(email: string): boolean {
          const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
          return emailRegex.test(email);
        }

        function formatDisplayName(user: { firstName: string; lastName: string }): string {
          return \`\${user.firstName} \${user.lastName}\`;
        }
      `;

      // Act
      const result = await extractor.extractTests(sourceCode, {
        enableAnalysis: true,
        enableValidation: true,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();

      if (result.data) {
        const extractionResult = result.data;

        assertions.extractionResult.isValid(extractionResult);

        // Verify extraction structure
        assertions.extractionResult.hasStructure(extractionResult, {
          totalTests: 5, // 4 API tests + 2 utility tests - 1 setup describe = 5 test blocks
          requestSpecificCount: 3, // API-related tests
          sharedTestsCount: 2, // Utility tests
          importsCount: 3, // mocha, chai, @apicize/lib
          globalVariablesCount: 3, // response, context, helper
          helperFunctionsCount: 2, // validateEmail, formatDisplayName
          isSuccessful: true,
        });

        // Verify specific tests were found
        assertions.extractionResult.containsTestsNamed(extractionResult, [
          'should create a new user successfully',
          'should validate required fields',
          'should get user by ID',
          'should validate email format',
          'should format user display name',
        ]);

        // Verify test classification
        const requestSpecificTests = extractionResult.requestSpecificTests;
        const sharedTests = extractionResult.sharedTests;

        expect(
          requestSpecificTests.some(test => test.name.value.includes('create a new user'))
        ).toBe(true);

        expect(sharedTests.some(test => test.name.value.includes('validate email'))).toBe(true);

        // Verify metadata extraction
        expect(extractionResult.metadata.hasMetadata).toBe(true);

        // Verify imports were extracted
        const imports = extractionResult.imports;
        expect(imports.some(imp => imp.source === 'mocha')).toBe(true);
        expect(imports.some(imp => imp.source === 'chai')).toBe(true);
        expect(imports.some(imp => imp.source === '@apicize/lib')).toBe(true);

        // Verify helper functions were extracted
        const helpers = extractionResult.helperFunctions;
        expect(helpers.some(func => func.name === 'validateEmail')).toBe(true);
        expect(helpers.some(func => func.name === 'formatDisplayName')).toBe(true);
      }
    });

    it('should handle complex nested test structures', async () => {
      // Arrange
      const extractor = TestExtractorFactory.createAnalysisEnabled();
      const sourceCode = `
        import { describe, it } from 'mocha';
        import { expect } from 'chai';

        describe('E-commerce API', () => {
          describe('Authentication', () => {
            describe('Login', () => {
              it('should login with valid credentials', () => {
                expect(response.status).to.equal(200);
              });

              it('should reject invalid credentials', () => {
                expect(response.status).to.equal(401);
              });
            });

            describe('Registration', () => {
              it('should register new user', () => {
                expect(response.status).to.equal(201);
              });
            });
          });

          describe('Product Management', () => {
            describe('Product Listing', () => {
              it('should list all products', () => {
                expect(response.status).to.equal(200);
                expect(response.body.data).to.be.an('array');
              });
            });
          });
        });
      `;

      // Act
      const result = await extractor.extractTests(sourceCode);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.analysis).toBeDefined();

      if (result.data) {
        const extractionResult = result.data;

        // Verify hierarchical structure
        const rootSuite = extractionResult.testSuite;
        expect(rootSuite.testBlocks.length).toBeGreaterThan(0);

        // Verify nesting levels
        const allTests = extractionResult.getAllTests();
        const maxDepth = Math.max(...allTests.map(test => test.depth));
        expect(maxDepth).toBeGreaterThanOrEqual(3); // Should have deep nesting

        // Verify test names
        assertions.extractionResult.containsTestsNamed(extractionResult, [
          'should login with valid credentials',
          'should register new user',
          'should list all products',
        ]);
      }

      if (result.analysis) {
        const analysis = result.analysis;

        // Verify analysis metrics
        expect(analysis.analysisMetrics.totalTests).toBeGreaterThan(0);
        expect(analysis.analysisMetrics.maxNestingDepth).toBeGreaterThanOrEqual(3);
        expect(analysis.qualityMetrics.testsWithAssertions).toBeGreaterThan(0);
      }
    });

    it('should handle parsing errors gracefully', async () => {
      // Arrange
      const extractor = TestExtractorFactory.createDefault();
      const invalidSourceCode = `
        describe('Invalid Test', () => {
          it('incomplete test'
        // Missing closing brace and parenthesis
      `;

      // Act
      const result = await extractor.extractTests(invalidSourceCode);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.data).toBeUndefined();
    });

    it('should handle empty source code', async () => {
      // Arrange
      const extractor = TestExtractorFactory.createDefault();
      const emptySource = '';

      // Act
      const result = await extractor.extractTests(emptySource, {
        enableValidation: true,
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle source with no tests', async () => {
      // Arrange
      const extractor = TestExtractorFactory.createDefault();
      const noTestsSource = `
        import { helper } from './helper';

        const config = {
          baseUrl: 'https://api.example.com',
          timeout: 5000
        };

        function setupEnvironment() {
          return { initialized: true };
        }

        export { config, setupEnvironment };
      `;

      // Act
      const result = await extractor.extractTests(noTestsSource, {
        enableValidation: true,
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('performance characteristics', () => {
    it('should handle large test files efficiently', async () => {
      // Arrange
      const extractor = TestExtractorFactory.createPerformanceOptimized();

      // Generate a large test file
      const generateLargeTestFile = (testCount: number): string => {
        const imports = `
          import { describe, it } from 'mocha';
          import { expect } from 'chai';
        `;

        const tests = Array.from(
          { length: testCount },
          (_, i) => `
          describe('Test Suite ${i}', () => {
            it('should test functionality ${i}', () => {
              expect(${i}).to.equal(${i});
              expect(true).to.be.true;
            });

            it('should test edge case ${i}', () => {
              expect(${i} + 1).to.equal(${i + 1});
            });
          });
        `
        ).join('\n');

        return imports + tests;
      };

      const largeSourceCode = generateLargeTestFile(100); // 200 test blocks

      // Act
      const startTime = Date.now();
      const result = await extractor.extractTests(largeSourceCode);
      const endTime = Date.now();

      const duration = endTime - startTime;

      // Assert
      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds

      if (result.data) {
        const stats = result.data.getStatistics();
        expect(stats.totalTests).toBeGreaterThan(100);
      }

      console.log(`Large file extraction (200 tests) took ${duration}ms`);
    });

    it('should process realistic API test files within reasonable time', async () => {
      // Arrange
      const extractor = TestExtractorFactory.createDefault();
      const realisticApiTestFile = `
        import { describe, it, beforeEach, afterEach } from 'mocha';
        import { expect } from 'chai';
        import { TestHelper, ApicizeResponse, BodyType } from '@apicize/lib';

        let helper: TestHelper;
        let response: ApicizeResponse;
        let context: any;

        describe('Comprehensive API Test Suite', () => {
          beforeEach(async () => {
            helper = new TestHelper();
            context = await helper.setupTest('comprehensive');
          });

          afterEach(() => {
            helper.cleanup();
          });

          describe('User Management', () => {
            describe('User Creation', () => {
              it('should create user with valid data', () => {
                expect(response.status).to.equal(201);
                const data = response.body.type === BodyType.JSON ? response.body.data : null;
                expect(data).to.not.be.null;
                expect(data.id).to.be.a('string');
                output('userId', data.id);
              });

              it('should validate required fields', () => {
                expect(response.status).to.be.oneOf([201, 400]);
              });

              it('should handle duplicate email', () => {
                expect(response.status).to.be.oneOf([201, 409]);
              });
            });

            describe('User Retrieval', () => {
              it('should get user by id', () => {
                expect(response.status).to.equal(200);
                expect(response.body.data.id).to.equal($.userId);
              });

              it('should return 404 for non-existent user', () => {
                expect(response.status).to.be.oneOf([200, 404]);
              });
            });

            describe('User Updates', () => {
              it('should update user profile', () => {
                expect(response.status).to.equal(200);
              });

              it('should validate update permissions', () => {
                expect(response.status).to.be.oneOf([200, 403]);
              });
            });

            describe('User Deletion', () => {
              it('should delete user', () => {
                expect(response.status).to.equal(204);
              });
            });
          });

          describe('Product Management', () => {
            describe('Product Listing', () => {
              it('should list all products', () => {
                expect(response.status).to.equal(200);
                expect(response.body.data).to.be.an('array');
              });

              it('should support pagination', () => {
                expect(response.status).to.equal(200);
                const data = response.body.data;
                expect(data.page).to.be.a('number');
                expect(data.total).to.be.a('number');
              });

              it('should support filtering', () => {
                expect(response.status).to.equal(200);
              });

              it('should support sorting', () => {
                expect(response.status).to.equal(200);
                const products = response.body.data.items;
                expect(products).to.be.an('array');
              });
            });

            describe('Product Details', () => {
              it('should get product by id', () => {
                expect(response.status).to.equal(200);
                expect(response.body.data.id).to.be.a('string');
              });

              it('should return 404 for non-existent product', () => {
                expect(response.status).to.be.oneOf([200, 404]);
              });
            });
          });

          describe('Order Management', () => {
            describe('Order Creation', () => {
              it('should create order with valid data', () => {
                expect(response.status).to.equal(201);
                output('orderId', response.body.data.id);
              });

              it('should validate inventory', () => {
                expect(response.status).to.be.oneOf([201, 400]);
              });

              it('should calculate totals correctly', () => {
                expect(response.status).to.equal(201);
                const order = response.body.data;
                expect(order.total).to.be.a('number');
                expect(order.total).to.be.greaterThan(0);
              });
            });

            describe('Order Retrieval', () => {
              it('should get order by id', () => {
                expect(response.status).to.equal(200);
                expect(response.body.data.id).to.equal($.orderId);
              });

              it('should list user orders', () => {
                expect(response.status).to.equal(200);
                expect(response.body.data).to.be.an('array');
              });
            });
          });
        });

        describe('Utility Functions', () => {
          it('should validate email addresses', () => {
            expect(isValidEmail('test@example.com')).to.be.true;
            expect(isValidEmail('invalid')).to.be.false;
          });

          it('should format currency', () => {
            expect(formatCurrency(12.34)).to.equal('$12.34');
            expect(formatCurrency(0)).to.equal('$0.00');
          });

          it('should calculate tax', () => {
            expect(calculateTax(100, 0.08)).to.equal(8);
            expect(calculateTax(0, 0.08)).to.equal(0);
          });
        });

        function isValidEmail(email: string): boolean {
          return /^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(email);
        }

        function formatCurrency(amount: number): string {
          return \`$\${amount.toFixed(2)}\`;
        }

        function calculateTax(amount: number, rate: number): number {
          return amount * rate;
        }
      `;

      // Act
      const performanceResult = await assertions.performance.benchmark(
        () => extractor.extractTests(realisticApiTestFile),
        5 // Run 5 iterations
      );

      // Assert
      expect(performanceResult.averageTime).toBeLessThan(2000); // Average under 2 seconds
      expect(performanceResult.maxTime).toBeLessThan(5000); // Max under 5 seconds

      console.log(`Realistic API test file processing:`, performanceResult);
    });
  });
});
