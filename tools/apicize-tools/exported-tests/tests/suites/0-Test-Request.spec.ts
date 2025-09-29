// Auto-generated individual request: Test Request
import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';
import {
    TestHelper,
    ApicizeContext,
    ApicizeResponse,
    BodyType
} from '@apicize/lib';

/* @apicize-request-metadata
{
    "id": "test-request-1",
    "name": "Test Request",
    "url": "https://api.example.com/test",
    "method": "GET",
    "headers": null,
    "body": null,
    "queryStringParams": null,
    "timeout": {{request.timeout}},
    "numberOfRedirects": {{request.numberOfRedirects}},
    "runs": {{request.runs}},
    "multiRunExecution": "{{request.multiRunExecution}}",
    "keepAlive": {{request.keepAlive}},
    "acceptInvalidCerts": {{request.acceptInvalidCerts}}
}
@apicize-request-metadata-end */

// Test context
let context: ApicizeContext;
let response: ApicizeResponse;
let $: Record<string, any>;

const output = (key: string, value: any): void => {
    context?.output(key, value);
};

describe('Test Request', function() {
    beforeEach(async function() {
        this.timeout(30000);

        const helper = new TestHelper();
        context = await helper.setupRequest('test-request-1');

        response = await context.execute({
            id: 'test-request-1',
            method: 'GET',
            url: 'https://api.example.com/test',
            headers: [],
            body: null,
            queryStringParams: [],
            timeout: 30000,
            numberOfRedirects: {{request.numberOfRedirects}},
            acceptInvalidCerts: {{request.acceptInvalidCerts}}
        });

        $ = context.$;
    });

    expect(response.status).to.equal(200);
});
