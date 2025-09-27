/**
 * Dependency injection interfaces for better testability
 * Part of Phase 3: Testing Improvements - Extract static dependencies
 */

/**
 * File system operations interface
 */
export interface IFileSystem {
  /**
   * Check if file or directory exists
   */
  existsSync(path: string): boolean;

  /**
   * Read file content synchronously
   */
  readFileSync(path: string, encoding?: BufferEncoding): string | Buffer;

  /**
   * Write file content synchronously
   */
  writeFileSync(path: string, data: string | Buffer, encoding?: BufferEncoding): void;

  /**
   * Read directory contents
   */
  readdirSync(path: string): string[];

  /**
   * Create directory
   */
  mkdirSync(path: string, options?: { recursive?: boolean }): void;

  /**
   * Get file stats
   */
  statSync(path: string): {
    isFile(): boolean;
    isDirectory(): boolean;
    size: number;
    mtime: Date;
  };

  /**
   * Read file asynchronously
   */
  readFile(path: string, encoding?: BufferEncoding): Promise<string | Buffer>;

  /**
   * Write file asynchronously
   */
  writeFile(path: string, data: string | Buffer, encoding?: BufferEncoding): Promise<void>;
}

/**
 * HTTP client interface
 */
export interface IHttpClient {
  /**
   * Perform HTTP request
   */
  fetch(url: string, init?: RequestInit): Promise<Response>;

  /**
   * Get request with timeout
   */
  get(
    url: string,
    options?: { timeout?: number; headers?: Record<string, string> }
  ): Promise<Response>;

  /**
   * Post request with body
   */
  post(
    url: string,
    body?: any,
    options?: { timeout?: number; headers?: Record<string, string> }
  ): Promise<Response>;

  /**
   * Put request with body
   */
  put(
    url: string,
    body?: any,
    options?: { timeout?: number; headers?: Record<string, string> }
  ): Promise<Response>;

  /**
   * Delete request
   */
  delete(
    url: string,
    options?: { timeout?: number; headers?: Record<string, string> }
  ): Promise<Response>;
}

/**
 * Console interface for logging
 */
export interface IConsole {
  /**
   * Log message
   */
  log(...args: any[]): void;

  /**
   * Log error message
   */
  error(...args: any[]): void;

  /**
   * Log warning message
   */
  warn(...args: any[]): void;

  /**
   * Log info message
   */
  info(...args: any[]): void;

  /**
   * Log debug message
   */
  debug(...args: any[]): void;
}

/**
 * Time provider interface
 */
export interface ITimeProvider {
  /**
   * Get current timestamp
   */
  now(): number;

  /**
   * Get current date
   */
  getDate(): Date;

  /**
   * Create timeout
   */
  setTimeout(callback: () => void, delay: number): number;

  /**
   * Clear timeout
   */
  clearTimeout(id: number): void;

  /**
   * Create interval
   */
  setInterval(callback: () => void, delay: number): number;

  /**
   * Clear interval
   */
  clearInterval(id: number): void;
}

/**
 * Process environment interface
 */
export interface IProcessEnv {
  /**
   * Get environment variable
   */
  get(key: string): string | undefined;

  /**
   * Set environment variable
   */
  set(key: string, value: string): void;

  /**
   * Check if environment variable exists
   */
  has(key: string): boolean;

  /**
   * Get all environment variables
   */
  getAll(): Record<string, string>;
}

/**
 * Random number generator interface
 */
export interface IRandomGenerator {
  /**
   * Generate random number between 0 and 1
   */
  random(): number;

  /**
   * Generate random integer between min and max (inclusive)
   */
  randomInt(min: number, max: number): number;

  /**
   * Generate UUID
   */
  uuid(): string;
}

/**
 * Path utilities interface
 */
export interface IPathUtils {
  /**
   * Join path segments
   */
  join(...segments: string[]): string;

  /**
   * Resolve absolute path
   */
  resolve(...segments: string[]): string;

  /**
   * Get directory name
   */
  dirname(path: string): string;

  /**
   * Get base name
   */
  basename(path: string, ext?: string): string;

  /**
   * Get file extension
   */
  extname(path: string): string;

  /**
   * Check if path is absolute
   */
  isAbsolute(path: string): boolean;

  /**
   * Normalize path
   */
  normalize(path: string): string;
}

/**
 * Crypto utilities interface
 */
export interface ICryptoUtils {
  /**
   * Create hash
   */
  createHash(algorithm: string, data: string | Buffer): string;

  /**
   * Create HMAC
   */
  createHmac(algorithm: string, key: string, data: string | Buffer): string;

  /**
   * Generate random bytes
   */
  randomBytes(size: number): Buffer;

  /**
   * Base64 encode
   */
  base64Encode(data: string | Buffer): string;

  /**
   * Base64 decode
   */
  base64Decode(data: string): Buffer;
}

/**
 * Event emitter interface
 */
export interface IEventEmitter {
  /**
   * Add event listener
   */
  on(event: string, listener: (...args: any[]) => void): void;

  /**
   * Remove event listener
   */
  off(event: string, listener: (...args: any[]) => void): void;

  /**
   * Emit event
   */
  emit(event: string, ...args: any[]): boolean;

  /**
   * Add one-time event listener
   */
  once(event: string, listener: (...args: any[]) => void): void;

  /**
   * Remove all listeners for event
   */
  removeAllListeners(event?: string): void;
}

/**
 * JSON utilities interface
 */
export interface IJsonUtils {
  /**
   * Parse JSON string
   */
  parse(text: string): any;

  /**
   * Stringify object to JSON
   */
  stringify(value: any, replacer?: any, space?: string | number): string;

  /**
   * Validate JSON format
   */
  isValid(text: string): boolean;

  /**
   * Safe parse that returns null on error
   */
  safeParse(text: string): any | null;
}

/**
 * URL utilities interface
 */
export interface IUrlUtils {
  /**
   * Parse URL
   */
  parse(url: string): {
    protocol: string;
    hostname: string;
    port: string;
    pathname: string;
    search: string;
    hash: string;
  };

  /**
   * Format URL from components
   */
  format(components: {
    protocol?: string;
    hostname?: string;
    port?: string;
    pathname?: string;
    search?: string;
    hash?: string;
  }): string;

  /**
   * Resolve URL relative to base
   */
  resolve(base: string, relative: string): string;

  /**
   * Check if URL is valid
   */
  isValid(url: string): boolean;
}

/**
 * Template engine interface
 */
export interface ITemplateEngine {
  /**
   * Compile template with variables
   */
  compile(template: string, variables: Record<string, any>): string;

  /**
   * Check if template is valid
   */
  isValid(template: string): boolean;

  /**
   * Extract variables from template
   */
  extractVariables(template: string): string[];
}

/**
 * Configuration provider interface
 */
export interface IConfigProvider {
  /**
   * Get configuration value
   */
  get<T = any>(key: string, defaultValue?: T): T;

  /**
   * Set configuration value
   */
  set(key: string, value: any): void;

  /**
   * Check if configuration exists
   */
  has(key: string): boolean;

  /**
   * Load configuration from file
   */
  loadFromFile(path: string): Promise<void>;

  /**
   * Save configuration to file
   */
  saveToFile(path: string): Promise<void>;

  /**
   * Get all configuration
   */
  getAll(): Record<string, any>;
}

/**
 * Dependency container interface
 */
export interface IDependencyContainer {
  /**
   * Register singleton service
   */
  registerSingleton<T>(token: string, factory: () => T): void;

  /**
   * Register transient service
   */
  registerTransient<T>(token: string, factory: () => T): void;

  /**
   * Register instance
   */
  registerInstance<T>(token: string, instance: T): void;

  /**
   * Resolve service
   */
  resolve<T>(token: string): T;

  /**
   * Check if service is registered
   */
  isRegistered(token: string): boolean;

  /**
   * Clear all registrations
   */
  clear(): void;
}

/**
 * Factory for creating dependency implementations
 */
export class DependencyFactory {
  /**
   * Create file system implementation
   */
  static createFileSystem(): IFileSystem {
    const fs = require('fs');
    return {
      existsSync: fs.existsSync,
      readFileSync: fs.readFileSync,
      writeFileSync: fs.writeFileSync,
      readdirSync: fs.readdirSync,
      mkdirSync: fs.mkdirSync,
      statSync: fs.statSync,
      readFile: fs.promises.readFile,
      writeFile: fs.promises.writeFile,
    };
  }

  /**
   * Create HTTP client implementation
   */
  static createHttpClient(): IHttpClient {
    return {
      fetch: global.fetch,
      async get(url, options) {
        const response = await fetch(url, {
          method: 'GET',
          ...(options?.headers && { headers: options.headers }),
          ...(options?.timeout && { signal: AbortSignal.timeout(options.timeout) }),
        });
        return response;
      },
      async post(url, body, options) {
        const response = await fetch(url, {
          method: 'POST',
          ...(options?.headers && { headers: options.headers }),
          ...(body && { body: JSON.stringify(body) }),
          ...(options?.timeout && { signal: AbortSignal.timeout(options.timeout) }),
        });
        return response;
      },
      async put(url, body, options) {
        const response = await fetch(url, {
          method: 'PUT',
          ...(options?.headers && { headers: options.headers }),
          ...(body && { body: JSON.stringify(body) }),
          ...(options?.timeout && { signal: AbortSignal.timeout(options.timeout) }),
        });
        return response;
      },
      async delete(url, options) {
        const response = await fetch(url, {
          method: 'DELETE',
          ...(options?.headers && { headers: options.headers }),
          ...(options?.timeout && { signal: AbortSignal.timeout(options.timeout) }),
        });
        return response;
      },
    };
  }

  /**
   * Create console implementation
   */
  static createConsole(): IConsole {
    return {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info,
      debug: console.debug,
    };
  }

  /**
   * Create time provider implementation
   */
  static createTimeProvider(): ITimeProvider {
    return {
      now: Date.now,
      getDate: () => new Date(),
      setTimeout: (callback, delay) => setTimeout(callback, delay) as any,
      clearTimeout: clearTimeout,
      setInterval: (callback, delay) => setInterval(callback, delay) as any,
      clearInterval: clearInterval,
    };
  }

  /**
   * Create process environment implementation
   */
  static createProcessEnv(): IProcessEnv {
    return {
      get: key => process.env[key],
      set: (key, value) => {
        process.env[key] = value;
      },
      has: key => key in process.env,
      getAll: () =>
        Object.fromEntries(
          Object.entries(process.env).filter(([, value]) => value !== undefined)
        ) as Record<string, string>,
    };
  }
}
