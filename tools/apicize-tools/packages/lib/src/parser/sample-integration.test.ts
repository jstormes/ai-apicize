import { MetadataExtractor } from './metadata-extractor';

describe('MetadataExtractor - Sample Integration', () => {
  let extractor: MetadataExtractor;

  beforeEach(() => {
    extractor = new MetadataExtractor();
  });

  describe('sample TypeScript test file integration', () => {
    it('should extract metadata from sample exported test file', async () => {
      // Create a sample TypeScript test file that looks like an exported .apicize file
      const sampleContent = `
// Auto-generated from demo.apicize
import { describe, it, before, after, beforeEach } from 'mocha';
import { expect } from 'chai';
import { TestHelper, ApicizeContext, ApicizeResponse, BodyType } from '@apicize/lib';

/* @apicize-file-metadata
{
  "version": 1.0,
  "source": "demo.apicize",
  "exportDate": "2024-01-01T00:00:00Z",
  "workbook": {
    "name": "Demo API Tests",
    "description": "Sample API testing workbook"
  }
}
@apicize-file-metadata-end */

// Test context variables
let context: ApicizeContext;
let response: ApicizeResponse;
let $: Record<string, any>;
const output = (key: string, value: any): void => {
  context?.output(key, value);
};

describe('API Testing Demo', () => {
  /* @apicize-group-metadata
  {
    "id": "demo-group-1",
    "name": "User Management",
    "execution": "SEQUENTIAL",
    "runs": 1,
    "multiRunExecution": "SEQUENTIAL",
    "selectedScenario": {
      "id": "scenario-prod",
      "name": "Production Environment"
    }
  }
  @apicize-group-metadata-end */

  before(async () => {
    const helper = new TestHelper();
    context = await helper.setupTest('API Testing Demo');
  });

  describe('Create User', () => {
    /* @apicize-request-metadata
    {
      "id": "create-user-request",
      "name": "Create New User",
      "url": "https://api.example.com/users",
      "method": "POST",
      "headers": [
        {"name": "Content-Type", "value": "application/json"},
        {"name": "Authorization", "value": "Bearer {{apiToken}}"}
      ],
      "body": {
        "type": "JSON",
        "data": {
          "name": "{{userName}}",
          "email": "{{userEmail}}",
          "role": "user"
        }
      },
      "queryStringParams": [],
      "timeout": 30000,
      "numberOfRedirects": 10,
      "runs": 1,
      "multiRunExecution": "SEQUENTIAL",
      "keepAlive": true,
      "acceptInvalidCerts": false,
      "mode": "cors"
    }
    @apicize-request-metadata-end */

    beforeEach(async () => {
      // Execute the actual HTTP request
      response = await context.execute({
        url: context.substituteVariables("https://api.example.com/users"),
        method: "POST",
        headers: context.headers,
        body: context.body,
        timeout: 30000
      });

      // Set up variables for test code
      $ = context.$;
    });

    it('should create user successfully', () => {
      // Original test code from .apicize file
      expect(response.status).to.equal(201);

      const JSON_body = (response.body.type == BodyType.JSON)
        ? response.body.data
        : expect.fail('Response body is not JSON');

      expect(JSON_body.name).to.equal($.userName);
      expect(JSON_body.email).to.equal($.userEmail);
      expect(JSON_body.id).to.be.a('string');

      // Save user ID for subsequent tests
      output('createdUserId', JSON_body.id);
      console.info(\`Created user with ID: \${JSON_body.id}\`);
    });
  });

  describe('Get User', () => {
    /* @apicize-request-metadata
    {
      "id": "get-user-request",
      "name": "Get User by ID",
      "url": "https://api.example.com/users/{{createdUserId}}",
      "method": "GET",
      "headers": [
        {"name": "Authorization", "value": "Bearer {{apiToken}}"}
      ],
      "body": {
        "type": "None"
      },
      "queryStringParams": [
        {"name": "include", "value": "profile,preferences"}
      ],
      "timeout": 15000,
      "numberOfRedirects": 5,
      "runs": 1,
      "keepAlive": false,
      "acceptInvalidCerts": false
    }
    @apicize-request-metadata-end */

    beforeEach(async () => {
      response = await context.execute({
        url: context.substituteVariables("https://api.example.com/users/{{createdUserId}}"),
        method: "GET",
        headers: context.headers,
        timeout: 15000
      });

      $ = context.$;
    });

    it('should retrieve user by ID', () => {
      expect(response.status).to.equal(200);

      const JSON_body = (response.body.type == BodyType.JSON)
        ? response.body.data
        : expect.fail('Response body is not JSON');

      expect(JSON_body.id).to.equal($.createdUserId);
      expect(JSON_body.name).to.be.a('string');
      expect(JSON_body.email).to.be.a('string');
      expect(JSON_body.profile).to.be.an('object');
    });
  });
});

describe('Product Management', () => {
  /* @apicize-group-metadata
  {
    "id": "product-group-2",
    "name": "Product Operations",
    "execution": "CONCURRENT",
    "runs": 1,
    "selectedScenario": {
      "id": "scenario-dev",
      "name": "Development Environment"
    }
  }
  @apicize-group-metadata-end */

  describe('List Products', () => {
    /* @apicize-request-metadata
    {
      "id": "list-products-request",
      "name": "List All Products",
      "url": "https://api.example.com/products",
      "method": "GET",
      "headers": [
        {"name": "Accept", "value": "application/json"}
      ],
      "body": {
        "type": "None"
      },
      "queryStringParams": [
        {"name": "limit", "value": "50"},
        {"name": "sort", "value": "name"},
        {"name": "order", "value": "asc"}
      ],
      "timeout": 10000
    }
    @apicize-request-metadata-end */

    beforeEach(async () => {
      response = await context.execute({
        url: context.substituteVariables("https://api.example.com/products"),
        method: "GET",
        headers: context.headers,
        timeout: 10000
      });

      $ = context.$;
    });

    it('should list products with pagination', () => {
      expect(response.status).to.equal(200);

      const JSON_body = (response.body.type == BodyType.JSON)
        ? response.body.data
        : expect.fail('Response body is not JSON');

      expect(JSON_body.products).to.be.an('array');
      expect(JSON_body.pagination).to.be.an('object');
      expect(JSON_body.pagination.limit).to.equal(50);
      expect(JSON_body.pagination.total).to.be.a('number');
    });
  });

  describe('Create Product', () => {
    /* @apicize-request-metadata
    {
      "id": "create-product-request",
      "name": "Create New Product",
      "url": "https://api.example.com/products",
      "method": "POST",
      "headers": [
        {"name": "Content-Type", "value": "application/json"},
        {"name": "Authorization", "value": "Bearer {{apiToken}}"}
      ],
      "body": {
        "type": "JSON",
        "data": {
          "name": "{{productName}}",
          "description": "{{productDescription}}",
          "price": "{{productPrice}}",
          "category": "{{productCategory}}"
        }
      },
      "timeout": 25000,
      "runs": 1
    }
    @apicize-request-metadata-end */

    beforeEach(async () => {
      response = await context.execute({
        url: context.substituteVariables("https://api.example.com/products"),
        method: "POST",
        headers: context.headers,
        body: context.body,
        timeout: 25000
      });

      $ = context.$;
    });

    it('should create product with valid data', () => {
      expect(response.status).to.equal(201);

      const JSON_body = (response.body.type == BodyType.JSON)
        ? response.body.data
        : expect.fail('Response body is not JSON');

      expect(JSON_body.name).to.equal($.productName);
      expect(JSON_body.description).to.equal($.productDescription);
      expect(JSON_body.price).to.equal(parseFloat($.productPrice));
      expect(JSON_body.category).to.equal($.productCategory);
      expect(JSON_body.id).to.be.a('string');
      expect(JSON_body.createdAt).to.be.a('string');

      output('productId', JSON_body.id);
      console.info(\`Created product: \${JSON_body.name} with ID: \${JSON_body.id}\`);
    });
  });
});
`;

      const result = extractor.extractFromContent(sampleContent);

      // Verify no errors in extraction
      expect(result.errors).toHaveLength(0);

      // Verify file metadata
      expect(result.fileMetadata).toBeDefined();
      expect(result.fileMetadata!.version).toBe(1.0);
      expect(result.fileMetadata!.source).toBe('demo.apicize');
      expect(result.fileMetadata!.workbook.name).toBe('Demo API Tests');

      // Verify group metadata
      expect(result.groupMetadata).toHaveLength(2);
      const userGroup = result.groupMetadata.find(g => g.id === 'demo-group-1');
      const productGroup = result.groupMetadata.find(g => g.id === 'product-group-2');

      expect(userGroup).toBeDefined();
      expect(userGroup!.metadata.name).toBe('User Management');
      expect(userGroup!.metadata.execution).toBe('SEQUENTIAL');
      expect(userGroup!.metadata.selectedScenario.name).toBe('Production Environment');

      expect(productGroup).toBeDefined();
      expect(productGroup!.metadata.name).toBe('Product Operations');
      expect(productGroup!.metadata.execution).toBe('CONCURRENT');

      // Verify request metadata
      expect(result.requestMetadata).toHaveLength(4);
      const createUser = result.requestMetadata.find(r => r.id === 'create-user-request');
      const getUser = result.requestMetadata.find(r => r.id === 'get-user-request');
      const listProducts = result.requestMetadata.find(r => r.id === 'list-products-request');
      const createProduct = result.requestMetadata.find(r => r.id === 'create-product-request');

      // Verify create user request
      expect(createUser).toBeDefined();
      expect(createUser!.metadata.name).toBe('Create New User');
      expect(createUser!.metadata.method).toBe('POST');
      expect(createUser!.metadata.url).toBe('https://api.example.com/users');
      expect(createUser!.metadata.body.type).toBe('JSON');
      expect(createUser!.metadata.timeout).toBe(30000);
      expect(createUser!.testCode).toContain('should create user successfully');
      expect(createUser!.testCode).toContain('expect(response.status).to.equal(201)');

      // Verify get user request
      expect(getUser).toBeDefined();
      expect(getUser!.metadata.method).toBe('GET');
      expect(getUser!.metadata.url).toBe('https://api.example.com/users/{{createdUserId}}');
      expect(getUser!.metadata.body.type).toBe('None');
      expect(getUser!.metadata.queryStringParams).toHaveLength(1);

      // Verify list products request
      expect(listProducts).toBeDefined();
      expect(listProducts!.metadata.queryStringParams).toHaveLength(3);
      expect(listProducts!.metadata.timeout).toBe(10000);

      // Verify create product request
      expect(createProduct).toBeDefined();
      expect(createProduct!.metadata.body.data.name).toBe('{{productName}}');
      expect(createProduct!.testCode).toContain('Created product:');

      // Verify helper methods work correctly
      const allRequests = extractor.getAllRequests(result);
      expect(allRequests).toHaveLength(4);

      const allGroups = extractor.getAllGroups(result);
      expect(allGroups).toHaveLength(2);

      const stats = extractor.getMetadataStats(result);
      expect(stats.hasFileMetadata).toBe(true);
      expect(stats.totalRequests).toBe(4);
      expect(stats.totalGroups).toBe(2);
      expect(stats.requestsWithTests).toBe(4);
      expect(stats.metadataBlocks).toBe(7); // 1 file + 2 groups + 4 requests

      // Test finding specific metadata
      const foundUser = extractor.findMetadataById(result, 'create-user-request');
      expect(foundUser).toBeDefined();
      expect(foundUser!.blockType).toBe('request');

      const foundGroup = extractor.findMetadataById(result, 'demo-group-1');
      expect(foundGroup).toBeDefined();
      expect(foundGroup!.blockType).toBe('group');
    });

    it('should handle malformed metadata in realistic file', () => {
      const malformedContent = `
/* @apicize-file-metadata
{
  "version": 1.0,
  "source": "malformed.apicize"
}
@apicize-file-metadata-end */

describe('Test', () => {
  /* @apicize-request-metadata
  {
    "id": "test-request",
    "url": "https://api.example.com",
    "method": "GET",
    // This comment breaks JSON parsing
    "headers": []
  }
  @apicize-request-metadata-end */

  it('should handle malformed metadata', () => {
    expect(true).toBe(true);
  });
});
`;

      const result = extractor.extractFromContent(malformedContent);

      // Should have file metadata but fail on request metadata
      expect(result.fileMetadata).toBeDefined();
      expect(result.requestMetadata).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Invalid JSON in request metadata');
    });

    it('should extract test code accurately from realistic scenarios', () => {
      const complexTestContent = `
/* @apicize-request-metadata
{
  "id": "complex-test",
  "url": "https://api.example.com/complex",
  "method": "POST"
}
@apicize-request-metadata-end */

it('should handle complex test scenarios', () => {
  // Validate response status
  expect(response.status).to.equal(200);

  // Check response body structure
  const JSON_body = (response.body.type == BodyType.JSON)
    ? response.body.data
    : expect.fail('Response body is not JSON');

  // Validate nested object properties
  expect(JSON_body.user).to.be.an('object');
  expect(JSON_body.user.profile).to.be.an('object');
  expect(JSON_body.user.profile.settings).to.be.an('object');

  // Test array validation
  expect(JSON_body.permissions).to.be.an('array');
  expect(JSON_body.permissions).to.have.length.greaterThan(0);

  // Variable substitution and output
  expect(JSON_body.user.id).to.equal($.expectedUserId);
  output('actualUserId', JSON_body.user.id);

  // Complex assertions with loops
  JSON_body.permissions.forEach((permission, index) => {
    expect(permission).to.have.property('name');
    expect(permission).to.have.property('granted');
    console.info(\`Permission \${index}: \${permission.name} = \${permission.granted}\`);
  });

  // Conditional logic
  if (JSON_body.user.role === 'admin') {
    expect(JSON_body.adminFeatures).to.be.an('array');
  } else {
    expect(JSON_body.adminFeatures).to.be.undefined;
  }
});
`;

      const result = extractor.extractFromContent(complexTestContent);

      expect(result.errors).toHaveLength(0);
      expect(result.requestMetadata).toHaveLength(1);

      const request = result.requestMetadata[0];
      expect(request.testCode).toBeDefined();
      expect(request.testCode).toContain('should handle complex test scenarios');
      expect(request.testCode).toContain('forEach((permission, index)');
      expect(request.testCode).toContain("if (JSON_body.user.role === 'admin')");
      expect(request.testCode).toContain("output('actualUserId', JSON_body.user.id)");
    });

    it('should handle files with TypeScript imports and exports', () => {
      const typescriptContent = `
import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import { TestHelper, BodyType } from '@apicize/lib';
import * as fs from 'fs';

export interface CustomTestContext {
  userId: string;
  sessionToken: string;
}

/* @apicize-file-metadata
{
  "version": 1.0,
  "source": "typescript-features.apicize",
  "typescript": {
    "strict": true,
    "target": "ES2020"
  }
}
@apicize-file-metadata-end */

const helper = new TestHelper();
let context: CustomTestContext;

describe('TypeScript Features Test', () => {
  /* @apicize-request-metadata
  {
    "id": "typescript-request",
    "url": "https://api.example.com/typescript",
    "method": "GET",
    "headers": [
      {"name": "Accept", "value": "application/json"}
    ]
  }
  @apicize-request-metadata-end */

  beforeEach(async () => {
    context = await helper.setupCustomContext();
  });

  it('should work with TypeScript features', () => {
    const responseData: any = response.body.data;

    expect(response.status).to.equal(200);
    expect(responseData).to.satisfy((data: any) => {
      return typeof data === 'object' && data !== null;
    });

    // Type-safe operations
    const typedData = responseData as { items: Array<{ id: number; name: string }> };
    expect(typedData.items).to.be.an('array');

    typedData.items.forEach((item: { id: number; name: string }) => {
      expect(item.id).to.be.a('number');
      expect(item.name).to.be.a('string');
    });
  });

  afterEach(async () => {
    await helper.cleanup(context);
  });
});

export default helper;
`;

      const result = extractor.extractFromContent(typescriptContent);

      expect(result.errors).toHaveLength(0);
      expect(result.fileMetadata).toBeDefined();
      expect(result.fileMetadata!.typescript).toBeDefined();
      expect(result.fileMetadata!.typescript.strict).toBe(true);

      expect(result.requestMetadata).toHaveLength(1);
      const request = result.requestMetadata[0];
      expect(request.testCode).toContain('should work with TypeScript features');
      expect(request.testCode).toContain('const typedData = responseData as');
    });
  });
});
