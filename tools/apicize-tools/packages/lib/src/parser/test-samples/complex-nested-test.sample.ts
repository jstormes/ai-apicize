import { describe, it, before, beforeEach, after, afterEach } from 'mocha';
import { expect } from 'chai';
import { TestHelper, ApicizeContext, BodyType } from '@apicize/lib';

/* @apicize-file-metadata
{
  "version": 1.0,
  "source": "complex-nested.apicize",
  "exportDate": "2024-01-01T00:00:00Z"
}
@apicize-file-metadata-end */

// Shared test utilities
class TestDataManager {
  private data: Map<string, any> = new Map();

  store(key: string, value: any): void {
    this.data.set(key, value);
  }

  get(key: string): any {
    return this.data.get(key);
  }

  clear(): void {
    this.data.clear();
  }
}

const testDataManager = new TestDataManager();

// Helper functions
function generateTestData(type: 'user' | 'product') {
  if (type === 'user') {
    return {
      name: `Test User ${Date.now()}`,
      email: `test${Date.now()}@example.com`,
    };
  } else {
    return {
      name: `Test Product ${Date.now()}`,
      price: Math.floor(Math.random() * 1000),
    };
  }
}

async function validateResponse(response: any, expectedStatus: number) {
  expect(response.status).to.equal(expectedStatus);
  expect(response.body).to.exist;
}

// Test context
let context: ApicizeContext;
let response: any;
let $: Record<string, any>;

const output = (key: string, value: any): void => {
  context?.output(key, value);
};

describe('E-Commerce API Tests', () => {
  /* @apicize-group-metadata
  {
    "id": "ecommerce-root",
    "execution": "SEQUENTIAL",
    "selectedScenario": {"id": "staging", "name": "Staging Environment"}
  }
  @apicize-group-metadata-end */

  before(async () => {
    console.log('Starting E-Commerce API test suite...');
    testDataManager.clear();
  });

  after(() => {
    console.log('E-Commerce API test suite completed');
    testDataManager.clear();
  });

  describe('User Management', () => {
    /* @apicize-group-metadata
    {
      "id": "user-management",
      "execution": "SEQUENTIAL",
      "selectedData": {"id": "users-data", "name": "User Test Data"}
    }
    @apicize-group-metadata-end */

    beforeEach(() => {
      console.log('Setting up user test...');
    });

    afterEach(() => {
      console.log('Cleaning up user test...');
    });

    describe('User Registration', () => {
      /* @apicize-request-metadata
      {
        "id": "register-user",
        "url": "https://api.ecommerce.com/auth/register",
        "method": "POST",
        "headers": [{"name": "Content-Type", "value": "application/json"}],
        "body": {"type": "JSON", "data": {"name": "{{userName}}", "email": "{{userEmail}}", "password": "{{password}}"}}
      }
      @apicize-request-metadata-end */

      beforeEach(async () => {
        const helper = new TestHelper();
        context = await helper.setupTest('Register User');

        const userData = generateTestData('user');
        testDataManager.store('currentUser', userData);

        response = await context.execute({
          url: 'https://api.ecommerce.com/auth/register',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: {
            ...userData,
            password: 'TestPassword123!',
          },
        });

        $ = context.$;
      });

      it('should register new user', async () => {
        await validateResponse(response, 201);

        const data =
          response.body.type == BodyType.JSON
            ? response.body.data
            : expect.fail('Response body is not JSON');

        const userData = testDataManager.get('currentUser');
        expect(data.name).to.equal(userData.name);
        expect(data.email).to.equal(userData.email);
        expect(data.id).to.be.a('string');
        expect(data.token).to.be.a('string');

        output('userId', data.id);
        output('authToken', data.token);
        testDataManager.store('userId', data.id);
        testDataManager.store('authToken', data.token);

        console.info(`Registered user: ${data.id}`);
      });
    });

    describe('User Profile', () => {
      /* @apicize-request-metadata
      {
        "id": "get-user-profile",
        "url": "https://api.ecommerce.com/users/{{userId}}",
        "method": "GET",
        "headers": [
          {"name": "Authorization", "value": "Bearer {{authToken}}"},
          {"name": "Accept", "value": "application/json"}
        ]
      }
      @apicize-request-metadata-end */

      beforeEach(async () => {
        const helper = new TestHelper();
        context = await helper.setupTest('Get User Profile');

        response = await context.execute({
          url: `https://api.ecommerce.com/users/${$.userId}`,
          method: 'GET',
          headers: {
            Authorization: `Bearer ${$.authToken}`,
            Accept: 'application/json',
          },
        });

        $ = context.$;
      });

      it('should get user profile', () => {
        expect(response.status).to.equal(200);

        const data =
          response.body.type == BodyType.JSON
            ? response.body.data
            : expect.fail('Response body is not JSON');

        expect(data.id).to.equal($.userId);
        expect(data.name).to.be.a('string');
        expect(data.email).to.be.a('string');
        expect(data.createdAt).to.be.a('string');

        console.info(`Retrieved profile for user: ${data.id}`);
      });

      it('should have valid profile structure', () => {
        expect(response.status).to.equal(200);

        const data =
          response.body.type == BodyType.JSON
            ? response.body.data
            : expect.fail('Response body is not JSON');

        // Validate profile structure
        expect(data).to.have.property('id');
        expect(data).to.have.property('name');
        expect(data).to.have.property('email');
        expect(data).to.have.property('createdAt');
        expect(data).to.not.have.property('password');

        // Validate data types
        expect(data.id).to.be.a('string');
        expect(data.name).to.be.a('string').that.is.not.empty;
        expect(data.email).to.be.a('string').that.includes('@');
        expect(new Date(data.createdAt)).to.be.a('date');
      });
    });
  });

  describe('Product Catalog', () => {
    /* @apicize-group-metadata
    {
      "id": "product-catalog",
      "execution": "SEQUENTIAL"
    }
    @apicize-group-metadata-end */

    describe('Product Search', () => {
      /* @apicize-request-metadata
      {
        "id": "search-products",
        "url": "https://api.ecommerce.com/products",
        "method": "GET",
        "queryStringParams": [
          {"name": "q", "value": "{{searchTerm}}"},
          {"name": "limit", "value": "{{limit}}"}
        ]
      }
      @apicize-request-metadata-end */

      beforeEach(async () => {
        const helper = new TestHelper();
        context = await helper.setupTest('Search Products');

        response = await context.execute({
          url: 'https://api.ecommerce.com/products?q=laptop&limit=10',
          method: 'GET',
        });

        $ = context.$;
      });

      it('should search products successfully', () => {
        expect(response.status).to.equal(200);

        const data =
          response.body.type == BodyType.JSON
            ? response.body.data
            : expect.fail('Response body is not JSON');

        expect(data).to.have.property('products');
        expect(data).to.have.property('totalCount');
        expect(data.products).to.be.an('array');
        expect(data.totalCount).to.be.a('number').that.is.at.least(0);

        if (data.products.length > 0) {
          const product = data.products[0];
          expect(product).to.have.property('id');
          expect(product).to.have.property('name');
          expect(product).to.have.property('price');
          output('firstProductId', product.id);
        }

        console.info(`Found ${data.products.length} products`);
      });
    });

    describe('Product Details', () => {
      /* @apicize-request-metadata
      {
        "id": "get-product-details",
        "url": "https://api.ecommerce.com/products/{{firstProductId}}",
        "method": "GET",
        "headers": [{"name": "Accept", "value": "application/json"}]
      }
      @apicize-request-metadata-end */

      beforeEach(async () => {
        const helper = new TestHelper();
        context = await helper.setupTest('Get Product Details');

        // Skip if no product ID available
        if (!$.firstProductId) {
          console.log('Skipping test - no product ID available');
          return;
        }

        response = await context.execute({
          url: `https://api.ecommerce.com/products/${$.firstProductId}`,
          method: 'GET',
          headers: { Accept: 'application/json' },
        });

        $ = context.$;
      });

      it('should get product details', function () {
        if (!$.firstProductId) {
          this.skip();
          return;
        }

        expect(response.status).to.equal(200);

        const data =
          response.body.type == BodyType.JSON
            ? response.body.data
            : expect.fail('Response body is not JSON');

        expect(data.id).to.equal($.firstProductId);
        expect(data.name).to.be.a('string');
        expect(data.price).to.be.a('number').that.is.above(0);
        expect(data.description).to.be.a('string');

        console.info(`Product details: ${data.name} - $${data.price}`);
      });
    });
  });
});
