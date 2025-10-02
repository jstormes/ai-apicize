import {
  MetadataExtractor,
  MetadataExtractionError,
  ExtractedMetadata,
  extractMetadataFromFile,
  extractMetadataFromContent,
} from './metadata-extractor';
import * as fs from 'fs';
import * as path from 'path';

describe('MetadataExtractor', () => {
  let extractor: MetadataExtractor;

  beforeEach(() => {
    extractor = new MetadataExtractor();
  });

  describe('extractFromContent', () => {
    it('should extract file-level metadata', () => {
      const content = `
/* @apicize-file-metadata
{
  "version": 1.0,
  "source": "demo.apicize",
  "exportDate": "2024-01-01T00:00:00Z"
}
@apicize-file-metadata-end */

describe('Test Suite', () => {
  it('should work', () => {
    expect(true).toBe(true);
  });
});
`;

      const result = extractor.extractFromContent(content);

      expect(result.errors).toHaveLength(0);
      expect(result.fileMetadata).toBeDefined();
      expect(result.fileMetadata!.version).toBe(1.0);
      expect(result.fileMetadata!.source).toBe('demo.apicize');
      expect(result.fileMetadata!.exportDate).toBe('2024-01-01T00:00:00Z');
    });

    it('should extract request metadata', () => {
      const content = `
describe('API Tests', () => {
  describe('Create User', () => {
    /* @apicize-request-metadata
    {
      "id": "create-user-123",
      "url": "https://api.example.com/users",
      "method": "POST",
      "headers": [{"name": "Content-Type", "value": "application/json"}]
    }
    @apicize-request-metadata-end */

    it('should create user successfully', () => {
      expect(response.status).to.equal(201);
      const data = response.body.data;
      expect(data.name).to.equal($.userName);
    });
  });
});
`;

      const result = extractor.extractFromContent(content);

      expect(result.errors).toHaveLength(0);
      expect(result.requestMetadata).toHaveLength(1);

      const request = result.requestMetadata[0];
      expect(request.id).toBe('create-user-123');
      expect(request.metadata.url).toBe('https://api.example.com/users');
      expect(request.metadata.method).toBe('POST');
      expect(request.testCode).toContain('should create user successfully');
      expect(request.testCode).toContain('expect(response.status).to.equal(201)');
    });

    it('should extract group metadata', () => {
      const content = `
describe('User Management', () => {
  /* @apicize-group-metadata
  {
    "id": "user-group-456",
    "name": "User Operations",
    "execution": "SEQUENTIAL"
  }
  @apicize-group-metadata-end */

  describe('Create User', () => {
    it('should work', () => {
      expect(true).toBe(true);
    });
  });
});
`;

      const result = extractor.extractFromContent(content);

      expect(result.errors).toHaveLength(0);
      expect(result.groupMetadata).toHaveLength(1);

      const group = result.groupMetadata[0];
      expect(group.id).toBe('user-group-456');
      expect(group.metadata.name).toBe('User Operations');
      expect(group.metadata.execution).toBe('SEQUENTIAL');
    });

    it('should handle missing metadata gracefully', () => {
      const content = `
describe('Test Suite', () => {
  it('should work without metadata', () => {
    expect(true).toBe(true);
  });
});
`;

      const result = extractor.extractFromContent(content);

      expect(result.errors).toHaveLength(0);
      expect(result.requestMetadata).toHaveLength(0);
      expect(result.groupMetadata).toHaveLength(0);
      expect(result.fileMetadata).toBeUndefined();
    });

    it('should handle invalid JSON in metadata', () => {
      const content = `
/* @apicize-request-metadata
{
  "id": "test-request",
  "url": "https://api.example.com",
  "invalid": json syntax
}
@apicize-request-metadata-end */

it('should fail parsing', () => {
  expect(true).toBe(true);
});
`;

      const result = extractor.extractFromContent(content);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Invalid JSON in request metadata');
      expect(result.requestMetadata).toHaveLength(0);
    });

    it('should detect duplicate IDs when warnings enabled', () => {
      const content = `
/* @apicize-request-metadata
{
  "id": "duplicate-id",
  "url": "https://api.example.com/1"
}
@apicize-request-metadata-end */

it('test 1', () => {});

/* @apicize-request-metadata
{
  "id": "duplicate-id",
  "url": "https://api.example.com/2"
}
@apicize-request-metadata-end */

it('test 2', () => {});
`;

      const result = extractor.extractFromContent(content, { includeWarnings: true });

      expect(result.warnings.some(w => w.includes('Duplicate metadata IDs'))).toBe(true);
      expect(result.requestMetadata).toHaveLength(2);
    });

    it('should fail in strict mode with no metadata', () => {
      const content = `
describe('Test Suite', () => {
  it('should work', () => {
    expect(true).toBe(true);
  });
});
`;

      const result = extractor.extractFromContent(content, { strictMode: true });

      expect(result.errors.some(e => e.includes('No metadata blocks found'))).toBe(true);
    });

    it('should validate JSON structure when enabled', () => {
      const content = `
/* @apicize-file-metadata
"not an object"
@apicize-file-metadata-end */
`;

      const result = extractor.extractFromContent(content, { validateJson: true });

      expect(result.errors.some(e => e.includes('not a valid object'))).toBe(true);
      expect(result.fileMetadata).toBeUndefined();
    });

    it('should handle malformed metadata blocks', () => {
      const content = `
/* @apicize-request-metadata
{
  "id": "test-request"
}
// Missing end marker

it('should handle malformed blocks', () => {});
`;

      const result = extractor.extractFromContent(content);

      // Should not find the metadata due to missing end marker
      expect(result.requestMetadata).toHaveLength(0);
      expect(result.errors).toHaveLength(0); // This is not an error, just missing metadata
    });
  });

  describe('extractAndValidate', () => {
    it('should validate content and return metadata', async () => {
      const content = `
/* @apicize-file-metadata
{
  "version": 1.0,
  "source": "test.apicize"
}
@apicize-file-metadata-end */

/* @apicize-request-metadata
{
  "id": "test-request",
  "url": "https://api.example.com",
  "method": "GET"
}
@apicize-request-metadata-end */

it('should work', () => {
  expect(true).toBe(true);
});
`;

      const result = await extractor.extractAndValidate(content);

      expect(result.fileMetadata).toBeDefined();
      expect(result.fileMetadata!.version).toBe(1.0);
      expect(result.requestMetadata).toHaveLength(1);
    });

    it('should throw error for invalid content', async () => {
      const content = `
/* @apicize-request-metadata
{ invalid json }
@apicize-request-metadata-end */
`;

      await expect(extractor.extractAndValidate(content)).rejects.toThrow(MetadataExtractionError);
    });
  });

  describe('helper methods', () => {
    let metadata: ExtractedMetadata;

    beforeEach(() => {
      const content = `
/* @apicize-file-metadata
{
  "version": 1.0,
  "source": "test.apicize"
}
@apicize-file-metadata-end */

/* @apicize-group-metadata
{
  "id": "group-1",
  "name": "Test Group"
}
@apicize-group-metadata-end */

/* @apicize-request-metadata
{
  "id": "request-1",
  "url": "https://api.example.com/1",
  "method": "GET"
}
@apicize-request-metadata-end */

it('test 1', () => {});

/* @apicize-request-metadata
{
  "id": "request-2",
  "url": "https://api.example.com/2",
  "method": "POST"
}
@apicize-request-metadata-end */

it('test 2', () => {});
`;

      metadata = extractor.extractFromContent(content);
    });

    describe('getAllRequests', () => {
      it('should return all request metadata', () => {
        const requests = extractor.getAllRequests(metadata);

        expect(requests).toHaveLength(2);
        expect(requests.map(r => r.id)).toEqual(['request-1', 'request-2']);
      });
    });

    describe('getAllGroups', () => {
      it('should return all group metadata', () => {
        const groups = extractor.getAllGroups(metadata);

        expect(groups).toHaveLength(1);
        expect(groups[0].id).toBe('group-1');
      });
    });

    describe('findMetadataById', () => {
      it('should find request by ID', () => {
        const found = extractor.findMetadataById(metadata, 'request-1');

        expect(found).toBeDefined();
        expect(found!.id).toBe('request-1');
        expect(found!.blockType).toBe('request');
      });

      it('should find group by ID', () => {
        const found = extractor.findMetadataById(metadata, 'group-1');

        expect(found).toBeDefined();
        expect(found!.id).toBe('group-1');
        expect(found!.blockType).toBe('group');
      });

      it('should return undefined for non-existent ID', () => {
        const found = extractor.findMetadataById(metadata, 'non-existent');

        expect(found).toBeUndefined();
      });
    });

    describe('getMetadataStats', () => {
      it('should return correct statistics', () => {
        const stats = extractor.getMetadataStats(metadata);

        expect(stats).toEqual({
          hasFileMetadata: true,
          totalRequests: 2,
          totalGroups: 1,
          requestsWithTests: 2, // Both requests have test code
          totalErrors: 0,
          totalWarnings: 0,
          metadataBlocks: 4, // 1 file + 1 group + 2 requests
        });
      });
    });
  });

  describe('parseFile', () => {
    const tempDir = path.join(__dirname, '../../../temp-test-metadata');
    const testFile = path.join(tempDir, 'test.spec.ts');

    beforeEach(async () => {
      // Create temp directory
      await fs.promises.mkdir(tempDir, { recursive: true });
    });

    afterEach(async () => {
      // Clean up temp directory
      try {
        await fs.promises.rm(tempDir, { recursive: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    it('should extract metadata from TypeScript file', async () => {
      const content = `
/* @apicize-file-metadata
{
  "version": 1.0,
  "source": "test.apicize"
}
@apicize-file-metadata-end */

/* @apicize-request-metadata
{
  "id": "test-request",
  "url": "https://api.example.com/test",
  "method": "GET"
}
@apicize-request-metadata-end */

it('should work', () => {
  expect(response.status).to.equal(200);
});
`;

      await fs.promises.writeFile(testFile, content, 'utf-8');

      const result = await extractor.extractFromFile(testFile);

      expect(result.errors).toHaveLength(0);
      expect(result.fileMetadata).toBeDefined();
      expect(result.requestMetadata).toHaveLength(1);
      expect(result.requestMetadata[0].id).toBe('test-request');
    });

    it('should handle non-existent file', async () => {
      const result = await extractor.extractFromFile('/non/existent/file.ts');

      expect(result.errors[0]).toContain('File not found');
      expect(result.requestMetadata).toHaveLength(0);
    });
  });

  describe('complex metadata structures', () => {
    it('should handle multiple metadata blocks correctly', () => {
      const content = `
/* @apicize-file-metadata
{
  "version": 1.0,
  "source": "complex.apicize",
  "workbook": {
    "name": "Complex API Tests",
    "description": "Test suite with multiple endpoints"
  }
}
@apicize-file-metadata-end */

describe('User API', () => {
  /* @apicize-group-metadata
  {
    "id": "user-api-group",
    "name": "User Management",
    "execution": "SEQUENTIAL",
    "selectedScenario": {
      "id": "scenario-1",
      "name": "Production"
    }
  }
  @apicize-group-metadata-end */

  describe('Create User', () => {
    /* @apicize-request-metadata
    {
      "id": "create-user",
      "url": "https://api.example.com/users",
      "method": "POST",
      "headers": [
        {"name": "Content-Type", "value": "application/json"},
        {"name": "Authorization", "value": "Bearer {{token}}"}
      ],
      "body": {
        "type": "JSON",
        "data": {
          "name": "{{userName}}",
          "email": "{{userEmail}}"
        }
      },
      "timeout": 30000
    }
    @apicize-request-metadata-end */

    it('should create user with valid data', () => {
      expect(response.status).to.equal(201);

      const JSON_body = (response.body.type == BodyType.JSON)
        ? response.body.data
        : expect.fail('Response body is not JSON');

      expect(JSON_body.id).to.be.a('string');
      expect(JSON_body.name).to.equal($.userName);
      expect(JSON_body.email).to.equal($.userEmail);

      output('userId', JSON_body.id);
      console.info(\`Created user with ID: \${JSON_body.id}\`);
    });
  });

  describe('Get User', () => {
    /* @apicize-request-metadata
    {
      "id": "get-user",
      "url": "https://api.example.com/users/{{userId}}",
      "method": "GET",
      "headers": [
        {"name": "Authorization", "value": "Bearer {{token}}"}
      ],
      "timeout": 15000
    }
    @apicize-request-metadata-end */

    it('should retrieve user by ID', () => {
      expect(response.status).to.equal(200);

      const JSON_body = (response.body.type == BodyType.JSON)
        ? response.body.data
        : expect.fail('Response body is not JSON');

      expect(JSON_body.id).to.equal($.userId);
      expect(JSON_body.name).to.be.a('string');
      expect(JSON_body.email).to.be.a('string');
    });
  });
});

describe('Product API', () => {
  /* @apicize-group-metadata
  {
    "id": "product-api-group",
    "name": "Product Management",
    "execution": "CONCURRENT"
  }
  @apicize-group-metadata-end */

  describe('List Products', () => {
    /* @apicize-request-metadata
    {
      "id": "list-products",
      "url": "https://api.example.com/products",
      "method": "GET",
      "queryStringParams": [
        {"name": "limit", "value": "10"},
        {"name": "offset", "value": "0"}
      ]
    }
    @apicize-request-metadata-end */

    it('should list products with pagination', () => {
      expect(response.status).to.equal(200);

      const JSON_body = (response.body.type == BodyType.JSON)
        ? response.body.data
        : expect.fail('Response body is not JSON');

      expect(JSON_body.products).to.be.an('array');
      expect(JSON_body.total).to.be.a('number');
      expect(JSON_body.limit).to.equal(10);
      expect(JSON_body.offset).to.equal(0);
    });
  });
});
`;

      const result = extractor.extractFromContent(content);

      expect(result.errors).toHaveLength(0);

      // Check file metadata
      expect(result.fileMetadata).toBeDefined();
      expect(result.fileMetadata!.version).toBe(1.0);
      expect(result.fileMetadata!.source).toBe('complex.apicize');
      expect(result.fileMetadata!.workbook.name).toBe('Complex API Tests');

      // Check group metadata
      expect(result.groupMetadata).toHaveLength(2);
      const userGroup = result.groupMetadata.find(g => g.id === 'user-api-group');
      const productGroup = result.groupMetadata.find(g => g.id === 'product-api-group');

      expect(userGroup).toBeDefined();
      expect(userGroup!.metadata.execution).toBe('SEQUENTIAL');
      expect(userGroup!.metadata.selectedScenario.name).toBe('Production');

      expect(productGroup).toBeDefined();
      expect(productGroup!.metadata.execution).toBe('CONCURRENT');

      // Check request metadata
      expect(result.requestMetadata).toHaveLength(3);
      const createUser = result.requestMetadata.find(r => r.id === 'create-user');
      const getUser = result.requestMetadata.find(r => r.id === 'get-user');
      const listProducts = result.requestMetadata.find(r => r.id === 'list-products');

      expect(createUser).toBeDefined();
      expect(createUser!.metadata.method).toBe('POST');
      expect(createUser!.metadata.body.type).toBe('JSON');
      expect(createUser!.testCode).toContain('should create user with valid data');

      expect(getUser).toBeDefined();
      expect(getUser!.metadata.method).toBe('GET');
      expect(getUser!.metadata.timeout).toBe(15000);

      expect(listProducts).toBeDefined();
      expect(listProducts!.metadata.queryStringParams).toHaveLength(2);

      // Check statistics
      const stats = extractor.getMetadataStats(result);
      expect(stats.hasFileMetadata).toBe(true);
      expect(stats.totalRequests).toBe(3);
      expect(stats.totalGroups).toBe(2);
      expect(stats.requestsWithTests).toBe(3);
      expect(stats.metadataBlocks).toBe(6); // 1 file + 2 groups + 3 requests
    });
  });

  describe('convenience functions', () => {
    it('extractMetadataFromContent should work', () => {
      const content = `
/* @apicize-file-metadata
{
  "version": 1.0
}
@apicize-file-metadata-end */
`;

      const result = extractMetadataFromContent(content);

      expect(result.fileMetadata).toBeDefined();
      expect(result.fileMetadata!.version).toBe(1.0);
    });

    it('extractMetadataFromFile should work', async () => {
      const tempDir = path.join(__dirname, '../../../temp-test-convenience-metadata');
      const testFile = path.join(tempDir, 'test.spec.ts');

      try {
        await fs.promises.mkdir(tempDir, { recursive: true });

        const content = `
/* @apicize-request-metadata
{
  "id": "test-request",
  "url": "https://api.example.com"
}
@apicize-request-metadata-end */

it('should work', () => {});
`;

        await fs.promises.writeFile(testFile, content, 'utf-8');

        const result = await extractMetadataFromFile(testFile);

        expect(result.requestMetadata).toHaveLength(1);
        expect(result.requestMetadata[0].id).toBe('test-request');
      } finally {
        try {
          await fs.promises.rm(tempDir, { recursive: true });
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    });
  });

  describe('edge cases', () => {
    it('should handle empty content', () => {
      const result = extractor.extractFromContent('');

      expect(result.errors).toHaveLength(0);
      expect(result.requestMetadata).toHaveLength(0);
      expect(result.groupMetadata).toHaveLength(0);
      expect(result.fileMetadata).toBeUndefined();
    });

    it('should handle content with only comments', () => {
      const content = `
// This is a comment
/* This is a block comment */
// No metadata here
`;

      const result = extractor.extractFromContent(content);

      expect(result.errors).toHaveLength(0);
      expect(result.requestMetadata).toHaveLength(0);
    });

    it('should handle metadata with missing IDs', () => {
      const content = `
/* @apicize-request-metadata
{
  "url": "https://api.example.com",
  "method": "GET"
}
@apicize-request-metadata-end */

it('should generate ID', () => {});
`;

      const result = extractor.extractFromContent(content);

      expect(result.errors).toHaveLength(0);
      expect(result.requestMetadata).toHaveLength(1);
      // Should generate a fallback ID based on line number
      expect(result.requestMetadata[0].id).toMatch(/request-\d+/);
    });

    it('should handle nested describe blocks without metadata', () => {
      const content = `
describe('Outer Suite', () => {
  describe('Inner Suite', () => {
    describe('Deep Suite', () => {
      it('should work', () => {
        expect(true).toBe(true);
      });
    });
  });
});
`;

      const result = extractor.extractFromContent(content);

      expect(result.errors).toHaveLength(0);
      expect(result.requestMetadata).toHaveLength(0);
      expect(result.groupMetadata).toHaveLength(0);
    });
  });
});
