/**
 * Test categorization utilities for organizing tests by type
 * Provides consistent test organization and execution patterns
 */

/**
 * Test category definitions
 */
export enum TestCategory {
  UNIT = 'unit',
  INTEGRATION = 'integration',
  CONTRACT = 'contract',
  PERFORMANCE = 'performance',
  E2E = 'e2e',
}

/**
 * Test type definitions for more granular categorization
 */
export enum TestType {
  // Unit test types
  DOMAIN_ENTITY = 'domain-entity',
  VALUE_OBJECT = 'value-object',
  DOMAIN_SERVICE = 'domain-service',
  APPLICATION_SERVICE = 'application-service',
  INFRASTRUCTURE_COMPONENT = 'infrastructure-component',
  PRESENTATION_FACADE = 'presentation-facade',

  // Integration test types
  SERVICE_INTEGRATION = 'service-integration',
  PARSER_INTEGRATION = 'parser-integration',
  END_TO_END_FLOW = 'end-to-end-flow',

  // Contract test types
  INTERFACE_CONTRACT = 'interface-contract',
  API_CONTRACT = 'api-contract',

  // Performance test types
  LOAD_TEST = 'load-test',
  STRESS_TEST = 'stress-test',
  BENCHMARK = 'benchmark',
}

/**
 * Test descriptor for categorizing and organizing tests
 */
export interface TestDescriptor {
  category: TestCategory;
  type: TestType;
  component: string;
  description: string;
  tags?: string[];
  timeout?: number;
  skip?: boolean;
  only?: boolean;
}

/**
 * Test categorization utilities
 */
export class TestCategorizer {
  /**
   * Create a unit test descriptor
   * @param type Unit test type
   * @param component Component being tested
   * @param description Test description
   * @param options Additional options
   * @returns Test descriptor
   */
  static unit(
    type: TestType,
    component: string,
    description: string,
    options: Partial<TestDescriptor> = {}
  ): TestDescriptor {
    return {
      category: TestCategory.UNIT,
      type,
      component,
      description,
      timeout: 5000, // 5 seconds default for unit tests
      ...options,
    };
  }

  /**
   * Create an integration test descriptor
   * @param type Integration test type
   * @param component Component being tested
   * @param description Test description
   * @param options Additional options
   * @returns Test descriptor
   */
  static integration(
    type: TestType,
    component: string,
    description: string,
    options: Partial<TestDescriptor> = {}
  ): TestDescriptor {
    return {
      category: TestCategory.INTEGRATION,
      type,
      component,
      description,
      timeout: 30000, // 30 seconds default for integration tests
      ...options,
    };
  }

  /**
   * Create a contract test descriptor
   * @param type Contract test type
   * @param component Component being tested
   * @param description Test description
   * @param options Additional options
   * @returns Test descriptor
   */
  static contract(
    type: TestType,
    component: string,
    description: string,
    options: Partial<TestDescriptor> = {}
  ): TestDescriptor {
    return {
      category: TestCategory.CONTRACT,
      type,
      component,
      description,
      timeout: 10000, // 10 seconds default for contract tests
      ...options,
    };
  }

  /**
   * Create a performance test descriptor
   * @param type Performance test type
   * @param component Component being tested
   * @param description Test description
   * @param options Additional options
   * @returns Test descriptor
   */
  static performance(
    type: TestType,
    component: string,
    description: string,
    options: Partial<TestDescriptor> = {}
  ): TestDescriptor {
    return {
      category: TestCategory.PERFORMANCE,
      type,
      component,
      description,
      timeout: 60000, // 60 seconds default for performance tests
      ...options,
    };
  }

  /**
   * Filter test descriptors by category
   * @param descriptors Array of test descriptors
   * @param category Category to filter by
   * @returns Filtered descriptors
   */
  static filterByCategory(descriptors: TestDescriptor[], category: TestCategory): TestDescriptor[] {
    return descriptors.filter(desc => desc.category === category);
  }

  /**
   * Filter test descriptors by type
   * @param descriptors Array of test descriptors
   * @param type Type to filter by
   * @returns Filtered descriptors
   */
  static filterByType(descriptors: TestDescriptor[], type: TestType): TestDescriptor[] {
    return descriptors.filter(desc => desc.type === type);
  }

  /**
   * Filter test descriptors by component
   * @param descriptors Array of test descriptors
   * @param component Component to filter by
   * @returns Filtered descriptors
   */
  static filterByComponent(descriptors: TestDescriptor[], component: string): TestDescriptor[] {
    return descriptors.filter(desc => desc.component === component);
  }

  /**
   * Filter test descriptors by tags
   * @param descriptors Array of test descriptors
   * @param tags Tags to filter by (AND logic)
   * @returns Filtered descriptors
   */
  static filterByTags(descriptors: TestDescriptor[], tags: string[]): TestDescriptor[] {
    return descriptors.filter(desc => tags.every(tag => desc.tags?.includes(tag)));
  }
}

/**
 * Test suite organizer for creating categorized test suites
 */
export class TestSuiteOrganizer {
  private descriptors: TestDescriptor[] = [];

  /**
   * Add a test descriptor
   * @param descriptor Test descriptor to add
   * @returns This organizer for chaining
   */
  add(descriptor: TestDescriptor): this {
    this.descriptors.push(descriptor);
    return this;
  }

  /**
   * Add multiple test descriptors
   * @param descriptors Test descriptors to add
   * @returns This organizer for chaining
   */
  addAll(descriptors: TestDescriptor[]): this {
    this.descriptors.push(...descriptors);
    return this;
  }

  /**
   * Get all descriptors
   * @returns All test descriptors
   */
  getAll(): TestDescriptor[] {
    return [...this.descriptors];
  }

  /**
   * Get descriptors by category
   * @param category Category to filter by
   * @returns Filtered descriptors
   */
  getByCategory(category: TestCategory): TestDescriptor[] {
    return TestCategorizer.filterByCategory(this.descriptors, category);
  }

  /**
   * Get unit tests
   * @returns Unit test descriptors
   */
  getUnitTests(): TestDescriptor[] {
    return this.getByCategory(TestCategory.UNIT);
  }

  /**
   * Get integration tests
   * @returns Integration test descriptors
   */
  getIntegrationTests(): TestDescriptor[] {
    return this.getByCategory(TestCategory.INTEGRATION);
  }

  /**
   * Get contract tests
   * @returns Contract test descriptors
   */
  getContractTests(): TestDescriptor[] {
    return this.getByCategory(TestCategory.CONTRACT);
  }

  /**
   * Get performance tests
   * @returns Performance test descriptors
   */
  getPerformanceTests(): TestDescriptor[] {
    return this.getByCategory(TestCategory.PERFORMANCE);
  }

  /**
   * Clear all descriptors
   * @returns This organizer for chaining
   */
  clear(): this {
    this.descriptors = [];
    return this;
  }

  /**
   * Generate test execution summary
   * @returns Test execution summary
   */
  getSummary(): {
    totalTests: number;
    byCategory: Record<TestCategory, number>;
    byType: Record<TestType, number>;
    byComponent: Record<string, number>;
  } {
    const byCategory = {} as Record<TestCategory, number>;
    const byType = {} as Record<TestType, number>;
    const byComponent = {} as Record<string, number>;

    for (const descriptor of this.descriptors) {
      // Count by category
      byCategory[descriptor.category] = (byCategory[descriptor.category] || 0) + 1;

      // Count by type
      byType[descriptor.type] = (byType[descriptor.type] || 0) + 1;

      // Count by component
      byComponent[descriptor.component] = (byComponent[descriptor.component] || 0) + 1;
    }

    return {
      totalTests: this.descriptors.length,
      byCategory,
      byType,
      byComponent,
    };
  }
}

/**
 * Predefined test descriptors for common scenarios
 */
export const commonTestDescriptors = {
  // Domain entity tests
  testBlockEntity: TestCategorizer.unit(
    TestType.DOMAIN_ENTITY,
    'TestBlock',
    'Domain entity behavior'
  ),

  testSuiteEntity: TestCategorizer.unit(
    TestType.DOMAIN_ENTITY,
    'TestSuite',
    'Domain entity behavior'
  ),

  codeMetadataEntity: TestCategorizer.unit(
    TestType.DOMAIN_ENTITY,
    'CodeMetadata',
    'Domain entity behavior'
  ),

  // Value object tests
  testNameValueObject: TestCategorizer.unit(
    TestType.VALUE_OBJECT,
    'TestName',
    'Value object immutability and validation'
  ),

  sourceCodeValueObject: TestCategorizer.unit(
    TestType.VALUE_OBJECT,
    'SourceCode',
    'Value object immutability and validation'
  ),

  sourcePositionValueObject: TestCategorizer.unit(
    TestType.VALUE_OBJECT,
    'SourcePosition',
    'Value object immutability and validation'
  ),

  // Application service tests
  testExtractionService: TestCategorizer.unit(
    TestType.APPLICATION_SERVICE,
    'TestExtractionService',
    'Application service orchestration'
  ),

  testAnalysisService: TestCategorizer.unit(
    TestType.APPLICATION_SERVICE,
    'TestAnalysisService',
    'Application service orchestration'
  ),

  // Infrastructure component tests
  typeScriptParser: TestCategorizer.unit(
    TestType.INFRASTRUCTURE_COMPONENT,
    'TypeScriptParser',
    'Infrastructure parsing logic'
  ),

  dependencyContainer: TestCategorizer.unit(
    TestType.INFRASTRUCTURE_COMPONENT,
    'DependencyContainer',
    'Dependency injection container'
  ),

  // Integration tests
  parserIntegration: TestCategorizer.integration(
    TestType.PARSER_INTEGRATION,
    'TypeScriptParser',
    'Parser integration with real TypeScript content'
  ),

  serviceIntegration: TestCategorizer.integration(
    TestType.SERVICE_INTEGRATION,
    'TestExtractionService',
    'Service integration across layers'
  ),

  endToEndFlow: TestCategorizer.integration(
    TestType.END_TO_END_FLOW,
    'TestExtractorFacade',
    'Complete extraction workflow'
  ),

  // Contract tests
  parserContract: TestCategorizer.contract(
    TestType.INTERFACE_CONTRACT,
    'ISourceCodeParser',
    'Parser interface contract compliance'
  ),

  classifierContract: TestCategorizer.contract(
    TestType.INTERFACE_CONTRACT,
    'ITestClassifier',
    'Classifier interface contract compliance'
  ),

  analyzerContract: TestCategorizer.contract(
    TestType.INTERFACE_CONTRACT,
    'IMetadataAnalyzer',
    'Analyzer interface contract compliance'
  ),

  // Performance tests
  largeSuiteBenchmark: TestCategorizer.performance(
    TestType.BENCHMARK,
    'TestExtractionService',
    'Large test suite processing performance'
  ),

  memoryUsageBenchmark: TestCategorizer.performance(
    TestType.BENCHMARK,
    'TypeScriptParser',
    'Memory usage during parsing'
  ),
};
