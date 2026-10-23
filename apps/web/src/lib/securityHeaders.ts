/**
 * Security headers for every page (P13-01 follow-up; `toreview.md` §105.21). The API sets its own
 * in `packages/server` (Hono); these cover the HTML the Next server renders.
 *
 * - **Clickjacking:** `frame-ancestors 'none'` plus `X-Frame-Options: DENY` for older browsers. No
 *   page is meant to be framed, and no page frames anything (`frame-src 'none'`).
 * - **CSP without nonces.** A nonce needs every page rendered per request, which would undo the
 *   static, prefetchable routes (§84). So scripts are `'self' 'unsafe-inline'`, as Next's guide
 *   prescribes for that case: it still blocks scripts from any other origin, plugins, `<base>`
 *   hijacking, form posts elsewhere and framing. `'unsafe-eval'` only in development (React's
 *   error overlay needs it).
 * - **Storage is the one other origin.** Uploads POST straight to object storage and avatars load
 *   from presigned GETs, so its origin is allowed for `connect-src` and `img-src`. Locally that is
 *   the S3 endpoint; in the cloud, S3 itself (the endpoint override is refused there, L3).
 */
export interface SecurityHeaderOptions {
  dev: boolean;
  /** The S3 endpoint override (local only), e.g. http://127.0.0.1:8333. */
  s3Endpoint?: string | undefined;
  awsRegion?: string | undefined;
  /** NEXT_PUBLIC_API_BASE_URL, when the API is on another origin. */
  apiBaseUrl?: string | undefined;
}

const originOf = (url: string | undefined): string | null => {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
};

export function storageOrigins(
  options: Pick<SecurityHeaderOptions, 's3Endpoint' | 'awsRegion'>,
): string[] {
  const local = originOf(options.s3Endpoint);
  if (local) return [local];
  const region = options.awsRegion ?? 'us-east-1';
  // Presigned URLs are virtual-hosted: https://<bucket>.s3.<region>.amazonaws.com/...
  return [`https://*.s3.${region}.amazonaws.com`, 'https://*.s3.amazonaws.com'];
}

export function contentSecurityPolicy(options: SecurityHeaderOptions): string {
  const storage = storageOrigins(options);
  const api = originOf(options.apiBaseUrl);
  // blob: because the browser uploader reads the picked file back from its blob: URL with fetch.
  const connect = ["'self'", 'blob:', ...storage, ...(api ? [api] : [])];
  const insecure = [...storage, ...(api ? [api] : [])].some((o) => o.startsWith('http:'));
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${options.dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${storage.join(' ')}`,
    "font-src 'self' data:",
    `connect-src ${connect.join(' ')}`,
    "worker-src 'self' blob:",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    // Not while any allowed origin is plain http (local storage); it would rewrite those requests.
    ...(options.dev || insecure ? [] : ['upgrade-insecure-requests']),
  ];
  return directives.join('; ');
}

export function pageSecurityHeaders(options: SecurityHeaderOptions): Record<string, string> {
  return {
    'Content-Security-Policy': contentSecurityPolicy(options),
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
  };
}
