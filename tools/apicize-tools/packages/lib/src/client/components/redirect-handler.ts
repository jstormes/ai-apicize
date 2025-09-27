/**
 * Redirect Handler - Responsible for handling HTTP redirects
 */

import { HttpMethod } from '../../types';
import { Url } from '../../domain/value-objects';
import { Result, success, failure } from '../../infrastructure/result';
import { ApicizeError, ApicizeErrorCode } from '../../infrastructure/errors';
import { HttpRequest } from '../../domain/execution/execution-domain';

/**
 * Redirect handler configuration
 */
export interface RedirectHandlerConfig {
  maxRedirects?: number;
  followRedirects?: boolean;
  allowDowngradeToHttp?: boolean;
  preserveAuthOnRedirect?: boolean;
  preserveBodyOnRedirect?: boolean;
  trustedDomains?: string[];
}

/**
 * Redirect information
 */
export interface RedirectInfo {
  fromUrl: string;
  toUrl: string;
  statusCode: number;
  method: HttpMethod;
  preserveBody: boolean;
  redirectCount: number;
}

/**
 * Redirect handler implementation
 */
export class ApicizeRedirectHandler {
  private config: RedirectHandlerConfig;

  constructor(config: RedirectHandlerConfig = {}) {
    this.config = {
      maxRedirects: 10,
      followRedirects: true,
      allowDowngradeToHttp: false,
      preserveAuthOnRedirect: false,
      preserveBodyOnRedirect: false,
      trustedDomains: [],
      ...config,
    };
  }

  /**
   * Handle redirect response and return new request or null
   */
  handleRedirect(
    response: Response,
    request: HttpRequest,
    redirectCount: number
  ): Result<HttpRequest | null, ApicizeError> {
    try {
      // Check if redirects are enabled
      if (!this.config.followRedirects) {
        return success(null);
      }

      // Check if this is actually a redirect
      if (!this.isRedirect(response)) {
        return success(null);
      }

      // Check redirect limit
      if (redirectCount >= this.config.maxRedirects!) {
        return failure(
          new ApicizeError(
            ApicizeErrorCode.NETWORK_ERROR,
            `Too many redirects (limit: ${this.config.maxRedirects})`,
            {
              context: {
                redirectCount,
                maxRedirects: this.config.maxRedirects,
                currentUrl: request.url.toString(),
              },
            }
          )
        );
      }

      // Get redirect URL
      const redirectUrlResult = this.getRedirectUrl(response, request.url);
      if (redirectUrlResult.isFailure()) {
        return redirectUrlResult as any;
      }

      const redirectUrl = redirectUrlResult.data;

      // Security checks
      const securityCheckResult = this.performSecurityChecks(request.url, redirectUrl);
      if (securityCheckResult.isFailure()) {
        return securityCheckResult as any;
      }

      // Determine new HTTP method
      const newMethod = this.getRedirectMethod(request.method, response.status);

      // Determine if body should be preserved
      const preserveBody = this.shouldPreserveBody(request.method, newMethod, response.status);

      // Create new request
      const newRequest: HttpRequest = {
        ...request,
        url: redirectUrl,
        method: newMethod,
        body: preserveBody
          ? request.body
          : request.body.constructor === request.body.constructor
            ? (request.body as any).constructor.none()
            : request.body,
        headers: this.processHeadersForRedirect(request, redirectUrl),
        metadata: {
          ...request.metadata,
          redirectCount: redirectCount + 1,
          originalUrl: request.metadata.originalUrl || request.url.toString(),
          redirectChain: [
            ...((request.metadata.redirectChain as RedirectInfo[]) || []),
            {
              fromUrl: request.url.toString(),
              toUrl: redirectUrl.toString(),
              statusCode: response.status,
              method: newMethod,
              preserveBody,
              redirectCount: redirectCount + 1,
            },
          ],
        },
      };

      return success(newRequest);
    } catch (error) {
      return failure(
        new ApicizeError(ApicizeErrorCode.INTERNAL_ERROR, 'Failed to handle redirect', {
          cause: error as Error,
          context: {
            status: response.status,
            redirectCount,
            currentUrl: request.url.toString(),
          },
        })
      );
    }
  }

  /**
   * Check if response is a redirect
   */
  isRedirect(response: Response): boolean {
    return response.status >= 300 && response.status < 400 && response.status !== 304;
  }

  /**
   * Get redirect URL from response
   */
  getRedirectUrl(response: Response, currentUrl: Url): Result<Url, ApicizeError> {
    try {
      const location = response.headers.get('location');

      if (!location) {
        return failure(
          new ApicizeError(
            ApicizeErrorCode.NETWORK_ERROR,
            'Redirect response missing location header',
            { context: { status: response.status, url: currentUrl.toString() } }
          )
        );
      }

      // Handle relative URLs
      let redirectUrl: Url;
      try {
        // Try as absolute URL first
        redirectUrl = new Url(location);
      } catch {
        // If that fails, resolve relative to current URL
        try {
          const resolved = new URL(location, currentUrl.toString());
          redirectUrl = new Url(resolved.toString());
        } catch (error) {
          return failure(
            new ApicizeError(
              ApicizeErrorCode.INVALID_ARGUMENT,
              `Invalid redirect location: ${location}`,
              { cause: error as Error, context: { location, currentUrl: currentUrl.toString() } }
            )
          );
        }
      }

      return success(redirectUrl);
    } catch (error) {
      return failure(
        new ApicizeError(ApicizeErrorCode.INTERNAL_ERROR, 'Failed to get redirect URL', {
          cause: error as Error,
        })
      );
    }
  }

  /**
   * Determine HTTP method for redirect
   */
  getRedirectMethod(originalMethod: HttpMethod, statusCode: number): HttpMethod {
    // 303 See Other: Always use GET
    if (statusCode === 303) {
      return HttpMethod.GET;
    }

    // 301, 302: POST/PUT/PATCH typically become GET (historical browser behavior)
    if (
      (statusCode === 301 || statusCode === 302) &&
      [HttpMethod.POST, HttpMethod.PUT, HttpMethod.PATCH].includes(originalMethod)
    ) {
      return HttpMethod.GET;
    }

    // 307, 308: Preserve original method
    if (statusCode === 307 || statusCode === 308) {
      return originalMethod;
    }

    // Default: preserve original method
    return originalMethod;
  }

  /**
   * Determine if request body should be preserved
   */
  private shouldPreserveBody(
    originalMethod: HttpMethod,
    newMethod: HttpMethod,
    statusCode: number
  ): boolean {
    // If configured to never preserve body on redirect
    if (!this.config.preserveBodyOnRedirect) {
      return false;
    }

    // If method changes from body-supporting to non-body-supporting method
    const originalSupportsBody = [HttpMethod.POST, HttpMethod.PUT, HttpMethod.PATCH].includes(
      originalMethod
    );
    const newSupportsBody = [HttpMethod.POST, HttpMethod.PUT, HttpMethod.PATCH].includes(newMethod);

    if (originalSupportsBody && !newSupportsBody) {
      return false;
    }

    // For 307 and 308, preserve body if methods are the same
    if ((statusCode === 307 || statusCode === 308) && originalMethod === newMethod) {
      return true;
    }

    return false;
  }

  /**
   * Process headers for redirect
   */
  private processHeadersForRedirect(
    request: HttpRequest,
    redirectUrl: Url
  ): typeof request.headers {
    const newHeaders = request.headers.clone();

    // Remove authorization headers when redirecting to different domain
    if (!this.config.preserveAuthOnRedirect && !this.isSameDomain(request.url, redirectUrl)) {
      newHeaders.delete('authorization');
      newHeaders.delete('cookie');
    }

    // Update host header
    newHeaders.set('host', redirectUrl.host);

    // Remove content-length if body is not preserved
    if (!this.shouldPreserveBody(request.method, request.method, 0)) {
      newHeaders.delete('content-length');
      newHeaders.delete('content-type');
    }

    return newHeaders;
  }

  /**
   * Perform security checks for redirect
   */
  private performSecurityChecks(currentUrl: Url, redirectUrl: Url): Result<void, ApicizeError> {
    // Check for downgrade from HTTPS to HTTP
    if (currentUrl.isSecure() && !redirectUrl.isSecure() && !this.config.allowDowngradeToHttp) {
      return failure(
        new ApicizeError(
          ApicizeErrorCode.VALIDATION_ERROR,
          'Redirect from HTTPS to HTTP is not allowed',
          {
            context: {
              from: currentUrl.toString(),
              to: redirectUrl.toString(),
            },
          }
        )
      );
    }

    // Check trusted domains if configured
    if (this.config.trustedDomains && this.config.trustedDomains.length > 0) {
      const redirectHost = redirectUrl.host;
      const isTrusted = this.config.trustedDomains.some(domain => {
        return redirectHost === domain || redirectHost.endsWith('.' + domain);
      });

      if (!isTrusted) {
        return failure(
          new ApicizeError(
            ApicizeErrorCode.PERMISSION_DENIED,
            `Redirect to untrusted domain: ${redirectHost}`,
            {
              context: {
                redirectHost,
                trustedDomains: this.config.trustedDomains,
              },
            }
          )
        );
      }
    }

    return success(undefined);
  }

  /**
   * Check if two URLs are from the same domain
   */
  private isSameDomain(url1: Url, url2: Url): boolean {
    return url1.host === url2.host;
  }

  /**
   * Get redirect chain from request metadata
   */
  getRedirectChain(request: HttpRequest): RedirectInfo[] {
    return (request.metadata.redirectChain as RedirectInfo[]) || [];
  }

  /**
   * Check if request has been redirected
   */
  hasBeenRedirected(request: HttpRequest): boolean {
    return this.getRedirectChain(request).length > 0;
  }

  /**
   * Get original URL before any redirects
   */
  getOriginalUrl(request: HttpRequest): string {
    return (request.metadata.originalUrl as string) || request.url.toString();
  }

  /**
   * Create a copy with different configuration
   */
  withConfig(newConfig: Partial<RedirectHandlerConfig>): ApicizeRedirectHandler {
    return new ApicizeRedirectHandler({ ...this.config, ...newConfig });
  }

  /**
   * Get current configuration
   */
  getConfig(): RedirectHandlerConfig {
    return { ...this.config };
  }
}
