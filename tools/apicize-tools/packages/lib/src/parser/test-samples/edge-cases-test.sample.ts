// Edge cases test file for TestExtractor
import { describe, it, suite, test, before, after, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';

/* @apicize-file-metadata
{
  "version": 1.0,
  "source": "edge-cases.apicize",
  "exportDate": "2024-01-01T00:00:00Z",
  "special": {
    "nested": {
      "value": "test"
    }
  }
}
@apicize-file-metadata-end */

// Test file with various edge cases
const complexObject = {
  nested: {
    deeply: {
      nested: {
        value: 'test',
      },
    },
  },
  array: [1, 2, 3],
  function: () => 'test',
};

// Arrow function
const arrowFunction = () => {
  return 'arrow function result';
};

// Async function
async function asyncFunction() {
  return await Promise.resolve('async result');
}

// Class with methods
class TestHelper {
  constructor(public name: string) {}

  method() {
    return `Hello ${this.name}`;
  }

  async asyncMethod() {
    return await Promise.resolve(`Async hello ${this.name}`);
  }
}

// Type definitions (used in tests)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type TestConfig = {
  timeout: number;
  retries: number;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface TestInterface {
  id: string;
  name: string;
  execute(): Promise<void>;
}

// Test suites with mixed function names
describe('Edge Cases - Describe', () => {
  /* @apicize-group-metadata
  {
    "id": "edge-cases-describe",
    "execution": "CONCURRENT"
  }
  @apicize-group-metadata-end */

  it('test with describe/it', () => {
    expect(true).to.be.true;
  });

  test('test with describe/test', () => {
    expect(1).to.equal(1);
  });
});

suite('Edge Cases - Suite', () => {
  /* @apicize-group-metadata
  {
    "id": "edge-cases-suite",
    "execution": "SEQUENTIAL"
  }
  @apicize-group-metadata-end */

  it('test with suite/it', () => {
    expect(false).to.be.false;
  });

  test('test with suite/test', () => {
    expect('test').to.be.a('string');
  });
});

// Tests with various async patterns
describe('Async Patterns', () => {
  beforeEach(async function () {
    this.timeout(5000);
    await new Promise(resolve => setTimeout(resolve, 10));
  });

  it('async test with async/await', async () => {
    const result = await asyncFunction();
    expect(result).to.equal('async result');
  });

  it('async test with promise', () => {
    return Promise.resolve('promise result').then(result => {
      expect(result).to.equal('promise result');
    });
  });

  it('test with arrow function', () => {
    const result = arrowFunction();
    expect(result).to.equal('arrow function result');
  });
});

// Tests with complex code structures
describe('Complex Code Structures', () => {
  /* @apicize-request-metadata
  {
    "id": "complex-request",
    "url": "https://api.complex.com/{{endpoint}}",
    "method": "POST",
    "body": {
      "type": "JSON",
      "data": {
        "nested": {
          "object": {
            "with": ["array", "values"]
          }
        }
      }
    }
  }
  @apicize-request-metadata-end */

  it('test with complex object destructuring', () => {
    const {
      nested: {
        deeply: {
          nested: { value },
        },
      },
    } = complexObject;
    expect(value).to.equal('test');
  });

  it('test with try-catch', () => {
    try {
      throw new Error('Test error');
    } catch (error) {
      expect(error).to.be.instanceOf(Error);
      expect((error as Error).message).to.equal('Test error');
    }
  });

  it('test with loops and conditions', () => {
    const numbers = [1, 2, 3, 4, 5];
    const evenNumbers = [];

    for (const num of numbers) {
      if (num % 2 === 0) {
        evenNumbers.push(num);
      }
    }

    expect(evenNumbers).to.deep.equal([2, 4]);
  });

  it('test with class instantiation', () => {
    const helper = new TestHelper('TestCase');
    expect(helper.method()).to.equal('Hello TestCase');
  });

  it('test with async class method', async () => {
    const helper = new TestHelper('AsyncTest');
    const result = await helper.asyncMethod();
    expect(result).to.equal('Async hello AsyncTest');
  });
});

// Tests with unusual formatting
describe('Unusual Formatting', function () {
  this.timeout(10000);

  it('test with unusual spacing', function () {
    expect(1 + 1).to.equal(2);
  });

  it('test with\nmultiline string', () => {
    const multiline = `
      This is a
      multiline string
      with various content
    `;
    expect(multiline).to.include('multiline');
  });

  it('test with template literals', () => {
    const name = 'World';
    const greeting = `Hello, ${name}!`;
    expect(greeting).to.equal('Hello, World!');
  });
});

// Deeply nested test structure
describe('Level 1', () => {
  describe('Level 2', () => {
    describe('Level 3', () => {
      describe('Level 4', () => {
        it('deeply nested test', () => {
          expect(4).to.equal(4);
        });
      });
    });
  });
});

// Tests with hooks
describe('Hook Tests', () => {
  let setupValue: string;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let _cleanupValue: string;

  before(function () {
    setupValue = 'setup complete';
    console.log('Global setup');
  });

  after(function () {
    _cleanupValue = 'cleanup complete';
    console.log('Global cleanup');
  });

  beforeEach(async function () {
    await new Promise(resolve => setTimeout(resolve, 1));
    console.log('Test setup');
  });

  afterEach(function () {
    console.log('Test cleanup');
  });

  it('should have setup value', () => {
    expect(setupValue).to.equal('setup complete');
  });

  it('should work with hooks', () => {
    expect(true).to.be.true;
  });
});

// Empty test suite
describe('Empty Suite', () => {
  // No tests
});

// Suite with only hooks
describe('Hooks Only Suite', () => {
  before(() => {
    console.log('Only hooks here');
  });
});

// Comments and edge cases in code
describe('Comments and Edge Cases', () => {
  it('test with comments', () => {
    // This is a comment
    expect(1).to.equal(1); // Inline comment

    /*
     * Multi-line comment
     * with multiple lines
     */
    expect(true).to.be.true;
  });

  it('test with regex', () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    expect(emailRegex.test('test@example.com')).to.be.true;
    expect(emailRegex.test('invalid-email')).to.be.false;
  });

  it('test with string containing describe/it', () => {
    const testString = 'This string contains describe and it keywords';
    expect(testString).to.include('describe');
    expect(testString).to.include('it');
  });
});
