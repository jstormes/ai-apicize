import { ValidationError } from '../../shared/DomainError';
import { Result } from '../../shared/Result';
import { SourcePosition } from '../value-objects/SourcePosition';

/**
 * Domain entity representing metadata extracted from code comments and annotations
 */
export class CodeMetadata {
  private _requestMetadata: RequestMetadata[] = [];
  private _groupMetadata: GroupMetadata[] = [];
  private _testMetadata: TestMetadata[] = [];
  private _customMetadata: Map<string, unknown> = new Map();

  private constructor(
    private readonly _id: string,
    private readonly _sourceFile: string
  ) {}

  /**
   * Creates a new CodeMetadata instance
   */
  static create(props: {
    id: string;
    sourceFile: string;
  }): Result<CodeMetadata, ValidationError> {
    if (!props.id || typeof props.id !== 'string' || props.id.trim().length === 0) {
      return Result.fail(
        new ValidationError('INVALID_METADATA_ID', 'Metadata ID must be a non-empty string', {
          id: props.id,
        })
      );
    }

    if (!props.sourceFile || typeof props.sourceFile !== 'string' || props.sourceFile.trim().length === 0) {
      return Result.fail(
        new ValidationError('INVALID_SOURCE_FILE', 'Source file must be a non-empty string', {
          sourceFile: props.sourceFile,
        })
      );
    }

    return Result.ok(new CodeMetadata(props.id.trim(), props.sourceFile.trim()));
  }

  /**
   * Gets the metadata ID
   */
  get id(): string {
    return this._id;
  }

  /**
   * Gets the source file path
   */
  get sourceFile(): string {
    return this._sourceFile;
  }

  /**
   * Gets all request metadata
   */
  get requestMetadata(): readonly RequestMetadata[] {
    return [...this._requestMetadata];
  }

  /**
   * Gets all group metadata
   */
  get groupMetadata(): readonly GroupMetadata[] {
    return [...this._groupMetadata];
  }

  /**
   * Gets all test metadata
   */
  get testMetadata(): readonly TestMetadata[] {
    return [...this._testMetadata];
  }

  /**
   * Gets custom metadata value by key
   */
  getCustomMetadata<T>(key: string): T | undefined {
    return this._customMetadata.get(key) as T | undefined;
  }

  /**
   * Gets all custom metadata
   */
  getAllCustomMetadata(): Record<string, unknown> {
    return Object.fromEntries(this._customMetadata.entries());
  }

  /**
   * Adds request metadata
   */
  addRequestMetadata(metadata: RequestMetadata): Result<void, ValidationError> {
    // Validate required fields
    if (!metadata.id || typeof metadata.id !== 'string') {
      return Result.fail(
        new ValidationError('INVALID_REQUEST_METADATA_ID', 'Request metadata ID must be a non-empty string', {
          id: metadata.id,
        })
      );
    }

    if (!metadata.url || typeof metadata.url !== 'string') {
      return Result.fail(
        new ValidationError('INVALID_REQUEST_URL', 'Request URL must be a non-empty string', {
          url: metadata.url,
        })
      );
    }

    // Check for duplicates
    const isDuplicate = this._requestMetadata.some(existing => existing.id === metadata.id);
    if (isDuplicate) {
      return Result.fail(
        new ValidationError('DUPLICATE_REQUEST_METADATA', 'Request metadata with this ID already exists', {
          id: metadata.id,
        })
      );
    }

    this._requestMetadata.push(metadata);
    return Result.ok(undefined);
  }

  /**
   * Adds group metadata
   */
  addGroupMetadata(metadata: GroupMetadata): Result<void, ValidationError> {
    // Validate required fields
    if (!metadata.id || typeof metadata.id !== 'string') {
      return Result.fail(
        new ValidationError('INVALID_GROUP_METADATA_ID', 'Group metadata ID must be a non-empty string', {
          id: metadata.id,
        })
      );
    }

    if (!metadata.name || typeof metadata.name !== 'string') {
      return Result.fail(
        new ValidationError('INVALID_GROUP_NAME', 'Group name must be a non-empty string', {
          name: metadata.name,
        })
      );
    }

    // Check for duplicates
    const isDuplicate = this._groupMetadata.some(existing => existing.id === metadata.id);
    if (isDuplicate) {
      return Result.fail(
        new ValidationError('DUPLICATE_GROUP_METADATA', 'Group metadata with this ID already exists', {
          id: metadata.id,
        })
      );
    }

    this._groupMetadata.push(metadata);
    return Result.ok(undefined);
  }

  /**
   * Adds test metadata
   */
  addTestMetadata(metadata: TestMetadata): Result<void, ValidationError> {
    // Validate required fields
    if (!metadata.testId || typeof metadata.testId !== 'string') {
      return Result.fail(
        new ValidationError('INVALID_TEST_METADATA_ID', 'Test metadata ID must be a non-empty string', {
          testId: metadata.testId,
        })
      );
    }

    // Check for duplicates
    const isDuplicate = this._testMetadata.some(existing => existing.testId === metadata.testId);
    if (isDuplicate) {
      return Result.fail(
        new ValidationError('DUPLICATE_TEST_METADATA', 'Test metadata with this ID already exists', {
          testId: metadata.testId,
        })
      );
    }

    this._testMetadata.push(metadata);
    return Result.ok(undefined);
  }

  /**
   * Sets custom metadata
   */
  setCustomMetadata(key: string, value: unknown): Result<void, ValidationError> {
    if (!key || typeof key !== 'string') {
      return Result.fail(
        new ValidationError('INVALID_METADATA_KEY', 'Metadata key must be a non-empty string', { key })
      );
    }

    this._customMetadata.set(key, value);
    return Result.ok(undefined);
  }

  /**
   * Finds request metadata by ID
   */
  findRequestMetadata(id: string): RequestMetadata | undefined {
    return this._requestMetadata.find(metadata => metadata.id === id);
  }

  /**
   * Finds group metadata by ID
   */
  findGroupMetadata(id: string): GroupMetadata | undefined {
    return this._groupMetadata.find(metadata => metadata.id === id);
  }

  /**
   * Finds test metadata by test ID
   */
  findTestMetadata(testId: string): TestMetadata | undefined {
    return this._testMetadata.find(metadata => metadata.testId === testId);
  }

  /**
   * Finds request metadata by position
   */
  findRequestMetadataByPosition(position: SourcePosition): RequestMetadata[] {
    return this._requestMetadata.filter(metadata => {
      if (!metadata.position) return false;
      return metadata.position.overlaps(position) || position.contains(metadata.position);
    });
  }

  /**
   * Gets metadata that affects a specific source position
   */
  getMetadataForPosition(position: SourcePosition): {
    request: RequestMetadata[];
    group: GroupMetadata[];
    test: TestMetadata[];
  } {
    const request = this.findRequestMetadataByPosition(position);

    const group = this._groupMetadata.filter(metadata => {
      if (!metadata.position) return false;
      return metadata.position.overlaps(position) || position.contains(metadata.position);
    });

    const test = this._testMetadata.filter(metadata => {
      if (!metadata.position) return false;
      return metadata.position.overlaps(position) || position.contains(metadata.position);
    });

    return { request, group, test };
  }

  /**
   * Checks if there's request metadata near a position
   */
  hasRequestMetadataNear(position: SourcePosition, maxDistance = 500): boolean {
    return this._requestMetadata.some(metadata => {
      if (!metadata.position) return false;
      return position.distanceTo(metadata.position) <= maxDistance;
    });
  }

  /**
   * Gets statistics about the metadata
   */
  getStatistics(): MetadataStatistics {
    return {
      totalRequestMetadata: this._requestMetadata.length,
      totalGroupMetadata: this._groupMetadata.length,
      totalTestMetadata: this._testMetadata.length,
      totalCustomMetadata: this._customMetadata.size,
      hasApicizeMetadata: this._requestMetadata.length > 0 || this._groupMetadata.length > 0,
      uniqueRequestIds: new Set(this._requestMetadata.map(m => m.id)).size,
      uniqueGroupIds: new Set(this._groupMetadata.map(m => m.id)).size,
    };
  }

  /**
   * Validates all metadata for consistency
   */
  validate(): Result<MetadataValidationResult, ValidationError> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for orphaned references
    for (const groupMeta of this._groupMetadata) {
      if (groupMeta.selectedScenario && !this.findRequestMetadata(groupMeta.selectedScenario.id)) {
        warnings.push(`Group ${groupMeta.id} references unknown scenario ${groupMeta.selectedScenario.id}`);
      }
    }

    // Check for duplicate positions
    const positions = this._requestMetadata
      .filter(m => m.position)
      .map(m => m.position!);

    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        if (positions[i].overlaps(positions[j])) {
          warnings.push(`Request metadata positions overlap at ${positions[i].toString()} and ${positions[j].toString()}`);
        }
      }
    }

    return Result.ok({
      isValid: errors.length === 0,
      errors,
      warnings,
      statistics: this.getStatistics(),
    });
  }

  /**
   * Merges metadata from another CodeMetadata instance
   */
  merge(other: CodeMetadata): Result<void, ValidationError> {
    // Merge request metadata
    for (const metadata of other._requestMetadata) {
      const addResult = this.addRequestMetadata(metadata);
      if (Result.isFail(addResult)) {
        return addResult;
      }
    }

    // Merge group metadata
    for (const metadata of other._groupMetadata) {
      const addResult = this.addGroupMetadata(metadata);
      if (Result.isFail(addResult)) {
        return addResult;
      }
    }

    // Merge test metadata
    for (const metadata of other._testMetadata) {
      const addResult = this.addTestMetadata(metadata);
      if (Result.isFail(addResult)) {
        return addResult;
      }
    }

    // Merge custom metadata
    for (const [key, value] of other._customMetadata.entries()) {
      this._customMetadata.set(key, value);
    }

    return Result.ok(undefined);
  }

  /**
   * Entity equality (based on ID)
   */
  equals(other: CodeMetadata): boolean {
    return this._id === other._id;
  }

  /**
   * String representation
   */
  toString(): string {
    return `CodeMetadata(${this._id})`;
  }

  /**
   * JSON serialization
   */
  toJSON(): object {
    return {
      id: this._id,
      sourceFile: this._sourceFile,
      requestMetadata: this._requestMetadata,
      groupMetadata: this._groupMetadata,
      testMetadata: this._testMetadata,
      customMetadata: this.getAllCustomMetadata(),
      statistics: this.getStatistics(),
    };
  }
}

/**
 * Interface for request metadata
 */
export interface RequestMetadata {
  id: string;
  url: string;
  method: string;
  headers?: Array<{ name: string; value: string }>;
  body?: unknown;
  timeout?: number;
  numberOfRedirects?: number;
  runs?: number;
  multiRunExecution?: string;
  keepAlive?: boolean;
  acceptInvalidCerts?: boolean;
  position?: SourcePosition;
  [key: string]: unknown;
}

/**
 * Interface for group metadata
 */
export interface GroupMetadata {
  id: string;
  name: string;
  execution?: string;
  runs?: number;
  multiRunExecution?: string;
  selectedScenario?: { id: string; name: string };
  selectedData?: { id: string; name: string };
  position?: SourcePosition;
  [key: string]: unknown;
}

/**
 * Interface for test metadata
 */
export interface TestMetadata {
  testId: string;
  description?: string;
  tags?: string[];
  timeout?: number;
  skip?: boolean;
  only?: boolean;
  position?: SourcePosition;
  [key: string]: unknown;
}

/**
 * Interface for metadata statistics
 */
export interface MetadataStatistics {
  totalRequestMetadata: number;
  totalGroupMetadata: number;
  totalTestMetadata: number;
  totalCustomMetadata: number;
  hasApicizeMetadata: boolean;
  uniqueRequestIds: number;
  uniqueGroupIds: number;
}

/**
 * Interface for metadata validation results
 */
export interface MetadataValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  statistics: MetadataStatistics;
}