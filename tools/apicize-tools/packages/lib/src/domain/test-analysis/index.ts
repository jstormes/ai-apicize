// Domain Entities
export { TestSuite } from './entities/TestSuite';
export { TestBlock, TestBlockType } from './entities/TestBlock';
export { CodeMetadata } from './entities/CodeMetadata';

// Value Objects
export { TestName } from './value-objects/TestName';
export { SourcePosition } from './value-objects/SourcePosition';
export { SourceCode, CodeLanguage } from './value-objects/SourceCode';
export { RequestPattern } from './value-objects/RequestPattern';

// Domain Services
export * from './services/ITestClassifier';
export * from './services/IMetadataAnalyzer';

// Repository Interfaces
export * from './repositories/ITestRepository';

// Shared Types (re-export from entities for convenience)
export type {
  ImportStatement,
  VariableDeclaration,
  HelperFunction,
  ClassificationResult,
  TestSuiteStatistics,
  ValidationSummary,
  RequestMetadata,
  GroupMetadata,
  TestMetadata,
  MetadataStatistics,
} from './entities/TestSuite';

export type {
  TestBlockStatistics,
} from './entities/TestBlock';

export type {
  MetadataValidationResult,
} from './entities/CodeMetadata';

export type {
  ImportStatement as SourceCodeImport,
  VariableDeclaration as SourceCodeVariable,
} from './value-objects/SourceCode';