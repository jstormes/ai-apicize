// Auto-generated individual request: Test Request
import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { TestHelper, ApicizeContext, ApicizeResponse, BodyType } from '@apicize/lib';

/* @apicize-request-metadata
{
    "id": "test-request-1",
    "name": "Test Request",
    "url": "https://api.example.com/test",
    "method": "GET",
    "headers": null,
    "body": null,
    "queryStringParams": null,
    "timeout": 30000,
    "numberOfRedirects": 10,
    "runs": 1,
    "multiRunExecution": "SEQUENTIAL",
    "keepAlive": false,
    "acceptInvalidCerts": false
}
@apicize-request-metadata-end */

// Test context
let context: ApicizeContext;
let response: ApicizeResponse;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let $: Record<string, any>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const output = (key: string, value: any): void => {
  context?.output(key, value);
};

describe('Test Request', function () {
  beforeEach(async function () {
    this.timeout(30000);

    const helper = new TestHelper();
    context = await helper.setupTest('test-request-1');

    response = await context.execute({
      id: 'test-request-1',
      method: 'GET',
      url: 'https://api.example.com/test',
      headers: [],
      body: null,
      queryStringParams: [],
      timeout: 30000,
      numberOfRedirects: 10,
      acceptInvalidCerts: false,
    });

    $ = context.$;
  });

  it('should return successful response', () => {
    expect(response.status).to.equal(200);
  });
});
