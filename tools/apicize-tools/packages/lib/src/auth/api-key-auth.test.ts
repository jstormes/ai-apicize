import { describe, it, expect } from '@jest/globals';
import { ApiKeyAuthProvider } from './api-key-auth';
import { ApiKeyAuthorization, AuthorizationType } from '../types';

describe('ApiKeyAuthProvider', () => {
  const createValidAuth = (): ApiKeyAuthorization => ({
    id: '1',
    name: 'Test API Key Auth',
    type: AuthorizationType.ApiKey,
    header: 'X-API-Key',
    value: 'test-api-key-12345',
  });

  describe('getHeaders', () => {
    it('should generate correct API key header', async () => {
      const auth = createValidAuth();
      const provider = new ApiKeyAuthProvider(auth);

      const result = await provider.getHeaders();

      expect(result.success).toBe(true);
      expect(result.headers).toHaveLength(1);
      expect(result.headers[0].name).toBe('X-API-Key');
      expect(result.headers[0].value).toBe('test-api-key-12345');
    });

    it('should handle custom header names', async () => {
      const auth: ApiKeyAuthorization = {
        ...createValidAuth(),
        header: 'Authorization',
        value: 'Bearer my-token',
      };
      const provider = new ApiKeyAuthProvider(auth);

      const result = await provider.getHeaders();

      expect(result.success).toBe(true);
      expect(result.headers[0].name).toBe('Authorization');
      expect(result.headers[0].value).toBe('Bearer my-token');
    });

    it('should handle special characters in values', async () => {
      const auth: ApiKeyAuthorization = {
        ...createValidAuth(),
        value: 'key-with-special!@#$%^&*()_+-=chars',
      };
      const provider = new ApiKeyAuthProvider(auth);

      const result = await provider.getHeaders();

      expect(result.success).toBe(true);
      expect(result.headers[0].value).toBe('key-with-special!@#$%^&*()_+-=chars');
    });

    it('should fail with invalid configuration', async () => {
      const auth: ApiKeyAuthorization = {
        ...createValidAuth(),
        header: '',
        value: 'test-key',
      };
      const provider = new ApiKeyAuthProvider(auth);

      const result = await provider.getHeaders();

      expect(result.success).toBe(false);
      expect(result.error).toContain('invalid');
      expect(result.headers).toHaveLength(0);
    });
  });

  describe('isValid', () => {
    it('should validate correct configuration', () => {
      const auth = createValidAuth();
      const provider = new ApiKeyAuthProvider(auth);

      expect(provider.isValid()).toBe(true);
    });

    it('should invalidate missing header name', () => {
      const auth: ApiKeyAuthorization = {
        ...createValidAuth(),
        header: '',
      };
      const provider = new ApiKeyAuthProvider(auth);

      expect(provider.isValid()).toBe(false);
    });

    it('should invalidate missing value', () => {
      const auth: ApiKeyAuthorization = {
        ...createValidAuth(),
        value: '',
      };
      const provider = new ApiKeyAuthProvider(auth);

      expect(provider.isValid()).toBe(false);
    });

    it('should invalidate wrong auth type', () => {
      const auth = {
        ...createValidAuth(),
        type: AuthorizationType.Basic,
      } as unknown as ApiKeyAuthorization;
      const provider = new ApiKeyAuthProvider(auth);

      expect(provider.isValid()).toBe(false);
    });

    it('should invalidate invalid header names', () => {
      const invalidHeaders = [
        'header with spaces',
        'header@invalid',
        'header<invalid>',
        'header[invalid]',
        'header{invalid}',
      ];

      invalidHeaders.forEach(headerName => {
        const auth: ApiKeyAuthorization = {
          ...createValidAuth(),
          header: headerName,
        };
        const provider = new ApiKeyAuthProvider(auth);

        expect(provider.isValid()).toBe(false);
      });
    });

    it('should validate common header names', () => {
      const validHeaders = [
        'X-API-Key',
        'Authorization',
        'X-Auth-Token',
        'apikey',
        'api-key',
        'X-RapidAPI-Key',
        'Custom_Header123',
      ];

      validHeaders.forEach(headerName => {
        const auth: ApiKeyAuthorization = {
          ...createValidAuth(),
          header: headerName,
        };
        const provider = new ApiKeyAuthProvider(auth);

        expect(provider.isValid()).toBe(true);
      });
    });
  });

  describe('getType', () => {
    it('should return ApiKey type', () => {
      const auth = createValidAuth();
      const provider = new ApiKeyAuthProvider(auth);

      expect(provider.getType()).toBe(AuthorizationType.ApiKey);
    });
  });

  describe('getHeaderName', () => {
    it('should return header name', () => {
      const auth = createValidAuth();
      const provider = new ApiKeyAuthProvider(auth);

      expect(provider.getHeaderName()).toBe('X-API-Key');
    });
  });

  describe('static utility methods', () => {
    describe('isValidApiKeyValue', () => {
      it('should validate reasonable API key values', () => {
        const validKeys = [
          'api-key-12345',
          'sk-1234567890abcdef',
          'very-long-api-key-with-many-characters-1234567890',
          'Key123!@#',
        ];

        validKeys.forEach(key => {
          expect(ApiKeyAuthProvider.isValidApiKeyValue(key)).toBe(true);
        });
      });

      it('should invalidate short or empty values', () => {
        const invalidKeys = [
          '',
          '   ',
          'short',
          '1234567', // 7 chars, below minimum
          null,
          undefined,
        ];

        invalidKeys.forEach(key => {
          expect(ApiKeyAuthProvider.isValidApiKeyValue(key as any)).toBe(false);
        });
      });

      it('should invalidate non-string values', () => {
        const nonStrings = [123, {}, [], true, false];

        nonStrings.forEach(value => {
          expect(ApiKeyAuthProvider.isValidApiKeyValue(value as any)).toBe(false);
        });
      });
    });

    describe('getCommonHeaders', () => {
      it('should return array of common header configurations', () => {
        const headers = ApiKeyAuthProvider.getCommonHeaders();

        expect(Array.isArray(headers)).toBe(true);
        expect(headers.length).toBeGreaterThan(0);

        headers.forEach(header => {
          expect(header).toHaveProperty('name');
          expect(header).toHaveProperty('description');
          expect(typeof header.name).toBe('string');
          expect(typeof header.description).toBe('string');
        });

        // Check for some expected common headers
        const headerNames = headers.map(h => h.name);
        expect(headerNames).toContain('X-API-Key');
        expect(headerNames).toContain('Authorization');
      });
    });

    describe('createBearerToken', () => {
      it('should create Bearer token format', () => {
        const token = 'my-access-token';
        const result = ApiKeyAuthProvider.createBearerToken(token);

        expect(result).toEqual({
          header: 'Authorization',
          value: 'Bearer my-access-token',
        });
      });

      it('should handle tokens with special characters', () => {
        const token = 'token.with.dots_and_underscores-and-dashes';
        const result = ApiKeyAuthProvider.createBearerToken(token);

        expect(result.value).toBe(`Bearer ${token}`);
      });
    });
  });
});
