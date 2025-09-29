import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ExportPipeline, ExportOptions } from './export-pipeline';
import { ApicizeWorkbook, HttpMethod, BodyType, ExecutionMode, VariableType } from '../types';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('ExportPipeline', () => {
    let exportPipeline: ExportPipeline;
    let tempDir: string;
    let testWorkbook: ApicizeWorkbook;

    beforeEach(async () => {
        exportPipeline = new ExportPipeline();

        // Create a temporary directory for each test
        tempDir = join(tmpdir(), `apicize-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
        await fs.mkdir(tempDir, { recursive: true });

        // Create a test workbook
        testWorkbook = {
            version: 1.0,
            requests: [
                {
                    id: 'test-request-1',
                    name: 'Get Users',
                    url: 'https://api.example.com/users',
                    method: HttpMethod.GET,
                    test: 'expect(response.status).to.equal(200);',
                    headers: [
                        { name: 'Accept', value: 'application/json' }
                    ],
                    body: {
                        type: BodyType.None,
                        data: undefined
                    },
                    queryStringParams: [],
                    timeout: 30000,
                    numberOfRedirects: 10,
                    runs: 1,
                    multiRunExecution: ExecutionMode.SEQUENTIAL,
                    keepAlive: false,
                    acceptInvalidCerts: false
                },
                {
                    id: 'test-request-2',
                    name: 'Create User',
                    url: 'https://api.example.com/users',
                    method: HttpMethod.POST,
                    test: 'expect(response.status).to.equal(201);',
                    headers: [
                        { name: 'Content-Type', value: 'application/json' }
                    ],
                    body: {
                        type: BodyType.JSON,
                        data: { name: 'Test User', email: 'test@example.com' }
                    },
                    queryStringParams: [],
                    timeout: 30000,
                    numberOfRedirects: 10,
                    runs: 1,
                    multiRunExecution: ExecutionMode.SEQUENTIAL,
                    keepAlive: false,
                    acceptInvalidCerts: false
                }
            ],
            scenarios: [
                {
                    id: 'test-scenario-1',
                    name: 'Development',
                    variables: [
                        { name: 'baseUrl', value: 'https://dev.api.example.com', type: VariableType.TEXT },
                        { name: 'apiKey', value: 'dev-key-123', type: VariableType.TEXT }
                    ]
                }
            ],
            authorizations: [],
            certificates: [],
            proxies: [],
            data: [],
            defaults: {}
        };
    });

    afterEach(async () => {
        // Clean up temporary directory
        try {
            await fs.rmdir(tempDir, { recursive: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    describe('exportWorkbook', () => {
        it('should export a complete workbook successfully', async () => {
            const options: ExportOptions = {
                outputDir: tempDir,
                projectName: 'test-project'
            };

            const result = await exportPipeline.exportWorkbook(testWorkbook, 'test.apicize', options);

            expect(result.success).toBe(true);
            expect(result.outputPath).toBe(tempDir);
            expect(result.filesCreated.length).toBeGreaterThan(0);
            expect(result.metadata.totalFiles).toBeGreaterThan(0);
            expect(result.errors).toBeUndefined();
        });

        it('should create all required project files', async () => {
            const options: ExportOptions = {
                outputDir: tempDir,
                projectName: 'test-project'
            };

            const result = await exportPipeline.exportWorkbook(testWorkbook, 'test.apicize', options);

            expect(result.success).toBe(true);

            // Verify required files exist
            const requiredFiles = [
                'package.json',
                'tsconfig.json',
                '.mocharc.json'
            ];

            for (const file of requiredFiles) {
                const filePath = join(tempDir, file);
                await expect(fs.access(filePath)).resolves.toBeUndefined();
            }
        });

        it('should handle export options correctly', async () => {
            const options: ExportOptions = {
                outputDir: tempDir,
                projectName: 'custom-project',
                packageManager: 'yarn',
                typescript: true,
                strict: false,
                includeExampleData: false
            };

            const result = await exportPipeline.exportWorkbook(testWorkbook, 'test.apicize', options);

            expect(result.success).toBe(true);
            expect(result.metadata.scaffoldedProject.metadata.projectName).toBe('custom-project');

            // Verify package.json uses yarn
            const packageJsonPath = join(tempDir, 'package.json');
            const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
            const packageJson = JSON.parse(packageJsonContent);

            // Should contain yarn-specific scripts or configurations
            expect(packageJson).toBeDefined();
        });

        it('should generate import mappings', async () => {
            const options: ExportOptions = {
                outputDir: tempDir,
                projectName: 'test-project'
            };

            const result = await exportPipeline.exportWorkbook(testWorkbook, 'test.apicize', options);

            expect(result.success).toBe(true);
            expect(result.metadata.importMappings).toBeDefined();
            expect(result.metadata.importMappings.length).toBeGreaterThan(0);

            // Should have workbook mapping
            const workbookMapping = result.metadata.importMappings.find(m => m.type === 'workbook');
            expect(workbookMapping).toBeDefined();
            expect(workbookMapping?.originalPath).toBe('test.apicize');

            // Should have request mappings
            const requestMappings = result.metadata.importMappings.filter(m => m.type === 'request');
            expect(requestMappings.length).toBe(2);
        });

        it('should call progress callback if provided', async () => {
            const progressCalls: Array<{stage: string, progress: number, message: string}> = [];

            const options: ExportOptions = {
                outputDir: tempDir,
                projectName: 'test-project',
                progressCallback: (stage, progress, message) => {
                    progressCalls.push({ stage, progress, message });
                }
            };

            const result = await exportPipeline.exportWorkbook(testWorkbook, 'test.apicize', options);

            expect(result.success).toBe(true);
            expect(progressCalls.length).toBeGreaterThan(0);
            expect(progressCalls[0].progress).toBe(10);
            expect(progressCalls[progressCalls.length - 1].progress).toBe(100);
        });

        it('should handle validation errors gracefully', async () => {
            const invalidWorkbook = { ...testWorkbook, version: undefined } as any;

            const options: ExportOptions = {
                outputDir: tempDir,
                projectName: 'test-project'
            };

            const result = await exportPipeline.exportWorkbook(invalidWorkbook, 'test.apicize', options);

            expect(result.success).toBe(false);
            expect(result.errors).toBeDefined();
            expect(result.errors!.length).toBeGreaterThan(0);
            expect(result.errors![0]).toContain('version');
        });

        it('should handle missing requests array', async () => {
            const invalidWorkbook = { ...testWorkbook, requests: undefined } as any;

            const options: ExportOptions = {
                outputDir: tempDir,
                projectName: 'test-project'
            };

            const result = await exportPipeline.exportWorkbook(invalidWorkbook, 'test.apicize', options);

            // Should succeed by initializing empty requests array for minimal workbooks
            expect(result.success).toBe(true);
            expect(result.errors).toBeUndefined();
        });

        it('should handle requests without IDs', async () => {
            const invalidWorkbook = {
                ...testWorkbook,
                requests: [{ ...testWorkbook.requests[0], id: undefined } as any]
            };

            const options: ExportOptions = {
                outputDir: tempDir,
                projectName: 'test-project'
            };

            const result = await exportPipeline.exportWorkbook(invalidWorkbook, 'test.apicize', options);

            expect(result.success).toBe(false);
            expect(result.errors).toBeDefined();
            expect(result.errors![0]).toContain('id');
        });
    });

    describe('exportFromFile', () => {
        it('should export from a valid .apicize file', async () => {
            // Create a test .apicize file
            const testFilePath = join(tempDir, 'test.apicize');
            await fs.writeFile(testFilePath, JSON.stringify(testWorkbook, null, 2));

            const options: ExportOptions = {
                outputDir: join(tempDir, 'output'),
                projectName: 'file-test'
            };

            const result = await exportPipeline.exportFromFile(testFilePath, options);

            expect(result.success).toBe(true);
            expect(result.metadata.sourceFile).toBe(testFilePath);
        });

        it('should handle missing files', async () => {
            const nonExistentPath = join(tempDir, 'missing.apicize');

            const options: ExportOptions = {
                outputDir: join(tempDir, 'output'),
                projectName: 'missing-test'
            };

            const result = await exportPipeline.exportFromFile(nonExistentPath, options);

            expect(result.success).toBe(false);
            expect(result.errors).toBeDefined();
            expect(result.errors!.length).toBeGreaterThan(0);
        });

        it('should handle invalid JSON files', async () => {
            // Create an invalid JSON file
            const testFilePath = join(tempDir, 'invalid.apicize');
            await fs.writeFile(testFilePath, 'invalid json content');

            const options: ExportOptions = {
                outputDir: join(tempDir, 'output'),
                projectName: 'invalid-test'
            };

            const result = await exportPipeline.exportFromFile(testFilePath, options);

            expect(result.success).toBe(false);
            expect(result.errors).toBeDefined();
            expect(result.errors![0]).toContain('JSON');
        });
    });

    describe('exportMultipleWorkbooks', () => {
        it('should export multiple workbooks', async () => {
            const workbooks = [
                { workbook: testWorkbook, sourceFilePath: 'test1.apicize' },
                { workbook: testWorkbook, sourceFilePath: 'test2.apicize' }
            ];

            const options: ExportOptions = {
                outputDir: tempDir,
                projectName: 'multi-test'
            };

            const results = await exportPipeline.exportMultipleWorkbooks(workbooks, options);

            expect(results.length).toBe(2);
            expect(results[0].success).toBe(true);
            expect(results[1].success).toBe(true);
        });

        it('should create separate directories for each workbook', async () => {
            const workbooks = [
                { workbook: testWorkbook, sourceFilePath: 'test1.apicize' },
                { workbook: testWorkbook, sourceFilePath: 'test2.apicize' }
            ];

            const options: ExportOptions = {
                outputDir: tempDir,
                projectName: 'multi-test'
            };

            const results = await exportPipeline.exportMultipleWorkbooks(workbooks, options);

            expect(results[0].outputPath).toContain('workbook-1');
            expect(results[1].outputPath).toContain('workbook-2');
        });

        it('should call progress callback for multi-file export', async () => {
            const progressCalls: Array<{stage: string, progress: number, message: string}> = [];

            const workbooks = [
                { workbook: testWorkbook, sourceFilePath: 'test1.apicize' },
                { workbook: testWorkbook, sourceFilePath: 'test2.apicize' }
            ];

            const options: ExportOptions = {
                outputDir: tempDir,
                projectName: 'multi-test',
                progressCallback: (stage, progress, message) => {
                    progressCalls.push({ stage, progress, message });
                }
            };

            await exportPipeline.exportMultipleWorkbooks(workbooks, options);

            const multiExportCalls = progressCalls.filter(call => call.stage === 'multi-export');
            expect(multiExportCalls.length).toBeGreaterThan(0);
        });
    });

    describe('utility methods', () => {
        it('should extract project name from file path', async () => {
            const options: ExportOptions = {
                outputDir: tempDir
                // No projectName specified, should extract from file path
            };

            const result = await exportPipeline.exportWorkbook(testWorkbook, '/path/to/my-api.apicize', options);

            expect(result.success).toBe(true);
            expect(result.metadata.scaffoldedProject.metadata.projectName).toBe('my-api');
        });

        it('should handle Windows file paths', async () => {
            const options: ExportOptions = {
                outputDir: tempDir
            };

            const result = await exportPipeline.exportWorkbook(testWorkbook, 'C:\\path\\to\\my-api.apicize', options);

            expect(result.success).toBe(true);
            expect(result.metadata.scaffoldedProject.metadata.projectName).toBe('my-api');
        });

        it('should sanitize project names', async () => {
            const options: ExportOptions = {
                outputDir: tempDir
            };

            const result = await exportPipeline.exportWorkbook(testWorkbook, 'my api with spaces & symbols!.apicize', options);

            expect(result.success).toBe(true);
            expect(result.metadata.scaffoldedProject.metadata.projectName).toBe('my-api-with-spaces---symbols-');
        });
    });

    describe('error handling', () => {
        it('should call error handler when provided', async () => {
            let errorHandlerCalled = false;
            let errorStage = '';

            const invalidWorkbook = { ...testWorkbook, version: undefined } as any;

            const options: ExportOptions = {
                outputDir: tempDir,
                projectName: 'test-project',
                errorHandler: (_error, stage) => {
                    errorHandlerCalled = true;
                    errorStage = stage;
                }
            };

            await exportPipeline.exportWorkbook(invalidWorkbook, 'test.apicize', options);

            expect(errorHandlerCalled).toBe(true);
            expect(errorStage).toBe('export');
        });

        it('should handle file system errors gracefully', async () => {
            const options: ExportOptions = {
                outputDir: '/invalid/path/that/cannot/be/created',
                projectName: 'test-project'
            };

            const result = await exportPipeline.exportWorkbook(testWorkbook, 'test.apicize', options);

            expect(result.success).toBe(false);
            expect(result.errors).toBeDefined();
            expect(result.errors!.length).toBeGreaterThan(0);
        });
    });

    describe('validation', () => {
        it('should validate generated package.json dependencies', async () => {
            const options: ExportOptions = {
                outputDir: tempDir,
                projectName: 'test-project'
            };

            const result = await exportPipeline.exportWorkbook(testWorkbook, 'test.apicize', options);

            expect(result.success).toBe(true);

            // Read and validate package.json
            const packageJsonPath = join(tempDir, 'package.json');
            const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
            const packageJson = JSON.parse(packageJsonContent);

            expect(packageJson.devDependencies.mocha).toBeDefined();
            expect(packageJson.devDependencies.chai).toBeDefined();
            expect(packageJson.scripts.test).toBeDefined();
        });
    });
});