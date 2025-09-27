import { expect } from '@jest/globals';
import { ApicizeWorkbook } from '../types';

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidWorkbook(): R;
      toHaveRequestWithId(id: string): R;
      toHaveScenarioWithName(name: string): R;
      toHaveAuthorizationType(type: string): R;
      toHaveStatusCode(code: number): R;
      toContainHeader(name: string, value?: string): R;
      toHaveBodyType(type: string): R;
      toBeValidRequest(): R;
    }
  }
}

/**
 * Custom matcher to check if an object is a valid workbook
 */
expect.extend({
  toBeValidWorkbook(received: any) {
    const pass =
      received !== null &&
      typeof received === 'object' &&
      typeof received.version === 'number' &&
      received.version === 1.0 &&
      (received.requests === undefined || Array.isArray(received.requests));

    if (pass) {
      return {
        message: () => `expected ${JSON.stringify(received)} not to be a valid workbook`,
        pass: true,
      };
    } else {
      const issues: string[] = [];
      if (!received) issues.push('value is null or undefined');
      if (typeof received !== 'object') issues.push('value is not an object');
      if (typeof received?.version !== 'number') issues.push('version is not a number');
      if (received?.version !== 1.0) issues.push(`version is ${received?.version}, expected 1.0`);
      if (received?.requests !== undefined && !Array.isArray(received.requests)) {
        issues.push('requests is not an array');
      }

      return {
        message: () => `expected value to be a valid workbook\nIssues: ${issues.join(', ')}`,
        pass: false,
      };
    }
  },

  /**
   * Check if workbook has a request with specific ID
   */
  toHaveRequestWithId(received: ApicizeWorkbook, id: string) {
    const findRequest = (items: any[]): boolean => {
      for (const item of items) {
        if (item.id === id) return true;
        if (item.children && Array.isArray(item.children)) {
          if (findRequest(item.children)) return true;
        }
      }
      return false;
    };

    const pass = received.requests && findRequest(received.requests);

    return {
      pass,
      message: () =>
        pass
          ? `expected workbook not to have request with id "${id}"`
          : `expected workbook to have request with id "${id}"`,
    };
  },

  /**
   * Check if workbook has a scenario with specific name
   */
  toHaveScenarioWithName(received: ApicizeWorkbook, name: string) {
    const pass = received.scenarios?.some(s => s.name === name) ?? false;

    return {
      pass,
      message: () =>
        pass
          ? `expected workbook not to have scenario with name "${name}"`
          : `expected workbook to have scenario with name "${name}"`,
    };
  },

  /**
   * Check if workbook has an authorization of specific type
   */
  toHaveAuthorizationType(received: ApicizeWorkbook, type: string) {
    const pass = received.authorizations?.some(a => a.type === type) ?? false;

    return {
      pass,
      message: () =>
        pass
          ? `expected workbook not to have authorization of type "${type}"`
          : `expected workbook to have authorization of type "${type}"`,
    };
  },

  /**
   * Check response status code
   */
  toHaveStatusCode(received: any, code: number) {
    const actualCode = received?.status || received?.statusCode;
    const pass = actualCode === code;

    return {
      pass,
      message: () =>
        pass
          ? `expected response not to have status code ${code}`
          : `expected response to have status code ${code}, but got ${actualCode}`,
    };
  },

  /**
   * Check if headers contain specific header
   */
  toContainHeader(received: any, name: string, value?: string) {
    const headers = received?.headers || received;

    let found = false;
    let actualValue: string | undefined;

    if (Array.isArray(headers)) {
      const header = headers.find(h => h.name === name);
      found = !!header;
      actualValue = header?.value;
    } else if (headers instanceof Headers) {
      found = headers.has(name);
      actualValue = headers.get(name) || undefined;
    } else if (typeof headers === 'object') {
      found = name in headers;
      actualValue = headers[name];
    }

    const pass = value === undefined ? found : (found && actualValue === value);

    return {
      pass,
      message: () => {
        if (value === undefined) {
          return pass
            ? `expected headers not to contain "${name}"`
            : `expected headers to contain "${name}"`;
        } else {
          return pass
            ? `expected headers not to contain "${name}: ${value}"`
            : `expected headers to contain "${name}: ${value}", but got "${name}: ${actualValue}"`;
        }
      },
    };
  },

  /**
   * Check body type
   */
  toHaveBodyType(received: any, type: string) {
    const bodyType = received?.body?.type || received?.type;
    const pass = bodyType === type;

    return {
      pass,
      message: () =>
        pass
          ? `expected body type not to be "${type}"`
          : `expected body type to be "${type}", but got "${bodyType}"`,
    };
  },

  /**
   * Check if object is a valid request
   */
  toBeValidRequest(received: any) {
    const issues: string[] = [];

    if (!received?.id) issues.push('missing id');
    if (!received?.name) issues.push('missing name');
    if (!received?.url && !received?.children) issues.push('missing url (required for requests)');
    if (!received?.method && !received?.children) issues.push('missing method (required for requests)');

    const pass = issues.length === 0;

    return {
      pass,
      message: () =>
        pass
          ? `expected object not to be a valid request`
          : `expected object to be a valid request\nIssues: ${issues.join(', ')}`,
    };
  },
});

/**
 * Helper function to validate response structure
 */
export function expectValidResponse(response: any) {
  expect(response).toBeDefined();
  expect(response).toHaveProperty('status');
  expect(response).toHaveProperty('headers');
  expect(response).toHaveProperty('body');
}

/**
 * Helper function to validate error structure
 */
export function expectValidError(error: any, expectedMessage?: string | RegExp) {
  expect(error).toBeInstanceOf(Error);
  if (expectedMessage) {
    if (typeof expectedMessage === 'string') {
      expect(error.message).toContain(expectedMessage);
    } else {
      expect(error.message).toMatch(expectedMessage);
    }
  }
}

/**
 * Helper to check validation errors
 */
export function expectValidationErrors(result: any, expectedCount?: number) {
  expect(result).toHaveProperty('valid', false);
  expect(result).toHaveProperty('errors');
  expect(Array.isArray(result.errors)).toBe(true);

  if (expectedCount !== undefined) {
    expect(result.errors).toHaveLength(expectedCount);
  } else {
    expect(result.errors.length).toBeGreaterThan(0);
  }
}

/**
 * Helper to check successful validation
 */
export function expectValidationSuccess(result: any) {
  expect(result).toHaveProperty('valid', true);
  expect(result).toHaveProperty('errors');
  expect(result.errors).toHaveLength(0);
}