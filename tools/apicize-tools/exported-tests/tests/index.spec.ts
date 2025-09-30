// Auto-generated from api-tests.apicize
import { describe, before, after } from 'mocha';
import { TestHelper, ApicizeContext } from '@apicize/lib';

/* @apicize-file-metadata
{
    "version": 1,
    "source": "api-tests.apicize",
    "exportDate": "{{exportDate}}",
    "workbook": {"version":1,"requests":[{"id":"test-request-1","name":"Test Request","url":"https://api.example.com/test","method":"GET","test":"expect(response.status).to.equal(200);"}]}
}
@apicize-file-metadata-end */

// Global test context
let context: ApicizeContext;
// These variables are available for imported test suites
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let _$: Record<string, any>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _output = (key: string, value: any): void => {
  context?.output(key, value);
};

describe('API Tests', function () {
  this.timeout(30000);

  before(async function () {
    const helper = new TestHelper();
    context = await helper.setupWorkbook('api-tests');
    _$ = context.$;
  });

  after(async function () {
    await context?.cleanup();
  });
});

// Import group test suites
