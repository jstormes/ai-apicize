import { Authorization, AuthorizationType, NameValuePair } from '../types';

export interface AuthResult {
  headers: NameValuePair[];
  success: boolean;
  error?: string;
}

export interface TokenInfo {
  accessToken: string;
  tokenType?: string;
  expiresAt?: number;
  refreshToken?: string;
}

export abstract class AuthProvider {
  protected authorization: Authorization;

  constructor(authorization: Authorization) {
    this.authorization = authorization;
  }

  abstract getHeaders(): Promise<AuthResult>;

  abstract isValid(): boolean;

  abstract getType(): AuthorizationType;

  protected createHeaders(headers: Record<string, string>): NameValuePair[] {
    return Object.entries(headers).map(([name, value]) => ({ name, value }));
  }

  protected createAuthResult(
    headers: NameValuePair[],
    success: boolean = true,
    error?: string
  ): AuthResult {
    const result: AuthResult = { headers, success };
    if (error !== undefined) {
      result.error = error;
    }
    return result;
  }
}

export class AuthManager {
  private providers: Map<string, AuthProvider> = new Map();
  private tokenCache: Map<string, TokenInfo> = new Map();

  registerProvider(id: string, provider: AuthProvider): void {
    this.providers.set(id, provider);
  }

  getProvider(id: string): AuthProvider | undefined {
    return this.providers.get(id);
  }

  async getAuthHeaders(authId: string): Promise<AuthResult> {
    const provider = this.providers.get(authId);
    if (!provider) {
      return {
        headers: [],
        success: false,
        error: `Authentication provider '${authId}' not found`,
      };
    }

    try {
      return await provider.getHeaders();
    } catch (error) {
      return {
        headers: [],
        success: false,
        error: error instanceof Error ? error.message : 'Unknown authentication error',
      };
    }
  }

  clearTokenCache(authId?: string): void {
    if (authId) {
      this.tokenCache.delete(authId);
    } else {
      this.tokenCache.clear();
    }
  }

  protected getCachedToken(authId: string): TokenInfo | undefined {
    const token = this.tokenCache.get(authId);
    if (!token) return undefined;

    // Check if token is expired (with 5 minute buffer)
    if (token.expiresAt && token.expiresAt < Date.now() + 5 * 60 * 1000) {
      this.tokenCache.delete(authId);
      return undefined;
    }

    return token;
  }

  protected setCachedToken(authId: string, token: TokenInfo): void {
    this.tokenCache.set(authId, token);
  }

  createProvider(authorization: Authorization): AuthProvider {
    switch (authorization.type) {
      case AuthorizationType.Basic:
        return new BasicAuthProvider(authorization);
      case AuthorizationType.ApiKey:
        return new ApiKeyAuthProvider(authorization);
      case AuthorizationType.OAuth2Client:
        return new OAuth2ClientAuthProvider(authorization);
      case AuthorizationType.OAuth2Pkce:
        return new OAuth2PkceAuthProvider(authorization);
      default:
        throw new Error(`Unsupported authorization type: ${(authorization as any).type}`);
    }
  }

  async createAndRegisterProvider(id: string, authorization: Authorization): Promise<void> {
    const provider = this.createProvider(authorization);
    this.registerProvider(id, provider);
  }
}

// Import specific auth provider classes
import { BasicAuthProvider } from './basic-auth';
import { ApiKeyAuthProvider } from './api-key-auth';
import { OAuth2ClientAuthProvider } from './oauth2-client-auth';
import { OAuth2PkceAuthProvider } from './oauth2-pkce-auth';
