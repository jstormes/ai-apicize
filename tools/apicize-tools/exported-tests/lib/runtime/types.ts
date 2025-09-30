import { ApicizeResponse, BodyType } from '@apicize/lib';

export interface ApicizeContext {
  $: Record<string, any>;
  execute(request: RequestConfig): Promise<ApicizeResponse>;
  substituteVariables(text: string): string;
  output(key: string, value: any): void;
}

export interface RequestConfig {
  url: string;
  method: string;
  headers?: Array<{ name: string; value: string }>;
  body?: any;
  queryStringParams?: Array<{ name: string; value: string }>;
  timeout?: number;
  auth?: string;
  service?: string;
  endpoint?: string;
}

export interface TestConfig {
  scenario?: string;
  environment?: string;
  auth?: string;
  timeout?: number;
}

export { ApicizeResponse, BodyType };
