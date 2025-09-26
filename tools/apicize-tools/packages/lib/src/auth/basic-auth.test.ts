import { describe, it, expect } from '@jest/globals';
import { BasicAuthProvider } from './basic-auth';
import { BasicAuthorization, AuthorizationType } from '../types';

describe('BasicAuthProvider', () => {
  const createValidAuth = (): BasicAuthorization => ({
    id: '1',
    name: 'Test Basic Auth',
    type: AuthorizationType.Basic,
    username: 'testuser',
    password: 'testpass',
  });

  describe('getHeaders', () => {
    it('should generate correct Basic auth header', async () => {
      const auth = createValidAuth();
      const provider = new BasicAuthProvider(auth);

      const result = await provider.getHeaders();

      expect(result.success).toBe(true);
      expect(result.headers).toHaveLength(1);
      expect(result.headers[0].name).toBe('Authorization');

      // Decode and verify the credentials
      const authHeader = result.headers[0].value;
      const decoded = BasicAuthProvider.decodeBasicAuth(authHeader);
      expect(decoded).toEqual({
        username: 'testuser',
        password: 'testpass',
      });
    });

    it('should handle special characters in credentials', async () => {
      const auth: BasicAuthorization = {
        ...createValidAuth(),
        username: 'user@example.com',
        password: 'p@ssw0rd!#$',
      };
      const provider = new BasicAuthProvider(auth);

      const result = await provider.getHeaders();

      expect(result.success).toBe(true);
      const decoded = BasicAuthProvider.decodeBasicAuth(result.headers[0].value);
      expect(decoded).toEqual({
        username: 'user@example.com',
        password: 'p@ssw0rd!#$',
      });
    });

    it('should handle Unicode characters', async () => {
      const auth: BasicAuthorization = {
        ...createValidAuth(),
        username: 'ユーザー',
        password: 'パスワード',
      };
      const provider = new BasicAuthProvider(auth);

      const result = await provider.getHeaders();

      expect(result.success).toBe(true);
      const decoded = BasicAuthProvider.decodeBasicAuth(result.headers[0].value);
      expect(decoded).toEqual({
        username: 'ユーザー',
        password: 'パスワード',
      });
    });

    it('should fail with invalid configuration', async () => {
      const auth: BasicAuthorization = {
        ...createValidAuth(),
        username: '',
        password: 'testpass',
      };
      const provider = new BasicAuthProvider(auth);

      const result = await provider.getHeaders();

      expect(result.success).toBe(false);
      expect(result.error).toContain('invalid');
      expect(result.headers).toHaveLength(0);
    });
  });

  describe('isValid', () => {
    it('should validate correct configuration', () => {
      const auth = createValidAuth();
      const provider = new BasicAuthProvider(auth);

      expect(provider.isValid()).toBe(true);
    });

    it('should invalidate missing username', () => {
      const auth: BasicAuthorization = {
        ...createValidAuth(),
        username: '',
      };
      const provider = new BasicAuthProvider(auth);

      expect(provider.isValid()).toBe(false);
    });

    it('should invalidate missing password', () => {
      const auth: BasicAuthorization = {
        ...createValidAuth(),
        password: '',
      };
      const provider = new BasicAuthProvider(auth);

      expect(provider.isValid()).toBe(false);
    });

    it('should invalidate wrong auth type', () => {
      const auth = {
        ...createValidAuth(),
        type: AuthorizationType.ApiKey,
      } as unknown as BasicAuthorization;
      const provider = new BasicAuthProvider(auth);

      expect(provider.isValid()).toBe(false);
    });
  });

  describe('getType', () => {
    it('should return Basic type', () => {
      const auth = createValidAuth();
      const provider = new BasicAuthProvider(auth);

      expect(provider.getType()).toBe(AuthorizationType.Basic);
    });
  });

  describe('getUsername', () => {
    it('should return username', () => {
      const auth = createValidAuth();
      const provider = new BasicAuthProvider(auth);

      expect(provider.getUsername()).toBe('testuser');
    });
  });

  describe('static utility methods', () => {
    describe('validateCredentials', () => {
      it('should validate correct credentials', () => {
        expect(BasicAuthProvider.validateCredentials('user', 'pass')).toBe(true);
      });

      it('should invalidate empty username', () => {
        expect(BasicAuthProvider.validateCredentials('', 'pass')).toBe(false);
      });

      it('should invalidate empty password', () => {
        expect(BasicAuthProvider.validateCredentials('user', '')).toBe(false);
      });

      it('should invalidate non-string credentials', () => {
        expect(BasicAuthProvider.validateCredentials(null as any, 'pass')).toBe(false);
        expect(BasicAuthProvider.validateCredentials('user', null as any)).toBe(false);
      });
    });

    describe('decodeBasicAuth', () => {
      it('should decode valid Basic auth header', () => {
        const header = 'Basic dGVzdHVzZXI6dGVzdHBhc3M='; // testuser:testpass
        const result = BasicAuthProvider.decodeBasicAuth(header);

        expect(result).toEqual({
          username: 'testuser',
          password: 'testpass',
        });
      });

      it('should handle credentials with colon in password', () => {
        const header = 'Basic dGVzdDpwYXNzOndvcmQ='; // test:pass:word
        const result = BasicAuthProvider.decodeBasicAuth(header);

        expect(result).toEqual({
          username: 'test',
          password: 'pass:word',
        });
      });

      it('should return null for invalid header format', () => {
        expect(BasicAuthProvider.decodeBasicAuth('Bearer token')).toBeNull();
        expect(BasicAuthProvider.decodeBasicAuth('Basic')).toBeNull();
        expect(BasicAuthProvider.decodeBasicAuth('invalid')).toBeNull();
      });

      it('should return null for invalid base64', () => {
        expect(BasicAuthProvider.decodeBasicAuth('Basic invalid-base64')).toBeNull();
      });

      it('should return null for credentials without colon', () => {
        const header = 'Basic dGVzdA=='; // "test" without colon
        expect(BasicAuthProvider.decodeBasicAuth(header)).toBeNull();
      });
    });
  });
});
