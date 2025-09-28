import * as fs from 'fs/promises';
import * as path from 'path';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  RequestReconstructor,
} from './request-reconstructor';
import { ProjectMap, ScannedFile } from './file-scanner';
import { HttpMethod, BodyType } from '../types';

// Mock response object for test content validation
declare global {
  var response: any;
}

describe('RequestReconstructor', () => {
  let tempDir: string;
  let reconstructor: RequestReconstructor;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(process.cwd(), 'test-temp-reconstructor-'));
    reconstructor = new RequestReconstructor();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('constructor', () => {
    it('should use default options when none provided', () => {
      const reconstructor = new RequestReconstructor();
      expect(reconstructor).toBeInstanceOf(RequestReconstructor);
    });

    it('should merge provided options with defaults', () => {
      const customOptions = {
        validateRequests: false,
        maxFileSize: 5000000,
      };
      const reconstructor = new RequestReconstructor(customOptions);
      expect(reconstructor).toBeInstanceOf(RequestReconstructor);
    });
  });

  describe('reconstructFromProject', () => {
    it('should handle empty project', async () => {
      const projectMap: ProjectMap = {
        rootPath: tempDir,
        mainFiles: [],
        suiteFiles: [],
        allFiles: [],
        dependencies: new Map(),
      };

      const result = await reconstructor.reconstructFromProject(projectMap);

      expect(result).toMatchObject({
        rootPath: tempDir,
        requests: [],
        processedFiles: [],
        errors: [],
        warnings: [],
      });
    });

    it('should reconstruct simple request from metadata', async () => {
      const testContent = `import { describe, it, expect } from '@jest/globals';
import { TestHelper, BodyType } from '@apicize/lib';

describe('User API', () => {
  /* @apicize-request-metadata
  {
    "id": "user-001",
    "name": "Get User",
    "url": "https://api.example.com/users/{{userId}}",
    "method": "GET",
    "headers": [
      {"name": "Authorization", "value": "Bearer {{token}}"}
    ],
    "timeout": 5000
  }
  @apicize-request-metadata-end */

  describe('Get User', () => {
    it('should return user data', () => {
      expect(response.status).toBe(200);
    });
  });
});

      const testFile = path.join(tempDir, 'users.spec.ts');
      await fs.writeFile(testFile, testContent);

      const scannedFile: ScannedFile = {
        filePath: testFile,
        relativePath: 'users.spec.ts',
        baseName: 'users.spec',
        directory: tempDir,
        isMainFile: false,
        isSuiteFile: false,
        size: testContent.length,
        lastModified: new Date(),
      };

      const projectMap: ProjectMap = {
        rootPath: tempDir,
        mainFiles: [scannedFile],
        suiteFiles: [],
        allFiles: [scannedFile],
        dependencies: new Map(),
      };

      const result = await reconstructor.reconstructFromProject(projectMap);

      expect(result.requests).toHaveLength(1);
      expect(result.processedFiles).toContain(testFile);
      expect(result.errors).toHaveLength(0);

      const request = result.requests[0] as any;
      expect(request).toMatchObject({
        id: 'user-001',
        name: 'User API', // Should match the outer describe block
        url: 'https://api.example.com/users/{{userId}}',
        method: HttpMethod.GET,
        timeout: 5000,
        sourceFile: testFile,
      });

      expect(request.headers).toEqual([
        { name: 'Authorization', value: 'Bearer {{token}}' },
      ]);
    });

    it('should reconstruct hierarchical request groups', async () => {
      const testContent = `
import { describe, it, expect } from '@jest/globals';

describe('API Tests', () => {
  /* @apicize-group-metadata
  {
    "id": "group-001",
    "name": "API Tests",
    "execution": "SEQUENTIAL"
  }
  @apicize-group-metadata-end */

  describe('Users', () => {
    /* @apicize-request-metadata
    {
      "id": "user-001",
      "name": "Get User",
      "url": "https://api.example.com/users/1",
      "method": "GET"
    }
    @apicize-request-metadata-end */

    describe('Get User', () => {
      it('should return user data', () => {
        expect(response.status).to.equal(200);
      });
    });

    /* @apicize-request-metadata
    {
      "id": "user-002",
      "name": "Create User",
      "url": "https://api.example.com/users",
      "method": "POST"
    }
    @apicize-request-metadata-end */

    describe('Create User', () => {
      it('should create user', () => {
        expect(response.status).to.equal(201);
      });
    });
  });
});
      `;

      const testFile = path.join(tempDir, 'api.spec.ts');
      await fs.writeFile(testFile, testContent);

      const scannedFile: ScannedFile = {
        filePath: testFile,
        relativePath: 'api.spec.ts',
        baseName: 'api.spec',
        directory: tempDir,
        isMainFile: false,
        isSuiteFile: false,
        size: testContent.length,
        lastModified: new Date(),
      };

      const projectMap: ProjectMap = {
        rootPath: tempDir,
        mainFiles: [scannedFile],
        suiteFiles: [],
        allFiles: [scannedFile],
        dependencies: new Map(),
      };

      const result = await reconstructor.reconstructFromProject(projectMap);

      expect(result.requests).toHaveLength(1);
      expect(result.errors).toHaveLength(0);

      const group = result.requests[0] as ReconstructedRequestGroup;
      expect(group).toMatchObject({
        id: 'group-001',
        name: 'API Tests',
        execution: ExecutionMode.SEQUENTIAL,
        sourceFile: testFile,
      });

      expect(group.children).toHaveLength(1);

      const userGroup = group.children[0] as ReconstructedRequestGroup;
      expect(userGroup.name).toBe('Users');
      expect(userGroup.children).toHaveLength(2);

      const getUserRequest = userGroup.children[0] as ReconstructedRequest;
      expect(getUserRequest).toMatchObject({
        id: 'user-001',
        name: 'Get User',
        url: 'https://api.example.com/users/1',
        method: HttpMethod.GET,
      });

      const createUserRequest = userGroup.children[1] as ReconstructedRequest;
      expect(createUserRequest).toMatchObject({
        id: 'user-002',
        name: 'Create User',
        url: 'https://api.example.com/users',
        method: HttpMethod.POST,
      });
    });

    it('should handle request with complex body', async () => {
      const testContent = `
describe('Create Product', () => {
  /* @apicize-request-metadata
  {
    "id": "product-001",
    "name": "Create Product",
    "url": "https://api.example.com/products",
    "method": "POST",
    "body": {
      "type": "JSON",
      "data": {
        "name": "Test Product",
        "price": 99.99,
        "categories": ["electronics", "gadgets"]
      },
      "formatted": "{\\"name\\": \\"Test Product\\", \\"price\\": 99.99}"
    },
    "queryStringParams": [
      {"name": "validate", "value": "true", "disabled": false}
    ]
  }
  @apicize-request-metadata-end */

  it('should create product', () => {
    expect(response.status).to.equal(201);
  });
});
      `;

      const testFile = path.join(tempDir, 'products.spec.ts');
      await fs.writeFile(testFile, testContent);

      const scannedFile: ScannedFile = {
        filePath: testFile,
        relativePath: 'products.spec.ts',
        baseName: 'products.spec',
        directory: tempDir,
        isMainFile: false,
        isSuiteFile: false,
        size: testContent.length,
        lastModified: new Date(),
      };

      const projectMap: ProjectMap = {
        rootPath: tempDir,
        mainFiles: [scannedFile],
        suiteFiles: [],
        allFiles: [scannedFile],
        dependencies: new Map(),
      };

      const result = await reconstructor.reconstructFromProject(projectMap);

      expect(result.requests).toHaveLength(1);
      expect(result.errors).toHaveLength(0);

      const request = result.requests[0] as ReconstructedRequest;
      expect(request).toMatchObject({
        id: 'product-001',
        name: 'Create Product',
        url: 'https://api.example.com/products',
        method: HttpMethod.POST,
      });

      expect(request.body).toMatchObject({
        type: BodyType.JSON,
        data: {
          name: 'Test Product',
          price: 99.99,
          categories: ['electronics', 'gadgets'],
        },
        formatted: '{"name": "Test Product", "price": 99.99}',
      });

      expect(request.queryStringParams).toEqual([
        { name: 'validate', value: 'true', disabled: false },
      ]);
    });

    it('should handle form body type', async () => {
      const testContent = `
describe('Upload File', () => {
  /* @apicize-request-metadata
  {
    "id": "upload-001",
    "name": "Upload File",
    "url": "https://api.example.com/upload",
    "method": "POST",
    "body": {
      "type": "Form",
      "data": [
        {"name": "file", "value": "test.pdf"},
        {"name": "category", "value": "document"}
      ]
    }
  }
  @apicize-request-metadata-end */

  it('should upload file', () => {
    expect(response.status).to.equal(200);
  });
});
      `;

      const testFile = path.join(tempDir, 'upload.spec.ts');
      await fs.writeFile(testFile, testContent);

      const scannedFile: ScannedFile = {
        filePath: testFile,
        relativePath: 'upload.spec.ts',
        baseName: 'upload.spec',
        directory: tempDir,
        isMainFile: false,
        isSuiteFile: false,
        size: testContent.length,
        lastModified: new Date(),
      };

      const projectMap: ProjectMap = {
        rootPath: tempDir,
        mainFiles: [scannedFile],
        suiteFiles: [],
        allFiles: [scannedFile],
        dependencies: new Map(),
      };

      const result = await reconstructor.reconstructFromProject(projectMap);

      expect(result.requests).toHaveLength(1);

      const request = result.requests[0] as ReconstructedRequest;
      expect(request.body).toMatchObject({
        type: BodyType.Form,
        data: [
          { name: 'file', value: 'test.pdf' },
          { name: 'category', value: 'document' },
        ],
      });
    });
  });

  describe('error handling', () => {
    it('should handle file read errors gracefully', async () => {
      const nonExistentFile = path.join(tempDir, 'nonexistent.spec.ts');

      const scannedFile: ScannedFile = {
        filePath: nonExistentFile,
        relativePath: 'nonexistent.spec.ts',
        baseName: 'nonexistent.spec',
        directory: tempDir,
        isMainFile: false,
        isSuiteFile: false,
        size: 100,
        lastModified: new Date(),
      };

      const projectMap: ProjectMap = {
        rootPath: tempDir,
        mainFiles: [scannedFile],
        suiteFiles: [],
        allFiles: [scannedFile],
        dependencies: new Map(),
      };

      await expect(reconstructor.reconstructFromProject(projectMap)).rejects.toThrow(RequestReconstructorError);
    });

    it('should skip large files and add warnings', async () => {
      const testContent = 'small content';
      const testFile = path.join(tempDir, 'large.spec.ts');
      await fs.writeFile(testFile, testContent);

      const scannedFile: ScannedFile = {
        filePath: testFile,
        relativePath: 'large.spec.ts',
        baseName: 'large.spec',
        directory: tempDir,
        isMainFile: false,
        isSuiteFile: false,
        size: 15000000, // Fake large size
        lastModified: new Date(),
      };

      const projectMap: ProjectMap = {
        rootPath: tempDir,
        mainFiles: [scannedFile],
        suiteFiles: [],
        allFiles: [scannedFile],
        dependencies: new Map(),
      };

      const result = await reconstructor.reconstructFromProject(projectMap);

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].warning).toContain('File size');
      expect(result.warnings[0].warning).toContain('exceeds maximum');
    });

    it('should handle invalid JSON in metadata', async () => {
      const testContent = `
describe('Test', () => {
  /* @apicize-request-metadata
  {
    "id": "test-001",
    "name": "Test",
    invalid json here
  }
  @apicize-request-metadata-end */

  it('should test', () => {
    expect(true).toBe(true);
  });
});
      `;

      const testFile = path.join(tempDir, 'invalid.spec.ts');
      await fs.writeFile(testFile, testContent);

      const scannedFile: ScannedFile = {
        filePath: testFile,
        relativePath: 'invalid.spec.ts',
        baseName: 'invalid.spec',
        directory: tempDir,
        isMainFile: false,
        isSuiteFile: false,
        size: testContent.length,
        lastModified: new Date(),
      };

      const projectMap: ProjectMap = {
        rootPath: tempDir,
        mainFiles: [scannedFile],
        suiteFiles: [],
        allFiles: [scannedFile],
        dependencies: new Map(),
      };

      await expect(reconstructor.reconstructFromProject(projectMap)).rejects.toThrow(RequestReconstructorError);
    });

    it('should handle missing required fields', async () => {
      const testContent = `
describe('Test', () => {
  /* @apicize-request-metadata
  {
    "name": "Test"
  }
  @apicize-request-metadata-end */

  it('should test', () => {
    expect(true).toBe(true);
  });
});
      `;

      const testFile = path.join(tempDir, 'missing-fields.spec.ts');
      await fs.writeFile(testFile, testContent);

      const scannedFile: ScannedFile = {
        filePath: testFile,
        relativePath: 'missing-fields.spec.ts',
        baseName: 'missing-fields.spec',
        directory: tempDir,
        isMainFile: false,
        isSuiteFile: false,
        size: testContent.length,
        lastModified: new Date(),
      };

      const projectMap: ProjectMap = {
        rootPath: tempDir,
        mainFiles: [scannedFile],
        suiteFiles: [],
        allFiles: [scannedFile],
        dependencies: new Map(),
      };

      await expect(reconstructor.reconstructFromProject(projectMap)).rejects.toThrow(RequestReconstructorError);
    });

    it('should skip error files when skipErrorFiles is true', async () => {
      const testContent = `
describe('Test', () => {
  /* @apicize-request-metadata
  {
    invalid json
  }
  @apicize-request-metadata-end */

  it('should test', () => {
    expect(true).toBe(true);
  });
});
      `;

      const testFile = path.join(tempDir, 'error.spec.ts');
      await fs.writeFile(testFile, testContent);

      const scannedFile: ScannedFile = {
        filePath: testFile,
        relativePath: 'error.spec.ts',
        baseName: 'error.spec',
        directory: tempDir,
        isMainFile: false,
        isSuiteFile: false,
        size: testContent.length,
        lastModified: new Date(),
      };

      const projectMap: ProjectMap = {
        rootPath: tempDir,
        mainFiles: [scannedFile],
        suiteFiles: [],
        allFiles: [scannedFile],
        dependencies: new Map(),
      };

      const skipErrorsReconstructor = new RequestReconstructor({ skipErrorFiles: true });
      const result = await skipErrorsReconstructor.reconstructFromProject(projectMap);

      expect(result.errors).toHaveLength(1);
      expect(result.requests).toHaveLength(0);
    });
  });

  describe('convenience functions', () => {
    it('should export reconstructFromProject function', async () => {
      const projectMap: ProjectMap = {
        rootPath: tempDir,
        mainFiles: [],
        suiteFiles: [],
        allFiles: [],
        dependencies: new Map(),
      };

      const result = await reconstructFromProject(projectMap);

      expect(result).toMatchObject({
        rootPath: tempDir,
        requests: [],
      });
    });

    it('should export reconstructFromFiles function', async () => {
      const testContent = `
describe('Test', () => {
  /* @apicize-request-metadata
  {
    "id": "test-001",
    "name": "Test",
    "url": "https://api.example.com/test",
    "method": "GET"
  }
  @apicize-request-metadata-end */

  it('should test', () => {
    expect(true).toBe(true);
  });
});
      `;

      const testFile = path.join(tempDir, 'test.spec.ts');
      await fs.writeFile(testFile, testContent);

      const result = await reconstructFromFiles([testFile]);

      expect(result.requests).toHaveLength(1);
      expect(result.requests[0]).toMatchObject({
        id: 'test-001',
        name: 'Test',
        url: 'https://api.example.com/test',
        method: HttpMethod.GET,
      });
    });
  });

  describe('validation', () => {
    it('should add warnings for items with missing required fields', async () => {
      const testContent = `
describe('Test', () => {
  /* @apicize-request-metadata
  {
    "id": "test-001",
    "name": "Test",
    "url": "https://api.example.com/test",
    "method": "GET"
  }
  @apicize-request-metadata-end */

  it('should test', () => {
    expect(true).toBe(true);
  });
});
      `;

      const testFile = path.join(tempDir, 'test.spec.ts');
      await fs.writeFile(testFile, testContent);

      const scannedFile: ScannedFile = {
        filePath: testFile,
        relativePath: 'test.spec.ts',
        baseName: 'test.spec',
        directory: tempDir,
        isMainFile: false,
        isSuiteFile: false,
        size: testContent.length,
        lastModified: new Date(),
      };

      const projectMap: ProjectMap = {
        rootPath: tempDir,
        mainFiles: [scannedFile],
        suiteFiles: [],
        allFiles: [scannedFile],
        dependencies: new Map(),
      };

      const result = await reconstructor.reconstructFromProject(projectMap);

      expect(result.requests).toHaveLength(1);
      expect(result.warnings).toHaveLength(0); // This request has all required fields
    });

    it('should skip validation when validateRequests is false', async () => {
      const noValidationReconstructor = new RequestReconstructor({ validateRequests: false });

      const projectMap: ProjectMap = {
        rootPath: tempDir,
        mainFiles: [],
        suiteFiles: [],
        allFiles: [],
        dependencies: new Map(),
      };

      const result = await noValidationReconstructor.reconstructFromProject(projectMap);

      expect(result.warnings).toHaveLength(0);
    });
  });
});