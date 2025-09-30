export class OutputCollector {
  private outputs: Map<string, any> = new Map();

  collect(key: string, value: any): void {
    this.outputs.set(key, value);
  }

  get(key: string): any {
    return this.outputs.get(key);
  }

  getAll(): Record<string, any> {
    return Object.fromEntries(this.outputs.entries());
  }

  clear(): void {
    this.outputs.clear();
  }
}
