import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { OAuth2ClientAuthProvider, OAuth2TokenResponse } from './oauth2-client-auth';
import { OAuth2ClientAuthorization, AuthorizationType } from '../types';
import { createMockResponse, FetchMockManager } from '../test-utils/index';

// Fetch mock manager for this test suite
const fetchManager = new FetchMockManager();

describe('OAuth2ClientAuthProvider', () => {
  const createValidAuth = (): OAuth2ClientAuthorization => ({
    id: '1',
    name: 'Test OAuth2 Client',
    type: AuthorizationType.OAuth2Client,
    accessTokenUrl: 'https://auth.example.com/token',
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    scope: 'read write',
    audience: 'https://api.example.com',
  });

  beforeEach(() => {
    fetchManager.save();
    jest.clearAllMocks();
  });

  afterEach(() => {
    fetchManager.restore();
    jest.restoreAllMocks();
  });

  describe('getHeaders', () => {
    it('should fetch token and return authorization header', async () => {
      const auth = createValidAuth();
      const provider = new OAuth2ClientAuthProvider(auth);

      const mockTokenResponse: OAuth2TokenResponse = {
        access_token: 'test-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
      };

      fetchManager.mock().mockResolvedValue(createMockResponse(mockTokenResponse) as any);

      const result = await provider.getHeaders();

      expect(result.success).toBe(true);
      expect(result.headers).toHaveLength(1);
      expect(result.headers[0].name).toBe('Authorization');
      expect(result.headers[0].value).toBe('Bearer test-access-token');

      // Verify fetch was called correctly
      expect(fetch).toHaveBeenCalledTimes(1);
      const fetchCall = (fetch as any).mock.calls[0];
      expect(fetchCall[0]).toBe('https://auth.example.com/token');
      expect(fetchCall[1].method).toBe('POST');
      expect(fetchCall[1].headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    });

    it('should use cached token when valid', async () => {
      const auth = createValidAuth();
      const provider = new OAuth2ClientAuthProvider(auth);

      const mockTokenResponse: OAuth2TokenResponse = {
        access_token: 'cached-token',
        token_type: 'Bearer',
        expires_in: 3600,
      };

      fetchManager.mock().mockResolvedValue(createMockResponse(mockTokenResponse) as any);

      // First call should fetch token
      const result1 = await provider.getHeaders();
      expect(result1.success).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(1);

      // Second call should use cached token
      const result2 = await provider.getHeaders();
      expect(result2.success).toBe(true);
      expect(result2.headers[0].value).toBe('Bearer cached-token');
      expect(fetch).toHaveBeenCalledTimes(1); // Still only called once
    });

    it('should handle token expiration and refetch', async () => {
      const auth = createValidAuth();
      const provider = new OAuth2ClientAuthProvider(auth);

      // Mock token that expires in the past (definitely expired)
      const mockTokenResponse: OAuth2TokenResponse = {
        access_token: 'expiring-token',
        token_type: 'Bearer',
        expires_in: -1, // Already expired
      };

      const mockNewTokenResponse: OAuth2TokenResponse = {
        access_token: 'new-token',
        token_type: 'Bearer',
        expires_in: 3600,
      };

      const mockResponse1 = createMockResponse(mockTokenResponse);
      const mockResponse2 = createMockResponse(mockNewTokenResponse);

      const mockFetch = fetchManager.mock();
      mockFetch
        .mockResolvedValueOnce(mockResponse1 as any)
        .mockResolvedValueOnce(mockResponse2 as any);

      // First call
      const result1 = await provider.getHeaders();
      expect(result1.success).toBe(true);

      // Wait a bit to ensure token is expired
      await new Promise(resolve => setTimeout(resolve, 10));

      // Second call should refetch due to expiration
      const result2 = await provider.getHeaders();
      expect(result2.success).toBe(true);
      expect(result2.headers[0].value).toBe('Bearer new-token');
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should handle HTTP errors', async () => {
      const auth = createValidAuth();
      const provider = new OAuth2ClientAuthProvider(auth);

      const mockResponse = {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: jest.fn<() => Promise<string>>().mockResolvedValue('Invalid credentials'),
      } as Partial<Response>;

      fetchManager.mock().mockResolvedValue(mockResponse as any);

      const result = await provider.getHeaders();

      expect(result.success).toBe(false);
      expect(result.error).toContain('401');
      expect(result.error).toContain('Unauthorized');
      expect(result.headers).toHaveLength(0);
    });

    it('should handle missing access token in response', async () => {
      const auth = createValidAuth();
      const provider = new OAuth2ClientAuthProvider(auth);

      const mockTokenResponse = {
        token_type: 'Bearer',
        expires_in: 3600,
        // Missing access_token
      };

      fetchManager.mock().mockResolvedValue(createMockResponse(mockTokenResponse) as any);

      const result = await provider.getHeaders();

      expect(result.success).toBe(false);
      expect(result.error).toContain('missing access_token');
      expect(result.headers).toHaveLength(0);
    });

    it('should handle network errors', async () => {
      const auth = createValidAuth();
      const provider = new OAuth2ClientAuthProvider(auth);

      fetchManager.mock().mockRejectedValue(new Error('Network error'));

      const result = await provider.getHeaders();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
      expect(result.headers).toHaveLength(0);
    });

    it('should fail with invalid configuration', async () => {
      const auth: OAuth2ClientAuthorization = {
        ...createValidAuth(),
        clientId: '',
      };
      const provider = new OAuth2ClientAuthProvider(auth);

      const result = await provider.getHeaders();

      expect(result.success).toBe(false);
      expect(result.error).toContain('invalid');
      expect(result.headers).toHaveLength(0);
    });

    it('should include scope and audience in request', async () => {
      const auth = createValidAuth();
      const provider = new OAuth2ClientAuthProvider(auth);

      const mockTokenResponse: OAuth2TokenResponse = {
        access_token: 'test-token',
        token_type: 'Bearer',
      };

      fetchManager.mock().mockResolvedValue(createMockResponse(mockTokenResponse) as any);

      await provider.getHeaders();

      const fetchCall = (fetch as any).mock.calls[0];
      const body = fetchCall[1].body;
      expect(body).toContain('scope=read+write'); // URLSearchParams encodes spaces as +
      expect(body).toContain('audience=https%3A%2F%2Fapi.example.com');
    });
  });

  describe('isValid', () => {
    it('should validate correct configuration', () => {
      const auth = createValidAuth();
      const provider = new OAuth2ClientAuthProvider(auth);

      expect(provider.isValid()).toBe(true);
    });

    it('should invalidate missing accessTokenUrl', () => {
      const auth: OAuth2ClientAuthorization = {
        ...createValidAuth(),
        accessTokenUrl: '',
      };
      const provider = new OAuth2ClientAuthProvider(auth);

      expect(provider.isValid()).toBe(false);
    });

    it('should invalidate invalid URL', () => {
      const auth: OAuth2ClientAuthorization = {
        ...createValidAuth(),
        accessTokenUrl: 'not-a-valid-url',
      };
      const provider = new OAuth2ClientAuthProvider(auth);

      expect(provider.isValid()).toBe(false);
    });

    it('should invalidate missing clientId', () => {
      const auth: OAuth2ClientAuthorization = {
        ...createValidAuth(),
        clientId: '',
      };
      const provider = new OAuth2ClientAuthProvider(auth);

      expect(provider.isValid()).toBe(false);
    });

    it('should invalidate missing clientSecret', () => {
      const auth: OAuth2ClientAuthorization = {
        ...createValidAuth(),
        clientSecret: '',
      };
      const provider = new OAuth2ClientAuthProvider(auth);

      expect(provider.isValid()).toBe(false);
    });

    it('should invalidate wrong auth type', () => {
      const auth = {
        ...createValidAuth(),
        type: AuthorizationType.Basic,
      } as unknown as OAuth2ClientAuthorization;
      const provider = new OAuth2ClientAuthProvider(auth);

      expect(provider.isValid()).toBe(false);
    });
  });

  describe('getType', () => {
    it('should return OAuth2Client type', () => {
      const auth = createValidAuth();
      const provider = new OAuth2ClientAuthProvider(auth);

      expect(provider.getType()).toBe(AuthorizationType.OAuth2Client);
    });
  });

  describe('token management', () => {
    it('should clear cached token', async () => {
      const auth = createValidAuth();
      const provider = new OAuth2ClientAuthProvider(auth);

      // First get a token
      const mockTokenResponse: OAuth2TokenResponse = {
        access_token: 'test-token',
        token_type: 'Bearer',
        expires_in: 3600,
      };

      fetchManager.mock().mockResolvedValue(createMockResponse(mockTokenResponse) as any);

      await provider.getHeaders();
      expect(fetch).toHaveBeenCalledTimes(1);

      // Clear token and call again - should fetch new token
      provider.clearToken();
      await provider.getHeaders();
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should return token info', async () => {
      const auth = createValidAuth();
      const provider = new OAuth2ClientAuthProvider(auth);

      expect(provider.getTokenInfo()).toBeUndefined();

      // Get a token
      const mockTokenResponse: OAuth2TokenResponse = {
        access_token: 'test-token',
        token_type: 'Bearer',
        expires_in: 3600,
      };

      fetchManager.mock().mockResolvedValue(createMockResponse(mockTokenResponse) as any);

      await provider.getHeaders();

      const tokenInfo = provider.getTokenInfo();
      expect(tokenInfo).toBeDefined();
      expect(tokenInfo!.accessToken).toBe('test-token');
      expect(tokenInfo!.tokenType).toBe('Bearer');
    });
  });

  describe('static validateConfig', () => {
    it('should validate correct config', () => {
      const config = {
        accessTokenUrl: 'https://auth.example.com/token',
        clientId: 'client-id',
        clientSecret: 'client-secret',
      };

      const result = OAuth2ClientAuthProvider.validateConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate with optional parameters', () => {
      const config = {
        accessTokenUrl: 'https://auth.example.com/token',
        clientId: 'client-id',
        clientSecret: 'client-secret',
        scope: 'read write',
        audience: 'https://api.example.com',
      };

      const result = OAuth2ClientAuthProvider.validateConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should collect all validation errors', () => {
      const config = {
        accessTokenUrl: '',
        clientId: '',
        clientSecret: '',
      };

      const result = OAuth2ClientAuthProvider.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(3);
      expect(result.errors).toContain('accessTokenUrl is required');
      expect(result.errors).toContain('clientId is required');
      expect(result.errors).toContain('clientSecret is required');
    });

    it('should validate URL format', () => {
      const config = {
        accessTokenUrl: 'not-a-url',
        clientId: 'client-id',
        clientSecret: 'client-secret',
      };

      const result = OAuth2ClientAuthProvider.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('accessTokenUrl must be a valid URL');
    });
  });
});
