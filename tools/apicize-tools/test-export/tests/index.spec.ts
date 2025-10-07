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
    "exportDate": "2025-10-07T14:28:34.499Z",
    "workbook": {"version":1,"requests":[]}
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
