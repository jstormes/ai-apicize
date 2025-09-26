import { AuthProvider, AuthResult } from './auth-manager';
import { ApiKeyAuthorization, AuthorizationType } from '../types';

export class ApiKeyAuthProvider extends AuthProvider {
  private apiKeyAuth: ApiKeyAuthorization;

  constructor(authorization: ApiKeyAuthorization) {
    super(authorization);
    this.apiKeyAuth = authorization;
  }

  async getHeaders(): Promise<AuthResult> {
    if (!this.isValid()) {
      return this.createAuthResult([], false, 'API Key auth configuration is invalid');
    }

    try {
      const headers = this.createHeaders({
        [this.apiKeyAuth.header]: this.apiKeyAuth.value,
      });

      return this.createAuthResult(headers);
    } catch (error) {
      return this.createAuthResult([], false, `Failed to create API key headers: ${error}`);
    }
  }

  isValid(): boolean {
    return !!(
      this.apiKeyAuth.header &&
      this.apiKeyAuth.value &&
      this.apiKeyAuth.type === AuthorizationType.ApiKey &&
      this.isValidHeaderName(this.apiKeyAuth.header)
    );
  }

  getType(): AuthorizationType {
    return AuthorizationType.ApiKey;
  }

  getHeaderName(): string {
    return this.apiKeyAuth.header;
  }

  // Utility method to validate header names
  private isValidHeaderName(name: string): boolean {
    // Basic validation for HTTP header names
    // Headers should contain only valid characters and not be empty
    return /^[a-zA-Z0-9!#$&'*+.^_`|~-]+$/.test(name);
  }

  // Utility method to test if a value looks like an API key
  static isValidApiKeyValue(value: string): boolean {
    return !!(
      value &&
      typeof value === 'string' &&
      value.trim().length > 0 &&
      value.length >= 8 // Minimum reasonable API key length
    );
  }

  // Common API key header patterns
  static getCommonHeaders(): Array<{ name: string; description: string }> {
    return [
      { name: 'X-API-Key', description: 'Generic API key header' },
      { name: 'Authorization', description: 'Bearer token in Authorization header' },
      { name: 'X-Auth-Token', description: 'Authentication token header' },
      { name: 'X-RapidAPI-Key', description: 'RapidAPI key header' },
      { name: 'X-Mashape-Key', description: 'Mashape key header' },
      { name: 'apikey', description: 'Simple lowercase apikey header' },
      { name: 'api-key', description: 'Hyphenated api-key header' },
    ];
  }

  // Utility to create bearer token format
  static createBearerToken(token: string): { header: string; value: string } {
    return {
      header: 'Authorization',
      value: `Bearer ${token}`,
    };
  }
}
