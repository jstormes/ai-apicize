import { AuthProvider, AuthResult, TokenInfo } from './auth-manager';
import { OAuth2ClientAuthorization, AuthorizationType } from '../types';

export interface OAuth2TokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
}

export class OAuth2ClientAuthProvider extends AuthProvider {
  private oauth2Auth: OAuth2ClientAuthorization;
  private cachedToken?: TokenInfo;

  constructor(authorization: OAuth2ClientAuthorization) {
    super(authorization);
    this.oauth2Auth = authorization;
  }

  async getHeaders(): Promise<AuthResult> {
    if (!this.isValid()) {
      return this.createAuthResult([], false, 'OAuth2 Client auth configuration is invalid');
    }

    try {
      // Check if we have a valid cached token
      if (this.cachedToken && this.isTokenValid(this.cachedToken)) {
        return this.createTokenHeaders(this.cachedToken);
      }

      // Fetch new token
      const tokenResult = await this.fetchToken();
      if (!tokenResult.success) {
        return this.createAuthResult([], false, tokenResult.error);
      }

      if (tokenResult.token) {
        this.cachedToken = tokenResult.token;
      }
      return this.createTokenHeaders(this.cachedToken!);
    } catch (error) {
      return this.createAuthResult([], false, `OAuth2 token fetch failed: ${error}`);
    }
  }

  private async fetchToken(): Promise<{ success: boolean; token?: TokenInfo; error?: string }> {
    try {
      const body = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.oauth2Auth.clientId,
        client_secret: this.oauth2Auth.clientSecret,
      });

      if (this.oauth2Auth.scope) {
        body.append('scope', this.oauth2Auth.scope);
      }

      if (this.oauth2Auth.audience) {
        body.append('audience', this.oauth2Auth.audience);
      }

      const response = await fetch(this.oauth2Auth.accessTokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `OAuth2 token request failed: ${response.status} ${response.statusText} - ${errorText}`,
        };
      }

      const tokenResponse = (await response.json()) as OAuth2TokenResponse;

      if (!tokenResponse.access_token) {
        return {
          success: false,
          error: 'OAuth2 response missing access_token',
        };
      }

      const token: TokenInfo = {
        accessToken: tokenResponse.access_token,
        tokenType: tokenResponse.token_type || 'Bearer',
      };

      if (tokenResponse.refresh_token) {
        token.refreshToken = tokenResponse.refresh_token;
      }

      // Calculate expiration time if provided
      if (tokenResponse.expires_in) {
        token.expiresAt = Date.now() + tokenResponse.expires_in * 1000;
      }

      return { success: true, token };
    } catch (error) {
      return {
        success: false,
        error: `OAuth2 token fetch error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private createTokenHeaders(token: TokenInfo): AuthResult {
    const authValue = `${token.tokenType} ${token.accessToken}`;
    const headers = this.createHeaders({
      Authorization: authValue,
    });

    return this.createAuthResult(headers);
  }

  private isTokenValid(token: TokenInfo): boolean {
    if (!token.accessToken) return false;

    // If no expiration time, assume it's valid
    if (!token.expiresAt) return true;

    // Check if token expires within next 5 minutes (buffer time)
    return token.expiresAt > Date.now() + 5 * 60 * 1000;
  }

  isValid(): boolean {
    return !!(
      this.oauth2Auth.accessTokenUrl &&
      this.oauth2Auth.clientId &&
      this.oauth2Auth.clientSecret &&
      this.oauth2Auth.type === AuthorizationType.OAuth2Client &&
      this.isValidUrl(this.oauth2Auth.accessTokenUrl)
    );
  }

  getType(): AuthorizationType {
    return AuthorizationType.OAuth2Client;
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  // Public method to clear cached token
  clearToken(): void {
    delete this.cachedToken;
  }

  // Public method to get token info for debugging
  getTokenInfo(): TokenInfo | undefined {
    return this.cachedToken ? { ...this.cachedToken } : undefined;
  }

  // Static method to validate OAuth2 client credentials configuration
  static validateConfig(config: {
    accessTokenUrl: string;
    clientId: string;
    clientSecret: string;
    scope?: string;
    audience?: string;
  }): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

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

    if (!config.clientSecret) {
      errors.push('clientSecret is required');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
