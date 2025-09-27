/**
 * Timer abstraction for better testability
 * Provides injectable timer interface that can be mocked in tests
 */

/**
 * Timer interface for abstracting time-based operations
 */
export interface Timer {
  /**
   * Set a timeout
   */
  setTimeout(callback: () => void, delay: number): NodeJS.Timeout;

  /**
   * Clear a timeout
   */
  clearTimeout(id: NodeJS.Timeout): void;

  /**
   * Get current timestamp
   */
  now(): number;

  /**
   * Create a promise that resolves after a delay
   */
  delay(ms: number): Promise<void>;
}

/**
 * Real timer implementation using native functions
 */
export class RealTimer implements Timer {
  setTimeout(callback: () => void, delay: number): NodeJS.Timeout {
    return setTimeout(callback, delay);
  }

  clearTimeout(id: NodeJS.Timeout): void {
    clearTimeout(id);
  }

  now(): number {
    return Date.now();
  }

  delay(ms: number): Promise<void> {
    return new Promise(resolve => this.setTimeout(resolve, ms));
  }
}

/**
 * Mock timer for testing
 */
export class MockTimer implements Timer {
  private timeouts: Map<NodeJS.Timeout, { callback: () => void; delay: number; startTime: number }> = new Map();
  private nextId = 1;
  private currentTime = 0;

  setTimeout(callback: () => void, delay: number): NodeJS.Timeout {
    const id = this.nextId++ as any as NodeJS.Timeout;
    this.timeouts.set(id, {
      callback,
      delay,
      startTime: this.currentTime,
    });
    return id;
  }

  clearTimeout(id: NodeJS.Timeout): void {
    this.timeouts.delete(id);
  }

  now(): number {
    return this.currentTime;
  }

  delay(ms: number): Promise<void> {
    return new Promise(resolve => this.setTimeout(resolve, ms));
  }

  /**
   * Advance time by the specified amount and trigger callbacks
   */
  advance(ms: number): void {
    this.currentTime += ms;

    const toTrigger: Array<() => void> = [];
    const toRemove: NodeJS.Timeout[] = [];

    for (const [id, timeout] of this.timeouts) {
      if (this.currentTime >= timeout.startTime + timeout.delay) {
        toTrigger.push(timeout.callback);
        toRemove.push(id);
      }
    }

    // Remove triggered timeouts
    toRemove.forEach(id => this.timeouts.delete(id));

    // Execute callbacks
    toTrigger.forEach(callback => callback());
  }

  /**
   * Get pending timeouts (for testing)
   */
  getPendingTimeouts(): number {
    return this.timeouts.size;
  }

  /**
   * Clear all timeouts
   */
  clearAll(): void {
    this.timeouts.clear();
  }

  /**
   * Reset timer state
   */
  reset(): void {
    this.currentTime = 0;
    this.clearAll();
    this.nextId = 1;
  }
}

/**
 * Default timer instance (uses real timers)
 */
export const defaultTimer = new RealTimer();

/**
 * AbortController abstraction for better testability
 */
export interface AbortControllerLike {
  signal: AbortSignal;
  abort(): void;
}

/**
 * Real AbortController implementation
 */
export class RealAbortController implements AbortControllerLike {
  private controller = new AbortController();

  get signal(): AbortSignal {
    return this.controller.signal;
  }

  abort(): void {
    this.controller.abort();
  }
}

/**
 * Mock AbortController for testing
 */
export class MockAbortController implements AbortControllerLike {
  private _signal: MockAbortSignal;

  constructor() {
    this._signal = new MockAbortSignal();
  }

  get signal(): AbortSignal {
    return this._signal as any;
  }

  abort(): void {
    this._signal.abort();
  }
}

/**
 * Mock AbortSignal for testing
 */
class MockAbortSignal {
  private _aborted = false;
  private listeners: Array<() => void> = [];

  get aborted(): boolean {
    return this._aborted;
  }

  addEventListener(type: string, listener: () => void, options?: { once?: boolean }): void {
    if (type === 'abort') {
      this.listeners.push(listener);
      if (this._aborted) {
        listener();
        if (options?.once) {
          this.removeEventListener(type, listener);
        }
      }
    }
  }

  removeEventListener(type: string, listener: () => void): void {
    if (type === 'abort') {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    }
  }

  abort(): void {
    if (!this._aborted) {
      this._aborted = true;
      this.listeners.forEach(listener => listener());
    }
  }
}

/**
 * AbortController factory interface
 */
export interface AbortControllerFactory {
  create(): AbortControllerLike;
}

/**
 * Real AbortController factory
 */
export class RealAbortControllerFactory implements AbortControllerFactory {
  create(): AbortControllerLike {
    return new RealAbortController();
  }
}

/**
 * Mock AbortController factory
 */
export class MockAbortControllerFactory implements AbortControllerFactory {
  create(): AbortControllerLike {
    return new MockAbortController();
  }
}

/**
 * Default AbortController factory
 */
export const defaultAbortControllerFactory = new RealAbortControllerFactory();