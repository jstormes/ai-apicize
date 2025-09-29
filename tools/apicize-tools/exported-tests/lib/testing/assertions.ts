import { expect } from 'chai';
import { BodyType } from '@apicize/lib';

// Custom Chai assertions for Apicize tests
declare global {
    namespace Chai {
        interface Assertion {
            json(): Assertion;
            status(code: number): Assertion;
        }
    }
}

// Extend Chai with custom assertions
chai.use(function(chai, utils) {
    chai.Assertion.addMethod('json', function() {
        const response = utils.flag(this, 'object');
        expect(response.body.type).to.equal(BodyType.JSON);
        utils.flag(this, 'object', response.body.data);
    });

    chai.Assertion.addMethod('status', function(expectedStatus: number) {
        const response = utils.flag(this, 'object');
        expect(response.status).to.equal(expectedStatus);
    });
});
