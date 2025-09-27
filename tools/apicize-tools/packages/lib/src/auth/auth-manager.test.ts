import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { AuthManager, AuthProvider, AuthResult } from './auth-manager';
import { BasicAuthProvider } from './basic-auth';
import { ApiKeyAuthProvider } from './api-key-auth';
import { OAuth2ClientAuthProvider } from './oauth2-client-auth';
import { OAuth2PkceAuthProvider } from './oauth2-pkce-auth';
import {
  AuthorizationType,
  BasicAuthorization,
  ApiKeyAuthorization,
  OAuth2ClientAuthorization,
  OAuth2PkceAuthorization,
} from '../types';
import { FetchMockManager, createMockResponse } from '../test-utils';

describe('AuthManager', () => {
  let authManager: AuthManager;
  const fetchManager = new FetchMockManager();

  beforeEach(() => {
    authManager = new AuthManager();
    fetchManager.save();
  });

  afterEach(() => {
    fetchManager.restore();
    jest.restoreAllMocks();
  });

  describe('provider registration and retrieval', () => {
    it('should register and retrieve providers', () => {
      const basicAuth: BasicAuthorization = {
        id: '1',
        name: 'Test Basic',
        type: AuthorizationType.Basic,
        username: 'user',
        password: 'pass',
      };

      const provider = new BasicAuthProvider(basicAuth);
      authManager.registerProvider('test', provider);

      const retrieved = authManager.getProvider('test');
      expect(retrieved).toBe(provider);
    });

    it('should return undefined for non-existent provider', () => {
      const provider = authManager.getProvider('nonexistent');
      expect(provider).toBeUndefined();
    });
  });

  describe('provider creation', () => {
    it('should create BasicAuthProvider', () => {
      const auth: BasicAuthorization = {
        id: '1',
        name: 'Test Basic',
        type: AuthorizationType.Basic,
        username: 'user',
        password: 'pass',
      };

      const provider = authManager.createProvider(auth);
      expect(provider).toBeInstanceOf(BasicAuthProvider);
      expect(provider.getType()).toBe(AuthorizationType.Basic);
    });

    it('should create ApiKeyAuthProvider', () => {
      const auth: ApiKeyAuthorization = {
        id: '1',
        name: 'Test API Key',
        type: AuthorizationType.ApiKey,
        header: 'X-API-Key',
        value: 'test-key',
      };

      const provider = authManager.createProvider(auth);
      expect(provider).toBeInstanceOf(ApiKeyAuthProvider);
      expect(provider.getType()).toBe(AuthorizationType.ApiKey);
    });

    it('should create OAuth2ClientAuthProvider', () => {
      const auth: OAuth2ClientAuthorization = {
        id: '1',
        name: 'Test OAuth2',
        type: AuthorizationType.OAuth2Client,
        accessTokenUrl: 'https://auth.example.com/token',
        clientId: 'client-id',
        clientSecret: 'client-secret',
      };

      const provider = authManager.createProvider(auth);
      expect(provider).toBeInstanceOf(OAuth2ClientAuthProvider);
      expect(provider.getType()).toBe(AuthorizationType.OAuth2Client);
    });

    it('should create OAuth2PkceAuthProvider', () => {
      const auth: OAuth2PkceAuthorization = {
        id: '1',
        name: 'Test OAuth2 PKCE',
        type: AuthorizationType.OAuth2Pkce,
        authorizeUrl: 'https://auth.example.com/authorize',
        accessTokenUrl: 'https://auth.example.com/token',
        clientId: 'client-id',
      };

      const provider = authManager.createProvider(auth);
      expect(provider).toBeInstanceOf(OAuth2PkceAuthProvider);
      expect(provider.getType()).toBe(AuthorizationType.OAuth2Pkce);
    });

    it('should throw error for unsupported auth type', () => {
      const auth = {
        id: '1',
        name: 'Unsupported',
        type: 'Unsupported' as AuthorizationType,
      } as any;

      expect(() => authManager.createProvider(auth)).toThrow('Unsupported authorization type');
    });
  });

  describe('getAuthHeaders', () => {
    it('should return headers from valid provider', async () => {
      const basicAuth: BasicAuthorization = {
        id: '1',
        name: 'Test Basic',
        type: AuthorizationType.Basic,
        username: 'user',
        password: 'pass',
      };

      const provider = new BasicAuthProvider(basicAuth);
      authManager.registerProvider('test', provider);

      const result = await authManager.getAuthHeaders('test');
      expect(result.success).toBe(true);
      expect(result.headers).toHaveLength(1);
      expect(result.headers[0].name).toBe('Authorization');
      expect(result.headers[0].value).toMatch(/^Basic /);
    });

    it('should return error for non-existent provider', async () => {
      const result = await authManager.getAuthHeaders('nonexistent');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
      expect(result.headers).toHaveLength(0);
    });

    it('should handle provider errors gracefully', async () => {
      class FailingProvider extends AuthProvider {
        constructor() {
          super({
            id: '1',
            name: 'Failing',
            type: AuthorizationType.Basic,
          } as any);
        }

        async getHeaders(): Promise<AuthResult> {
          throw new Error('Provider error');
        }

        isValid(): boolean {
          return false;
        }

        getType(): AuthorizationType {
          return AuthorizationType.Basic;
        }
      }

      const provider = new FailingProvider();
      authManager.registerProvider('failing', provider);

      const result = await authManager.getAuthHeaders('failing');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Provider error');
      expect(result.headers).toHaveLength(0);
    });
  });

  describe('createAndRegisterProvider', () => {
    it('should create and register provider in one step', async () => {
      const auth: BasicAuthorization = {
        id: '1',
        name: 'Test Basic',
        type: AuthorizationType.Basic,
        username: 'user',
        password: 'pass',
      };

      await authManager.createAndRegisterProvider('test', auth);

      const provider = authManager.getProvider('test');
      expect(provider).toBeInstanceOf(BasicAuthProvider);

      const result = await authManager.getAuthHeaders('test');
      expect(result.success).toBe(true);
    });
  });

  describe('token cache management', () => {
    it('should clear all tokens when no ID provided', async () => {
      // Create OAuth2 provider that caches tokens
      const auth: OAuth2ClientAuthorization = {
        id: 'oauth-1',
        name: 'OAuth Test',
        type: AuthorizationType.OAuth2Client,
        accessTokenUrl: 'https://auth.example.com/token',
        clientId: 'client-id',
        clientSecret: 'client-secret',
      };

      // Create single mock and configure responses
      const mockFetch = fetchManager.mock();
      const mockResponse = createMockResponse(
        { access_token: 'token1', token_type: 'Bearer', expires_in: 3600 },
        true
      );
      const mockResponse2 = createMockResponse(
        { access_token: 'token2', token_type: 'Bearer', expires_in: 3600 },
        true
      );

      mockFetch
        .mockResolvedValueOnce(mockResponse as any)
        .mockResolvedValueOnce(mockResponse2 as any);

      await authManager.createAndRegisterProvider('oauth-test', auth);

      // First call should fetch token
      const result1 = await authManager.getAuthHeaders('oauth-test');
      expect(result1.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Clear all tokens
      authManager.clearTokenCache();

      // Next call should fetch new token (cache was cleared)
      const result2 = await authManager.getAuthHeaders('oauth-test');
      expect(result2.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result2.headers[0].value).toBe('Bearer token2');
    });

    it('should clear specific token when ID provided', async () => {
      // Create two OAuth2 providers
      const auth1: OAuth2ClientAuthorization = {
        id: 'oauth-1',
        name: 'OAuth Test 1',
        type: AuthorizationType.OAuth2Client,
        accessTokenUrl: 'https://auth1.example.com/token',
        clientId: 'client-1',
        clientSecret: 'secret-1',
      };

      const auth2: OAuth2ClientAuthorization = {
        id: 'oauth-2',
        name: 'OAuth Test 2',
        type: AuthorizationType.OAuth2Client,
        accessTokenUrl: 'https://auth2.example.com/token',
        clientId: 'client-2',
        clientSecret: 'secret-2',
      };

      // Create single mock and configure all responses
      const mockFetch = fetchManager.mock();
      const mockResponse1 = createMockResponse(
        { access_token: 'token1', token_type: 'Bearer', expires_in: 3600 },
        true
      );
      const mockResponse2 = createMockResponse(
        { access_token: 'token2', token_type: 'Bearer', expires_in: 3600 },
        true
      );
      const mockResponse3 = createMockResponse(
        { access_token: 'token1-new', token_type: 'Bearer', expires_in: 3600 },
        true
      );

      mockFetch
        .mockResolvedValueOnce(mockResponse1 as any)
        .mockResolvedValueOnce(mockResponse2 as any)
        .mockResolvedValueOnce(mockResponse3 as any);

      await authManager.createAndRegisterProvider('oauth-1', auth1);
      await authManager.createAndRegisterProvider('oauth-2', auth2);

      // Fetch tokens for both providers
      await authManager.getAuthHeaders('oauth-1');
      await authManager.getAuthHeaders('oauth-2');
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Clear only oauth-1's cache
      authManager.clearTokenCache('oauth-1');

      // oauth-1 should fetch new token
      const result1 = await authManager.getAuthHeaders('oauth-1');
      expect(result1.headers[0].value).toBe('Bearer token1-new');
      expect(mockFetch).toHaveBeenCalledTimes(3);

      // oauth-2 should still use cached token
      const result2 = await authManager.getAuthHeaders('oauth-2');
      expect(result2.headers[0].value).toBe('Bearer token2');
      expect(mockFetch).toHaveBeenCalledTimes(3); // No new fetch
    });
  });
});
