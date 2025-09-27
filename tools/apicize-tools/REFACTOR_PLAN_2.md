# 🏗️ **Apicize Tools Architecture Refactoring Plan 2**

## Overview

This document outlines a comprehensive architectural refactoring plan to address separation of concerns issues, improve testability, and implement clean architecture patterns in the Apicize tools project.

## 🚨 **Current Architectural Problems**

### 1. **Lack of Clean Separation of Concerns**
- **Parser logic mixed with business logic**: The `TestExtractor` class does too many things - parsing, analysis, validation, and data transformation
- **Tightly coupled dependencies**: Hard to test individual components in isolation
- **Monolithic interfaces**: Large interfaces that violate the Interface Segregation Principle

### 2. **Poor Domain Modeling**
- **Anemic domain models**: Data structures without behavior
- **Missing value objects**: Complex logic scattered throughout instead of encapsulated
- **No clear domain boundaries**: Parser, metadata extraction, and test analysis mixed together

### 3. **Testing Architecture Issues**
- **Hard to mock dependencies**: Tests fail because they're testing implementation details rather than behavior
- **Brittle test patterns**: Tests break when internal logic changes slightly
- **No clear test boundaries**: Unit tests mixed with integration concerns

### 4. **Code Organization Problems**
- **Feature folders instead of domain folders**: Related functionality scattered
- **Mixed abstraction levels**: High-level orchestration mixed with low-level parsing details
- **No clear dependency flow**: Circular dependencies and unclear boundaries

## 🎯 **Proposed Architectural Improvements**

### **1. Domain-Driven Design (DDD) Approach**

```typescript
// Domain structure
src/
├── domain/
│   ├── test-analysis/          # Core domain for test analysis
│   │   ├── entities/
│   │   │   ├── TestSuite.ts    # Rich domain entity
│   │   │   ├── TestBlock.ts    # Value object with behavior
│   │   │   └── CodeMetadata.ts # Value object
│   │   ├── value-objects/
│   │   │   ├── TestName.ts     # Encapsulates naming rules
│   │   │   ├── SourcePosition.ts
│   │   │   └── RequestPattern.ts
│   │   ├── services/
│   │   │   ├── TestClassifier.ts    # Domain service
│   │   │   └── MetadataAnalyzer.ts  # Domain service
│   │   └── repositories/
│   │       └── ITestRepository.ts   # Interface
│   └── shared/
│       ├── Result.ts          # Shared value object
│       └── DomainError.ts     # Domain errors
├── infrastructure/
│   ├── parsing/               # Infrastructure for parsing
│   │   ├── TypeScriptParser.ts    # Pure parsing logic
│   │   ├── AstNavigator.ts        # AST traversal
│   │   └── SourceAnalyzer.ts      # Source code analysis
│   └── repositories/
│       └── FileTestRepository.ts  # File-based implementation
├── application/
│   ├── services/
│   │   ├── TestExtractionService.ts   # Orchestration
│   │   └── TestAnalysisService.ts     # Application logic
│   └── dto/
│       └── TestExtractionResult.ts   # Data transfer objects
└── presentation/
    └── TestExtractorFacade.ts        # Public API
```

### **2. Hexagonal Architecture Pattern**

```typescript
// Clear separation between core domain and external concerns
interface ISourceCodeParser {
  parseSource(content: string): ParsedSource;
}

interface ITestAnalyzer {
  analyzeTests(parsedSource: ParsedSource): TestAnalysisResult;
}

interface IMetadataExtractor {
  extractMetadata(source: ParsedSource): CodeMetadata;
}

// Core domain doesn't depend on infrastructure
class TestExtractionService {
  constructor(
    private parser: ISourceCodeParser,
    private analyzer: ITestAnalyzer,
    private metadataExtractor: IMetadataExtractor
  ) {}
}
```

### **3. Strategy Pattern for Test Classification**

```typescript
interface ITestClassificationStrategy {
  classify(testBlock: TestBlock, context: ClassificationContext): boolean;
}

class RequestPatternStrategy implements ITestClassificationStrategy {
  classify(testBlock: TestBlock, context: ClassificationContext): boolean {
    return context.patterns.some(pattern => pattern.test(testBlock.name.value));
  }
}

class MetadataCommentStrategy implements ITestClassificationStrategy {
  classify(testBlock: TestBlock, context: ClassificationContext): boolean {
    return context.precedingContent.includes('@apicize-request-metadata');
  }
}

class TestClassifier {
  constructor(private strategies: ITestClassificationStrategy[]) {}

  isRequestSpecific(testBlock: TestBlock, context: ClassificationContext): boolean {
    return this.strategies.some(strategy => strategy.classify(testBlock, context));
  }
}
```

### **4. Builder Pattern for Complex Object Creation**

```typescript
class TestBlockBuilder {
  private testBlock: Partial<TestBlock> = {};

  withName(name: string): this {
    this.testBlock.name = new TestName(name);
    return this;
  }

  withCode(code: string): this {
    this.testBlock.code = new SourceCode(code);
    return this;
  }

  withPosition(start: number, end: number): this {
    this.testBlock.position = new SourcePosition(start, end);
    return this;
  }

  build(): TestBlock {
    return new TestBlock(this.testBlock);
  }
}
```

### **5. Factory Pattern for Parser Creation**

```typescript
interface IParserFactory {
  createParser(options: ParsingOptions): ISourceCodeParser;
}

class TypeScriptParserFactory implements IParserFactory {
  createParser(options: ParsingOptions): ISourceCodeParser {
    return new TypeScriptParser(
      new AstNavigator(),
      new SyntaxAnalyzer(),
      options
    );
  }
}
```

## 🧪 **Improved Testing Architecture**

### **1. Test Doubles and Mocking Strategy**

```typescript
// Clean interfaces make mocking easy
class MockSourceCodeParser implements ISourceCodeParser {
  private responses = new Map<string, ParsedSource>();

  mockResponse(content: string, result: ParsedSource): void {
    this.responses.set(content, result);
  }

  parseSource(content: string): ParsedSource {
    return this.responses.get(content) || new ParsedSource([]);
  }
}

// Test becomes focused on behavior, not implementation
describe('TestExtractionService', () => {
  let service: TestExtractionService;
  let mockParser: MockSourceCodeParser;
  let mockAnalyzer: MockTestAnalyzer;

  beforeEach(() => {
    mockParser = new MockSourceCodeParser();
    mockAnalyzer = new MockTestAnalyzer();
    service = new TestExtractionService(mockParser, mockAnalyzer);
  });

  it('should extract request-specific tests', () => {
    // Arrange
    const sourceCode = 'describe("API Test", () => {})';
    const expectedParsedSource = new ParsedSource([/* test blocks */]);
    const expectedAnalysis = new TestAnalysisResult([/* classified tests */]);

    mockParser.mockResponse(sourceCode, expectedParsedSource);
    mockAnalyzer.mockResponse(expectedParsedSource, expectedAnalysis);

    // Act
    const result = service.extractTests(sourceCode);

    // Assert
    expect(result.requestSpecificTests).toHaveLength(1);
  });
});
```

### **2. Test Data Builder Pattern**

```typescript
class TestContentBuilder {
  private content = '';

  withDescribeBlock(name: string, content: string): this {
    this.content += `describe('${name}', () => {\n${content}\n});\n`;
    return this;
  }

  withRequestMetadata(metadata: object): this {
    this.content = `/* @apicize-request-metadata\n${JSON.stringify(metadata)}\n@apicize-request-metadata-end */\n${this.content}`;
    return this;
  }

  withItBlock(name: string, code: string): this {
    this.content += `  it('${name}', () => {\n    ${code}\n  });\n`;
    return this;
  }

  build(): string {
    return this.content;
  }
}

// Usage in tests
const testContent = new TestContentBuilder()
  .withRequestMetadata({ id: 'test-request' })
  .withDescribeBlock('API Request Test',
    new TestContentBuilder()
      .withItBlock('should make request', 'expect(response.status).to.equal(200)')
      .build()
  )
  .withDescribeBlock('General Test',
    new TestContentBuilder()
      .withItBlock('should work generally', 'expect(true).to.be.true')
      .build()
  )
  .build();
```

### **3. Contract Testing for Interfaces**

```typescript
// Shared contract tests ensure all implementations behave consistently
export function testSourceCodeParserContract(createParser: () => ISourceCodeParser) {
  describe('ISourceCodeParser contract', () => {
    let parser: ISourceCodeParser;

    beforeEach(() => {
      parser = createParser();
    });

    it('should parse basic describe blocks', () => {
      const result = parser.parseSource('describe("test", () => {})');
      expect(result.testBlocks).toHaveLength(1);
    });

    it('should handle malformed code gracefully', () => {
      expect(() => parser.parseSource('invalid typescript')).not.toThrow();
    });
  });
}

// Use in specific parser tests
describe('TypeScriptParser', () => {
  testSourceCodeParserContract(() => new TypeScriptParser());

  // Parser-specific tests
  it('should extract TypeScript-specific features', () => {
    // TypeScript-specific test cases
  });
});
```

## 🔧 **Implementation Phases**

### **Phase 1: Extract Domain Models**
**Goal**: Create rich domain entities and value objects, move business logic into domain objects

**Tasks**:
1. Create domain entities with behavior
2. Extract value objects for complex data
3. Define clear domain interfaces
4. Move business logic from services to domain objects

**Deliverables**:
- `TestSuite` entity with rich behavior
- `TestBlock` value object with validation
- `TestName`, `SourcePosition`, `SourceCode` value objects
- `CodeMetadata` domain entity
- Domain service interfaces

### **Phase 2: Implement Hexagonal Architecture**
**Goal**: Separate core domain from infrastructure concerns

**Tasks**:
1. Create infrastructure adapters
2. Define application services for orchestration
3. Implement clean interfaces between layers
4. Extract parsing logic to infrastructure layer

**Deliverables**:
- `ISourceCodeParser` and `TypeScriptParser` implementation
- `TestExtractionService` application service
- Clear dependency injection points
- Infrastructure isolation

### **Phase 3: Refactor Tests**
**Goal**: Create maintainable, focused tests with proper mocking

**Tasks**:
1. Create test builders and utilities
2. Implement proper mocking strategy
3. Add contract tests for interfaces
4. Separate unit tests from integration tests

**Deliverables**:
- Test data builders
- Mock implementations
- Contract test suites
- Clean test architecture

### **Phase 4: Apply Design Patterns**
**Goal**: Implement patterns for extensibility and maintainability

**Tasks**:
1. Implement Strategy pattern for test classification
2. Add Factory pattern for parser creation
3. Use Builder pattern for complex object creation
4. Apply Repository pattern for data access

**Deliverables**:
- Strategy implementations
- Factory classes
- Builder classes
- Repository interfaces and implementations

## 💡 **Benefits of This Architecture**

1. **Testability**: Clean interfaces make unit testing straightforward
2. **Maintainability**: Clear separation of concerns reduces coupling
3. **Extensibility**: New classification strategies can be added easily
4. **Reusability**: Domain logic can be reused across different contexts
5. **Clarity**: Domain-driven design makes the code self-documenting

## 📋 **Success Criteria**

- All tests pass with the new architecture
- Code coverage maintains or improves
- Clear separation between domain, application, and infrastructure layers
- Easy to add new test classification strategies
- Reduced coupling between components
- Improved error handling and validation

## 🗂️ **Migration Strategy**

1. **Incremental refactoring**: Refactor one component at a time
2. **Parallel implementation**: Keep existing code working while building new architecture
3. **Feature flags**: Use feature toggles to switch between old and new implementations
4. **Comprehensive testing**: Ensure no regression during migration
5. **Documentation**: Update documentation to reflect new architecture

## 📈 **Success Metrics**

- Test execution time improvement
- Reduced test flakiness
- Code maintainability metrics
- Developer experience improvements
- Reduced bug reports related to parser functionality