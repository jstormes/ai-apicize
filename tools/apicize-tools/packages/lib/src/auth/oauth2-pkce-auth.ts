import { AuthProvider, AuthResult, TokenInfo } from './auth-manager';
import { OAuth2PkceAuthorization, AuthorizationType } from '../types';

export class OAuth2PkceAuthProvider extends AuthProvider {
  private oauth2Auth: OAuth2PkceAuthorization;

  constructor(authorization: OAuth2PkceAuthorization) {
    super(authorization);
    this.oauth2Auth = authorization;
  }

  async getHeaders(): Promise<AuthResult> {
    // OAuth2 PKCE flow requires user interaction for authorization
    // This is a stub implementation that returns an error for now
    return this.createAuthResult(
      [],
      false,
      'OAuth2 PKCE flow is not yet implemented - requires interactive authorization'
    );
  }

  isValid(): boolean {
    return !!(
      this.oauth2Auth.authorizeUrl &&
      this.oauth2Auth.accessTokenUrl &&
      this.oauth2Auth.clientId &&
      this.oauth2Auth.type === AuthorizationType.OAuth2Pkce &&
      this.isValidUrl(this.oauth2Auth.authorizeUrl) &&
      this.isValidUrl(this.oauth2Auth.accessTokenUrl)
    );
  }

  getType(): AuthorizationType {
    return AuthorizationType.OAuth2Pkce;
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  // Utility methods for future PKCE implementation

  static generateCodeVerifier(): string {
    // Generate a random string for PKCE code verifier
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(
      array,
      byte => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'[byte % 66]
    ).join('');
  }

  static async generateCodeChallenge(verifier: string): Promise<string> {
    // Generate SHA256 hash of the code verifier for PKCE code challenge
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);

    // Convert to base64url encoding
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  getAuthorizationUrl(state: string, redirectUri: string): string {
    // These parameters will be used in future implementation
    void state;
    void redirectUri;
    if (!this.isValid()) {
      throw new Error('OAuth2 PKCE configuration is invalid');
    }

    // This would be used to construct the authorization URL
    // Implementation would require code verifier/challenge generation
    throw new Error('OAuth2 PKCE authorization URL generation not yet implemented');
  }

  async exchangeCodeForToken(
    code: string,
    codeVerifier: string,
    redirectUri: string
  ): Promise<{ success: boolean; token?: TokenInfo; error?: string }> {
    // These parameters will be used in future implementation
    void code;
    void codeVerifier;
    void redirectUri;
    // This would exchange the authorization code for an access token
    // Implementation requires the full PKCE flow
    return {
      success: false,
      error: 'OAuth2 PKCE token exchange not yet implemented',
    };
  }

  // Static method to validate OAuth2 PKCE configuration
  static validateConfig(config: {
    authorizeUrl: string;
    accessTokenUrl: string;
    clientId: string;
    scope?: string;
    audience?: string;
  }): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.authorizeUrl) {
      errors.push('authorizeUrl is required');
    } else {
      try {
        new URL(config.authorizeUrl);
      } catch {
        errors.push('authorizeUrl must be a valid URL');
      }
    }

    if (!config.accessTokenUrl) {
      errors.push('accessTokenUrl is required');
    } else {
      try {
        new URL(config.accessTokenUrl);
      } catch {
        errors.push('accessTokenUrl must be a valid URL');
      }
    }

    if (!config.clientId) {
      errors.push('clientId is required');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // TODO: Future implementation should include:
  // - Interactive browser flow for authorization
  // - State management for security
  // - Token refresh capabilities
  // - Proper PKCE code verifier/challenge handling
  // - Integration with system browser or embedded webview
}
