// Auto-generated request group: CRUD Operations
import { describe, it, beforeEach, before } from 'mocha';
import { expect } from 'chai';
import {
    TestHelper,
    ApicizeContext,
    ApicizeResponse,
    BodyType
} from '@apicize/lib';

/* @apicize-group-metadata
{
    "id": "08481c50-fc57-4099-9733-a102f1850c37",
    "name": "CRUD Operations",
    "execution": "SEQUENTIAL",
    "runs": 1,
    "multiRunExecution": "SEQUENTIAL",
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

describe('CRUD Operations', function() {
    before(async function() {
        const helper = new TestHelper();
        context = await helper.setupGroup('08481c50-fc57-4099-9733-a102f1850c37');
        $ = context.$;
    });

    beforeEach(async function() {
        this.timeout({{this.timeout}});

        response = await context.execute({
            id: '{{this.id}}',
            method: '{{this.method}}',
            url: '{{this.url}}',
            headers: null,
            body: null,
            queryStringParams: null,
            timeout: {{this.timeout}},
            numberOfRedirects: {{this.numberOfRedirects}},
            acceptInvalidCerts: {{this.acceptInvalidCerts}}
        });

        $ = context.$;
    });

    {{this.test}}
});
{{/each}}
{{/if}}

describe('Author #1', function() {
    // Nested group - would be implemented recursively
});

describe('Author #2', function() {
    // Nested group - would be implemented recursively
});

});
