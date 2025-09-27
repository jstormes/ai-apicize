import {
  TestExtractor,
  ExtractedTestCode,
  TestExtractionError,
  extractTestCodeFromContent,
  extractTestCodeFromFile,
} from './test-extractor';
import * as fs from 'fs';
import * as path from 'path';

describe('TestExtractor', () => {
  let extractor: TestExtractor;

  beforeEach(() => {
    extractor = new TestExtractor();
  });

  describe('extractFromContent', () => {
    it('should extract basic describe and it blocks', () => {
      const content = `
import { describe, it } from 'mocha';
import { expect } from 'chai';

describe('Test Suite', () => {
  it('should pass', () => {
    expect(true).to.be.true;
  });
});
      `;

      const result = extractor.extractFromContent(content);

      expect(result.errors).toHaveLength(0);
      expect(result.testBlocks).toHaveLength(1);

      const describeBlock = result.testBlocks[0];
      expect(describeBlock.type).toBe('describe');
      expect(describeBlock.name).toBe('Test Suite');
      expect(describeBlock.children).toHaveLength(1);

      const itBlock = describeBlock.children![0];
      expect(itBlock.type).toBe('it');
      expect(itBlock.name).toBe('should pass');
      expect(itBlock.code).toContain('expect(true).to.be.true');
    });

    it('should extract imports correctly', () => {
      const content = `
import { describe, it } from 'mocha';
import { expect } from 'chai';
import * as fs from 'fs';
import type { SomeType } from './types';
import defaultExport from './default';
      `;

      const result = extractor.extractFromContent(content);

      expect(result.imports).toHaveLength(5);

      const mochaImport = result.imports.find(imp => imp.source === 'mocha');
      expect(mochaImport).toBeDefined();
      expect(mochaImport!.imports).toEqual(['describe', 'it']);
      expect(mochaImport!.isTypeImport).toBe(false);

      const typeImport = result.imports.find(imp => imp.source === './types');
      expect(typeImport).toBeDefined();
      expect(typeImport!.isTypeImport).toBe(true);

      const fsImport = result.imports.find(imp => imp.source === 'fs');
      expect(fsImport).toBeDefined();
      expect(fsImport!.imports).toEqual(['* as fs']);
    });

    it('should extract global variables', () => {
      const content = `
const globalVar = 'test';
let mutableVar: string;
var oldVar = 42;

describe('Test', () => {
  const localVar = 'local';
});
      `;

      const result = extractor.extractFromContent(content);

      expect(result.globalVariables).toHaveLength(3);

      const constVar = result.globalVariables.find(v => v.name === 'globalVar');
      expect(constVar).toBeDefined();
      expect(constVar!.isConst).toBe(true);
      expect(constVar!.value).toBe("'test'");

      const letVar = result.globalVariables.find(v => v.name === 'mutableVar');
      expect(letVar).toBeDefined();
      expect(letVar!.isConst).toBe(false);
      expect(letVar!.type).toBe('string');
    });

    it('should extract helper functions', () => {
      const content = `
function helperFunction(param: string): boolean {
  return param.length > 0;
}

async function asyncHelper(data: any): Promise<void> {
  await Promise.resolve(data);
}

describe('Test', () => {
  function localFunction() {
    // This should not be extracted
  }
});
      `;

      const result = extractor.extractFromContent(content);

      expect(result.helperFunctions).toHaveLength(2);

      const syncHelper = result.helperFunctions.find(f => f.name === 'helperFunction');
      expect(syncHelper).toBeDefined();
      expect(syncHelper!.isAsync).toBe(false);
      expect(syncHelper!.parameters).toEqual(['param: string']);
      expect(syncHelper!.returnType).toBe('boolean');

      const asyncHelper = result.helperFunctions.find(f => f.name === 'asyncHelper');
      expect(asyncHelper).toBeDefined();
      expect(asyncHelper!.isAsync).toBe(true);
      expect(asyncHelper!.returnType).toBe('Promise<void>');
    });

    it('should identify request-specific tests', () => {
      const content = `
/* @apicize-request-metadata
{
  "id": "test-request",
  "url": "https://api.example.com"
}
@apicize-request-metadata-end */

describe('API Request Test', () => {
  it('should make request', () => {
    expect(response.status).to.equal(200);
  });
});

describe('General Test', () => {
  it('should work generally', () => {
    expect(true).to.be.true;
  });
});
      `;

      const result = extractor.extractFromContent(content);

      expect(result.testBlocks).toHaveLength(2);

      const requestTest = result.testBlocks.find(t => t.name === 'API Request Test');
      expect(requestTest).toBeDefined();
      expect(requestTest!.isRequestSpecific).toBe(true);

      const generalTest = result.testBlocks.find(t => t.name === 'General Test');
      expect(generalTest).toBeDefined();
      expect(generalTest!.isRequestSpecific).toBe(false);
    });

    it('should handle nested describe blocks', () => {
      const content = `
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

    it('test 3', () => {
      expect(3).to.equal(3);
    });
  });

  it('outer test', () => {
    expect(true).to.be.true;
  });
});
      `;

      const result = extractor.extractFromContent(content);

      expect(result.testBlocks).toHaveLength(1);

      const outerSuite = result.testBlocks[0];
      expect(outerSuite.name).toBe('Outer Suite');
      expect(outerSuite.depth).toBe(0);
      expect(outerSuite.children).toHaveLength(3); // 2 inner describes + 1 it

      const innerSuite1 = outerSuite.children!.find(c => c.name === 'Inner Suite 1');
      expect(innerSuite1).toBeDefined();
      expect(innerSuite1!.depth).toBe(1);
      expect(innerSuite1!.children).toHaveLength(1);

      const innerSuite2 = outerSuite.children!.find(c => c.name === 'Inner Suite 2');
      expect(innerSuite2).toBeDefined();
      expect(innerSuite2!.children).toHaveLength(2);
    });

    it('should preserve code formatting', () => {
      const content = `
describe('Formatted Test', () => {
  it('should preserve formatting', () => {
    // This is a comment
    const data = {
      key: 'value',
      nested: {
        array: [1, 2, 3]
      }
    };

    expect(data.key).to.equal('value');
    expect(data.nested.array).to.deep.equal([1, 2, 3]);
  });
});
      `;

      const result = extractor.extractFromContent(content, { preserveFormatting: true });

      const testBlock = result.testBlocks[0].children![0];
      expect(testBlock.code).toContain('// This is a comment');
      expect(testBlock.code).toContain('  nested: {');
      expect(testBlock.code).toContain('    array: [1, 2, 3]');
    });

    it('should handle malformed code gracefully', () => {
      const content = `
describe('Broken Test', () => {
  it('missing parenthesis', () => {
    expect(true.to.be.true;
  });
});
      `;

      const result = extractor.extractFromContent(content);

      // Should still extract what it can
      expect(result.testBlocks).toHaveLength(1);
      expect(result.testBlocks[0].name).toBe('Broken Test');
    });

    it('should handle empty content', () => {
      const result = extractor.extractFromContent('');

      expect(result.testBlocks).toHaveLength(0);
      expect(result.imports).toHaveLength(0);
      expect(result.globalVariables).toHaveLength(0);
      expect(result.helperFunctions).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('extractFromFile', () => {
    const tempDir = path.join(__dirname, 'temp');
    const tempFile = path.join(tempDir, 'test.ts');

    beforeAll(() => {
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
    });

    afterAll(() => {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
      if (fs.existsSync(tempDir)) {
        fs.rmdirSync(tempDir);
      }
    });

    it('should extract from existing file', async () => {
      const content = `
import { describe, it } from 'mocha';

describe('File Test', () => {
  it('should work', () => {
    expect(true).to.be.true;
  });
});
      `;

      fs.writeFileSync(tempFile, content);

      const result = await extractor.extractFromFile(tempFile);

      expect(result.errors).toHaveLength(0);
      expect(result.testBlocks).toHaveLength(1);
      expect(result.testBlocks[0].name).toBe('File Test');
    });

    it('should handle non-existent file', async () => {
      const result = await extractor.extractFromFile('/path/that/does/not/exist.ts');

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('File not found');
      expect(result.testBlocks).toHaveLength(0);
    });
  });

  describe('extractAndValidate', () => {
    it('should validate successful extraction', async () => {
      const content = `
describe('Valid Test', () => {
  it('should pass', () => {
    expect(true).to.be.true;
  });
});
      `;

      const result = await extractor.extractAndValidate(content);

      expect(result.testBlocks).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
    });

    it('should throw error on invalid extraction', async () => {
      // Mock a scenario that would cause errors
      const originalExtract = extractor.extractFromContent;
      extractor.extractFromContent = jest.fn().mockReturnValue({
        testBlocks: [],
        imports: [],
        globalVariables: [],
        helperFunctions: [],
        errors: ['Parse error'],
        warnings: [],
      });

      await expect(extractor.extractAndValidate('invalid')).rejects.toThrow(TestExtractionError);

      // Restore original method
      extractor.extractFromContent = originalExtract;
    });
  });

  describe('utility methods', () => {
    let sampleResult: ExtractedTestCode;

    beforeEach(() => {
      const content = `
import { describe, it } from 'mocha';

/* @apicize-request-metadata */
describe('Request Test', () => {
  it('request test 1', () => {
    expect(response.status).to.equal(200);
  });
});

describe('General Test', () => {
  describe('Nested', () => {
    it('nested test', () => {
      expect(true).to.be.true;
    });
  });

  it('general test', () => {
    expect(false).to.be.false;
  });
});
      `;

      sampleResult = extractor.extractFromContent(content);
    });

    describe('getTestStats', () => {
      it('should return correct statistics', () => {
        const stats = extractor.getTestStats(sampleResult);

        expect(stats.totalBlocks).toBeGreaterThan(0);
        expect(stats.describeBlocks).toBeGreaterThan(0);
        expect(stats.itBlocks).toBeGreaterThan(0);
        expect(stats.requestSpecificBlocks).toBe(1); // Only 'Request Test'
        expect(stats.importsCount).toBe(1);
        expect(stats.totalErrors).toBe(0);
      });
    });

    describe('findTestBlocks', () => {
      it('should find blocks by name pattern', () => {
        const requestBlocks = extractor.findTestBlocks(sampleResult, /request/i);
        expect(requestBlocks.length).toBeGreaterThan(0);
        expect(requestBlocks.some(block => block.name.toLowerCase().includes('request'))).toBe(
          true
        );
      });

      it('should find blocks by string pattern', () => {
        const generalBlocks = extractor.findTestBlocks(sampleResult, 'General');
        expect(generalBlocks.length).toBeGreaterThan(0);
        expect(generalBlocks.some(block => block.name.includes('General'))).toBe(true);
      });
    });

    describe('getRequestSpecificTests', () => {
      it('should return only request-specific tests', () => {
        const requestTests = extractor.getRequestSpecificTests(sampleResult);
        expect(requestTests.length).toBeGreaterThan(0);
        expect(requestTests.every(test => test.isRequestSpecific)).toBe(true);
      });
    });

    describe('getSharedTests', () => {
      it('should return only shared tests', () => {
        const sharedTests = extractor.getSharedTests(sampleResult);
        expect(sharedTests.length).toBeGreaterThan(0);
        expect(sharedTests.every(test => !test.isRequestSpecific)).toBe(true);
      });
    });
  });

  describe('convenience functions', () => {
    it('should work with extractTestCodeFromContent', () => {
      const content = `
describe('Convenience Test', () => {
  it('should work', () => {
    expect(true).to.be.true;
  });
});
      `;

      const result = extractTestCodeFromContent(content);

      expect(result.testBlocks).toHaveLength(1);
      expect(result.testBlocks[0].name).toBe('Convenience Test');
    });

    it('should work with extractTestCodeFromFile', async () => {
      const tempFile = path.join(__dirname, 'convenience-test.ts');
      const content = `
describe('File Convenience Test', () => {
  it('should work', () => {
    expect(true).to.be.true;
  });
});
      `;

      try {
        fs.writeFileSync(tempFile, content);
        const result = await extractTestCodeFromFile(tempFile);

        expect(result.testBlocks).toHaveLength(1);
        expect(result.testBlocks[0].name).toBe('File Convenience Test');
      } finally {
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      }
    });
  });

  describe('edge cases', () => {
    it('should handle arrow functions in tests', () => {
      const content = `
describe('Arrow Function Test', () => {
  it('should handle arrow function', () => {
    const add = (a: number, b: number) => a + b;
    expect(add(1, 2)).to.equal(3);
  });
});
      `;

      const result = extractor.extractFromContent(content);

      expect(result.testBlocks).toHaveLength(1);
      expect(result.testBlocks[0].children![0].code).toContain('=>');
    });

    it('should handle async tests', () => {
      const content = `
describe('Async Test', () => {
  it('should handle async', async () => {
    const result = await Promise.resolve(42);
    expect(result).to.equal(42);
  });
});
      `;

      const result = extractor.extractFromContent(content);

      expect(result.testBlocks).toHaveLength(1);
      const itBlock = result.testBlocks[0].children![0];
      expect(itBlock.code).toContain('await');
      expect(itBlock.code).toContain('Promise.resolve');
    });

    it('should handle complex nesting', () => {
      const content = `
describe('Level 1', () => {
  describe('Level 2', () => {
    describe('Level 3', () => {
      it('deep test', () => {
        expect(true).to.be.true;
      });
    });
  });
});
      `;

      const result = extractor.extractFromContent(content);
      const stats = extractor.getTestStats(result);

      expect(stats.maxDepth).toBe(2); // 0-indexed, so level 3 = depth 2
    });

    it('should handle special characters in test names', () => {
      const content = `
describe('Test with "quotes" and special chars: !@#$%', () => {
  it('should handle unicode: αβγ 中文 🚀', () => {
    expect(true).to.be.true;
  });
});
      `;

      const result = extractor.extractFromContent(content);

      expect(result.testBlocks).toHaveLength(1);
      expect(result.testBlocks[0].name).toContain('quotes');
      expect(result.testBlocks[0].children![0].name).toContain('unicode');
    });
  });
});
