// Auto-generated request group: Image Rotation
import { describe, it, beforeEach, before } from 'mocha';
import { expect } from 'chai';
import { TestHelper, ApicizeContext, ApicizeResponse, BodyType } from '@apicize/lib';

/* @apicize-group-metadata
{
    "id": "f0e0565d-c59b-44f9-9232-426f89d46291",
    "name": "Image Rotation",
    "execution": "CONCURRENT",
    "runs": 1,
    "multiRunExecution": "SEQUENTIAL",
    "selectedScenario": null,
    "selectedData": null
}
@apicize-group-metadata-end */

// Test context for this group
let context: ApicizeContext;
let response: ApicizeResponse;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let $: Record<string, any>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const output = (key: string, value: any): void => {
  context?.output(key, value);
};

describe('Image Rotation', function () {
  before(async function () {
    const helper = new TestHelper();
    context = await helper.setupGroup('f0e0565d-c59b-44f9-9232-426f89d46291');
    $ = context.$;
  });

  describe('Right', function () {
    // Metadata included
    /* @apicize-request-metadata
        {
            "id": "14775e91-cee6-404e-bb64-88cc97b8b77a",
            "name": "Right",
            "url": "https://sample-api.apicize.com/image/right",
            "method": "POST",
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

    beforeEach(async function () {
      this.timeout(30000);

      response = await context.execute({
        id: '14775e91-cee6-404e-bb64-88cc97b8b77a',
        method: 'POST',
        url: 'https://sample-api.apicize.com/image/right',
        headers: null,
        body: null,
        queryStringParams: null,
        timeout: 30000,
        numberOfRedirects: 10,
        acceptInvalidCerts: false,
      });

      $ = context.$;
    });

    describe('status', () => {
      it('equals 200', () => {
        expect(response.status).to.equal(200);
      });
    });

    describe('body', () => {
      it('has length > 0', () => {
        const result =
          response.body.type == BodyType.Binary
            ? response.body.data
            : expect.fail('Response body is not binary');

        expect(result.length).to.be.greaterThan(0);
      });
    });
  });

  describe('Flip', function () {
    // Metadata included
    /* @apicize-request-metadata
        {
            "id": "d9664e4b-1ade-4588-aa92-a13244882d5a",
            "name": "Flip",
            "url": "https://sample-api.apicize.com/image/flip",
            "method": "POST",
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

    beforeEach(async function () {
      this.timeout(30000);

      response = await context.execute({
        id: 'd9664e4b-1ade-4588-aa92-a13244882d5a',
        method: 'POST',
        url: 'https://sample-api.apicize.com/image/flip',
        headers: null,
        body: null,
        queryStringParams: null,
        timeout: 30000,
        numberOfRedirects: 10,
        acceptInvalidCerts: false,
      });

      $ = context.$;
    });

    describe('status', () => {
      it('equals 200', () => {
        expect(response.status).to.equal(200);
      });
    });

    describe('body', () => {
      it('has length > 0', () => {
        const result =
          response.body.type == BodyType.Binary
            ? response.body.data
            : expect.fail('Response body is not binary');

        expect(result.length).to.be.greaterThan(0);
      });
    });
  });

  describe('Left', function () {
    // Metadata included
    /* @apicize-request-metadata
        {
            "id": "08d81ab7-f1a7-4187-ab28-eb03199ef338",
            "name": "Left",
            "url": "https://sample-api.apicize.com/image/left",
            "method": "POST",
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

    beforeEach(async function () {
      this.timeout(30000);

      response = await context.execute({
        id: '08d81ab7-f1a7-4187-ab28-eb03199ef338',
        method: 'POST',
        url: 'https://sample-api.apicize.com/image/left',
        headers: null,
        body: null,
        queryStringParams: null,
        timeout: 30000,
        numberOfRedirects: 10,
        acceptInvalidCerts: false,
      });

      $ = context.$;
    });

    describe('status', () => {
      it('equals 200', () => {
        expect(response.status).to.equal(200);
      });
    });

    describe('body', () => {
      it('has length > 0', () => {
        const result =
          response.body.type == BodyType.Binary
            ? response.body.data
            : expect.fail('Response body is not binary');

        expect(result.length).to.be.greaterThan(0);
      });
    });
  });

  // End metadata
});
