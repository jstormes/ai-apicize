#!/usr/bin/env node

/**
 * Performance benchmark script for Apicize tools
 * Generates performance reports and identifies bottlenecks
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { performance } = require('perf_hooks');

class PerformanceBenchmark {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      environment: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        memory: process.memoryUsage()
      },
      benchmarks: []
    };
    this.tempDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'apicize-benchmark-'));
    this.toolsPath = path.resolve(__dirname, '../packages/tools');
  }

  async run() {
    console.log('🚀 Starting Apicize Performance Benchmarks...\n');

    try {
      // Ensure tools are built
      await this.buildTools();

      // Run benchmark tests
      await this.benchmarkValidation();
      await this.benchmarkExport();
      await this.benchmarkImport();
      await this.benchmarkRoundTrip();
      await this.benchmarkConcurrency();

      // Generate report
      this.generateReport();

    } catch (error) {
      console.error('❌ Benchmark failed:', error.message);
      process.exit(1);
    } finally {
      this.cleanup();
    }
  }

  async buildTools() {
    console.log('🔨 Building tools...');
    const startTime = performance.now();

    const buildResult = await this.runCommand('npm', ['run', 'build'], {
      cwd: this.toolsPath
    });

    if (buildResult.exitCode !== 0) {
      throw new Error('Failed to build tools');
    }

    const duration = performance.now() - startTime;
    console.log(`✅ Build completed in ${duration.toFixed(2)}ms\n`);
  }

  async benchmarkValidation() {
    console.log('📋 Benchmarking validation performance...');

    const sizes = [10, 50, 100, 250, 500];
    const validationResults = [];

    for (const size of sizes) {
      const file = this.createLargeFile(size);
      const filePath = path.join(this.tempDir, `validation-${size}.apicize`);
      fs.writeFileSync(filePath, JSON.stringify(file, null, 2));

      const startTime = performance.now();
      const result = await this.runCommand('node', [
        'dist/cli.js', 'validate', filePath
      ], { cwd: this.toolsPath });

      const duration = performance.now() - startTime;
      const success = result.exitCode === 0;

      validationResults.push({
        requestCount: size,
        duration: Math.round(duration),
        success,
        throughput: Math.round(size / duration * 1000)
      });

      console.log(`  ${size} requests: ${duration.toFixed(2)}ms (${success ? '✅' : '❌'})`);
    }

    this.results.benchmarks.push({
      operation: 'validation',
      results: validationResults
    });

    console.log('');
  }

  async benchmarkExport() {
    console.log('📤 Benchmarking export performance...');

    const sizes = [10, 50, 100];
    const exportResults = [];

    for (const size of sizes) {
      const file = this.createLargeFile(size);
      const filePath = path.join(this.tempDir, `export-${size}.apicize`);
      const outputDir = path.join(this.tempDir, `export-output-${size}`);
      fs.writeFileSync(filePath, JSON.stringify(file, null, 2));

      const startTime = performance.now();
      const result = await this.runCommand('node', [
        'dist/cli.js', 'export', filePath,
        '--output', outputDir
      ], { cwd: this.toolsPath });

      const duration = performance.now() - startTime;
      const success = result.exitCode === 0;

      // Count generated files
      let fileCount = 0;
      if (success && fs.existsSync(outputDir)) {
        fileCount = this.countFiles(outputDir);
      }

      exportResults.push({
        requestCount: size,
        duration: Math.round(duration),
        success,
        filesGenerated: fileCount,
        throughput: Math.round(size / duration * 1000)
      });

      console.log(`  ${size} requests: ${duration.toFixed(2)}ms, ${fileCount} files (${success ? '✅' : '❌'})`);
    }

    this.results.benchmarks.push({
      operation: 'export',
      results: exportResults
    });

    console.log('');
  }

  async benchmarkImport() {
    console.log('📥 Benchmarking import performance...');

    const sizes = [10, 50];
    const importResults = [];

    for (const size of sizes) {
      // First export a file
      const file = this.createLargeFile(size);
      const originalPath = path.join(this.tempDir, `import-original-${size}.apicize`);
      const exportDir = path.join(this.tempDir, `import-export-${size}`);
      const importPath = path.join(this.tempDir, `import-result-${size}.apicize`);

      fs.writeFileSync(originalPath, JSON.stringify(file, null, 2));

      const exportResult = await this.runCommand('node', [
        'dist/cli.js', 'export', originalPath,
        '--output', exportDir
      ], { cwd: this.toolsPath });

      if (exportResult.exitCode !== 0) {
        console.log(`  ${size} requests: Export failed, skipping import`);
        continue;
      }

      // Now benchmark import
      const startTime = performance.now();
      const result = await this.runCommand('node', [
        'dist/cli.js', 'import', exportDir,
        '--output', importPath
      ], { cwd: this.toolsPath });

      const duration = performance.now() - startTime;
      const success = result.exitCode === 0;

      // Calculate accuracy if successful
      let accuracy = 0;
      if (success && fs.existsSync(importPath)) {
        accuracy = this.calculateAccuracy(originalPath, importPath);
      }

      importResults.push({
        requestCount: size,
        duration: Math.round(duration),
        success,
        accuracy: Math.round(accuracy),
        throughput: Math.round(size / duration * 1000)
      });

      console.log(`  ${size} requests: ${duration.toFixed(2)}ms, ${accuracy.toFixed(1)}% accuracy (${success ? '✅' : '❌'})`);
    }

    this.results.benchmarks.push({
      operation: 'import',
      results: importResults
    });

    console.log('');
  }

  async benchmarkRoundTrip() {
    console.log('🔄 Benchmarking round-trip performance...');

    const sizes = [10, 25, 50];
    const roundTripResults = [];

    for (const size of sizes) {
      const file = this.createLargeFile(size);
      const originalPath = path.join(this.tempDir, `roundtrip-${size}.apicize`);
      const exportDir = path.join(this.tempDir, `roundtrip-export-${size}`);
      const importPath = path.join(this.tempDir, `roundtrip-import-${size}.apicize`);

      fs.writeFileSync(originalPath, JSON.stringify(file, null, 2));

      const startTime = performance.now();

      // Export
      const exportResult = await this.runCommand('node', [
        'dist/cli.js', 'export', originalPath,
        '--output', exportDir
      ], { cwd: this.toolsPath });

      if (exportResult.exitCode !== 0) {
        console.log(`  ${size} requests: Export failed`);
        continue;
      }

      // Import
      const importResult = await this.runCommand('node', [
        'dist/cli.js', 'import', exportDir,
        '--output', importPath
      ], { cwd: this.toolsPath });

      const duration = performance.now() - startTime;
      const success = importResult.exitCode === 0;

      let accuracy = 0;
      if (success && fs.existsSync(importPath)) {
        accuracy = this.calculateAccuracy(originalPath, importPath);
      }

      roundTripResults.push({
        requestCount: size,
        duration: Math.round(duration),
        success,
        accuracy: Math.round(accuracy),
        throughput: Math.round(size / duration * 1000)
      });

      console.log(`  ${size} requests: ${duration.toFixed(2)}ms, ${accuracy.toFixed(1)}% accuracy (${success ? '✅' : '❌'})`);
    }

    this.results.benchmarks.push({
      operation: 'roundtrip',
      results: roundTripResults
    });

    console.log('');
  }

  async benchmarkConcurrency() {
    console.log('⚡ Benchmarking concurrent operations...');

    const concurrentCount = 3;
    const fileSize = 20;
    const concurrentResults = [];

    // Create test files
    const files = [];
    for (let i = 0; i < concurrentCount; i++) {
      const file = this.createLargeFile(fileSize);
      const filePath = path.join(this.tempDir, `concurrent-${i}.apicize`);
      fs.writeFileSync(filePath, JSON.stringify(file, null, 2));
      files.push(filePath);
    }

    const startTime = performance.now();

    // Run concurrent validations
    const promises = files.map(file =>
      this.runCommand('node', [
        'dist/cli.js', 'validate', file
      ], { cwd: this.toolsPath })
    );

    const results = await Promise.all(promises);
    const duration = performance.now() - startTime;

    const successCount = results.filter(r => r.exitCode === 0).length;

    concurrentResults.push({
      operationCount: concurrentCount,
      requestsPerOperation: fileSize,
      totalRequests: concurrentCount * fileSize,
      duration: Math.round(duration),
      successCount,
      throughput: Math.round(concurrentCount * fileSize / duration * 1000)
    });

    console.log(`  ${concurrentCount} operations (${fileSize} requests each): ${duration.toFixed(2)}ms, ${successCount}/${concurrentCount} succeeded`);

    this.results.benchmarks.push({
      operation: 'concurrency',
      results: concurrentResults
    });

    console.log('');
  }

  generateReport() {
    console.log('📊 Generating performance report...\n');

    // Summary
    console.log('=== PERFORMANCE SUMMARY ===');
    console.log(`Timestamp: ${this.results.timestamp}`);
    console.log(`Environment: Node.js ${this.results.environment.node} on ${this.results.environment.platform}`);
    console.log(`Memory Usage: ${Math.round(this.results.environment.memory.rss / 1024 / 1024)}MB RSS\n`);

    // Detailed results
    this.results.benchmarks.forEach(benchmark => {
      console.log(`${benchmark.operation.toUpperCase()}:`);
      benchmark.results.forEach(result => {
        if (result.requestCount) {
          console.log(`  ${result.requestCount} requests: ${result.duration}ms (${result.throughput} req/sec) ${result.success ? '✅' : '❌'}`);
          if (result.accuracy !== undefined) {
            console.log(`    Accuracy: ${result.accuracy}%`);
          }
          if (result.filesGenerated) {
            console.log(`    Files: ${result.filesGenerated}`);
          }
        } else if (result.operationCount) {
          console.log(`  ${result.operationCount} concurrent operations: ${result.duration}ms (${result.throughput} req/sec)`);
          console.log(`    Success rate: ${result.successCount}/${result.operationCount}`);
        }
      });
      console.log('');
    });

    // Performance thresholds check
    console.log('=== PERFORMANCE ANALYSIS ===');
    this.analyzePerformance();

    // Save detailed report
    const reportPath = path.join(__dirname, '../performance-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    console.log(`\n📋 Detailed report saved to: ${reportPath}`);
  }

  analyzePerformance() {
    const validationBench = this.results.benchmarks.find(b => b.operation === 'validation');
    const exportBench = this.results.benchmarks.find(b => b.operation === 'export');
    const importBench = this.results.benchmarks.find(b => b.operation === 'import');

    // Performance thresholds (requests per second)
    const thresholds = {
      validation: { min: 5, good: 20 },
      export: { min: 2, good: 10 },
      import: { min: 2, good: 10 }
    };

    [
      { name: 'Validation', bench: validationBench, threshold: thresholds.validation },
      { name: 'Export', bench: exportBench, threshold: thresholds.export },
      { name: 'Import', bench: importBench, threshold: thresholds.import }
    ].forEach(({ name, bench, threshold }) => {
      if (!bench || bench.results.length === 0) return;

      const avgThroughput = bench.results.reduce((sum, r) => sum + r.throughput, 0) / bench.results.length;

      let status = '❌';
      if (avgThroughput >= threshold.good) status = '🚀';
      else if (avgThroughput >= threshold.min) status = '✅';

      console.log(`${name}: ${avgThroughput.toFixed(2)} req/sec average ${status}`);

      if (avgThroughput < threshold.min) {
        console.log(`  ⚠️  Below minimum threshold (${threshold.min} req/sec)`);
      }
    });

    // Round-trip accuracy analysis
    const roundTripBench = this.results.benchmarks.find(b => b.operation === 'roundtrip');
    if (roundTripBench && roundTripBench.results.length > 0) {
      const avgAccuracy = roundTripBench.results.reduce((sum, r) => sum + r.accuracy, 0) / roundTripBench.results.length;
      const status = avgAccuracy >= 95 ? '🚀' : avgAccuracy >= 90 ? '✅' : '❌';
      console.log(`Round-trip accuracy: ${avgAccuracy.toFixed(1)}% average ${status}`);

      if (avgAccuracy < 90) {
        console.log(`  ⚠️  Below minimum accuracy threshold (90%)`);
      }
    }
  }

  createLargeFile(requestCount) {
    const requests = [];
    const groupSize = 10;
    const groupCount = Math.ceil(requestCount / groupSize);

    for (let g = 0; g < groupCount; g++) {
      const groupRequests = Math.min(groupSize, requestCount - g * groupSize);
      const children = [];

      for (let r = 0; r < groupRequests; r++) {
        children.push({
          id: `req-${g}-${r}`,
          name: `Request ${g + 1}.${r + 1}`,
          url: `{{baseUrl}}/api/test/${g}/${r}`,
          method: ['GET', 'POST', 'PUT', 'DELETE'][r % 4],
          test: `describe('Request ${g + 1}.${r + 1}', () => { it('should work', () => { expect(response.status).to.equal(200); }); });`,
          headers: [{ name: 'Content-Type', value: 'application/json' }],
          queryStringParams: [{ name: 'test', value: 'true' }],
          timeout: 30000,
          runs: 1
        });
      }

      requests.push({
        id: `group-${g}`,
        name: `Group ${g + 1}`,
        children,
        execution: 'SEQUENTIAL',
        runs: 1
      });
    }

    return {
      version: 1.0,
      requests,
      scenarios: [{
        id: 'default',
        name: 'Default',
        variables: [{ name: 'baseUrl', value: 'https://api.example.com', type: 'TEXT' }]
      }],
      authorizations: [],
      certificates: [],
      proxies: [],
      data: [],
      defaults: {}
    };
  }

  countFiles(dir) {
    let count = 0;
    const items = fs.readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
      if (item.isFile()) {
        count++;
      } else if (item.isDirectory()) {
        count += this.countFiles(path.join(dir, item.name));
      }
    }

    return count;
  }

  calculateAccuracy(originalPath, importedPath) {
    try {
      const original = JSON.parse(fs.readFileSync(originalPath, 'utf8'));
      const imported = JSON.parse(fs.readFileSync(importedPath, 'utf8'));

      const originalFields = this.countFields(original);
      const matchingFields = this.compareObjects(original, imported);

      return (matchingFields / originalFields) * 100;
    } catch (error) {
      return 0;
    }
  }

  countFields(obj) {
    if (typeof obj !== 'object' || obj === null) return 1;
    if (Array.isArray(obj)) return obj.reduce((sum, item) => sum + this.countFields(item), 0);
    return Object.keys(obj).reduce((sum, key) => sum + this.countFields(obj[key]), 0);
  }

  compareObjects(obj1, obj2) {
    if (typeof obj1 !== typeof obj2) return 0;
    if (obj1 === obj2) return 1;
    if (typeof obj1 !== 'object' || obj1 === null) return obj1 === obj2 ? 1 : 0;

    if (Array.isArray(obj1) !== Array.isArray(obj2)) return 0;
    if (Array.isArray(obj1)) {
      const minLength = Math.min(obj1.length, obj2.length);
      let matches = 0;
      for (let i = 0; i < minLength; i++) {
        matches += this.compareObjects(obj1[i], obj2[i]);
      }
      return matches;
    }

    const keys1 = Object.keys(obj1);
    let matches = 0;
    keys1.forEach(key => {
      if (key in obj2) {
        matches += this.compareObjects(obj1[key], obj2[key]);
      }
    });
    return matches;
  }

  async runCommand(command, args, options = {}) {
    return new Promise((resolve) => {
      const child = spawn(command, args, {
        stdio: 'pipe',
        ...options
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({
          exitCode: code || 0,
          stdout,
          stderr
        });
      });
    });
  }

  cleanup() {
    try {
      fs.rmSync(this.tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

// Run benchmark if called directly
if (require.main === module) {
  const benchmark = new PerformanceBenchmark();
  benchmark.run().catch(console.error);
}

module.exports = PerformanceBenchmark;