/**
 * Performance monitoring system for Phase 4: Performance & Reliability improvements
 * Provides comprehensive performance tracking, metrics collection, and monitoring hooks
 */

import { Telemetry, TelemetrySpan } from './interfaces';
import { ApicizeError, ApicizeErrorCode } from './errors';

/**
 * Performance metric types
 */
export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  TIMER = 'timer',
}

/**
 * Performance metric
 */
export interface PerformanceMetric {
  name: string;
  type: MetricType;
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
  unit?: string;
}

/**
 * Operation timing information
 */
export interface TimingInfo {
  startTime: number;
  endTime?: number;
  duration?: number;
  operationName: string;
  success: boolean;
  error?: Error;
  metadata?: Record<string, unknown>;
}

/**
 * Performance benchmark result
 */
export interface BenchmarkResult {
  operationName: string;
  iterations: number;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  medianTime: number;
  percentiles: Record<number, number>;
  opsPerSecond: number;
  memoryUsage?: NodeJS.MemoryUsage;
}

/**
 * Memory usage tracking
 */
export interface MemorySnapshot {
  timestamp: number;
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
  arrayBuffers: number;
}

/**
 * Performance monitoring configuration
 */
export interface PerformanceConfig {
  enableMetrics: boolean;
  enableTiming: boolean;
  enableMemoryTracking: boolean;
  enableBenchmarking: boolean;
  metricsBufferSize: number;
  timingBufferSize: number;
  memoryTrackingInterval: number;
  enableAutoGC: boolean;
  gcThreshold: number;
}

/**
 * Performance event listener interface
 */
export interface PerformanceEventListener {
  onMetric?(metric: PerformanceMetric): void;
  onTiming?(timing: TimingInfo): void;
  onMemorySnapshot?(snapshot: MemorySnapshot): void;
  onBenchmarkComplete?(result: BenchmarkResult): void;
  onThresholdExceeded?(metric: PerformanceMetric, threshold: number): void;
}

/**
 * Performance threshold configuration
 */
export interface PerformanceThreshold {
  metricName: string;
  threshold: number;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  action: 'log' | 'alert' | 'throw';
}

/**
 * Performance monitor implementation
 */
export class PerformanceMonitor {
  private config: PerformanceConfig;
  private metrics: PerformanceMetric[] = [];
  private timings: TimingInfo[] = [];
  private memorySnapshots: MemorySnapshot[] = [];
  private listeners: PerformanceEventListener[] = [];
  private thresholds: PerformanceThreshold[] = [];
  private memoryTrackingTimer?: NodeJS.Timeout;
  private activeTimers = new Map<string, number>();

  constructor(config: Partial<PerformanceConfig> = {}) {
    this.config = {
      enableMetrics: true,
      enableTiming: true,
      enableMemoryTracking: false,
      enableBenchmarking: true,
      metricsBufferSize: 1000,
      timingBufferSize: 1000,
      memoryTrackingInterval: 5000,
      enableAutoGC: false,
      gcThreshold: 0.8, // 80% heap usage
      ...config,
    };

    if (this.config.enableMemoryTracking) {
      this.startMemoryTracking();
    }
  }

  /**
   * Record a metric
   */
  recordMetric(
    name: string,
    value: number,
    type: MetricType = MetricType.GAUGE,
    labels?: Record<string, string>,
    unit?: string
  ): void {
    if (!this.config.enableMetrics) return;

    const metric: PerformanceMetric = {
      name,
      type,
      value,
      timestamp: Date.now(),
      labels,
      unit,
    };

    this.metrics.push(metric);
    this.trimBuffer(this.metrics, this.config.metricsBufferSize);

    // Notify listeners
    this.listeners.forEach(listener => listener.onMetric?.(metric));

    // Check thresholds
    this.checkThresholds(metric);

    // Auto GC if enabled and threshold exceeded
    if (this.config.enableAutoGC) {
      this.checkAutoGC();
    }
  }

  /**
   * Start timing an operation
   */
  startTiming(operationName: string): string {
    if (!this.config.enableTiming) return operationName;

    const timerId = `${operationName}_${Date.now()}_${Math.random()}`;
    this.activeTimers.set(timerId, Date.now());
    return timerId;
  }

  /**
   * End timing an operation
   */
  endTiming(
    timerId: string,
    operationName?: string,
    success: boolean = true,
    error?: Error,
    metadata?: Record<string, unknown>
  ): TimingInfo | undefined {
    if (!this.config.enableTiming) return undefined;

    const startTime = this.activeTimers.get(timerId);
    if (!startTime) {
      console.warn(`Timer not found: ${timerId}`);
      return undefined;
    }

    this.activeTimers.delete(timerId);
    const endTime = Date.now();
    const duration = endTime - startTime;

    const timing: TimingInfo = {
      startTime,
      endTime,
      duration,
      operationName: operationName || timerId.split('_')[0],
      success,
      error,
      metadata,
    };

    this.timings.push(timing);
    this.trimBuffer(this.timings, this.config.timingBufferSize);

    // Record as metric
    this.recordMetric(
      `operation_duration_ms`,
      duration,
      MetricType.HISTOGRAM,
      {
        operation: timing.operationName,
        success: success.toString(),
      },
      'ms'
    );

    // Notify listeners
    this.listeners.forEach(listener => listener.onTiming?.(timing));

    return timing;
  }

  /**
   * Time an async operation
   */
  async timeOperation<T>(
    operationName: string,
    operation: () => Promise<T>,
    metadata?: Record<string, unknown>
  ): Promise<T> {
    const timerId = this.startTiming(operationName);
    let success = true;
    let error: Error | undefined;

    try {
      const result = await operation();
      return result;
    } catch (err) {
      success = false;
      error = err as Error;
      throw err;
    } finally {
      this.endTiming(timerId, operationName, success, error, metadata);
    }
  }

  /**
   * Time a synchronous operation
   */
  timeSync<T>(operationName: string, operation: () => T, metadata?: Record<string, unknown>): T {
    const timerId = this.startTiming(operationName);
    let success = true;
    let error: Error | undefined;

    try {
      const result = operation();
      return result;
    } catch (err) {
      success = false;
      error = err as Error;
      throw err;
    } finally {
      this.endTiming(timerId, operationName, success, error, metadata);
    }
  }

  /**
   * Benchmark an operation
   */
  async benchmark<T>(
    operationName: string,
    operation: () => Promise<T> | T,
    iterations: number = 100
  ): Promise<BenchmarkResult> {
    if (!this.config.enableBenchmarking) {
      throw new ApicizeError(ApicizeErrorCode.CONFIGURATION_ERROR, 'Benchmarking is disabled');
    }

    const times: number[] = [];
    const memoryBefore = process.memoryUsage();

    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      try {
        await operation();
      } catch (error) {
        console.warn(`Benchmark iteration ${i} failed:`, error);
      }
      const end = Date.now();
      times.push(end - start);
    }

    const memoryAfter = process.memoryUsage();
    const totalTime = times.reduce((sum, time) => sum + time, 0);
    const averageTime = totalTime / iterations;
    const sortedTimes = times.sort((a, b) => a - b);
    const minTime = sortedTimes[0];
    const maxTime = sortedTimes[sortedTimes.length - 1];
    const medianTime = sortedTimes[Math.floor(sortedTimes.length / 2)];

    const percentiles: Record<number, number> = {};
    [50, 75, 90, 95, 99].forEach(p => {
      const index = Math.floor((p / 100) * sortedTimes.length);
      percentiles[p] = sortedTimes[Math.min(index, sortedTimes.length - 1)];
    });

    const result: BenchmarkResult = {
      operationName,
      iterations,
      totalTime,
      averageTime,
      minTime,
      maxTime,
      medianTime,
      percentiles,
      opsPerSecond: iterations / (totalTime / 1000),
      memoryUsage: {
        rss: memoryAfter.rss - memoryBefore.rss,
        heapTotal: memoryAfter.heapTotal - memoryBefore.heapTotal,
        heapUsed: memoryAfter.heapUsed - memoryBefore.heapUsed,
        external: memoryAfter.external - memoryBefore.external,
        arrayBuffers: memoryAfter.arrayBuffers - memoryBefore.arrayBuffers,
      },
    };

    // Notify listeners
    this.listeners.forEach(listener => listener.onBenchmarkComplete?.(result));

    return result;
  }

  /**
   * Take a memory snapshot
   */
  takeMemorySnapshot(): MemorySnapshot {
    const usage = process.memoryUsage();
    const snapshot: MemorySnapshot = {
      timestamp: Date.now(),
      rss: usage.rss,
      heapTotal: usage.heapTotal,
      heapUsed: usage.heapUsed,
      external: usage.external,
      arrayBuffers: usage.arrayBuffers,
    };

    this.memorySnapshots.push(snapshot);
    this.trimBuffer(this.memorySnapshots, this.config.metricsBufferSize);

    // Notify listeners
    this.listeners.forEach(listener => listener.onMemorySnapshot?.(snapshot));

    return snapshot;
  }

  /**
   * Add performance event listener
   */
  addListener(listener: PerformanceEventListener): void {
    this.listeners.push(listener);
  }

  /**
   * Remove performance event listener
   */
  removeListener(listener: PerformanceEventListener): void {
    const index = this.listeners.indexOf(listener);
    if (index >= 0) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Add performance threshold
   */
  addThreshold(threshold: PerformanceThreshold): void {
    this.thresholds.push(threshold);
  }

  /**
   * Get current metrics
   */
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  /**
   * Get timing information
   */
  getTimings(): TimingInfo[] {
    return [...this.timings];
  }

  /**
   * Get memory snapshots
   */
  getMemorySnapshots(): MemorySnapshot[] {
    return [...this.memorySnapshots];
  }

  /**
   * Get performance summary
   */
  getSummary(): {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    averageOperationTime: number;
    currentMemoryUsage: NodeJS.MemoryUsage;
    metrics: { [key: string]: PerformanceMetric[] };
  } {
    const totalOperations = this.timings.length;
    const successfulOperations = this.timings.filter(t => t.success).length;
    const failedOperations = totalOperations - successfulOperations;
    const averageOperationTime =
      this.timings.length > 0
        ? this.timings.reduce((sum, t) => sum + (t.duration || 0), 0) / this.timings.length
        : 0;

    const metrics: { [key: string]: PerformanceMetric[] } = {};
    this.metrics.forEach(metric => {
      if (!metrics[metric.name]) {
        metrics[metric.name] = [];
      }
      metrics[metric.name].push(metric);
    });

    return {
      totalOperations,
      successfulOperations,
      failedOperations,
      averageOperationTime,
      currentMemoryUsage: process.memoryUsage(),
      metrics,
    };
  }

  /**
   * Clear all collected data
   */
  clear(): void {
    this.metrics = [];
    this.timings = [];
    this.memorySnapshots = [];
    this.activeTimers.clear();
  }

  /**
   * Export data for analysis
   */
  exportData(): {
    metrics: PerformanceMetric[];
    timings: TimingInfo[];
    memorySnapshots: MemorySnapshot[];
    summary: ReturnType<PerformanceMonitor['getSummary']>;
  } {
    return {
      metrics: this.getMetrics(),
      timings: this.getTimings(),
      memorySnapshots: this.getMemorySnapshots(),
      summary: this.getSummary(),
    };
  }

  /**
   * Dispose monitor and cleanup resources
   */
  dispose(): void {
    if (this.memoryTrackingTimer) {
      clearInterval(this.memoryTrackingTimer);
      this.memoryTrackingTimer = undefined;
    }
    this.clear();
    this.listeners = [];
    this.thresholds = [];
  }

  // Private methods

  private startMemoryTracking(): void {
    this.memoryTrackingTimer = setInterval(() => {
      this.takeMemorySnapshot();
    }, this.config.memoryTrackingInterval);
  }

  private trimBuffer<T>(buffer: T[], maxSize: number): void {
    if (buffer.length > maxSize) {
      buffer.splice(0, buffer.length - maxSize);
    }
  }

  private checkThresholds(metric: PerformanceMetric): void {
    for (const threshold of this.thresholds) {
      if (threshold.metricName === metric.name) {
        const exceeded = this.evaluateThreshold(metric.value, threshold);
        if (exceeded) {
          this.handleThresholdExceeded(metric, threshold);
        }
      }
    }
  }

  private evaluateThreshold(value: number, threshold: PerformanceThreshold): boolean {
    switch (threshold.operator) {
      case 'gt':
        return value > threshold.threshold;
      case 'lt':
        return value < threshold.threshold;
      case 'eq':
        return value === threshold.threshold;
      case 'gte':
        return value >= threshold.threshold;
      case 'lte':
        return value <= threshold.threshold;
      default:
        return false;
    }
  }

  private handleThresholdExceeded(
    metric: PerformanceMetric,
    threshold: PerformanceThreshold
  ): void {
    // Notify listeners
    this.listeners.forEach(listener => listener.onThresholdExceeded?.(metric, threshold.threshold));

    switch (threshold.action) {
      case 'log':
        console.warn(
          `Performance threshold exceeded: ${metric.name} = ${metric.value}, threshold = ${threshold.threshold}`
        );
        break;
      case 'alert':
        console.error(
          `ALERT: Performance threshold exceeded: ${metric.name} = ${metric.value}, threshold = ${threshold.threshold}`
        );
        break;
      case 'throw':
        throw new ApicizeError(
          ApicizeErrorCode.PERFORMANCE_THRESHOLD_EXCEEDED,
          `Performance threshold exceeded: ${metric.name} = ${metric.value}, threshold = ${threshold.threshold}`
        );
    }
  }

  private checkAutoGC(): void {
    const usage = process.memoryUsage();
    const heapUsageRatio = usage.heapUsed / usage.heapTotal;

    if (heapUsageRatio > this.config.gcThreshold) {
      if (global.gc) {
        global.gc();
        this.recordMetric('gc_triggered', 1, MetricType.COUNTER);
      }
    }
  }
}

/**
 * Telemetry span implementation for performance monitoring
 */
export class ApicizeTelemetrySpan implements TelemetrySpan {
  private attributes: Record<string, unknown> = {};
  private startTime: number = Date.now();
  private ended = false;

  constructor(
    private name: string,
    private monitor: PerformanceMonitor,
    initialAttributes?: Record<string, unknown>
  ) {
    if (initialAttributes) {
      this.attributes = { ...initialAttributes };
    }
  }

  setAttribute(key: string, value: unknown): void {
    this.attributes[key] = value;
  }

  setAttributes(attributes: Record<string, unknown>): void {
    Object.assign(this.attributes, attributes);
  }

  recordException(exception: Error): void {
    this.setAttribute('exception.type', exception.name);
    this.setAttribute('exception.message', exception.message);
    this.setAttribute('exception.stack', exception.stack);
  }

  setStatus(status: 'ok' | 'error', message?: string): void {
    this.setAttribute('status', status);
    if (message) {
      this.setAttribute('status.message', message);
    }
  }

  end(): void {
    if (this.ended) return;

    this.ended = true;
    const duration = Date.now() - this.startTime;

    this.monitor.recordMetric(
      'span_duration_ms',
      duration,
      MetricType.HISTOGRAM,
      {
        span_name: this.name,
        status: this.attributes.status?.toString() || 'unknown',
      },
      'ms'
    );
  }
}

/**
 * Telemetry implementation for performance monitoring
 */
export class ApicizeTelemetry implements Telemetry {
  constructor(private monitor: PerformanceMonitor) {}

  startSpan(name: string, attributes?: Record<string, unknown>): TelemetrySpan {
    return new ApicizeTelemetrySpan(name, this.monitor, attributes);
  }

  recordEvent(name: string, attributes?: Record<string, unknown>): void {
    this.monitor.recordMetric(name, 1, MetricType.COUNTER, attributes as Record<string, string>);
  }

  recordMetric(name: string, value: number, attributes?: Record<string, unknown>): void {
    this.monitor.recordMetric(name, value, MetricType.GAUGE, attributes as Record<string, string>);
  }
}

// Global performance monitor instance
export const globalPerformanceMonitor = new PerformanceMonitor();
