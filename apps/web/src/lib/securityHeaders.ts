import { clerkFrontendOrigin } from './clerk';

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
 * - **Clerk, when sign-in goes through it** (toreview §169): its Frontend API (named by the
 *   publishable key) for scripts and calls, img.clerk.com for avatars, Cloudflare Turnstile
 *   (challenges.cloudflare.com, the only frame a page shows) and Clerk Protect, the bot check
 *   that refuses sign-up without it: a script from cdn.protect.clerk.com, the `blob:` scripts it
 *   makes, and calls to *.client.protect.clerk.com on several ports.
 */
export interface SecurityHeaderOptions {
  dev: boolean;
  /**
   * The S3 endpoint a browser reaches (local only), e.g. http://127.0.0.1:8333: S3_PUBLIC_ENDPOINT
   * when the server reaches storage by another name, as in Docker, else S3_ENDPOINT.
   */
  s3Endpoint?: string | undefined;
  awsRegion?: string | undefined;
  /** NEXT_PUBLIC_API_BASE_URL, when the API is on another origin. */
  apiBaseUrl?: string | undefined;
  /** NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, when sign-in goes through Clerk. */
  clerkPublishableKey?: string | undefined;
}

const TURNSTILE = 'https://challenges.cloudflare.com';
const PROTECT_SCRIPT = 'https://cdn.protect.clerk.com';
const PROTECT_CONNECT = ['https://*.protect.clerk.com', 'https://*.protect.clerk.com:*'];

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
  const clerk = clerkFrontendOrigin(options.clerkPublishableKey);
  const clerkScript = clerk ? ` ${clerk} ${TURNSTILE} ${PROTECT_SCRIPT} blob:` : '';
  // blob: because the browser uploader reads the picked file back from its blob: URL with fetch.
  const connect = [
    "'self'",
    'blob:',
    ...storage,
    ...(api ? [api] : []),
    ...(clerk ? [clerk, ...PROTECT_CONNECT, 'https://clerk-telemetry.com'] : []),
  ];
  const insecure = [...storage, ...(api ? [api] : [])].some((o) => o.startsWith('http:'));
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${options.dev ? " 'unsafe-eval'" : ''}${clerkScript}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${storage.join(' ')}${clerk ? ' https://img.clerk.com' : ''}`,
    "font-src 'self' data:",
    `connect-src ${connect.join(' ')}`,
    "worker-src 'self' blob:",
    clerk ? `frame-src ${TURNSTILE}` : "frame-src 'none'",
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
