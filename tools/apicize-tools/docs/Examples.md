# Apicize Examples and Tutorials

This document provides comprehensive examples and step-by-step tutorials for using Apicize tools.

## Table of Contents

- [Quick Start](#quick-start)
- [Basic Tutorials](#basic-tutorials)
- [Real-World Examples](#real-world-examples)
- [Advanced Use Cases](#advanced-use-cases)
- [Integration Examples](#integration-examples)
- [Best Practices](#best-practices)

## Quick Start

### 5-Minute Setup

```bash
# 1. Install Apicize CLI
npm install -g @apicize/tools

# 2. Create your first API test
apicize create my-first-api --interactive

# 3. Run the test
apicize run my-first-api.apicize

# 4. Export to TypeScript for advanced testing
apicize export my-first-api.apicize
```

### Your First .apicize File

Create a simple API test manually:

```json
{
  "version": 1.0,
  "requests": [{
    "id": "group-1",
    "name": "User API Tests",
    "children": [{
      "id": "get-users",
      "name": "Get Users",
      "url": "{{baseUrl}}/users",
      "method": "GET",
      "test": "describe('Get Users', () => { it('should return 200', () => { expect(response.status).to.equal(200); }); });",
      "headers": [],
      "queryStringParams": [],
      "timeout": 30000,
      "runs": 1
    }],
    "execution": "SEQUENTIAL",
    "runs": 1
  }],
  "scenarios": [{
    "id": "dev-scenario",
    "name": "Development",
    "variables": [{
      "name": "baseUrl",
      "value": "https://jsonplaceholder.typicode.com",
      "type": "TEXT"
    }]
  }],
  "authorizations": [],
  "certificates": [],
  "proxies": [],
  "data": [],
  "defaults": {
    "selectedScenario": {
      "id": "dev-scenario",
      "name": "Development"
    }
  }
}
```

Save as `users-api.apicize` and test:

```bash
apicize validate users-api.apicize
apicize run users-api.apicize
```

## Basic Tutorials

### Tutorial 1: Creating a REST API Test Suite

**Goal**: Create a complete CRUD test suite for a user management API.

**Step 1: Initialize the project**

```bash
apicize create user-management --template rest-crud --interactive
```

Answer the prompts:
- Description: "User Management API Tests"
- Base URL: "https://api.example.com"
- Add authentication: Yes
- Authentication type: API Key
- Add scenarios: Yes

**Step 2: Customize the generated file**

Edit `user-management.apicize` to add specific endpoints:

```json
{
  "version": 1.0,
  "requests": [{
    "id": "user-crud",
    "name": "User CRUD Operations",
    "children": [
      {
        "id": "create-user",
        "name": "Create User",
        "url": "{{baseUrl}}/users",
        "method": "POST",
        "test": "describe('Create User', () => { it('should return 201', () => { expect(response.status).to.equal(201); }); it('should return user with ID', () => { const user = response.body.data; expect(user).to.have.property('id'); output('userId', user.id); }); });",
        "headers": [
          {"name": "Content-Type", "value": "application/json"},
          {"name": "X-API-Key", "value": "{{apiKey}}"}
        ],
        "body": {
          "type": "JSON",
          "data": {
            "name": "John Doe",
            "email": "john@example.com",
            "role": "user"
          }
        },
        "queryStringParams": [],
        "timeout": 30000,
        "runs": 1
      },
      {
        "id": "get-user",
        "name": "Get User",
        "url": "{{baseUrl}}/users/{{userId}}",
        "method": "GET",
        "test": "describe('Get User', () => { it('should return 200', () => { expect(response.status).to.equal(200); }); it('should return correct user', () => { const user = response.body.data; expect(user.id).to.equal($.userId); expect(user.email).to.equal('john@example.com'); }); });",
        "headers": [
          {"name": "X-API-Key", "value": "{{apiKey}}"}
        ],
        "queryStringParams": [],
        "timeout": 30000,
        "runs": 1
      }
    ],
    "execution": "SEQUENTIAL",
    "runs": 1
  }]
}
```

**Step 3: Test and refine**

```bash
# Validate the structure
apicize validate user-management.apicize

# Run tests against development environment
apicize run user-management.apicize --scenario Development

# Export for advanced testing
apicize export user-management.apicize --output ./user-tests
```

### Tutorial 2: Working with Scenarios

**Goal**: Create multiple environment configurations for the same API tests.

**Step 1: Define scenarios**

```json
{
  "scenarios": [
    {
      "id": "dev",
      "name": "Development",
      "variables": [
        {"name": "baseUrl", "value": "https://dev-api.example.com", "type": "TEXT"},
        {"name": "apiKey", "value": "dev-key-123", "type": "TEXT"},
        {"name": "timeout", "value": "5000", "type": "TEXT"}
      ]
    },
    {
      "id": "staging",
      "name": "Staging",
      "variables": [
        {"name": "baseUrl", "value": "https://staging-api.example.com", "type": "TEXT"},
        {"name": "apiKey", "value": "staging-key-456", "type": "TEXT"},
        {"name": "timeout", "value": "10000", "type": "TEXT"}
      ]
    },
    {
      "id": "prod",
      "name": "Production",
      "variables": [
        {"name": "baseUrl", "value": "https://api.example.com", "type": "TEXT"},
        {"name": "apiKey", "value": "{{PROD_API_KEY}}", "type": "TEXT"},
        {"name": "timeout", "value": "30000", "type": "TEXT"}
      ]
    }
  ]
}
```

**Step 2: Use scenarios in tests**

```bash
# Test against different environments
apicize run api-tests.apicize --scenario Development
apicize run api-tests.apicize --scenario Staging

# Export with specific scenario
apicize export api-tests.apicize --scenario Production --output ./prod-tests
```

**Step 3: Environment variable integration**

For production, use environment variables:

```bash
export PROD_API_KEY="prod-secret-key"
apicize run api-tests.apicize --scenario Production
```

### Tutorial 3: Authentication Setup

**Goal**: Configure different authentication methods.

**API Key Authentication:**

```json
{
  "authorizations": [{
    "id": "api-key-auth",
    "name": "API Key",
    "type": "ApiKey",
    "header": "X-API-Key",
    "value": "{{apiKey}}"
  }],
  "defaults": {
    "selectedAuthorization": {
      "id": "api-key-auth",
      "name": "API Key"
    }
  }
}
```

**Basic Authentication:**

```json
{
  "authorizations": [{
    "id": "basic-auth",
    "name": "Basic Auth",
    "type": "Basic",
    "username": "{{username}}",
    "password": "{{password}}"
  }]
}
```

**OAuth2 Client Credentials:**

```json
{
  "authorizations": [{
    "id": "oauth2-client",
    "name": "OAuth2 Client",
    "type": "OAuth2Client",
    "accessTokenUrl": "{{baseUrl}}/oauth/token",
    "clientId": "{{clientId}}",
    "clientSecret": "{{clientSecret}}",
    "scope": "api:read api:write"
  }]
}
```

## Real-World Examples

### Example 1: E-commerce API Testing

Complete test suite for an e-commerce platform:

```json
{
  "version": 1.0,
  "requests": [
    {
      "id": "products",
      "name": "Product Management",
      "children": [
        {
          "id": "list-products",
          "name": "List Products",
          "url": "{{baseUrl}}/products",
          "method": "GET",
          "test": "describe('List Products', () => { it('should return paginated results', () => { expect(response.status).to.equal(200); const data = response.body.data; expect(data).to.have.property('items'); expect(data).to.have.property('total'); expect(data.items).to.be.an('array'); }); });",
          "queryStringParams": [
            {"name": "page", "value": "1"},
            {"name": "limit", "value": "10"},
            {"name": "category", "value": "electronics"}
          ]
        },
        {
          "id": "create-product",
          "name": "Create Product",
          "url": "{{baseUrl}}/products",
          "method": "POST",
          "test": "describe('Create Product', () => { it('should create product successfully', () => { expect(response.status).to.equal(201); const product = response.body.data; expect(product).to.have.property('id'); expect(product.name).to.equal('Test Product'); output('productId', product.id); }); });",
          "headers": [
            {"name": "Content-Type", "value": "application/json"}
          ],
          "body": {
            "type": "JSON",
            "data": {
              "name": "Test Product",
              "description": "A test product",
              "price": 99.99,
              "category": "electronics",
              "inventory": 100
            }
          }
        }
      ],
      "execution": "SEQUENTIAL"
    },
    {
      "id": "orders",
      "name": "Order Management",
      "children": [
        {
          "id": "create-order",
          "name": "Create Order",
          "url": "{{baseUrl}}/orders",
          "method": "POST",
          "test": "describe('Create Order', () => { it('should process order', () => { expect(response.status).to.equal(201); const order = response.body.data; expect(order).to.have.property('id'); expect(order.status).to.equal('pending'); output('orderId', order.id); }); });",
          "body": {
            "type": "JSON",
            "data": {
              "customerId": "{{customerId}}",
              "items": [
                {
                  "productId": "{{productId}}",
                  "quantity": 2,
                  "price": 99.99
                }
              ],
              "shipping": {
                "address": "123 Main St",
                "city": "Anytown",
                "zipCode": "12345"
              }
            }
          }
        }
      ],
      "execution": "SEQUENTIAL"
    }
  ],
  "scenarios": [
    {
      "id": "test-data",
      "name": "Test Environment",
      "variables": [
        {"name": "baseUrl", "value": "https://api-test.ecommerce.com", "type": "TEXT"},
        {"name": "customerId", "value": "test-customer-123", "type": "TEXT"}
      ]
    }
  ]
}
```

### Example 2: GraphQL API Testing

Testing a GraphQL API endpoint:

```json
{
  "version": 1.0,
  "requests": [{
    "id": "graphql-tests",
    "name": "GraphQL API Tests",
    "children": [
      {
        "id": "get-user-query",
        "name": "Get User Query",
        "url": "{{baseUrl}}/graphql",
        "method": "POST",
        "test": "describe('Get User Query', () => { it('should return user data', () => { expect(response.status).to.equal(200); const result = response.body.data; expect(result.data).to.have.property('user'); expect(result.data.user).to.have.property('id'); expect(result.data.user).to.have.property('email'); }); });",
        "headers": [
          {"name": "Content-Type", "value": "application/json"}
        ],
        "body": {
          "type": "JSON",
          "data": {
            "query": "query GetUser($id: ID!) { user(id: $id) { id email name createdAt } }",
            "variables": {
              "id": "{{userId}}"
            }
          }
        }
      },
      {
        "id": "create-user-mutation",
        "name": "Create User Mutation",
        "url": "{{baseUrl}}/graphql",
        "method": "POST",
        "test": "describe('Create User Mutation', () => { it('should create user', () => { expect(response.status).to.equal(200); const result = response.body.data; expect(result.data).to.have.property('createUser'); expect(result.data.createUser).to.have.property('id'); output('newUserId', result.data.createUser.id); }); });",
        "body": {
          "type": "JSON",
          "data": {
            "query": "mutation CreateUser($input: CreateUserInput!) { createUser(input: $input) { id email name } }",
            "variables": {
              "input": {
                "email": "newuser@example.com",
                "name": "New User",
                "password": "securePassword123"
              }
            }
          }
        }
      }
    ],
    "execution": "SEQUENTIAL"
  }]
}
```

### Example 3: File Upload Testing

Testing file upload endpoints:

```json
{
  "requests": [{
    "id": "file-upload",
    "name": "File Upload Tests",
    "children": [{
      "id": "upload-image",
      "name": "Upload Image",
      "url": "{{baseUrl}}/upload/image",
      "method": "POST",
      "test": "describe('Upload Image', () => { it('should upload successfully', () => { expect(response.status).to.equal(200); const result = response.body.data; expect(result).to.have.property('fileId'); expect(result).to.have.property('url'); output('uploadedFileId', result.fileId); }); });",
      "headers": [
        {"name": "Content-Type", "value": "multipart/form-data"}
      ],
      "body": {
        "type": "Form",
        "data": [
          {"name": "file", "value": "@test-image.jpg"},
          {"name": "description", "value": "Test image upload"},
          {"name": "category", "value": "profile"}
        ]
      }
    }]
  }]
}
```

## Advanced Use Cases

### Data-Driven Testing

Using CSV data for multiple test iterations:

**1. Create CSV data file (users.csv):**
```csv
name,email,role
John Doe,john@example.com,admin
Jane Smith,jane@example.com,user
Bob Wilson,bob@example.com,moderator
```

**2. Configure data source:**
```json
{
  "data": [{
    "id": "user-data",
    "name": "User Test Data",
    "type": "FILE-CSV",
    "source": "./users.csv"
  }],
  "requests": [{
    "id": "data-driven-test",
    "name": "Create Multiple Users",
    "selectedData": {
      "id": "user-data",
      "name": "User Test Data"
    },
    "children": [{
      "id": "create-user-from-data",
      "name": "Create User: {{name}}",
      "url": "{{baseUrl}}/users",
      "method": "POST",
      "body": {
        "type": "JSON",
        "data": {
          "name": "{{name}}",
          "email": "{{email}}",
          "role": "{{role}}"
        }
      },
      "runs": 1
    }],
    "execution": "SEQUENTIAL"
  }]
}
```

### Complex Test Scenarios

Testing complex business workflows:

```json
{
  "requests": [{
    "id": "order-workflow",
    "name": "Complete Order Workflow",
    "children": [
      {
        "id": "login",
        "name": "Login",
        "url": "{{baseUrl}}/auth/login",
        "method": "POST",
        "test": "describe('Login', () => { it('should authenticate user', () => { expect(response.status).to.equal(200); const auth = response.body.data; expect(auth).to.have.property('token'); output('authToken', auth.token); }); });",
        "body": {
          "type": "JSON",
          "data": {
            "email": "{{userEmail}}",
            "password": "{{userPassword}}"
          }
        }
      },
      {
        "id": "add-to-cart",
        "name": "Add Product to Cart",
        "url": "{{baseUrl}}/cart/items",
        "method": "POST",
        "headers": [
          {"name": "Authorization", "value": "Bearer {{authToken}}"}
        ],
        "test": "describe('Add to Cart', () => { it('should add item to cart', () => { expect(response.status).to.equal(200); output('cartTotal', response.body.data.total); }); });",
        "body": {
          "type": "JSON",
          "data": {
            "productId": "{{productId}}",
            "quantity": 2
          }
        }
      },
      {
        "id": "checkout",
        "name": "Checkout",
        "url": "{{baseUrl}}/orders/checkout",
        "method": "POST",
        "headers": [
          {"name": "Authorization", "value": "Bearer {{authToken}}"}
        ],
        "test": "describe('Checkout', () => { it('should process checkout', () => { expect(response.status).to.equal(201); const order = response.body.data; expect(order.total).to.equal($.cartTotal); output('orderId', order.id); }); });",
        "body": {
          "type": "JSON",
          "data": {
            "paymentMethod": "credit_card",
            "shippingAddress": {
              "street": "123 Main St",
              "city": "Anytown",
              "zipCode": "12345"
            }
          }
        }
      },
      {
        "id": "verify-order",
        "name": "Verify Order",
        "url": "{{baseUrl}}/orders/{{orderId}}",
        "method": "GET",
        "headers": [
          {"name": "Authorization", "value": "Bearer {{authToken}}"}
        ],
        "test": "describe('Verify Order', () => { it('should show order details', () => { expect(response.status).to.equal(200); const order = response.body.data; expect(order.id).to.equal($.orderId); expect(order.status).to.equal('confirmed'); }); });"
      }
    ],
    "execution": "SEQUENTIAL"
  }]
}
```

## Integration Examples

### CI/CD Pipeline Integration

**GitHub Actions Example:**

```yaml
name: API Tests
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  api-tests:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'

    - name: Install Apicize CLI
      run: npm install -g @apicize/tools

    - name: Validate API Specs
      run: |
        apicize validate tests/*.apicize --no-color

    - name: Run API Tests (Staging)
      env:
        STAGING_API_KEY: ${{ secrets.STAGING_API_KEY }}
      run: |
        apicize run api-tests.apicize --scenario Staging --reporter json --output staging-results.json

    - name: Upload Test Results
      uses: actions/upload-artifact@v3
      if: always()
      with:
        name: test-results
        path: staging-results.json
```

**Jenkins Pipeline Example:**

```groovy
pipeline {
    agent any

    environment {
        PROD_API_KEY = credentials('prod-api-key')
    }

    stages {
        stage('Install') {
            steps {
                sh 'npm install -g @apicize/tools'
            }
        }

        stage('Validate') {
            steps {
                sh 'apicize validate tests/*.apicize'
            }
        }

        stage('Test Development') {
            steps {
                sh 'apicize run api-tests.apicize --scenario Development --reporter json --output dev-results.json'
            }
        }

        stage('Test Production') {
            when {
                branch 'main'
            }
            steps {
                sh 'apicize run api-tests.apicize --scenario Production --reporter json --output prod-results.json'
            }
        }
    }

    post {
        always {
            archiveArtifacts artifacts: '*-results.json', fingerprint: true
        }
    }
}
```

### Docker Integration

**Dockerfile for API Testing:**

```dockerfile
FROM node:18-alpine

# Install Apicize CLI
RUN npm install -g @apicize/tools

# Copy test files
COPY tests/ /tests/
WORKDIR /tests

# Run tests
CMD ["apicize", "run", "api-tests.apicize", "--scenario", "Production", "--reporter", "json"]
```

**Docker Compose for Integration Testing:**

```yaml
version: '3.8'

services:
  api:
    image: my-api:latest
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=test

  api-tests:
    build: .
    depends_on:
      - api
    environment:
      - BASE_URL=http://api:3000
    volumes:
      - ./results:/results
    command: >
      sh -c "
        sleep 10 &&
        apicize run api-tests.apicize
          --scenario Test
          --reporter json
          --output /results/test-results.json
      "
```

## Best Practices

### 1. Test Organization

**Group related tests:**
```json
{
  "requests": [
    {
      "name": "Authentication",
      "children": ["login", "logout", "refresh-token"]
    },
    {
      "name": "User Management",
      "children": ["create-user", "get-user", "update-user", "delete-user"]
    },
    {
      "name": "Data Operations",
      "children": ["create-data", "query-data", "update-data"]
    }
  ]
}
```

**Use descriptive names:**
```json
{
  "name": "Create User - Admin Role - Should Return 201",
  "test": "describe('Create User with Admin Role', () => { ... })"
}
```

### 2. Variable Management

**Use scenarios for environment separation:**
```json
{
  "scenarios": [
    {"name": "Local", "variables": [{"name": "baseUrl", "value": "http://localhost:3000"}]},
    {"name": "Staging", "variables": [{"name": "baseUrl", "value": "https://staging.api.com"}]},
    {"name": "Production", "variables": [{"name": "baseUrl", "value": "https://api.com"}]}
  ]
}
```

**Use environment variables for secrets:**
```json
{
  "variables": [
    {"name": "apiKey", "value": "{{API_KEY}}", "type": "TEXT"},
    {"name": "dbPassword", "value": "{{DB_PASSWORD}}", "type": "TEXT"}
  ]
}
```

### 3. Test Data Management

**Use external data files for large datasets:**
```json
{
  "data": [{
    "name": "User Test Data",
    "type": "FILE-CSV",
    "source": "./data/users.csv"
  }]
}
```

**Pass data between tests:**
```javascript
// In first test
output('userId', user.id);

// In subsequent test
expect(response.body.userId).to.equal($.userId);
```

### 4. Error Handling

**Always test error conditions:**
```json
{
  "name": "Create User - Invalid Email - Should Return 400",
  "body": {"email": "invalid-email"},
  "test": "describe('Invalid Email', () => { it('should return 400', () => { expect(response.status).to.equal(400); expect(response.body.error).to.contain('Invalid email'); }); });"
}
```

**Test authentication failures:**
```json
{
  "name": "Unauthorized Access - Should Return 401",
  "headers": [],
  "test": "describe('Unauthorized', () => { it('should return 401', () => { expect(response.status).to.equal(401); }); });"
}
```

### 5. Performance Considerations

**Set appropriate timeouts:**
```json
{
  "timeout": 30000,
  "numberOfRedirects": 5
}
```

**Use concurrent execution for independent tests:**
```json
{
  "execution": "CONCURRENT",
  "children": ["test1", "test2", "test3"]
}
```

**Limit test runs:**
```json
{
  "runs": 1,
  "multiRunExecution": "SEQUENTIAL"
}
```

---

For more information, see the [CLI Guide](./CLI-Guide.md) and [API Reference](./API-Reference.md).