// Auto-generated individual request: Localhost Layout Search Test
import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';
import {
    TestHelper,
    ApicizeContext,
    ApicizeResponse,
    BodyType
} from '@jstormes/apicize-lib';

/* @apicize-request-metadata
{
    "id": "test-localhost",
    "name": "Localhost Layout Search Test",
    "url": "https://localhost:7152/v1/layoutsearch",
    "method": "GET",
    "headers": undefined,
    "body": undefined,
    "queryStringParams": undefined,
    "timeout": 30000,
    "numberOfRedirects": 10,
    "runs": 1,
    "multiRunExecution": "SEQUENTIAL",
    "keepAlive": false,
    "acceptInvalidCerts": true
}
@apicize-request-metadata-end */

// Test context
let context: ApicizeContext;
let response: ApicizeResponse;
let $: Record<string, any>;

const output = (key: string, value: any): void => {
    context?.output(key, value);
};

describe('Localhost Layout Search Test', function() {
    beforeEach(async function() {
        this.timeout(30000);

        const helper = new TestHelper();
        context = await helper.setupRequest('test-localhost');

        response = await context.execute({
            id: 'test-localhost',
            method: 'GET',
            url: 'https://localhost:7152/v1/layoutsearch',
            headers: [],
            body: undefined,
            queryStringParams: [],
            timeout: 30000,
            numberOfRedirects: 10,
            acceptInvalidCerts: true
        });

        $ = context.$;
    });

    describe('Localhost Layout Search', () => {
        it('should connect to localhost API', () => {
            console.log('Response status: ' + response.status)
            console.log('Response headers: ' + JSON.stringify(response.headers))

            if (response.status >= 200 && response.status < 300) {
                console.log('✓ Successfully connected to localhost API')

                if (response.body.type == BodyType.JSON) {
                    const data = response.body.data
                    console.log('Response data type: ' + typeof data)
                    console.log('Response data: ' + JSON.stringify(data))
                    } else {
                    console.log('Response body type: ' + response.body.type)
                    console.log('Response body: ' + response.body.text)
                }
                } else {
                console.log('✗ Failed to connect to localhost API')
                console.log('Status: ' + response.status)
                console.log('Body: ' + response.body.text)
            }
        })
    })
});
