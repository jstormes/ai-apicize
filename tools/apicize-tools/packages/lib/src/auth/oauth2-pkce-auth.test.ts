import { describe, it, expect } from '@jest/globals';
import { OAuth2PkceAuthProvider } from './oauth2-pkce-auth';
import { OAuth2PkceAuthorization, AuthorizationType } from '../types';

describe('OAuth2PkceAuthProvider', () => {
  const createValidAuth = (): OAuth2PkceAuthorization => ({
    id: '1',
    name: 'Test OAuth2 PKCE',
    type: AuthorizationType.OAuth2Pkce,
    authorizeUrl: 'https://auth.example.com/authorize',
    accessTokenUrl: 'https://auth.example.com/token',
    clientId: 'test-client-id',
    scope: 'read write',
    audience: 'https://api.example.com',
  });

  describe('getHeaders', () => {
    it('should return error for unimplemented PKCE flow', async () => {
      const auth = createValidAuth();
      const provider = new OAuth2PkceAuthProvider(auth);

      const result = await provider.getHeaders();

      expect(result.success).toBe(false);
      expect(result.error).toContain('not yet implemented');
      expect(result.error).toContain('interactive authorization');
      expect(result.headers).toHaveLength(0);
    });
  });

  describe('isValid', () => {
    it('should validate correct configuration', () => {
      const auth = createValidAuth();
      const provider = new OAuth2PkceAuthProvider(auth);

      expect(provider.isValid()).toBe(true);
    });

    it('should invalidate missing authorizeUrl', () => {
      const auth: OAuth2PkceAuthorization = {
        ...createValidAuth(),
        authorizeUrl: '',
      };
      const provider = new OAuth2PkceAuthProvider(auth);

      expect(provider.isValid()).toBe(false);
    });

    it('should invalidate missing accessTokenUrl', () => {
      const auth: OAuth2PkceAuthorization = {
        ...createValidAuth(),
        accessTokenUrl: '',
      };
      const provider = new OAuth2PkceAuthProvider(auth);

      expect(provider.isValid()).toBe(false);
    });

    it('should invalidate missing clientId', () => {
      const auth: OAuth2PkceAuthorization = {
        ...createValidAuth(),
        clientId: '',
      };
      const provider = new OAuth2PkceAuthProvider(auth);

      expect(provider.isValid()).toBe(false);
    });

    it('should invalidate invalid URLs', () => {
      const auth1: OAuth2PkceAuthorization = {
        ...createValidAuth(),
        authorizeUrl: 'not-a-valid-url',
      };
      const provider1 = new OAuth2PkceAuthProvider(auth1);
      expect(provider1.isValid()).toBe(false);

      const auth2: OAuth2PkceAuthorization = {
        ...createValidAuth(),
        accessTokenUrl: 'not-a-valid-url',
      };
      const provider2 = new OAuth2PkceAuthProvider(auth2);
      expect(provider2.isValid()).toBe(false);
    });

    it('should invalidate wrong auth type', () => {
      const auth = {
        ...createValidAuth(),
        type: AuthorizationType.Basic,
      } as unknown as OAuth2PkceAuthorization;
      const provider = new OAuth2PkceAuthProvider(auth);

      expect(provider.isValid()).toBe(false);
    });

    it('should validate optional parameters', () => {
      const auth: OAuth2PkceAuthorization = {
        id: '1',
        name: 'Minimal PKCE',
        type: AuthorizationType.OAuth2Pkce,
        authorizeUrl: 'https://auth.example.com/authorize',
        accessTokenUrl: 'https://auth.example.com/token',
        clientId: 'client-id',
        // scope and audience are optional
      };
      const provider = new OAuth2PkceAuthProvider(auth);

      expect(provider.isValid()).toBe(true);
    });
  });

  describe('getType', () => {
    it('should return OAuth2Pkce type', () => {
      const auth = createValidAuth();
      const provider = new OAuth2PkceAuthProvider(auth);

      expect(provider.getType()).toBe(AuthorizationType.OAuth2Pkce);
    });
  });

  describe('getAuthorizationUrl', () => {
    it('should throw error for unimplemented method', () => {
      const auth = createValidAuth();
      const provider = new OAuth2PkceAuthProvider(auth);

      expect(() => {
        provider.getAuthorizationUrl('state123', 'http://localhost:3000/callback');
      }).toThrow('not yet implemented');
    });

    it('should throw error for invalid configuration', () => {
      const auth: OAuth2PkceAuthorization = {
        ...createValidAuth(),
        authorizeUrl: '',
      };
      const provider = new OAuth2PkceAuthProvider(auth);

      expect(() => {
        provider.getAuthorizationUrl('state123', 'http://localhost:3000/callback');
      }).toThrow('invalid');
    });
  });

  describe('exchangeCodeForToken', () => {
    it('should return error for unimplemented method', async () => {
      const auth = createValidAuth();
      const provider = new OAuth2PkceAuthProvider(auth);

      const result = await provider.exchangeCodeForToken(
        'auth-code',
        'code-verifier',
        'http://localhost:3000/callback'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not yet implemented');
    });
  });

  describe('static utility methods', () => {
    describe('generateCodeVerifier', () => {
      it('should generate code verifier with correct length', () => {
        const verifier = OAuth2PkceAuthProvider.generateCodeVerifier();

        expect(typeof verifier).toBe('string');
        expect(verifier.length).toBeGreaterThan(0);
        // PKCE spec recommends 43-128 characters for code verifier
        expect(verifier.length).toBeGreaterThanOrEqual(32);
      });

      it('should generate different verifiers on each call', () => {
        const verifier1 = OAuth2PkceAuthProvider.generateCodeVerifier();
        const verifier2 = OAuth2PkceAuthProvider.generateCodeVerifier();

        expect(verifier1).not.toBe(verifier2);
      });

      it('should use only valid characters', () => {
        const verifier = OAuth2PkceAuthProvider.generateCodeVerifier();
        // PKCE code verifier should only contain unreserved characters
        const validChars = /^[A-Za-z0-9\-._~]+$/;
        expect(validChars.test(verifier)).toBe(true);
      });
    });

    describe('generateCodeChallenge', () => {
      it('should generate code challenge from verifier', async () => {
        const verifier = 'test-code-verifier-12345';
        const challenge = await OAuth2PkceAuthProvider.generateCodeChallenge(verifier);

        expect(typeof challenge).toBe('string');
        expect(challenge.length).toBeGreaterThan(0);
        // Base64url encoded SHA256 hash should be 43 characters
        expect(challenge.length).toBe(43);
      });

      it('should generate same challenge for same verifier', async () => {
        const verifier = 'consistent-verifier';
        const challenge1 = await OAuth2PkceAuthProvider.generateCodeChallenge(verifier);
        const challenge2 = await OAuth2PkceAuthProvider.generateCodeChallenge(verifier);

        expect(challenge1).toBe(challenge2);
      });

      it('should generate different challenges for different verifiers', async () => {
        const verifier1 = 'verifier-one';
        const verifier2 = 'verifier-two';
        const challenge1 = await OAuth2PkceAuthProvider.generateCodeChallenge(verifier1);
        const challenge2 = await OAuth2PkceAuthProvider.generateCodeChallenge(verifier2);

        expect(challenge1).not.toBe(challenge2);
      });

      it('should use base64url encoding (no padding)', async () => {
        const verifier = 'test-verifier';
        const challenge = await OAuth2PkceAuthProvider.generateCodeChallenge(verifier);

        // Base64url should not contain +, /, or = characters
        expect(challenge).not.toContain('+');
        expect(challenge).not.toContain('/');
        expect(challenge).not.toContain('=');
      });
    });

    describe('validateConfig', () => {
      it('should validate correct config', () => {
        const config = {
          authorizeUrl: 'https://auth.example.com/authorize',
          accessTokenUrl: 'https://auth.example.com/token',
          clientId: 'client-id',
        };

        const result = OAuth2PkceAuthProvider.validateConfig(config);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should validate with optional parameters', () => {
        const config = {
          authorizeUrl: 'https://auth.example.com/authorize',
          accessTokenUrl: 'https://auth.example.com/token',
          clientId: 'client-id',
          scope: 'read write',
          audience: 'https://api.example.com',
        };

        const result = OAuth2PkceAuthProvider.validateConfig(config);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should collect all validation errors', () => {
        const config = {
          authorizeUrl: '',
          accessTokenUrl: '',
          clientId: '',
        };

        const result = OAuth2PkceAuthProvider.validateConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(3);
        expect(result.errors).toContain('authorizeUrl is required');
        expect(result.errors).toContain('accessTokenUrl is required');
        expect(result.errors).toContain('clientId is required');
      });

      it('should validate URL formats', () => {
        const config = {
          authorizeUrl: 'not-a-url',
          accessTokenUrl: 'also-not-a-url',
          clientId: 'client-id',
        };

        const result = OAuth2PkceAuthProvider.validateConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('authorizeUrl must be a valid URL');
        expect(result.errors).toContain('accessTokenUrl must be a valid URL');
      });
    });
  });
});
