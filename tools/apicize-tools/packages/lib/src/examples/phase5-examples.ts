/**
 * Phase 5 Feature Examples - Developer Experience Enhancements
 *
 * This file demonstrates the new developer experience features
 * implemented in Phase 5 of the refactoring plan.
 */

import {
  RequestBuilder,
  ClientConfigBuilder,
  EnvironmentConfigBuilder,
  debugUtils,
  enableDebugMode,
  trace,
  inspect,
  PerformanceProfiler,
  MemoryTracker,
  ValidationHelpers
} from '../index';
import { ApicizeClient } from '../client/apicize-client';
import { HttpMethod } from '../types';

/**
 * Example 1: Fluent Request Builder
 *
 * Demonstrates the new fluent interface for building HTTP requests
 * with method chaining and type safety.
 */
export async function fluentRequestExample(): Promise<void> {
  // Create a client with fluent configuration
  const client = new ApicizeClient(
    ClientConfigBuilder.development()
      .timeout(10000)
      .maxRedirects(5)
      .retryAttempts(3)
      .build()
  );

  // Build and execute a request using fluent API
  const response = await RequestBuilder.create(client)
    .url('https://api.example.com/users')
    .post()
    .json({
      name: 'John Doe',
      email: 'john@example.com',
      role: 'admin'
    })
    .header('Authorization', 'Bearer token123')
    .header('Content-Type', 'application/json')
    .timeout(5000)
    .runs(3)
    .concurrent()
    .execute();

  console.log('Response:', response);
}

/**
 * Example 2: Configuration Builders
 *
 * Demonstrates fluent configuration building with preset environments.
 */
export function configurationBuilderExample(): void {
  // Create a production client configuration
  const prodConfig = ClientConfigBuilder.production()
    .timeout(30000)
    .maxRedirects(10)
    .validateCertificates(true)
    .build();

  // Create a development environment configuration
  const devEnv = EnvironmentConfigBuilder.development()
    .baseUrl('api', 'http://localhost:3000')
    .baseUrl('auth', 'http://localhost:4000')
    .header('X-Debug', 'true')
    .feature('mockResponses', true)
    .build();

  // Create a custom environment
  const customEnv = EnvironmentConfigBuilder.create()
    .name('custom')
    .baseUrl('api', 'https://custom-api.example.com')
    .header('X-Custom-Header', 'custom-value')
    .timeout('default', 15000)
    .timeout('long', 60000)
    .feature('customFeature', true)
    .build();

  console.log('Production Config:', prodConfig);
  console.log('Development Environment:', devEnv);
  console.log('Custom Environment:', customEnv);
}

/**
 * Example 3: Enhanced TypeScript Types
 *
 * Demonstrates the new generic types and type guards for better type safety.
 */
export async function enhancedTypesExample(): Promise<void> {
  import('../types/enhanced-types').then(async ({
    TypedResponse,
    isJsonResponse,
    isTextResponse,
    ResultHelpers
  }) => {
    // Simulate a typed API response
    const response: TypedResponse<{ id: number; name: string }> = {
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      body: {
        type: 'JSON' as any,
        data: { id: 1, name: 'John Doe' }
      },
      url: 'https://api.example.com/users/1',
      redirected: false,
      timing: {
        start: Date.now() - 1000,
        end: Date.now(),
        duration: 1000
      }
    };

    // Type-safe response handling
    if (isJsonResponse(response)) {
      // TypeScript knows response.body.data is the expected type
      console.log(`User ID: ${response.body.data.id}`);
      console.log(`User Name: ${response.body.data.name}`);
    } else if (isTextResponse(response)) {
      // TypeScript knows response.body.data is string
      console.log(`Text Response: ${response.body.data}`);
    }

    // Result type example
    const result = ResultHelpers.ok({ message: 'Success', data: response.body.data });

    if (ResultHelpers.isOk(result)) {
      console.log('Operation succeeded:', result.data);
    } else {
      console.log('Operation failed:', result.error);
    }
  });
}

/**
 * Example 4: Debug Utilities
 *
 * Demonstrates the comprehensive debugging support with tracing,
 * profiling, and memory tracking.
 */
export async function debugUtilitiesExample(): Promise<void> {
  // Enable debug mode
  enableDebugMode({
    level: 'debug',
    includeBody: true,
    includeHeaders: true,
    includeTiming: true
  });

  // Create a performance profiler
  const profiler = new PerformanceProfiler();
  profiler.mark('start');

  // Create a memory tracker
  const memTracker = new MemoryTracker();
  const startMemory = memTracker.snapshot('operation-start');

  // Create an operation trace
  const operationTrace = trace('complex-api-operation');

  try {
    operationTrace.step('Validating request');

    // Validate a request configuration
    const validation = ValidationHelpers.validateRequest({
      url: 'https://api.example.com/users',
      method: HttpMethod.POST,
      timeout: 5000,
      headers: [],
      body: { type: 'JSON' as any, data: { name: 'John' } },
      queryStringParams: [],
      numberOfRedirects: 10,
      runs: 1,
      multiRunExecution: 'SEQUENTIAL',
      keepAlive: false,
      acceptInvalidCerts: false
    });

    if (!validation.isValid) {
      operationTrace.error('Validation failed', new Error(validation.errors.join(', ')));
      return;
    }

    operationTrace.step('Building request', { headers: 2, bodySize: '23 bytes' });

    // Simulate some work
    profiler.mark('work-start');
    await new Promise(resolve => setTimeout(resolve, 100));
    profiler.mark('work-end');

    operationTrace.step('Executing request');

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 200));

    operationTrace.step('Processing response', { status: 200, size: '1.2KB' });

    // Complete the trace
    const traceResult = operationTrace.complete();

    // Get performance measurements
    const workDuration = profiler.measure('work-duration', 'work-start', 'work-end');
    const totalDuration = profiler.measure('total-duration', 'start');

    // Take final memory snapshot
    const endMemory = memTracker.snapshot('operation-end');
    const memoryDiff = memTracker.diff(startMemory, endMemory);

    // Generate reports
    console.log('=== Debug Report ===');
    console.log('Trace Result:', inspect(traceResult));
    console.log('Performance Report:', profiler.getReport());
    console.log('Memory Usage:', {
      heapUsedDiff: `${(memoryDiff.heapUsedDiff / 1024 / 1024).toFixed(2)} MB`,
      duration: `${memoryDiff.timeDiff}ms`
    });

  } catch (error) {
    operationTrace.error('Unexpected error', error as Error);
    operationTrace.abort('Operation failed due to unexpected error');
  }
}

/**
 * Example 5: Method Chaining and Convenience Methods
 *
 * Demonstrates advanced method chaining patterns and convenience methods.
 */
export async function methodChainingExample(): Promise<void> {
  // Chain multiple operations with different configurations
  const requests = await Promise.all([
    // GET request with query parameters
    RequestBuilder.create()
      .url('https://api.example.com/users')
      .get()
      .query('page', '1')
      .query('limit', '10')
      .query('sort', 'name')
      .header('Accept', 'application/json')
      .build(),

    // POST request with form data
    RequestBuilder.create()
      .url('https://api.example.com/contact')
      .post()
      .form({
        name: 'John Doe',
        email: 'john@example.com',
        message: 'Hello World'
      })
      .timeout(10000)
      .build(),

    // PUT request with XML body
    RequestBuilder.create()
      .url('https://api.example.com/config')
      .put()
      .xml(`<?xml version="1.0"?>
        <config>
          <setting name="debug" value="true" />
        </config>`)
      .header('Content-Type', 'application/xml')
      .build()
  ]);

  console.log('Built requests:', requests.map(req => ({
    method: req.method,
    url: req.url,
    bodyType: req.body?.type
  })));
}

/**
 * Example 6: Error Handling with Enhanced Types
 *
 * Demonstrates enhanced error handling with the Result type pattern.
 */
export async function errorHandlingExample(): Promise<void> {
  const { ResultHelpers } = await import('../types/enhanced-types');

  // Simulate an API operation that might fail
  async function simulateApiCall(shouldFail: boolean) {
    try {
      if (shouldFail) {
        throw new Error('API call failed');
      }

      return ResultHelpers.ok({
        id: 1,
        name: 'John Doe',
        email: 'john@example.com'
      });
    } catch (error) {
      return ResultHelpers.err({
        code: 'API_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        context: { shouldFail }
      } as any);
    }
  }

  // Handle successful result
  const successResult = await simulateApiCall(false);
  if (ResultHelpers.isOk(successResult)) {
    console.log('Success:', successResult.data);
  }

  // Handle error result
  const errorResult = await simulateApiCall(true);
  if (ResultHelpers.isErr(errorResult)) {
    console.log('Error:', errorResult.error);
  }

  // Chain operations with Result type
  const chainedResult = ResultHelpers.chain(successResult, (data) => {
    return ResultHelpers.ok({
      ...data,
      processed: true,
      processedAt: new Date()
    });
  });

  console.log('Chained result:', chainedResult);
}

/**
 * Example usage of all Phase 5 features
 */
export async function runAllExamples(): Promise<void> {
  console.log('=== Phase 5 Feature Examples ===\n');

  console.log('1. Fluent Request Builder:');
  await fluentRequestExample().catch(console.error);

  console.log('\n2. Configuration Builders:');
  configurationBuilderExample();

  console.log('\n3. Enhanced TypeScript Types:');
  await enhancedTypesExample().catch(console.error);

  console.log('\n4. Debug Utilities:');
  await debugUtilitiesExample().catch(console.error);

  console.log('\n5. Method Chaining:');
  await methodChainingExample().catch(console.error);

  console.log('\n6. Enhanced Error Handling:');
  await errorHandlingExample().catch(console.error);

  console.log('\n=== All Examples Completed ===');
}

// Export for testing
export default {
  fluentRequestExample,
  configurationBuilderExample,
  enhancedTypesExample,
  debugUtilitiesExample,
  methodChainingExample,
  errorHandlingExample,
  runAllExamples
};