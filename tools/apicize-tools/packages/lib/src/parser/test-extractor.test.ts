import {
  TestExtractor,
  ExtractedTestCode,
  TestExtractionError,
  extractTestCodeFromFile,
  extractTestCodeFromContent,
} from './test-extractor';

describe('TestExtractor', () => {
  let extractor: TestExtractor;

  beforeEach(() => {
    extractor = new TestExtractor();
  });

  describe('extractFromContent', () => {
    it('should extract simple test suite with one test', () => {
      const content = `
import { describe, it } from 'mocha';
import { expect } from 'chai';

describe('Simple Test Suite', () => {
  it('should pass', () => {
    expect(true).to.equal(true);
  });
});
      `;

      const result = extractor.extractFromContent(content);

      expect(result.errors).toHaveLength(0);
      expect(result.testSuites).toHaveLength(1);

      const suite = result.testSuites[0];
      expect(suite.name).toBe('Simple Test Suite');
      expect(suite.type).toBe('describe');
      expect(suite.tests).toHaveLength(1);

      const test = suite.tests[0];
      expect(test.name).toBe('should pass');
      expect(test.type).toBe('it');
      expect(test.isAsync).toBe(false);
      expect(test.body).toContain('expect(true).to.equal(true)');
    });

    it('should extract nested test suites', () => {
      const content = `
describe('Parent Suite', () => {
  describe('Nested Suite', () => {
    it('nested test', () => {
      expect(1).to.equal(1);
    });
  });

  it('parent test', () => {
    expect(2).to.equal(2);
  });
});
      `;

      const result = extractor.extractFromContent(content);

      expect(result.errors).toHaveLength(0);
      expect(result.testSuites).toHaveLength(1);

      const parentSuite = result.testSuites[0];
      expect(parentSuite.name).toBe('Parent Suite');
      expect(parentSuite.tests).toHaveLength(1);
      expect(parentSuite.nestedSuites).toHaveLength(1);

      const nestedSuite = parentSuite.nestedSuites[0];
      expect(nestedSuite.name).toBe('Nested Suite');
      expect(nestedSuite.tests).toHaveLength(1);
      expect(nestedSuite.tests[0].name).toBe('nested test');

      expect(parentSuite.tests[0].name).toBe('parent test');
    });

    it('should extract imports correctly', () => {
      const content = `
import { describe, it, before } from 'mocha';
import { expect } from 'chai';
import type { Request } from 'express';
import { TestHelper } from '../helpers';

describe('Test with imports', () => {
  it('should work', () => {});
});
      `;

      const result = extractor.extractFromContent(content);

      expect(result.imports).toHaveLength(4);

      const mochaImport = result.imports.find(imp => imp.moduleSpecifier === 'mocha');
      expect(mochaImport).toBeDefined();
      expect(mochaImport!.importClause).toBe('{ describe, it, before }');
      expect(mochaImport!.isTypeOnly).toBe(false);

      const typeImport = result.imports.find(imp => imp.moduleSpecifier === 'express');
      expect(typeImport).toBeDefined();
      expect(typeImport!.isTypeOnly).toBe(true);
    });

    it('should extract async tests', () => {
      const content = `
describe('Async Tests', () => {
  it('should handle async test', async () => {
    const result = await Promise.resolve(42);
    expect(result).to.equal(42);
  });

  it('should handle sync test', () => {
    expect(1).to.equal(1);
  });
});
      `;

      const result = extractor.extractFromContent(content);

      expect(result.testSuites).toHaveLength(1);
      const suite = result.testSuites[0];
      expect(suite.tests).toHaveLength(2);

      const asyncTest = suite.tests.find(t => t.name === 'should handle async test');
      expect(asyncTest).toBeDefined();
      expect(asyncTest!.isAsync).toBe(true);

      const syncTest = suite.tests.find(t => t.name === 'should handle sync test');
      expect(syncTest).toBeDefined();
      expect(syncTest!.isAsync).toBe(false);
    });

    it('should extract hooks', () => {
      const content = `
describe('Test with hooks', () => {
  before(() => {
    console.log('before');
  });

  beforeEach(async () => {
    await setup();
  });

  after(() => {
    console.log('after');
  });

  afterEach(() => {
    cleanup();
  });

  it('should test something', () => {
    expect(true).to.be.true;
  });
});
      `;

      const result = extractor.extractFromContent(content);

      expect(result.testSuites).toHaveLength(1);
      const suite = result.testSuites[0];
      expect(suite.hooks).toHaveLength(4);

      const beforeHook = suite.hooks.find(h => h.type === 'before');
      expect(beforeHook).toBeDefined();
      expect(beforeHook!.isAsync).toBe(false);

      const beforeEachHook = suite.hooks.find(h => h.type === 'beforeEach');
      expect(beforeEachHook).toBeDefined();
      expect(beforeEachHook!.isAsync).toBe(true);

      const afterHook = suite.hooks.find(h => h.type === 'after');
      expect(afterHook).toBeDefined();

      const afterEachHook = suite.hooks.find(h => h.type === 'afterEach');
      expect(afterEachHook).toBeDefined();
    });

    it('should extract shared code', () => {
      const content = `
import { describe, it } from 'mocha';

const testHelper = {
  setup: () => {},
  cleanup: () => {}
};

function createUser(name: string) {
  return { name, id: Math.random() };
}

class TestRunner {
  run() {}
}

type TestConfig = {
  timeout: number;
};

describe('Test with shared code', () => {
  it('should work', () => {});
});
      `;

      const result = extractor.extractFromContent(content, {
        includeSharedCode: true,
        includeTypeDefinitions: true,
      });

      expect(result.sharedCode).toHaveLength(4);

      const variable = result.sharedCode.find(
        c => c.type === 'variable' && c.name === 'testHelper'
      );
      expect(variable).toBeDefined();

      const func = result.sharedCode.find(c => c.type === 'function' && c.name === 'createUser');
      expect(func).toBeDefined();

      const cls = result.sharedCode.find(c => c.type === 'class' && c.name === 'TestRunner');
      expect(cls).toBeDefined();

      const type = result.sharedCode.find(c => c.type === 'type' && c.name === 'TestConfig');
      expect(type).toBeDefined();
    });

    it('should handle different test function names', () => {
      const content = `
suite('Suite using suite function', () => {
  test('test using test function', () => {
    expect(1).to.equal(1);
  });
});
      `;

      const result = extractor.extractFromContent(content);

      expect(result.testSuites).toHaveLength(1);
      const suite = result.testSuites[0];
      expect(suite.name).toBe('Suite using suite function');
      expect(suite.type).toBe('suite');

      expect(suite.tests).toHaveLength(1);
      const test = suite.tests[0];
      expect(test.name).toBe('test using test function');
      expect(test.type).toBe('test');
    });

    it('should handle empty files', () => {
      const content = '';
      const result = extractor.extractFromContent(content);

      expect(result.errors).toHaveLength(0);
      expect(result.testSuites).toHaveLength(0);
      expect(result.imports).toHaveLength(0);
      expect(result.sharedCode).toHaveLength(0);
    });

    it('should handle files with only imports', () => {
      const content = `
import { describe, it } from 'mocha';
import { expect } from 'chai';
      `;

      const result = extractor.extractFromContent(content);

      expect(result.errors).toHaveLength(0);
      expect(result.imports).toHaveLength(2);
      expect(result.testSuites).toHaveLength(0);
    });

    it('should handle syntax errors gracefully', () => {
      const content = `
describe('Test with syntax error', () => {
  it('broken test', () => {
    expect(1).to.equal(1)  // Missing semicolon
    const unclosed = {
  });
});
      `;

      const result = extractor.extractFromContent(content);

      // Should still extract what it can
      expect(result.testSuites).toHaveLength(1);
      expect(result.testSuites[0].tests).toHaveLength(1);
    });
  });

  describe('search and utility methods', () => {
    const sampleContent = `
describe('Parent Suite', () => {
  describe('Child Suite 1', () => {
    it('test 1', () => {});
    it('test 2', () => {});
  });

  describe('Child Suite 2', () => {
    it('test 3', () => {});
  });

  it('parent test', () => {});
});

describe('Another Suite', () => {
  it('another test', () => {});
});
    `;

    let extractedCode: ExtractedTestCode;

    beforeEach(() => {
      extractedCode = extractor.extractFromContent(sampleContent);
    });

    it('should find test suites by name', () => {
      const suites = extractor.findTestSuitesByName(extractedCode, 'Child Suite 1');
      expect(suites).toHaveLength(1);
      expect(suites[0].name).toBe('Child Suite 1');
    });

    it('should find tests by name', () => {
      const tests = extractor.findTestsByName(extractedCode, 'test 2');
      expect(tests).toHaveLength(1);
      expect(tests[0].test.name).toBe('test 2');
      expect(tests[0].suitePath).toEqual(['Parent Suite', 'Child Suite 1']);
    });

    it('should get all tests with suite paths', () => {
      const allTests = extractor.getAllTests(extractedCode);
      expect(allTests).toHaveLength(5);

      const test1 = allTests.find(t => t.test.name === 'test 1');
      expect(test1!.suitePath).toEqual(['Parent Suite', 'Child Suite 1']);

      const parentTest = allTests.find(t => t.test.name === 'parent test');
      expect(parentTest!.suitePath).toEqual(['Parent Suite']);

      const anotherTest = allTests.find(t => t.test.name === 'another test');
      expect(anotherTest!.suitePath).toEqual(['Another Suite']);
    });

    it('should generate test code statistics', () => {
      const stats = extractor.getTestCodeStats(extractedCode);

      expect(stats.totalSuites).toBe(4); // Parent Suite, Child Suite 1, Child Suite 2, Another Suite
      expect(stats.totalTests).toBe(5);
      expect(stats.asyncTests).toBe(0);
      expect(stats.totalErrors).toBe(0);
      expect(stats.totalWarnings).toBe(0);
      expect(stats.hasBeforeHooks).toBe(false);
      expect(stats.hasAfterHooks).toBe(false);
    });
  });

  describe('extractAndValidate', () => {
    it('should extract and validate valid content', async () => {
      const content = `
describe('Valid test', () => {
  it('should work', () => {
    expect(true).to.be.true;
  });
});
      `;

      const result = await extractor.extractAndValidate(content);
      expect(result.errors).toHaveLength(0);
      expect(result.testSuites).toHaveLength(1);
    });

    it('should throw error for invalid content in strict mode', async () => {
      const content = 'invalid typescript content {{{';

      await expect(extractor.extractAndValidate(content)).rejects.toThrow(TestExtractionError);
    });
  });

  describe('convenience functions', () => {
    it('should export convenience functions', () => {
      expect(typeof extractTestCodeFromFile).toBe('function');
      expect(typeof extractTestCodeFromContent).toBe('function');
    });

    it('should extract from content using convenience function', () => {
      const content = `
describe('Test', () => {
  it('works', () => {});
});
      `;

      const result = extractTestCodeFromContent(content);
      expect(result.testSuites).toHaveLength(1);
    });
  });

  describe('complex scenarios', () => {
    it('should handle complex apicize-style test file', () => {
      const content = `
import { describe, it, before, beforeEach } from 'mocha';
import { expect } from 'chai';
import { TestHelper, ApicizeContext, BodyType } from '@apicize/lib';

/* @apicize-file-metadata
{
  "version": 1.0,
  "source": "demo.apicize",
  "exportDate": "2024-01-01T00:00:00Z"
}
@apicize-file-metadata-end */

let context: ApicizeContext;
let response: any;
let $: Record<string, any>;

const output = (key: string, value: any): void => {
  context?.output(key, value);
};

describe('Demo API Tests', () => {
  /* @apicize-group-metadata
  {
    "id": "group-1",
    "execution": "SEQUENTIAL"
  }
  @apicize-group-metadata-end */

  describe('User Management', () => {
    /* @apicize-request-metadata
    {
      "id": "create-user",
      "url": "https://api.example.com/users",
      "method": "POST"
    }
    @apicize-request-metadata-end */

    beforeEach(async () => {
      const helper = new TestHelper();
      context = await helper.setupTest('Create User');
      response = await context.execute({
        url: "https://api.example.com/users",
        method: "POST",
        body: { name: "Test User" }
      });
      $ = context.$;
    });

    it('should create user successfully', () => {
      expect(response.status).to.equal(201);

      const data = (response.body.type == BodyType.JSON)
        ? response.body.data
        : expect.fail('Response body is not JSON');

      expect(data.name).to.equal('Test User');
      output('userId', data.id);
    });
  });
});
      `;

      const result = extractor.extractFromContent(content, {
        includeSharedCode: true,
        preserveComments: true,
      });

      expect(result.errors).toHaveLength(0);
      expect(result.imports).toHaveLength(3);
      expect(result.testSuites).toHaveLength(1);
      expect(result.sharedCode.length).toBeGreaterThan(0);

      const mainSuite = result.testSuites[0];
      expect(mainSuite.name).toBe('Demo API Tests');
      expect(mainSuite.nestedSuites).toHaveLength(1);

      const userSuite = mainSuite.nestedSuites[0];
      expect(userSuite.name).toBe('User Management');
      expect(userSuite.hooks).toHaveLength(1);
      expect(userSuite.hooks[0].type).toBe('beforeEach');
      expect(userSuite.hooks[0].isAsync).toBe(true);
      expect(userSuite.tests).toHaveLength(1);

      const test = userSuite.tests[0];
      expect(test.name).toBe('should create user successfully');
      expect(test.body).toContain('expect(response.status).to.equal(201)');
      expect(test.body).toContain("output('userId', data.id)");
    });
  });
});
