import { ValidationError, BusinessRuleError } from '../../shared/DomainError';
import { Result } from '../../shared/Result';
import { TestName } from '../value-objects/TestName';
import { SourcePosition } from '../value-objects/SourcePosition';
import { SourceCode } from '../value-objects/SourceCode';
import { RequestPattern } from '../value-objects/RequestPattern';

/**
 * Domain entity representing a test block (describe or it)
 * This is a rich domain object with behavior and business rules
 */
export class TestBlock {
  private _children: TestBlock[] = [];
  private _metadata: Map<string, unknown> = new Map();

  private constructor(
    private readonly _id: string,
    private readonly _type: TestBlockType,
    private readonly _name: TestName,
    private readonly _code: SourceCode,
    private readonly _fullCode: SourceCode,
    private readonly _position: SourcePosition,
    private readonly _depth: number,
    private _isRequestSpecific: boolean = false,
    private _parent?: TestBlock
  ) {
    this.validateInvariants();
  }

  /**
   * Creates a new TestBlock with validation
   */
  static create(props: {
    id: string;
    type: TestBlockType;
    name: TestName;
    code: SourceCode;
    fullCode: SourceCode;
    position: SourcePosition;
    depth: number;
    isRequestSpecific?: boolean;
    parent?: TestBlock;
  }): Result<TestBlock, ValidationError> {
    // Validate ID
    if (!props.id || typeof props.id !== 'string' || props.id.trim().length === 0) {
      return Result.fail(
        new ValidationError('INVALID_TEST_BLOCK_ID', 'Test block ID must be a non-empty string', {
          id: props.id,
        })
      );
    }

    // Validate depth
    if (!Number.isInteger(props.depth) || props.depth < 0) {
      return Result.fail(
        new ValidationError('INVALID_DEPTH', 'Depth must be a non-negative integer', {
          depth: props.depth,
        })
      );
    }

    // Validate depth relationship with parent
    if (props.parent && props.depth !== props.parent._depth + 1) {
      return Result.fail(
        new ValidationError(
          'INVALID_DEPTH_RELATIONSHIP',
          'Depth must be exactly one more than parent depth',
          {
            depth: props.depth,
            parentDepth: props.parent._depth,
          }
        )
      );
    }

    // Validate test block type rules
    if (
      props.type === TestBlockType.It &&
      props.parent &&
      props.parent._type === TestBlockType.It
    ) {
      return Result.fail(
        new ValidationError(
          'INVALID_NESTING',
          'It blocks cannot be nested inside other it blocks',
          {
            type: props.type,
            parentType: props.parent._type,
          }
        )
      );
    }

    const testBlock = new TestBlock(
      props.id.trim(),
      props.type,
      props.name,
      props.code,
      props.fullCode,
      props.position,
      props.depth,
      props.isRequestSpecific ?? false,
      props.parent
    );

    return Result.ok(testBlock);
  }

  /**
   * Gets the unique identifier
   */
  get id(): string {
    return this._id;
  }

  /**
   * Gets the test block type
   */
  get type(): TestBlockType {
    return this._type;
  }

  /**
   * Gets the test name
   */
  get name(): TestName {
    return this._name;
  }

  /**
   * Gets the inner code (without function wrapper)
   */
  get code(): SourceCode {
    return this._code;
  }

  /**
   * Gets the complete code including function wrapper
   */
  get fullCode(): SourceCode {
    return this._fullCode;
  }

  /**
   * Gets the source position
   */
  get position(): SourcePosition {
    return this._position;
  }

  /**
   * Gets the nesting depth
   */
  get depth(): number {
    return this._depth;
  }

  /**
   * Gets whether this test is request-specific
   */
  get isRequestSpecific(): boolean {
    return this._isRequestSpecific;
  }

  /**
   * Gets the parent test block (if any)
   */
  get parent(): TestBlock | undefined {
    return this._parent;
  }

  /**
   * Gets all child test blocks
   */
  get children(): readonly TestBlock[] {
    return [...this._children];
  }

  /**
   * Gets metadata value by key
   */
  getMetadata<T>(key: string): T | undefined {
    return this._metadata.get(key) as T | undefined;
  }

  /**
   * Gets all metadata as a record
   */
  getAllMetadata(): Record<string, unknown> {
    return Object.fromEntries(this._metadata.entries());
  }

  /**
   * Checks if this is a root-level test block
   */
  get isRoot(): boolean {
    return this._parent === undefined;
  }

  /**
   * Checks if this is a leaf test block (no children)
   */
  get isLeaf(): boolean {
    return this._children.length === 0;
  }

  /**
   * Checks if this is a describe block
   */
  get isDescribe(): boolean {
    return this._type === TestBlockType.Describe;
  }

  /**
   * Checks if this is an it block
   */
  get isIt(): boolean {
    return this._type === TestBlockType.It;
  }

  /**
   * Gets the full path from root to this block
   */
  get path(): TestName[] {
    const path: TestName[] = [];
    let current: TestBlock | undefined = this;

    while (current) {
      path.unshift(current._name);
      current = current._parent;
    }

    return path;
  }

  /**
   * Gets the full path as a string
   */
  get pathString(): string {
    return this.path.map(name => name.value).join(' > ');
  }

  /**
   * Classifies the test as request-specific based on patterns
   */
  classifyAsRequestSpecific(patterns: RequestPattern[]): Result<void, BusinessRuleError> {
    if (patterns.length === 0) {
      return Result.fail(
        new BusinessRuleError(
          'NO_PATTERNS_PROVIDED',
          'At least one pattern must be provided for classification'
        )
      );
    }

    const wasRequestSpecific = this._isRequestSpecific;
    this._isRequestSpecific = patterns.some(pattern => pattern.matches(this._name));

    // Business rule: If this block becomes request-specific, all ancestors should be as well
    if (this._isRequestSpecific && !wasRequestSpecific) {
      this.propagateRequestSpecificUpward();
    }

    return Result.ok(undefined);
  }

  /**
   * Marks this test as request-specific
   */
  markAsRequestSpecific(): void {
    if (!this._isRequestSpecific) {
      this._isRequestSpecific = true;
      this.propagateRequestSpecificUpward();
    }
  }

  /**
   * Marks this test as not request-specific
   */
  markAsNotRequestSpecific(): void {
    this._isRequestSpecific = false;
    // Note: We don't propagate this downward to preserve explicit classifications
  }

  /**
   * Sets metadata
   */
  setMetadata(key: string, value: unknown): Result<void, ValidationError> {
    if (!key || typeof key !== 'string') {
      return Result.fail(
        new ValidationError('INVALID_METADATA_KEY', 'Metadata key must be a non-empty string', {
          key,
        })
      );
    }

    this._metadata.set(key, value);
    return Result.ok(undefined);
  }

  /**
   * Removes metadata
   */
  removeMetadata(key: string): void {
    this._metadata.delete(key);
  }

  /**
   * Adds a child test block
   */
  addChild(child: TestBlock): Result<void, BusinessRuleError> {
    // Validate business rules
    if (this._type === TestBlockType.It) {
      return Result.fail(
        new BusinessRuleError('INVALID_CHILD_ADDITION', 'It blocks cannot have children')
      );
    }

    if (child._depth !== this._depth + 1) {
      return Result.fail(
        new BusinessRuleError(
          'INVALID_CHILD_DEPTH',
          'Child depth must be exactly one more than parent',
          {
            parentDepth: this._depth,
            childDepth: child._depth,
          }
        )
      );
    }

    if (this._children.some(existing => existing._id === child._id)) {
      return Result.fail(
        new BusinessRuleError('DUPLICATE_CHILD_ID', 'Child with this ID already exists', {
          childId: child._id,
        })
      );
    }

    // Set parent relationship
    child._parent = this;
    this._children.push(child);

    // Propagate request-specific status if needed
    if (child._isRequestSpecific) {
      this.propagateRequestSpecificUpward();
    }

    return Result.ok(undefined);
  }

  /**
   * Removes a child test block
   */
  removeChild(childId: string): boolean {
    const index = this._children.findIndex(child => child._id === childId);
    if (index === -1) {
      return false;
    }

    const child = this._children[index];
    child._parent = undefined;
    this._children.splice(index, 1);
    return true;
  }

  /**
   * Finds a child by ID
   */
  findChild(childId: string): TestBlock | undefined {
    return this._children.find(child => child._id === childId);
  }

  /**
   * Finds all descendants (children, grandchildren, etc.)
   */
  findAllDescendants(): TestBlock[] {
    const descendants: TestBlock[] = [];

    for (const child of this._children) {
      descendants.push(child);
      descendants.push(...child.findAllDescendants());
    }

    return descendants;
  }

  /**
   * Finds descendants that match a predicate
   */
  findDescendants(predicate: (block: TestBlock) => boolean): TestBlock[] {
    return this.findAllDescendants().filter(predicate);
  }

  /**
   * Gets all it blocks in this subtree
   */
  getAllItBlocks(): TestBlock[] {
    return this.findDescendants(block => block.isIt);
  }

  /**
   * Gets all describe blocks in this subtree
   */
  getAllDescribeBlocks(): TestBlock[] {
    return this.findDescendants(block => block.isDescribe);
  }

  /**
   * Checks if this block contains any executable tests
   */
  hasExecutableTests(): boolean {
    if (this.isIt) {
      return true;
    }
    return this._children.some(child => child.hasExecutableTests());
  }

  /**
   * Gets statistics about this test block subtree
   */
  getStatistics(): TestBlockStatistics {
    const allDescendants = this.findAllDescendants();
    const itBlocks = allDescendants.filter(block => block.isIt);
    const describeBlocks = allDescendants.filter(block => block.isDescribe);
    const requestSpecificBlocks = allDescendants.filter(block => block.isRequestSpecific);

    return {
      totalBlocks: allDescendants.length + 1, // +1 for this block
      itBlocks: itBlocks.length + (this.isIt ? 1 : 0),
      describeBlocks: describeBlocks.length + (this.isDescribe ? 1 : 0),
      requestSpecificBlocks: requestSpecificBlocks.length + (this.isRequestSpecific ? 1 : 0),
      maxDepth: Math.max(this._depth, ...allDescendants.map(block => block._depth)),
      hasAsyncTests: this.hasAsyncTests(),
    };
  }

  /**
   * Checks if this subtree contains async tests
   */
  hasAsyncTests(): boolean {
    if (this._code.hasAsyncPatterns()) {
      return true;
    }
    return this._children.some(child => child.hasAsyncTests());
  }

  /**
   * Validates domain invariants
   */
  private validateInvariants(): void {
    if (this._type === TestBlockType.It && this._children.length > 0) {
      throw new Error('Domain invariant violation: It blocks cannot have children');
    }

    if (this._parent && this._depth !== this._parent._depth + 1) {
      throw new Error('Domain invariant violation: Invalid depth relationship with parent');
    }
  }

  /**
   * Propagates request-specific status upward to ancestors
   */
  private propagateRequestSpecificUpward(): void {
    let current = this._parent;
    while (current && !current._isRequestSpecific) {
      current._isRequestSpecific = true;
      current = current._parent;
    }
  }

  /**
   * Entity equality (based on ID)
   */
  equals(other: TestBlock): boolean {
    return this._id === other._id;
  }

  /**
   * String representation
   */
  toString(): string {
    return `${this._type}(${this._name.value})`;
  }

  /**
   * JSON serialization
   */
  toJSON(): object {
    return {
      id: this._id,
      type: this._type,
      name: this._name.toJSON(),
      position: this._position.toJSON(),
      depth: this._depth,
      isRequestSpecific: this._isRequestSpecific,
      metadata: this.getAllMetadata(),
      children: this._children.map(child => child.toJSON()),
      path: this.pathString,
    };
  }
}

/**
 * Enumeration of test block types
 */
export enum TestBlockType {
  Describe = 'describe',
  It = 'it',
}

/**
 * Interface for test block statistics
 */
export interface TestBlockStatistics {
  totalBlocks: number;
  itBlocks: number;
  describeBlocks: number;
  requestSpecificBlocks: number;
  maxDepth: number;
  hasAsyncTests: boolean;
}
