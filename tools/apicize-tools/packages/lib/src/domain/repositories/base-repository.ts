/**
 * Repository pattern implementations for data access
 * Provides consistent data access patterns across the application
 */

import { Result, success, failure } from '../../infrastructure/result';
import { ApicizeError, ApicizeErrorCode } from '../../infrastructure/errors';
import { FileSystem } from '../../infrastructure/interfaces';

/**
 * Base repository interface
 */
export interface Repository<T, K = string> {
  /**
   * Find entity by key
   */
  findById(id: K): Promise<Result<T | null, ApicizeError>>;

  /**
   * Find multiple entities by criteria
   */
  findBy(criteria: Partial<T>): Promise<Result<T[], ApicizeError>>;

  /**
   * Get all entities
   */
  findAll(): Promise<Result<T[], ApicizeError>>;

  /**
   * Save entity
   */
  save(entity: T): Promise<Result<T, ApicizeError>>;

  /**
   * Update entity
   */
  update(id: K, updates: Partial<T>): Promise<Result<T, ApicizeError>>;

  /**
   * Delete entity
   */
  delete(id: K): Promise<Result<boolean, ApicizeError>>;

  /**
   * Check if entity exists
   */
  exists(id: K): Promise<Result<boolean, ApicizeError>>;

  /**
   * Count entities
   */
  count(criteria?: Partial<T>): Promise<Result<number, ApicizeError>>;
}

/**
 * Entity interface with required id field
 */
export interface Entity {
  id: string;
}

/**
 * Query criteria for repositories
 */
export interface QueryCriteria<T> {
  where?: Partial<T>;
  orderBy?: Array<{ field: keyof T; direction: 'asc' | 'desc' }>;
  limit?: number;
  offset?: number;
}

/**
 * Page result for paginated queries
 */
export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/**
 * Repository with pagination support
 */
export interface PaginatedRepository<T, K = string> extends Repository<T, K> {
  /**
   * Find entities with pagination
   */
  findWithPagination(
    criteria: QueryCriteria<T>,
    page: number,
    pageSize: number
  ): Promise<Result<PageResult<T>, ApicizeError>>;
}

/**
 * In-memory repository implementation
 */
export class InMemoryRepository<T extends Entity> implements Repository<T> {
  protected data = new Map<string, T>();
  protected nextId = 1;

  async findById(id: string): Promise<Result<T | null, ApicizeError>> {
    try {
      const entity = this.data.get(id) || null;
      return success(entity);
    } catch (error) {
      return failure(
        new ApicizeError(ApicizeErrorCode.INTERNAL_ERROR, `Failed to find entity by id: ${id}`, {
          cause: error as Error,
        })
      );
    }
  }

  async findBy(criteria: Partial<T>): Promise<Result<T[], ApicizeError>> {
    try {
      const results: T[] = [];
      const criteriaKeys = Object.keys(criteria) as Array<keyof T>;

      for (const entity of this.data.values()) {
        const matches = criteriaKeys.every(key => {
          const entityValue = entity[key];
          const criteriaValue = criteria[key];
          return entityValue === criteriaValue;
        });

        if (matches) {
          results.push(entity);
        }
      }

      return success(results);
    } catch (error) {
      return failure(
        new ApicizeError(ApicizeErrorCode.INTERNAL_ERROR, 'Failed to find entities by criteria', {
          cause: error as Error,
        })
      );
    }
  }

  async findAll(): Promise<Result<T[], ApicizeError>> {
    try {
      const results = Array.from(this.data.values());
      return success(results);
    } catch (error) {
      return failure(
        new ApicizeError(ApicizeErrorCode.INTERNAL_ERROR, 'Failed to find all entities', {
          cause: error as Error,
        })
      );
    }
  }

  async save(entity: T): Promise<Result<T, ApicizeError>> {
    try {
      // Generate ID if not present
      if (!entity.id) {
        (entity as any).id = this.generateId();
      }

      this.data.set(entity.id, { ...entity });
      return success(entity);
    } catch (error) {
      return failure(
        new ApicizeError(ApicizeErrorCode.INTERNAL_ERROR, 'Failed to save entity', {
          cause: error as Error,
        })
      );
    }
  }

  async update(id: string, updates: Partial<T>): Promise<Result<T, ApicizeError>> {
    try {
      const existing = this.data.get(id);
      if (!existing) {
        return failure(new ApicizeError(ApicizeErrorCode.NOT_FOUND, `Entity not found: ${id}`));
      }

      const updated = { ...existing, ...updates, id }; // Preserve ID
      this.data.set(id, updated);
      return success(updated);
    } catch (error) {
      return failure(
        new ApicizeError(ApicizeErrorCode.INTERNAL_ERROR, `Failed to update entity: ${id}`, {
          cause: error as Error,
        })
      );
    }
  }

  async delete(id: string): Promise<Result<boolean, ApicizeError>> {
    try {
      const deleted = this.data.delete(id);
      return success(deleted);
    } catch (error) {
      return failure(
        new ApicizeError(ApicizeErrorCode.INTERNAL_ERROR, `Failed to delete entity: ${id}`, {
          cause: error as Error,
        })
      );
    }
  }

  async exists(id: string): Promise<Result<boolean, ApicizeError>> {
    try {
      const exists = this.data.has(id);
      return success(exists);
    } catch (error) {
      return failure(
        new ApicizeError(
          ApicizeErrorCode.INTERNAL_ERROR,
          `Failed to check entity existence: ${id}`,
          { cause: error as Error }
        )
      );
    }
  }

  async count(criteria?: Partial<T>): Promise<Result<number, ApicizeError>> {
    try {
      if (!criteria) {
        return success(this.data.size);
      }

      const result = await this.findBy(criteria);
      if (result.isFailure()) {
        return result as any;
      }

      return success(result.data.length);
    } catch (error) {
      return failure(
        new ApicizeError(ApicizeErrorCode.INTERNAL_ERROR, 'Failed to count entities', {
          cause: error as Error,
        })
      );
    }
  }

  protected generateId(): string {
    return `id_${this.nextId++}`;
  }

  /**
   * Clear all data (useful for testing)
   */
  clear(): void {
    this.data.clear();
    this.nextId = 1;
  }
}

/**
 * File-based repository implementation
 */
export class FileRepository<T extends Entity> implements Repository<T> {
  private cache = new Map<string, T>();
  private cacheLoaded = false;

  constructor(
    private readonly fileSystem: FileSystem,
    private readonly filePath: string,
    private readonly serialize: (data: T[]) => string = JSON.stringify,
    private readonly deserialize: (content: string) => T[] = JSON.parse
  ) {}

  async findById(id: string): Promise<Result<T | null, ApicizeError>> {
    const loadResult = await this.ensureCacheLoaded();
    if (loadResult.isFailure()) {
      return loadResult as any;
    }

    try {
      const entity = this.cache.get(id) || null;
      return success(entity);
    } catch (error) {
      return failure(
        new ApicizeError(ApicizeErrorCode.INTERNAL_ERROR, `Failed to find entity by id: ${id}`, {
          cause: error as Error,
        })
      );
    }
  }

  async findBy(criteria: Partial<T>): Promise<Result<T[], ApicizeError>> {
    const loadResult = await this.ensureCacheLoaded();
    if (loadResult.isFailure()) {
      return loadResult as any;
    }

    try {
      const results: T[] = [];
      const criteriaKeys = Object.keys(criteria) as Array<keyof T>;

      for (const entity of this.cache.values()) {
        const matches = criteriaKeys.every(key => {
          const entityValue = entity[key];
          const criteriaValue = criteria[key];
          return entityValue === criteriaValue;
        });

        if (matches) {
          results.push(entity);
        }
      }

      return success(results);
    } catch (error) {
      return failure(
        new ApicizeError(ApicizeErrorCode.INTERNAL_ERROR, 'Failed to find entities by criteria', {
          cause: error as Error,
        })
      );
    }
  }

  async findAll(): Promise<Result<T[], ApicizeError>> {
    const loadResult = await this.ensureCacheLoaded();
    if (loadResult.isFailure()) {
      return loadResult as any;
    }

    try {
      const results = Array.from(this.cache.values());
      return success(results);
    } catch (error) {
      return failure(
        new ApicizeError(ApicizeErrorCode.INTERNAL_ERROR, 'Failed to find all entities', {
          cause: error as Error,
        })
      );
    }
  }

  async save(entity: T): Promise<Result<T, ApicizeError>> {
    const loadResult = await this.ensureCacheLoaded();
    if (loadResult.isFailure()) {
      return loadResult as any;
    }

    try {
      // Generate ID if not present
      if (!entity.id) {
        (entity as any).id = this.generateId();
      }

      this.cache.set(entity.id, { ...entity });
      const saveResult = await this.saveToFile();
      if (saveResult.isFailure()) {
        return saveResult as any;
      }

      return success(entity);
    } catch (error) {
      return failure(
        new ApicizeError(ApicizeErrorCode.INTERNAL_ERROR, 'Failed to save entity', {
          cause: error as Error,
        })
      );
    }
  }

  async update(id: string, updates: Partial<T>): Promise<Result<T, ApicizeError>> {
    const loadResult = await this.ensureCacheLoaded();
    if (loadResult.isFailure()) {
      return loadResult as any;
    }

    try {
      const existing = this.cache.get(id);
      if (!existing) {
        return failure(new ApicizeError(ApicizeErrorCode.NOT_FOUND, `Entity not found: ${id}`));
      }

      const updated = { ...existing, ...updates, id }; // Preserve ID
      this.cache.set(id, updated);

      const saveResult = await this.saveToFile();
      if (saveResult.isFailure()) {
        return saveResult as any;
      }

      return success(updated);
    } catch (error) {
      return failure(
        new ApicizeError(ApicizeErrorCode.INTERNAL_ERROR, `Failed to update entity: ${id}`, {
          cause: error as Error,
        })
      );
    }
  }

  async delete(id: string): Promise<Result<boolean, ApicizeError>> {
    const loadResult = await this.ensureCacheLoaded();
    if (loadResult.isFailure()) {
      return loadResult as any;
    }

    try {
      const deleted = this.cache.delete(id);
      if (deleted) {
        const saveResult = await this.saveToFile();
        if (saveResult.isFailure()) {
          return saveResult as any;
        }
      }

      return success(deleted);
    } catch (error) {
      return failure(
        new ApicizeError(ApicizeErrorCode.INTERNAL_ERROR, `Failed to delete entity: ${id}`, {
          cause: error as Error,
        })
      );
    }
  }

  async exists(id: string): Promise<Result<boolean, ApicizeError>> {
    const loadResult = await this.ensureCacheLoaded();
    if (loadResult.isFailure()) {
      return loadResult as any;
    }

    try {
      const exists = this.cache.has(id);
      return success(exists);
    } catch (error) {
      return failure(
        new ApicizeError(
          ApicizeErrorCode.INTERNAL_ERROR,
          `Failed to check entity existence: ${id}`,
          { cause: error as Error }
        )
      );
    }
  }

  async count(criteria?: Partial<T>): Promise<Result<number, ApicizeError>> {
    if (!criteria) {
      const loadResult = await this.ensureCacheLoaded();
      if (loadResult.isFailure()) {
        return loadResult as any;
      }
      return success(this.cache.size);
    }

    const result = await this.findBy(criteria);
    if (result.isFailure()) {
      return result as any;
    }

    return success(result.data.length);
  }

  private async ensureCacheLoaded(): Promise<Result<void, ApicizeError>> {
    if (this.cacheLoaded) {
      return success(undefined);
    }

    try {
      if (!this.fileSystem.exists(this.filePath)) {
        // File doesn't exist, start with empty cache
        this.cacheLoaded = true;
        return success(undefined);
      }

      const content = this.fileSystem.readFile(this.filePath, 'utf-8');
      const entities = this.deserialize(content);

      this.cache.clear();
      entities.forEach(entity => {
        this.cache.set(entity.id, entity);
      });

      this.cacheLoaded = true;
      return success(undefined);
    } catch (error) {
      return failure(
        new ApicizeError(
          ApicizeErrorCode.FILE_READ_ERROR,
          `Failed to load repository data from ${this.filePath}`,
          { cause: error as Error }
        )
      );
    }
  }

  private async saveToFile(): Promise<Result<void, ApicizeError>> {
    try {
      const entities = Array.from(this.cache.values());
      const content = this.serialize(entities);
      this.fileSystem.writeFile(this.filePath, content, 'utf-8');
      return success(undefined);
    } catch (error) {
      return failure(
        new ApicizeError(
          ApicizeErrorCode.FILE_WRITE_ERROR,
          `Failed to save repository data to ${this.filePath}`,
          { cause: error as Error }
        )
      );
    }
  }

  private generateId(): string {
    return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Repository factory for creating different types of repositories
 */
export class RepositoryFactory {
  /**
   * Create in-memory repository
   */
  static createInMemory<T extends Entity>(): InMemoryRepository<T> {
    return new InMemoryRepository<T>();
  }

  /**
   * Create file-based repository
   */
  static createFile<T extends Entity>(
    fileSystem: FileSystem,
    filePath: string,
    serialize?: (data: T[]) => string,
    deserialize?: (content: string) => T[]
  ): FileRepository<T> {
    return new FileRepository<T>(fileSystem, filePath, serialize, deserialize);
  }
}

/**
 * Repository decorator for caching
 */
export class CachedRepository<T extends Entity> implements Repository<T> {
  private cache = new Map<string, { entity: T; timestamp: number }>();

  constructor(
    private readonly repository: Repository<T>,
    private readonly cacheTimeoutMs: number = 5 * 60 * 1000 // 5 minutes
  ) {}

  async findById(id: string): Promise<Result<T | null, ApicizeError>> {
    // Check cache first
    const cached = this.cache.get(id);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeoutMs) {
      return success(cached.entity);
    }

    // Fetch from repository
    const result = await this.repository.findById(id);
    if (result.isSuccess() && result.data) {
      this.cache.set(id, { entity: result.data, timestamp: Date.now() });
    }

    return result;
  }

  async findBy(criteria: Partial<T>): Promise<Result<T[], ApicizeError>> {
    // Skip cache for complex queries
    return this.repository.findBy(criteria);
  }

  async findAll(): Promise<Result<T[], ApicizeError>> {
    return this.repository.findAll();
  }

  async save(entity: T): Promise<Result<T, ApicizeError>> {
    const result = await this.repository.save(entity);
    if (result.isSuccess()) {
      this.cache.set(entity.id, { entity: result.data, timestamp: Date.now() });
    }
    return result;
  }

  async update(id: string, updates: Partial<T>): Promise<Result<T, ApicizeError>> {
    const result = await this.repository.update(id, updates);
    if (result.isSuccess()) {
      this.cache.set(id, { entity: result.data, timestamp: Date.now() });
    }
    return result;
  }

  async delete(id: string): Promise<Result<boolean, ApicizeError>> {
    const result = await this.repository.delete(id);
    if (result.isSuccess() && result.data) {
      this.cache.delete(id);
    }
    return result;
  }

  async exists(id: string): Promise<Result<boolean, ApicizeError>> {
    // Check cache first
    if (this.cache.has(id)) {
      return success(true);
    }
    return this.repository.exists(id);
  }

  async count(criteria?: Partial<T>): Promise<Result<number, ApicizeError>> {
    return this.repository.count(criteria);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Remove expired cache entries
   */
  cleanupCache(): void {
    const now = Date.now();
    for (const [id, cached] of this.cache.entries()) {
      if (now - cached.timestamp >= this.cacheTimeoutMs) {
        this.cache.delete(id);
      }
    }
  }
}
