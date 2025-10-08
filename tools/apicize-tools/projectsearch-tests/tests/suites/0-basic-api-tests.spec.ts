// Auto-generated request group: Basic API Tests
import { describe, it, beforeEach, before } from 'mocha';
import { expect } from 'chai';
import {
    TestHelper,
    ApicizeContext,
    ApicizeResponse,
    BodyType
} from '@jstormes/apicize-lib';

/* @apicize-group-metadata
{
    "id": "26706ad9-dfae-4ef9-a13b-efcef860ad47",
    "name": "Basic API Tests",
    "execution": "SEQUENTIAL",
    "runs": 1,
    "multiRunExecution": "{{group.multiRunExecution}}",
    "selectedScenario": null,
    "selectedData": null
}
@apicize-group-metadata-end */

// Test context for this group
let context: ApicizeContext;
let response: ApicizeResponse;
let $: Record<string, any>;

const output = (key: string, value: any): void => {
    context?.output(key, value);
};

describe('Basic API Tests', function() {
    before(async function() {
        const helper = new TestHelper();
        context = await helper.setupWorkbook('Basic API Tests');
        $ = context.$;
    });

    describe('Get Project Search', function() {

        /* @apicize-request-metadata
        {
            "id": "083b2e62-f570-4d3e-a2ef-9114a1e08eea",
            "name": "Get Project Search",
            "url": "https://localhost:7152/v1/projectsearch",
            "method": "GET",
            "headers": [],
            "body": null,
            "queryStringParams": [],
            "timeout": 30000,
            "numberOfRedirects": 10,
            "runs": 1,
            "multiRunExecution": "SEQUENTIAL",
            "keepAlive": false,
            "acceptInvalidCerts": true,
            "test": "describe('Get Project Search', () => {\n  it('should return 200 status', () => {\n    expect(response.status).to.equal(200);\n  });\n\n  it('should return JSON with pagination', () => {\n    expect(response.body.type).to.equal(BodyType.JSON);\n    const JSON_body = (response.body.type == BodyType.JSON)\n      ? response.body.data as Record<string, any>\n      : expect.fail('Response body is not JSON');\n    expect(JSON_body).to.have.property('_total_items');\n    expect(JSON_body).to.have.property('_page');\n  });\n});"
        }
        @apicize-request-metadata-end */

        beforeEach(async function() {
            this.timeout(30000);

            response = await context.execute({
                method: 'GET',
                url: 'https://localhost:7152/v1/projectsearch',
                headers: [],
                queryStringParams: [],
                timeout: 30000,
                numberOfRedirects: 10,
                acceptInvalidCerts: true
            });

            $ = context.$;
        });

        describe('Get Project Search', () => {
            it('should return 200 status', () => {
                expect(response.status).to.equal(200);
            });

            it('should return JSON with pagination', () => {
                expect(response.body.type).to.equal(BodyType.JSON);
                const JSON_body = (response.body.type == BodyType.JSON)
                  ? response.body.data as Record<string, any>
                  : expect.fail('Response body is not JSON');
                expect(JSON_body).to.have.property('_total_items');
                expect(JSON_body).to.have.property('_page');
            });
        });
    });

});
