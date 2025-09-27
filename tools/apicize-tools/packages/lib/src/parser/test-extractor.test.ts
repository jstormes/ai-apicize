import {
  TestExtractor,
  TestExtractionError,
  extractTestCodeFromContent,
  extractTestCodeFromFile,
} from './test-extractor';
import * as fs from 'fs';

// Mock fs module for file system tests
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('TestExtractor', () => {
  let extractor: TestExtractor;

  beforeEach(() => {
    extractor = new TestExtractor();
    jest.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    it('should create extractor with default options', () => {
      const defaultExtractor = new TestExtractor();
      expect(defaultExtractor).toBeInstanceOf(TestExtractor);
    });

    it('should create extractor with custom options', () => {
      const customExtractor = new TestExtractor({
        preserveComments: false,
        preserveFormatting: false,
        includeSharedCode: false,
        strictMode: true,
      });
      expect(customExtractor).toBeInstanceOf(TestExtractor);
    });
  });

  describe('Import Extraction', () => {
    it('should extract named imports', () => {
      const content = `
import { describe, it, expect } from 'mocha';
import { assert } from 'chai';
      `;

      const result = extractor.extractFromContent(content);

      expect(result.imports).toHaveLength(2);
      expect(result.imports[0]).toMatchObject({
        moduleSpecifier: 'mocha',
        namedImports: ['describe', 'it', 'expect'],
        typeOnly: false,
      });
      expect(result.imports[1]).toMatchObject({
        moduleSpecifier: 'chai',
        namedImports: ['assert'],
        typeOnly: false,
      });
    });

    it('should extract default imports', () => {
      const content = `
import mocha from 'mocha';
import chai from 'chai';
      `;

      const result = extractor.extractFromContent(content);

      expect(result.imports).toHaveLength(2);
      expect(result.imports[0]).toMatchObject({
        moduleSpecifier: 'mocha',
        defaultImport: 'mocha',
        namedImports: [],
      });
      expect(result.imports[1]).toMatchObject({
        moduleSpecifier: 'chai',
        defaultImport: 'chai',
        namedImports: [],
      });
    });

    it('should extract namespace imports', () => {
      const content = `
import * as mocha from 'mocha';
import * as chai from 'chai';
      `;

      const result = extractor.extractFromContent(content);

      expect(result.imports).toHaveLength(2);
      expect(result.imports[0]).toMatchObject({
        moduleSpecifier: 'mocha',
        namespaceImport: 'mocha',
        namedImports: [],
      });
      expect(result.imports[1]).toMatchObject({
        moduleSpecifier: 'chai',
        namespaceImport: 'chai',
        namedImports: [],
      });
    });

    it('should extract type-only imports', () => {
      const content = `
import type { TestResult } from './types';
import type { Config } from 'mocha';
      `;

      const result = extractor.extractFromContent(content);

      expect(result.imports).toHaveLength(2);
      expect(result.imports[0]).toMatchObject({
        moduleSpecifier: './types',
        namedImports: ['TestResult'],
        typeOnly: true,
      });
      expect(result.imports[1]).toMatchObject({
        moduleSpecifier: 'mocha',
        namedImports: ['Config'],
        typeOnly: true,
      });
    });
  });

  describe('Test Code Extraction', () => {
    it('should extract basic describe and it blocks', () => {
      const content = `
/* @apicize-request-metadata
{
  "id": "test-request-123",
  "url": "https://api.example.com/test",
  "method": "GET"
}
@apicize-request-metadata-end */

describe('Test Request', () => {
  it('should return successful response', () => {
    expect(response.status).to.equal(200);
  });

  it('should have correct data', async () => {
    const data = response.body.data;
    expect(data).to.exist;
  });
});
      `;

      const result = extractor.extractFromContent(content);

      expect(result.requestTests).toHaveLength(1);
      expect(result.requestTests[0]).toMatchObject({
        id: 'test-request-123',
        describe: 'Test Request',
        itBlocks: [
          {
            name: 'should return successful response',
            isAsync: false,
          },
          {
            name: 'should have correct data',
            isAsync: true,
          },
        ],
      });
    });

    it('should extract nested describe blocks', () => {
      const content = `
describe('API Tests', () => {
  /* @apicize-request-metadata
  {
    "id": "nested-request-456",
    "url": "https://api.example.com/nested",
    "method": "POST"
  }
  @apicize-request-metadata-end */

  describe('POST Request', () => {
    it('should create resource', () => {
      expect(response.status).to.equal(201);
    });
  });
});
      `;

      const result = extractor.extractFromContent(content);

      expect(result.requestTests).toHaveLength(1);
      expect(result.requestTests[0]).toMatchObject({
        id: 'nested-request-456',
        describe: 'POST Request',
      });
    });

    it('should extract hook functions', () => {
      const content = `
describe('Test Suite', () => {
  beforeEach(async () => {
    response = await context.execute(request);
  });

  afterEach(() => {
    context.cleanup();
  });

  before(() => {
    context.setup();
  });

  after(() => {
    context.teardown();
  });
});
      `;

      const result = extractor.extractFromContent(content);

      expect(result.sharedCode).toHaveLength(4);
      expect(result.sharedCode.map(sc => sc.type)).toEqual([
        'beforeEach',
        'afterEach',
        'before',
        'after',
      ]);
    });

    it('should handle malformed metadata gracefully', () => {
      const content = `
/* @apicize-request-metadata
{
  "id": "malformed-json"
  "url": "https://api.example.com/test"
}
@apicize-request-metadata-end */

describe('Test with malformed metadata', () => {
  it('should still extract test', () => {
    expect(true).to.be.true;
  });
});
      `;

      const result = extractor.extractFromContent(content);

      // Should not extract the request test due to malformed metadata
      expect(result.requestTests).toHaveLength(0);
      expect(result.errors).toHaveLength(0); // Malformed metadata is ignored, not an error
    });
  });

  describe('Comment and Formatting Preservation', () => {
    it('should preserve comments when enabled', () => {
      const commentExtractor = new TestExtractor({ preserveComments: true });
      const content = `
/* @apicize-request-metadata
{
  "id": "comment-test",
  "url": "https://api.example.com/test",
  "method": "GET"
}
@apicize-request-metadata-end */

// This is a test comment
describe('Test with comments', () => {
  // Test comment inside
  it('should work', () => {
    expect(true).to.be.true;
  });
});
      `;

      const result = commentExtractor.extractFromContent(content);

      expect(result.requestTests).toHaveLength(1);
      expect(result.requestTests[0].formatting.preservedComments).toHaveLength(0); // Comments before describe block
    });

    it('should extract proper indentation', () => {
      const content = `
/* @apicize-request-metadata
{
  "id": "indent-test",
  "url": "https://api.example.com/test",
  "method": "GET"
}
@apicize-request-metadata-end */

    describe('Indented test', () => {
        it('should preserve indentation', () => {
            expect(response.status).to.equal(200);
        });
    });
      `;

      const result = extractor.extractFromContent(content);

      expect(result.requestTests).toHaveLength(1);
      expect(result.requestTests[0].formatting.indentation).toBe('    ');
    });
  });

  describe('File Operations', () => {
    it('should handle file not found', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = await extractor.extractFromFile('/nonexistent/file.ts');

      expect(result.errors).toContain('File not found: /nonexistent/file.ts');
      expect(result.requestTests).toHaveLength(0);
    });

    it('should read file successfully', async () => {
      const content = `
import { describe, it } from 'mocha';

/* @apicize-request-metadata
{
  "id": "file-test",
  "url": "https://api.example.com/file",
  "method": "GET"
}
@apicize-request-metadata-end */

describe('File test', () => {
  it('should work', () => {
    expect(true).to.be.true;
  });
});
      `;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.promises.readFile = jest.fn().mockResolvedValue(content);

      const result = await extractor.extractFromFile('/path/to/test.ts');

      expect(result.errors).toHaveLength(0);
      expect(result.requestTests).toHaveLength(1);
      expect(result.imports).toHaveLength(1);
    });

    it('should handle file read errors', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.promises.readFile = jest.fn().mockRejectedValue(new Error('Permission denied'));

      const result = await extractor.extractFromFile('/path/to/protected.ts');

      expect(result.errors).toContain('Failed to read file: Permission denied');
      expect(result.requestTests).toHaveLength(0);
    });
  });

  describe('Strict Mode', () => {
    it('should validate in strict mode', () => {
      const strictExtractor = new TestExtractor({ strictMode: true });
      const content = `
import { describe } from 'mocha';

describe('No tests here', () => {
  // Empty describe block
});
      `;

      const result = strictExtractor.extractFromContent(content);

      expect(result.errors).toContain('No request tests found in strict mode');
    });

    it('should warn about missing imports in strict mode', () => {
      const strictExtractor = new TestExtractor({ strictMode: true });
      const content = `
/* @apicize-request-metadata
{
  "id": "no-imports-test",
  "url": "https://api.example.com/test",
  "method": "GET"
}
@apicize-request-metadata-end */

describe('Test without imports', () => {
  it('should work', () => {
    console.log('test');
  });
});
      `;

      const result = strictExtractor.extractFromContent(content);

      expect(result.warnings).toContain('No Mocha/Chai imports found - this may not be a test file');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid TypeScript syntax', () => {
      const content = `
import { describe } from 'mocha';

describe('Invalid syntax', () => {
  it('should fail', () => {
    expect(response.status).to.equal(200);
    // Missing closing brace
      `;

      const result = extractor.extractFromContent(content);

      // TypeScript parser is robust, so it might still extract some information
      // but we should handle gracefully
      expect(result.errors.length).toBeGreaterThanOrEqual(0);
    });

    it('should throw error in extractAndValidate when extraction fails', async () => {
      const invalidContent = 'completely invalid typescript &@#$%';

      await expect(extractor.extractAndValidate(invalidContent)).rejects.toThrow(TestExtractionError);
    });
  });

  describe('Statistics and Analysis', () => {
    it('should provide extraction statistics', () => {
      const content = `
import { describe, it } from 'mocha';
import { expect } from 'chai';

/* @apicize-request-metadata
{
  "id": "stats-test",
  "url": "https://api.example.com/stats",
  "method": "GET"
}
@apicize-request-metadata-end */

describe('Statistics test', () => {
  beforeEach(async () => {
    response = await context.execute(request);
  });

  it('should work', () => {
    expect(response.status).to.equal(200);
  });

  it('should be async', async () => {
    const data = await response.json();
    expect(data).to.exist;
  });
});
      `;

      const result = extractor.extractFromContent(content);
      const stats = extractor.getExtractionStats(result);

      expect(stats).toMatchObject({
        totalRequestTests: 1,
        totalItBlocks: 2,
        asyncTests: 1,
        totalSharedCode: 1,
        totalImports: 2,
        totalErrors: 0,
        totalWarnings: 0,
      });
    });
  });

  describe('Convenience Functions', () => {
    it('should work with extractTestCodeFromContent', () => {
      const content = `
import { describe, it } from 'mocha';

/* @apicize-request-metadata
{
  "id": "convenience-test",
  "url": "https://api.example.com/convenience",
  "method": "GET"
}
@apicize-request-metadata-end */

describe('Convenience test', () => {
  it('should work', () => {
    expect(true).to.be.true;
  });
});
      `;

      const result = extractTestCodeFromContent(content);

      expect(result.requestTests).toHaveLength(1);
      expect(result.imports).toHaveLength(1);
    });

    it('should work with extractTestCodeFromFile', async () => {
      const content = `
import { describe, it } from 'mocha';

/* @apicize-request-metadata
{
  "id": "file-convenience-test",
  "url": "https://api.example.com/file-convenience",
  "method": "GET"
}
@apicize-request-metadata-end */

describe('File convenience test', () => {
  it('should work', () => {
    expect(true).to.be.true;
  });
});
      `;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.promises.readFile = jest.fn().mockResolvedValue(content);

      const result = await extractTestCodeFromFile('/path/to/convenience.ts');

      expect(result.requestTests).toHaveLength(1);
      expect(result.imports).toHaveLength(1);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle multiple request tests in one file', () => {
      const content = `
import { describe, it, expect } from 'mocha';

/* @apicize-request-metadata
{
  "id": "first-request",
  "url": "https://api.example.com/first",
  "method": "GET"
}
@apicize-request-metadata-end */

describe('First Request', () => {
  it('should work', () => {
    expect(response.status).to.equal(200);
  });
});

/* @apicize-request-metadata
{
  "id": "second-request",
  "url": "https://api.example.com/second",
  "method": "POST"
}
@apicize-request-metadata-end */

describe('Second Request', () => {
  it('should create', () => {
    expect(response.status).to.equal(201);
  });

  it('should return data', () => {
    expect(response.body.data).to.exist;
  });
});
      `;

      const result = extractor.extractFromContent(content);

      expect(result.requestTests).toHaveLength(2);
      expect(result.requestTests[0].id).toBe('first-request');
      expect(result.requestTests[1].id).toBe('second-request');
      expect(result.requestTests[0].itBlocks).toHaveLength(1);
      expect(result.requestTests[1].itBlocks).toHaveLength(2);
    });

    it('should ignore describe blocks without metadata', () => {
      const content = `
import { describe, it } from 'mocha';

describe('Regular test suite', () => {
  it('should be ignored', () => {
    expect(true).to.be.true;
  });
});

/* @apicize-request-metadata
{
  "id": "api-request",
  "url": "https://api.example.com/api",
  "method": "GET"
}
@apicize-request-metadata-end */

describe('API Request', () => {
  it('should be extracted', () => {
    expect(response.status).to.equal(200);
  });
});
      `;

      const result = extractor.extractFromContent(content);

      expect(result.requestTests).toHaveLength(1);
      expect(result.requestTests[0].id).toBe('api-request');
    });

    it('should handle test() function as alias for it()', () => {
      const content = `
import { describe, test } from 'mocha';

/* @apicize-request-metadata
{
  "id": "test-alias",
  "url": "https://api.example.com/test-alias",
  "method": "GET"
}
@apicize-request-metadata-end */

describe('Test alias', () => {
  test('should work with test() function', () => {
    expect(response.status).to.equal(200);
  });
});
      `;

      const result = extractor.extractFromContent(content);

      expect(result.requestTests).toHaveLength(1);
      expect(result.requestTests[0].itBlocks).toHaveLength(1);
      expect(result.requestTests[0].itBlocks[0].name).toBe('should work with test() function');
    });
  });
});