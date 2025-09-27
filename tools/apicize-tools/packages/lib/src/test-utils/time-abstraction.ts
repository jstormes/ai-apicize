/**
 * Time abstraction for deterministic testing
 * Part of Phase 3: Testing Improvements
 */

import { ITimeProvider } from './dependency-interfaces';

/**
 * Controllable time provider for testing
 */
export class TestTimeProvider implements ITimeProvider {
  private currentTime: number;
  private timers: Map<number, TestTimer> = new Map();
  private intervals: Map<number, TestInterval> = new Map();
  private nextId = 1;

  constructor(initialTime: number = Date.now()) {
    this.currentTime = initialTime;
  }

  /**
   * Get current timestamp
   */
  now(): number {
    return this.currentTime;
  }

  /**
   * Get current date
   */
  getDate(): Date {
    return new Date(this.currentTime);
  }

  /**
   * Advance time by specified milliseconds
   */
  advanceTime(ms: number): void {
    const targetTime = this.currentTime + ms;

    while (this.currentTime < targetTime) {
      const nextEvent = this.getNextEvent();

      if (!nextEvent || nextEvent.time > targetTime) {
        // No events before target time, jump directly
        this.currentTime = targetTime;
        break;
      }

      // Advance to next event and process it
      this.currentTime = nextEvent.time;
      this.processEvent(nextEvent);
    }
  }

  /**
   * Set absolute time
   */
  setTime(time: number): void {
    if (time < this.currentTime) {
      // If going backwards, clear all timers/intervals
      this.timers.clear();
      this.intervals.clear();
    } else {
      // If going forwards, advance time normally
      this.advanceTime(time - this.currentTime);
      return;
    }

    this.currentTime = time;
  }

  /**
   * Create timeout
   */
  setTimeout(callback: () => void, delay: number): number {
    const id = this.nextId++;
    const executeTime = this.currentTime + delay;

    this.timers.set(id, {
      id,
      callback,
      executeTime,
      delay,
      type: 'timeout',
    });

    return id;
  }

  /**
   * Clear timeout
   */
  clearTimeout(id: number): void {
    this.timers.delete(id);
  }

  /**
   * Create interval
   */
  setInterval(callback: () => void, delay: number): number {
    const id = this.nextId++;
    const nextExecuteTime = this.currentTime + delay;

    this.intervals.set(id, {
      id,
      callback,
      nextExecuteTime,
      delay,
      type: 'interval',
    });

    return id;
  }

  /**
   * Clear interval
   */
  clearInterval(id: number): void {
    this.intervals.delete(id);
  }

  /**
   * Get all pending timers and intervals
   */
  getPendingEvents(): Array<{ id: number; type: string; time: number; delay: number }> {
    const events: Array<{ id: number; type: string; time: number; delay: number }> = [];

    for (const timer of this.timers.values()) {
      events.push({
        id: timer.id,
        type: 'timeout',
        time: timer.executeTime,
        delay: timer.delay,
      });
    }

    for (const interval of this.intervals.values()) {
      events.push({
        id: interval.id,
        type: 'interval',
        time: interval.nextExecuteTime,
        delay: interval.delay,
      });
    }

    return events.sort((a, b) => a.time - b.time);
  }

  /**
   * Check if there are pending events
   */
  hasPendingEvents(): boolean {
    return this.timers.size > 0 || this.intervals.size > 0;
  }

  /**
   * Process all pending events up to current time
   */
  flushPendingEvents(): void {
    let nextEvent = this.getNextEvent();
    while (nextEvent && nextEvent.time <= this.currentTime) {
      this.processEvent(nextEvent);
      nextEvent = this.getNextEvent();
    }
  }

  /**
   * Reset time provider to initial state
   */
  reset(initialTime?: number): void {
    this.currentTime = initialTime ?? Date.now();
    this.timers.clear();
    this.intervals.clear();
    this.nextId = 1;
  }

  /**
   * Create a promise that resolves after a delay
   */
  delay(ms: number): Promise<void> {
    return new Promise(resolve => {
      this.setTimeout(resolve, ms);
    });
  }

  /**
   * Wait until specific time
   */
  waitUntil(time: number): Promise<void> {
    if (time <= this.currentTime) {
      return Promise.resolve();
    }

    return new Promise(resolve => {
      this.setTimeout(resolve, time - this.currentTime);
    });
  }

  private getNextEvent(): { time: number; id: number; type: 'timeout' | 'interval' } | null {
    let nextEvent: { time: number; id: number; type: 'timeout' | 'interval' } | null = null;

    // Check timeouts
    for (const timer of this.timers.values()) {
      if (!nextEvent || timer.executeTime < nextEvent.time) {
        nextEvent = {
          time: timer.executeTime,
          id: timer.id,
          type: 'timeout',
        };
      }
    }

    // Check intervals
    for (const interval of this.intervals.values()) {
      if (!nextEvent || interval.nextExecuteTime < nextEvent.time) {
        nextEvent = {
          time: interval.nextExecuteTime,
          id: interval.id,
          type: 'interval',
        };
      }
    }

    return nextEvent;
  }

  private processEvent(event: { time: number; id: number; type: 'timeout' | 'interval' }): void {
    if (event.type === 'timeout') {
      const timer = this.timers.get(event.id);
      if (timer) {
        this.timers.delete(event.id);
        timer.callback();
      }
    } else if (event.type === 'interval') {
      const interval = this.intervals.get(event.id);
      if (interval) {
        // Schedule next execution
        interval.nextExecuteTime += interval.delay;
        interval.callback();
      }
    }
  }
}

interface TestTimer {
  id: number;
  callback: () => void;
  executeTime: number;
  delay: number;
  type: 'timeout';
}

interface TestInterval {
  id: number;
  callback: () => void;
  nextExecuteTime: number;
  delay: number;
  type: 'interval';
}

/**
 * Time travel utilities for testing time-dependent code
 */
export class TimeTravel {
  private timeProvider: TestTimeProvider;
  private checkpoints: Array<{ name: string; time: number }> = [];

  constructor(timeProvider: TestTimeProvider) {
    this.timeProvider = timeProvider;
  }

  /**
   * Create a checkpoint at current time
   */
  createCheckpoint(name: string): void {
    this.checkpoints.push({
      name,
      time: this.timeProvider.now(),
    });
  }

  /**
   * Return to a specific checkpoint
   */
  returnToCheckpoint(name: string): void {
    const checkpoint = this.checkpoints.find(cp => cp.name === name);
    if (!checkpoint) {
      throw new Error(`Checkpoint '${name}' not found`);
    }
    this.timeProvider.setTime(checkpoint.time);
  }

  /**
   * Jump to a specific date/time
   */
  jumpTo(date: Date | number): void {
    const time = typeof date === 'number' ? date : date.getTime();
    this.timeProvider.setTime(time);
  }

  /**
   * Go back in time by specified duration
   */
  goBack(ms: number): void {
    const newTime = this.timeProvider.now() - ms;
    this.timeProvider.setTime(newTime);
  }

  /**
   * Fast forward by specified duration
   */
  fastForward(ms: number): void {
    this.timeProvider.advanceTime(ms);
  }

  /**
   * Freeze time at current moment
   */
  freeze(): TimeFreeze {
    return new TimeFreeze(this.timeProvider);
  }

  /**
   * Get all checkpoints
   */
  getCheckpoints(): Array<{ name: string; time: number; date: Date }> {
    return this.checkpoints.map(cp => ({
      ...cp,
      date: new Date(cp.time),
    }));
  }

  /**
   * Clear all checkpoints
   */
  clearCheckpoints(): void {
    this.checkpoints = [];
  }
}

/**
 * Represents frozen time that can be unfrozen
 */
export class TimeFreeze {
  private timeProvider: TestTimeProvider;
  private frozenTime: number;

  constructor(timeProvider: TestTimeProvider) {
    this.timeProvider = timeProvider;
    this.frozenTime = timeProvider.now();
  }

  /**
   * Unfreeze time and resume normal flow
   */
  unfreeze(): void {
    // Time resumes from where it was frozen
    // Any scheduled events will execute normally
    this.timeProvider.flushPendingEvents();
  }

  /**
   * Get the frozen time
   */
  getFrozenTime(): number {
    return this.frozenTime;
  }

  /**
   * Check if any events would have occurred during freeze
   */
  getSkippedEvents(): Array<{ id: number; type: string; scheduledTime: number }> {
    return this.timeProvider
      .getPendingEvents()
      .filter(event => event.time <= this.frozenTime)
      .map(event => ({
        id: event.id,
        type: event.type,
        scheduledTime: event.time,
      }));
  }
}

/**
 * Time-based test scenarios for common patterns
 */
export class TimeTestScenarios {
  private timeProvider: TestTimeProvider;

  constructor(timeProvider: TestTimeProvider) {
    this.timeProvider = timeProvider;
  }

  /**
   * Test timeout behavior
   */
  async testTimeout(
    asyncOperation: () => Promise<any>,
    timeoutMs: number,
    shouldTimeout: boolean = true
  ): Promise<{ result?: any; timedOut: boolean; duration: number }> {
    const startTime = this.timeProvider.now();

    const timeoutPromise = new Promise((_, reject) => {
      this.timeProvider.setTimeout(() => {
        reject(new Error('Operation timed out'));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([asyncOperation(), timeoutPromise]);
      const duration = this.timeProvider.now() - startTime;

      return {
        result,
        timedOut: false,
        duration,
      };
    } catch (error) {
      const duration = this.timeProvider.now() - startTime;
      const timedOut = error instanceof Error && error.message === 'Operation timed out';

      if (shouldTimeout && !timedOut) {
        throw error; // Unexpected error
      }

      return {
        timedOut,
        duration,
      };
    }
  }

  /**
   * Test retry logic with backoff
   */
  async testRetryWithBackoff(
    operation: () => Promise<any>,
    maxRetries: number,
    baseDelay: number,
    backoffMultiplier: number = 2
  ): Promise<{ attempts: number; totalDuration: number; success: boolean }> {
    const startTime = this.timeProvider.now();
    let attempts = 0;
    let currentDelay = baseDelay;

    while (attempts <= maxRetries) {
      attempts++;

      try {
        await operation();
        return {
          attempts,
          totalDuration: this.timeProvider.now() - startTime,
          success: true,
        };
      } catch (error) {
        if (attempts <= maxRetries) {
          // Wait for delay before retry
          await this.timeProvider.delay(currentDelay);
          currentDelay *= backoffMultiplier;
        }
      }
    }

    return {
      attempts,
      totalDuration: this.timeProvider.now() - startTime,
      success: false,
    };
  }

  /**
   * Test periodic operations
   */
  async testPeriodicOperation(
    operation: () => void,
    interval: number,
    duration: number
  ): Promise<{ executionCount: number; averageInterval: number }> {
    const executions: number[] = [];
    let executionCount = 0;

    const intervalId = this.timeProvider.setInterval(() => {
      executions.push(this.timeProvider.now());
      executionCount++;
      operation();
    }, interval);

    // Let time advance for the specified duration
    this.timeProvider.advanceTime(duration);
    this.timeProvider.clearInterval(intervalId);

    // Calculate average interval
    let totalInterval = 0;
    for (let i = 1; i < executions.length; i++) {
      totalInterval += executions[i] - executions[i - 1];
    }
    const averageInterval = executions.length > 1 ? totalInterval / (executions.length - 1) : 0;

    return {
      executionCount,
      averageInterval,
    };
  }

  /**
   * Test race conditions
   */
  async testRaceCondition(
    operations: Array<() => Promise<any>>,
    delays: number[]
  ): Promise<{ winner: number; results: any[]; durations: number[] }> {
    const startTime = this.timeProvider.now();
    const promises = operations.map((operation, index) => {
      const delay = delays[index] || 0;

      return this.timeProvider.delay(delay).then(async () => {
        const result = await operation();
        return {
          index,
          result,
          completedAt: this.timeProvider.now(),
        };
      });
    });

    const results = await Promise.allSettled(promises);
    const successful = results
      .map((result, index) => ({ result, index }))
      .filter(({ result }) => result.status === 'fulfilled')
      .map(({ result, index }) => ({
        ...((result as PromiseFulfilledResult<any>).value as any),
        originalIndex: index,
      }))
      .sort((a, b) => a.completedAt - b.completedAt);

    const winner = successful.length > 0 ? successful[0].index : -1;
    const finalResults = results.map(r => (r.status === 'fulfilled' ? r.value : r.reason));
    const durations = successful.map(s => s.completedAt - startTime);

    return {
      winner,
      results: finalResults,
      durations,
    };
  }
}
