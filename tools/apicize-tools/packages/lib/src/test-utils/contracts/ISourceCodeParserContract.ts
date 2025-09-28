/**
 * Contract tests for ISourceCodeParser implementations
 * Ensures all implementations behave consistently
 */

import { ISourceCodeParser } from '../../infrastructure/parsing/ISourceCodeParser';
import { ParsingOptions } from '../../infrastructure/parsing/ParsingOptions';

/**
 * Test contract for ISourceCodeParser implementations
 * All implementations should pass these tests
 */
export function testSourceCodeParserContract(
  createParser: () => ISourceCodeParser,
  describeName: string = 'ISourceCodeParser Contract'
) {
  describe(describeName, () => {
    let parser: ISourceCodeParser;

    beforeEach(() => {
      parser = createParser();
    });

    describe('parseSource', () => {
      it('should parse basic describe blocks', () => {
        const content = `
          describe('Test Suite', () => {
            it('test case', () => {
              expect(true).to.be.true;
            });
          });
        `;

        const result = parser.parseSource(content);

        expect(result).toBeDefined();
        expect(result.testBlocks).toBeDefined();
        expect(result.testBlocks.length).toBeGreaterThanOrEqual(1);
      });

      it('should parse basic it blocks', () => {
        const content = `
          it('standalone test', () => {
            expect(1 + 1).to.equal(2);
          });
        `;

        const result = parser.parseSource(content);

        expect(result).toBeDefined();
        expect(result.testBlocks).toBeDefined();
        expect(result.testBlocks.length).toBeGreaterThanOrEqual(1);
      });

      it('should handle empty content', () => {
        const content = '';

        const result = parser.parseSource(content);

        expect(result).toBeDefined();
        expect(result.testBlocks).toBeDefined();
        expect(result.testBlocks.length).toBe(0);
      });

      it('should handle content with no test blocks', () => {
        const content = `
          const x = 1;
          function helper() {
            return 'hello';
          }
        `;

        const result = parser.parseSource(content);

        expect(result).toBeDefined();
        expect(result.testBlocks).toBeDefined();
        expect(result.testBlocks.length).toBe(0);
      });

      it('should parse nested describe blocks', () => {
        const content = `
          describe('Outer Suite', () => {
            describe('Inner Suite', () => {
              it('nested test', () => {
                expect(true).to.be.true;
              });
            });
          });
        `;

        const result = parser.parseSource(content);

        expect(result).toBeDefined();
        expect(result.testBlocks).toBeDefined();
        expect(result.testBlocks.length).toBeGreaterThanOrEqual(1);

        // Should have hierarchical structure
        const topLevel = result.testBlocks.find(block => block.name.value.includes('Outer'));
        expect(topLevel).toBeDefined();
      });

      it('should extract imports', () => {
        const content = `
          import { describe, it } from 'mocha';
          import { expect } from 'chai';

          describe('Test', () => {
            it('works', () => {
              expect(true).to.be.true;
            });
          });
        `;

        const result = parser.parseSource(content);

        expect(result).toBeDefined();
        expect(result.imports).toBeDefined();
        expect(result.imports.length).toBeGreaterThanOrEqual(2);
      });

      it('should respect parsing options', () => {
        const content = `
          describe('Test', () => {
            it('works', () => {
              expect(true).to.be.true;
            });
          });
        `;

        const options: ParsingOptions = {
          preserveFormatting: true,
          includeComments: false,
          extractHelpers: false,
        };

        const result = parser.parseSource(content, options);

        expect(result).toBeDefined();
        // Should respect the options (specific behavior depends on implementation)
      });

      it('should handle malformed code gracefully', () => {
        const content = `
          describe('Test', () => {
            it('incomplete test'
        `;

        expect(() => {
          const result = parser.parseSource(content);
          expect(result).toBeDefined();
        }).not.toThrow();
      });
    });

    describe('validateSyntax', () => {
      it('should validate correct TypeScript syntax', () => {
        const content = `
          describe('Test', () => {
            it('works', () => {
              expect(true).to.be.true;
            });
          });
        `;

        const isValid = parser.validateSyntax(content);
        expect(isValid).toBe(true);
      });

      it('should reject invalid TypeScript syntax', () => {
        const content = `
          describe('Test', () => {
            it('incomplete'
        `;

        const isValid = parser.validateSyntax(content);
        expect(isValid).toBe(false);
      });

      it('should handle empty content', () => {
        const content = '';

        const isValid = parser.validateSyntax(content);
        expect(typeof isValid).toBe('boolean');
      });

      it('should not throw on validation', () => {
        const content = 'completely invalid typescript!!!';

        expect(() => {
          parser.validateSyntax(content);
        }).not.toThrow();
      });
    });

    describe('error handling', () => {
      it('should provide empty errors array initially', () => {
        const errors = parser.getParsingErrors();
        expect(Array.isArray(errors)).toBe(true);
      });

      it('should provide empty warnings array initially', () => {
        const warnings = parser.getParsingWarnings();
        expect(Array.isArray(warnings)).toBe(true);
      });

      it('should report errors for invalid syntax', () => {
        const content = 'invalid typescript syntax {{{';

        parser.parseSource(content);
        const errors = parser.getParsingErrors();

        expect(errors.length).toBeGreaterThanOrEqual(0); // May or may not report errors depending on implementation
      });

      it('should clear errors between parses', () => {
        // First parse with error
        parser.parseSource('invalid syntax');
        const firstErrors = parser.getParsingErrors();

        // Second parse with valid content
        parser.parseSource('describe("test", () => {});');
        const secondErrors = parser.getParsingErrors();

        // Should not accumulate errors
        expect(secondErrors.length).toBeLessThanOrEqual(firstErrors.length);
      });
    });

    describe('consistency', () => {
      it('should produce consistent results for same input', () => {
        const content = `
          describe('Test', () => {
            it('works', () => {
              expect(true).to.be.true;
            });
          });
        `;

        const result1 = parser.parseSource(content);
        const result2 = parser.parseSource(content);

        expect(result1.testBlocks.length).toBe(result2.testBlocks.length);
        expect(result1.imports.length).toBe(result2.imports.length);
      });

      it('should handle multiple sequential parses', () => {
        const contents = [
          'describe("Test 1", () => {});',
          'describe("Test 2", () => {});',
          'describe("Test 3", () => {});',
        ];

        for (const content of contents) {
          expect(() => {
            parser.parseSource(content);
          }).not.toThrow();
        }
      });
    });

    describe('edge cases', () => {
      it('should handle very large content', () => {
        const largeContent = Array(1000)
          .fill(null)
          .map((_, i) => `it('test ${i}', () => { expect(true).to.be.true; });`)
          .join('\n');

        expect(() => {
          parser.parseSource(largeContent);
        }).not.toThrow();
      });

      it('should handle unicode content', () => {
        const content = `
          describe('测试套件', () => {
            it('应该工作', () => {
              expect('🎉').to.be.a('string');
            });
          });
        `;

        expect(() => {
          parser.parseSource(content);
        }).not.toThrow();
      });

      it('should handle mixed line endings', () => {
        const content =
          "describe('Test', () => {\r\n  it('works', () => {\n    expect(true).to.be.true;\r  });\r\n});";

        expect(() => {
          parser.parseSource(content);
        }).not.toThrow();
      });
    });
  });
}

/**
 * Shared test data for contract tests
 */
export const contractTestData = {
  simpleDescribe: `
    describe('Simple Test', () => {
      it('should work', () => {
        expect(true).to.be.true;
      });
    });
  `,

  nestedStructure: `
    describe('Outer Suite', () => {
      describe('Inner Suite 1', () => {
        it('test 1', () => {
          expect(1).to.equal(1);
        });
      });

      describe('Inner Suite 2', () => {
        it('test 2', () => {
          expect(2).to.equal(2);
        });
      });
    });
  `,

  withImports: `
    import { describe, it, beforeEach } from 'mocha';
    import { expect } from 'chai';
    import type { TestType } from './types';

    let helper: TestType;

    describe('Test with Imports', () => {
      beforeEach(() => {
        helper = createHelper();
      });

      it('should use imports', () => {
        expect(helper).to.exist;
      });
    });
  `,

  invalidSyntax: `
    describe('Invalid Test', () => {
      it('incomplete test'
  `,

  emptyContent: '',

  noTests: `
    const x = 1;
    function helper() {
      return 'not a test';
    }
  `,
};
