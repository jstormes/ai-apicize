import { ApicizeContext, RequestConfig } from './types';
import { ApicizeResponse } from '@apicize/lib';
import { ApicizeClient } from './client';

export class TestContext implements ApicizeContext {
  public $: Record<string, any> = {};

  constructor(
    private client: ApicizeClient,
    variables: Record<string, any> = {}
  ) {
    this.$ = { ...variables };
  }

  async execute(request: RequestConfig): Promise<ApicizeResponse> {
    return this.client.execute(request);
  }

  substituteVariables(text: string): string {
    return text.replace(/\{\{([^}]+)\}\}/g, (match, variable) => {
      const value = this.getNestedProperty(this.$, variable.trim());
      return value !== undefined ? String(value) : match;
    });
  }

  output(key: string, value: any): void {
    this.$[key] = value;
  }

  private getNestedProperty(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }
}
