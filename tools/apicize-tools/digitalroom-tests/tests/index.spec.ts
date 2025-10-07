// Auto-generated from api-tests.apicize
import { describe, before, after } from 'mocha';
import { expect } from 'chai';
import {
    TestHelper,
    ApicizeContext,
    ApicizeResponse,
    BodyType
} from '@jstormes/apicize-lib';

/* @apicize-file-metadata
{
    "version": 1,
    "source": "api-tests.apicize",
    "exportDate": "2025-10-07T14:37:28.860Z",
    "workbook": {"version":1,"requests":[{"id":"test-localhost","name":"Localhost Layout Search Test","url":"https://localhost:7152/v1/layoutsearch","method":"GET","timeout":30000,"numberOfRedirects":10,"runs":1,"multiRunExecution":"SEQUENTIAL","keepAlive":false,"acceptInvalidCerts":true,"test":"\ndescribe('Localhost Layout Search', () => {\n    it('should connect to localhost API', () => {\n        console.log('Response status: ' + response.status)\n        console.log('Response headers: ' + JSON.stringify(response.headers))\n        \n        if (response.status >= 200 && response.status < 300) {\n            console.log('✓ Successfully connected to localhost API')\n            \n            if (response.body.type == BodyType.JSON) {\n                const data = response.body.data\n                console.log('Response data type: ' + typeof data)\n                console.log('Response data: ' + JSON.stringify(data))\n            } else {\n                console.log('Response body type: ' + response.body.type)\n                console.log('Response body: ' + response.body.text)\n            }\n        } else {\n            console.log('✗ Failed to connect to localhost API')\n            console.log('Status: ' + response.status)\n            console.log('Body: ' + response.body.text)\n        }\n    })\n})"}],"scenarios":[],"authorizations":[],"certificates":[],"proxies":[],"defaults":{},"data":[]}
}
@apicize-file-metadata-end */

// Global test context
let context: ApicizeContext;
let response: ApicizeResponse;
let $: Record<string, any>;

const output = (key: string, value: any): void => {
    context?.output(key, value);
};

describe('API Tests', function() {
    this.timeout(30000);

    before(async function() {
        const helper = new TestHelper();
        context = await helper.setupWorkbook('api-tests');
        $ = context.$;
    });

    after(async function() {
        await context?.cleanup();
    });

});

// Import group test suites
