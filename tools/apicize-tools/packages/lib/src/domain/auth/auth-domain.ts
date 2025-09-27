/**
 * Authentication domain bounded context
 * Contains all authentication-related domain models, interfaces, and business logic
 */

import { AuthorizationType } from '../../types';
import { Result } from '../../infrastructure/result';
import { ApicizeError } from '../../infrastructure/errors';

/**
 * Authentication credentials interface
 */
export interface AuthCredentials {
  readonly type: AuthorizationType;
  readonly identifier: string; // username, client_id, etc.
  isValid(): boolean;
  getSecurityLevel(): SecurityLevel;
}

/**
 * Security levels for authentication
 */
export enum SecurityLevel {
  NONE = 0,
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  CRITICAL = 4,
}

/**
 * Authentication token interface
 */
export interface AuthToken {
  readonly value: string;
  readonly type: string;
  readonly expiresAt?: Date;
  readonly scopes?: string[];
  isExpired(): boolean;
  isValid(): boolean;
  getRemainingTime(): number;
}

/**
 * Authentication context
 */
export interface AuthContext {
  readonly userId?: string;
  readonly sessionId?: string;
  readonly permissions?: string[];
  readonly metadata?: Record<string, unknown>;
}

/**
 * Authentication result
 */
export interface AuthResult {
  readonly success: boolean;
  readonly token?: AuthToken;
  readonly context?: AuthContext;
  readonly error?: string;
  readonly expiresIn?: number;
}

/**
 * Authentication provider interface (read operations)
 */
export interface AuthProviderReader {
  /**
   * Get authentication headers for a request
   */
  getHeaders(credentials: AuthCredentials): Promise<Result<Record<string, string>, ApicizeError>>;

  /**
   * Validate credentials format and requirements
   */
  validateCredentials(credentials: AuthCredentials): Result<boolean, ApicizeError>;

  /**
   * Get the authentication type supported by this provider
   */
  getType(): AuthorizationType;

  /**
   * Check if provider is properly configured
   */
  isConfigured(): boolean;
}

/**
 * Authentication provider interface (write operations)
 */
export interface AuthProviderWriter {
  /**
   * Clear cached authentication data
   */
  clearCache(identifier?: string): Promise<Result<void, ApicizeError>>;

  /**
   * Refresh authentication token
   */
  refreshToken(credentials: AuthCredentials): Promise<Result<AuthToken, ApicizeError>>;

  /**
   * Revoke authentication token
   */
  revokeToken(token: AuthToken): Promise<Result<void, ApicizeError>>;
}

/**
 * Full authentication provider interface
 */
export interface AuthProvider extends AuthProviderReader, AuthProviderWriter {}

/**
 * Authentication repository interface
 */
export interface AuthRepository {
  /**
   * Store authentication data securely
   */
  store(identifier: string, data: AuthToken | AuthCredentials): Promise<Result<void, ApicizeError>>;

  /**
   * Retrieve authentication data
   */
  retrieve(identifier: string): Promise<Result<AuthToken | AuthCredentials | null, ApicizeError>>;

  /**
   * Remove authentication data
   */
  remove(identifier: string): Promise<Result<void, ApicizeError>>;

  /**
   * List all stored identifiers
   */
  list(): Promise<Result<string[], ApicizeError>>;

  /**
   * Check if data exists for identifier
   */
  exists(identifier: string): Promise<Result<boolean, ApicizeError>>;
}

/**
 * Authentication manager interface
 */
export interface AuthManager {
  /**
   * Register an authentication provider
   */
  registerProvider(type: AuthorizationType, provider: AuthProvider): Result<void, ApicizeError>;

  /**
   * Get authentication provider by type
   */
  getProvider(type: AuthorizationType): Result<AuthProvider, ApicizeError>;

  /**
   * Authenticate with specific provider
   */
  authenticate(
    type: AuthorizationType,
    credentials: AuthCredentials
  ): Promise<Result<AuthResult, ApicizeError>>;

  /**
   * Get authentication headers for request
   */
  getAuthHeaders(
    type: AuthorizationType,
    credentials: AuthCredentials
  ): Promise<Result<Record<string, string>, ApicizeError>>;

  /**
   * Clear all authentication data
   */
  clearAll(): Promise<Result<void, ApicizeError>>;
}

/**
 * Basic authentication credentials
 */
export class BasicAuthCredentials implements AuthCredentials {
  readonly type = AuthorizationType.Basic;

  constructor(
    private readonly username: string,
    private readonly password: string
  ) {}

  get identifier(): string {
    return this.username;
  }

  isValid(): boolean {
    return Boolean(this.username && this.password);
  }

  getSecurityLevel(): SecurityLevel {
    // Basic auth is considered low security due to base64 encoding
    return SecurityLevel.LOW;
  }

  getUsername(): string {
    return this.username;
  }

  getPassword(): string {
    return this.password;
  }
}

/**
 * API Key authentication credentials
 */
export class ApiKeyAuthCredentials implements AuthCredentials {
  readonly type = AuthorizationType.ApiKey;

  constructor(
    private readonly keyName: string,
    private readonly keyValue: string,
    private readonly location: 'header' | 'query' = 'header'
  ) {}

  get identifier(): string {
    return this.keyName;
  }

  isValid(): boolean {
    return Boolean(this.keyName && this.keyValue);
  }

  getSecurityLevel(): SecurityLevel {
    return SecurityLevel.MEDIUM;
  }

  getKeyName(): string {
    return this.keyName;
  }

  getKeyValue(): string {
    return this.keyValue;
  }

  getLocation(): 'header' | 'query' {
    return this.location;
  }
}

/**
 * OAuth2 Client Credentials
 */
export class OAuth2ClientCredentials implements AuthCredentials {
  readonly type = AuthorizationType.OAuth2Client;

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly tokenUrl: string,
    private readonly scopes?: string[],
    private readonly audience?: string
  ) {}

  get identifier(): string {
    return this.clientId;
  }

  isValid(): boolean {
    return Boolean(this.clientId && this.clientSecret && this.tokenUrl);
  }

  getSecurityLevel(): SecurityLevel {
    return SecurityLevel.HIGH;
  }

  getClientId(): string {
    return this.clientId;
  }

  getClientSecret(): string {
    return this.clientSecret;
  }

  getTokenUrl(): string {
    return this.tokenUrl;
  }

  getScopes(): string[] {
    return this.scopes || [];
  }

  getAudience(): string | undefined {
    return this.audience;
  }
}

/**
 * Authentication token implementation
 */
export class AuthTokenImpl implements AuthToken {
  public readonly value: string;
  public readonly type: string;
  public readonly expiresAt?: Date;
  public readonly scopes?: string[];

  constructor(value: string, type: string = 'Bearer', expiresAt?: Date, scopes?: string[]) {
    this.value = value;
    this.type = type;
    if (expiresAt !== undefined) {
      this.expiresAt = expiresAt;
    }
    if (scopes !== undefined) {
      this.scopes = scopes;
    }
  }

  isExpired(): boolean {
    if (!this.expiresAt) return false;
    return this.expiresAt.getTime() <= Date.now();
  }

  isValid(): boolean {
    return Boolean(this.value && !this.isExpired());
  }

  getRemainingTime(): number {
    if (!this.expiresAt) return Infinity;
    return Math.max(0, this.expiresAt.getTime() - Date.now());
  }

  static create(value: string, expiresInSeconds?: number, scopes?: string[]): AuthTokenImpl {
    const expiresAt = expiresInSeconds ? new Date(Date.now() + expiresInSeconds * 1000) : undefined;

    return new AuthTokenImpl(value, 'Bearer', expiresAt, scopes);
  }
}

/**
 * Authentication domain events
 */
export enum AuthDomainEvent {
  AUTHENTICATION_REQUESTED = 'authentication.requested',
  AUTHENTICATION_SUCCEEDED = 'authentication.succeeded',
  AUTHENTICATION_FAILED = 'authentication.failed',
  TOKEN_REFRESHED = 'token.refreshed',
  TOKEN_EXPIRED = 'token.expired',
  CREDENTIALS_INVALID = 'credentials.invalid',
  PROVIDER_REGISTERED = 'provider.registered',
  CACHE_CLEARED = 'cache.cleared',
}

/**
 * Authentication domain event data
 */
export interface AuthDomainEventData {
  type: AuthDomainEvent;
  timestamp: Date;
  authType: AuthorizationType;
  identifier?: string;
  success?: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Authentication service interface
 */
export interface AuthService {
  /**
   * Process authentication request
   */
  processAuth(credentials: AuthCredentials): Promise<Result<AuthResult, ApicizeError>>;

  /**
   * Validate authentication state
   */
  validateAuth(token: AuthToken): Result<boolean, ApicizeError>;

  /**
   * Generate authentication headers
   */
  generateHeaders(authResult: AuthResult): Result<Record<string, string>, ApicizeError>;
}

// ============= Additional Focused Interfaces (Interface Segregation) =============

/**
 * Token validator - focused on token validation operations
 */
export interface TokenValidator {
  /**
   * Check if token is valid
   */
  isValid(token: AuthToken): boolean;

  /**
   * Check if token is expired
   */
  isExpired(token: AuthToken): boolean;

  /**
   * Get remaining time before expiration
   */
  getRemainingTime(token: AuthToken): number;

  /**
   * Validate token format
   */
  validateFormat(tokenValue: string): Result<boolean, ApicizeError>;
}

/**
 * Token manager - focused on token lifecycle operations
 */
export interface TokenManager {
  /**
   * Create new token
   */
  create(value: string, expiresInSeconds?: number, scopes?: string[]): AuthToken;

  /**
   * Refresh existing token
   */
  refresh(token: AuthToken, credentials: AuthCredentials): Promise<Result<AuthToken, ApicizeError>>;

  /**
   * Revoke token
   */
  revoke(token: AuthToken): Promise<Result<void, ApicizeError>>;
}

/**
 * Credentials validator - focused on credentials validation
 */
export interface CredentialsValidator {
  /**
   * Validate credentials structure
   */
  validate(credentials: AuthCredentials): Result<boolean, ApicizeError>;

  /**
   * Check if credentials meet security requirements
   */
  checkSecurityRequirements(credentials: AuthCredentials): Result<boolean, ApicizeError>;

  /**
   * Get supported credential types
   */
  getSupportedTypes(): AuthorizationType[];
}

/**
 * Header generator - focused on generating authentication headers
 */
export interface AuthHeaderGenerator {
  /**
   * Generate authorization header
   */
  generateAuthHeader(token: AuthToken): Result<string, ApicizeError>;

  /**
   * Generate all authentication headers
   */
  generateHeaders(authResult: AuthResult): Result<Record<string, string>, ApicizeError>;

  /**
   * Get header name for auth type
   */
  getHeaderName(authType: AuthorizationType): string;
}

/**
 * Security evaluator - focused on security assessment
 */
export interface SecurityEvaluator {
  /**
   * Evaluate security level of credentials
   */
  evaluateCredentials(credentials: AuthCredentials): SecurityLevel;

  /**
   * Evaluate security level of auth method
   */
  evaluateMethod(authType: AuthorizationType): SecurityLevel;

  /**
   * Check if security level meets requirements
   */
  meetsRequirements(level: SecurityLevel, required: SecurityLevel): boolean;
}

/**
 * Authentication auditor - focused on audit operations
 */
export interface AuthenticationAuditor {
  /**
   * Log authentication attempt
   */
  logAttempt(credentials: AuthCredentials, success: boolean): void;

  /**
   * Log token usage
   */
  logTokenUsage(token: AuthToken, operation: string): void;

  /**
   * Get authentication history
   */
  getHistory(identifier: string): Promise<Result<AuthDomainEventData[], ApicizeError>>;
}

/**
 * Cache manager for authentication data
 */
export interface AuthCacheManager {
  /**
   * Cache token
   */
  cacheToken(identifier: string, token: AuthToken): Promise<Result<void, ApicizeError>>;

  /**
   * Get cached token
   */
  getCachedToken(identifier: string): Promise<Result<AuthToken | null, ApicizeError>>;

  /**
   * Clear cached data
   */
  clearCache(identifier?: string): Promise<Result<void, ApicizeError>>;

  /**
   * Check if token is cached
   */
  isCached(identifier: string): Promise<Result<boolean, ApicizeError>>;
}

/**
 * OAuth2 specific operations
 */
export interface OAuth2Operations {
  /**
   * Get authorization URL for OAuth2 flows
   */
  getAuthorizationUrl(credentials: OAuth2ClientCredentials): Result<string, ApicizeError>;

  /**
   * Exchange authorization code for token
   */
  exchangeCodeForToken(
    code: string,
    credentials: OAuth2ClientCredentials
  ): Promise<Result<AuthToken, ApicizeError>>;

  /**
   * Refresh OAuth2 token
   */
  refreshOAuth2Token(
    refreshToken: string,
    credentials: OAuth2ClientCredentials
  ): Promise<Result<AuthToken, ApicizeError>>;
}

/**
 * Basic authentication operations
 */
export interface BasicAuthOperations {
  /**
   * Encode basic auth credentials
   */
  encodeCredentials(username: string, password: string): Result<string, ApicizeError>;

  /**
   * Decode basic auth header
   */
  decodeCredentials(
    authHeader: string
  ): Result<{ username: string; password: string }, ApicizeError>;

  /**
   * Validate basic auth format
   */
  validateFormat(authHeader: string): Result<boolean, ApicizeError>;
}

/**
 * API Key operations
 */
export interface ApiKeyOperations {
  /**
   * Generate API key header
   */
  generateHeader(keyName: string, keyValue: string): Result<Record<string, string>, ApicizeError>;

  /**
   * Generate API key query parameters
   */
  generateQueryParams(
    keyName: string,
    keyValue: string
  ): Result<Record<string, string>, ApicizeError>;

  /**
   * Validate API key format
   */
  validateKey(keyValue: string): Result<boolean, ApicizeError>;
}

// ============= Repository Focused Interfaces =============

/**
 * Token repository - focused on token storage operations
 */
export interface TokenRepository {
  /**
   * Store token
   */
  storeToken(identifier: string, token: AuthToken): Promise<Result<void, ApicizeError>>;

  /**
   * Retrieve token
   */
  retrieveToken(identifier: string): Promise<Result<AuthToken | null, ApicizeError>>;

  /**
   * Remove token
   */
  removeToken(identifier: string): Promise<Result<void, ApicizeError>>;

  /**
   * List all token identifiers
   */
  listTokens(): Promise<Result<string[], ApicizeError>>;
}

/**
 * Credentials repository - focused on credentials storage operations
 */
export interface CredentialsRepository {
  /**
   * Store credentials securely
   */
  storeCredentials(
    identifier: string,
    credentials: AuthCredentials
  ): Promise<Result<void, ApicizeError>>;

  /**
   * Retrieve credentials
   */
  retrieveCredentials(identifier: string): Promise<Result<AuthCredentials | null, ApicizeError>>;

  /**
   * Remove credentials
   */
  removeCredentials(identifier: string): Promise<Result<void, ApicizeError>>;

  /**
   * List all credential identifiers
   */
  listCredentials(): Promise<Result<string[], ApicizeError>>;
}

/**
 * Session repository - focused on session management
 */
export interface SessionRepository {
  /**
   * Create session
   */
  createSession(context: AuthContext): Promise<Result<string, ApicizeError>>;

  /**
   * Get session
   */
  getSession(sessionId: string): Promise<Result<AuthContext | null, ApicizeError>>;

  /**
   * Update session
   */
  updateSession(sessionId: string, context: AuthContext): Promise<Result<void, ApicizeError>>;

  /**
   * Remove session
   */
  removeSession(sessionId: string): Promise<Result<void, ApicizeError>>;

  /**
   * List active sessions
   */
  listSessions(): Promise<Result<string[], ApicizeError>>;
}
