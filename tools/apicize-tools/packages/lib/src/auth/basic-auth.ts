import { AuthProvider, AuthResult } from './auth-manager';
import { BasicAuthorization, AuthorizationType } from '../types';

export class BasicAuthProvider extends AuthProvider {
  private basicAuth: BasicAuthorization;

  constructor(authorization: BasicAuthorization) {
    super(authorization);
    this.basicAuth = authorization;
  }

  async getHeaders(): Promise<AuthResult> {
    if (!this.isValid()) {
      return this.createAuthResult([], false, 'Basic auth configuration is invalid');
    }

    try {
      const credentials = `${this.basicAuth.username}:${this.basicAuth.password}`;
      const encoded = Buffer.from(credentials, 'utf-8').toString('base64');

      const headers = this.createHeaders({
        Authorization: `Basic ${encoded}`,
      });

      return this.createAuthResult(headers);
    } catch (error) {
      return this.createAuthResult([], false, `Failed to encode basic auth credentials: ${error}`);
    }
  }

  isValid(): boolean {
    return !!(
      this.basicAuth.username &&
      this.basicAuth.password &&
      this.basicAuth.type === AuthorizationType.Basic
    );
  }

  getType(): AuthorizationType {
    return AuthorizationType.Basic;
  }

  getUsername(): string {
    return this.basicAuth.username;
  }

  // Utility method to test credentials format
  static validateCredentials(username: string, password: string): boolean {
    return !!(username && password && typeof username === 'string' && typeof password === 'string');
  }

  // Utility method to decode a Basic auth header for testing
  static decodeBasicAuth(authHeader: string): { username: string; password: string } | null {
    try {
      const match = authHeader.match(/^Basic\s+(.+)$/);
      if (!match) return null;

      const decoded = Buffer.from(match[1], 'base64').toString('utf-8');
      const colonIndex = decoded.indexOf(':');
      if (colonIndex === -1) return null;

      return {
        username: decoded.substring(0, colonIndex),
        password: decoded.substring(colonIndex + 1),
      };
    } catch {
      return null;
    }
  }
}
