import { describe, it, before, beforeEach, after } from 'mocha';
import { expect } from 'chai';
import { TestHelper, ApicizeContext, BodyType } from '@apicize/lib';

/* @apicize-file-metadata
{
  "version": 1.0,
  "source": "simple-api.apicize",
  "exportDate": "2024-01-01T00:00:00Z"
}
@apicize-file-metadata-end */

// Test context variables
let context: ApicizeContext;
let response: any;
let $: Record<string, any>;

// Helper function for passing data between tests
const output = (key: string, value: any): void => {
  context?.output(key, value);
};

describe('Simple API Tests', () => {
  /* @apicize-group-metadata
  {
    "id": "simple-api-group",
    "execution": "SEQUENTIAL",
    "selectedScenario": {"id": "default", "name": "Default"}
  }
  @apicize-group-metadata-end */

  before(async () => {
    console.log('Setting up test suite...');
  });

  after(() => {
    console.log('Cleaning up test suite...');
  });

  describe('User Operations', () => {
    /* @apicize-request-metadata
    {
      "id": "get-users",
      "url": "https://api.example.com/users",
      "method": "GET",
      "headers": [{"name": "Accept", "value": "application/json"}],
      "timeout": 30000
    }
    @apicize-request-metadata-end */

    beforeEach(async () => {
      const helper = new TestHelper();
      context = await helper.setupTest('Get Users');

      response = await context.execute({
        url: context.substituteVariables('https://api.example.com/users'),
        method: 'GET',
        headers: { Accept: 'application/json' },
        timeout: 30000,
      });

      $ = context.$;
    });

    it('should get users list', () => {
      expect(response.status).to.equal(200);

      const data =
        response.body.type == BodyType.JSON
          ? response.body.data
          : expect.fail('Response body is not JSON');

      expect(data).to.be.an('array');
      expect(data.length).to.be.greaterThan(0);

      console.info(`Found ${data.length} users`);
    });
  });

  describe('Create User', () => {
    /* @apicize-request-metadata
    {
      "id": "create-user",
      "url": "https://api.example.com/users",
      "method": "POST",
      "headers": [
        {"name": "Content-Type", "value": "application/json"},
        {"name": "Accept", "value": "application/json"}
      ],
      "body": {
        "type": "JSON",
        "data": {"name": "{{userName}}", "email": "{{userEmail}}"}
      }
    }
    @apicize-request-metadata-end */

    beforeEach(async () => {
      const helper = new TestHelper();
      context = await helper.setupTest('Create User');

      response = await context.execute({
        url: 'https://api.example.com/users',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: {
          name: $.userName || 'Test User',
          email: $.userEmail || 'test@example.com',
        },
      });

      $ = context.$;
    });

    it('should create new user', async () => {
      expect(response.status).to.equal(201);

      const data =
        response.body.type == BodyType.JSON
          ? response.body.data
          : expect.fail('Response body is not JSON');

      expect(data.name).to.equal($.userName || 'Test User');
      expect(data.email).to.equal($.userEmail || 'test@example.com');
      expect(data.id).to.be.a('string');

      // Save user ID for later tests
      output('createdUserId', data.id);

      console.info(`Created user with ID: ${data.id}`);
    });
  });
});
