import { NextRequest, NextResponse, type NextFetchEvent } from 'next/server';

import { clerkMiddleware } from '@clerk/nextjs/server';

import { adminHostRedirect, requestHost } from '@/lib/adminHost';
import { CLERK_ENABLED, CLERK_PUBLISHABLE_KEY } from '@/lib/clerk';
import { landingHostRoute, parseHosts } from '@/lib/landingHost';
import { pageSecurityHeaders } from '@/lib/securityHeaders';

// Page security headers (src/lib/securityHeaders.ts). A proxy rather than next.config `headers()`
// because the storage origin is runtime configuration: the built image runs locally and in the cloud.
const headers = pageSecurityHeaders({
  dev: process.env.NODE_ENV === 'development',
  // Where a browser reaches storage, when the server reaches it by a container name (Docker).
  s3Endpoint: process.env.S3_PUBLIC_ENDPOINT ?? process.env.S3_ENDPOINT,
  awsRegion: process.env.AWS_REGION,
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
  clerkPublishableKey: CLERK_ENABLED ? CLERK_PUBLISHABLE_KEY : undefined,
});

// On the backend, the app's pages need a session: a visit without the session cookie goes to the
// sign-in screen before anything renders, so Home never shows to a signed-out visitor (toreview
// §133.1). The cookie's presence is an optimistic check; an expired session is caught by
// SessionGate and the HTTP client's 401 hook. The name matches packages/server/src/auth/sessions.ts.
const SESSION_COOKIE = '__Host-nk_session';
const SOURCE = (process.env.NEXT_PUBLIC_DATA_SOURCE ?? '').trim();
const USES_BACKEND = SOURCE !== '' && SOURCE !== 'mock';
/**
 * The `(app)` route group: everything behind the shell. And the admin portal, whose own guard is
 * the server (`/api/v1/admin/*` refuses a non-staff session); a signed-out visitor to it goes to
 * the staff sign-in (Figma 410:1605) rather than the user app's.
 */
const APP_ROUTES = [
  'admin',
  'applications',
  'assistant',
  'create',
  'documents',
  'help',
  'insights',
  'interview',
  'jd',
  'jobs',
  'profile',
  'resumes',
  'settings',
  'upgrade',
  'upload-jd',
];

/** Staff sign in here, so it must open without a session. */
const ADMIN_SIGN_IN = '/admin/sign-in';

function needsSession(pathname: string): boolean {
  if (pathname === '/') return true;
  if (pathname === ADMIN_SIGN_IN || pathname.startsWith(`${ADMIN_SIGN_IN}/`)) return false;
  const first = pathname.split('/')[1] ?? '';
  return APP_ROUTES.includes(first);
}

function withHeaders(response: NextResponse): NextResponse {
  for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
  return response;
}

/** The admin portal's own host (toreview §249), e.g. admin.app.nextkin.ai. Unset: /admin as before. */
const ADMIN_HOST = process.env.ADMIN_HOST?.trim().toLowerCase() || undefined;

/** The marketing host(s), e.g. nextkin.ai, and the app's own host it hands app paths to. */
const LANDING_HOSTS = parseHosts(process.env.LANDING_HOST);
const APP_HOST = process.env.APP_HOST?.trim().toLowerCase() || undefined;

function pages(request: NextRequest) {
  // Before the session check: the portal and the user app each answer on their own host only.
  const host = requestHost(request.headers);
  const moved = adminHostRedirect({
    host,
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    adminHost: ADMIN_HOST,
  });
  if (moved) {
    // Absolute and https either way: behind CloudFront the container itself is reached over http,
    // so a target built from request.url would bounce through one more redirect.
    const target = moved.startsWith('https://')
      ? new URL(moved)
      : new URL(moved, `https://${host}`);
    return withHeaders(NextResponse.redirect(target, 308));
  }
  // The marketing host: `/` is the landing page, app paths move to the app host.
  const landing = landingHostRoute({
    host,
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    landingHosts: LANDING_HOSTS,
    appHost: APP_HOST,
  });
  if (landing?.kind === 'redirect') {
    return withHeaders(NextResponse.redirect(new URL(landing.location), 308));
  }
  if (landing?.kind === 'rewrite') {
    const target = request.nextUrl.clone();
    target.pathname = landing.pathname;
    return withHeaders(NextResponse.rewrite(target));
  }
  if (
    USES_BACKEND &&
    needsSession(request.nextUrl.pathname) &&
    !request.cookies.has(SESSION_COOKIE)
  ) {
    const signIn = request.nextUrl.clone();
    signIn.pathname = request.nextUrl.pathname.startsWith('/admin') ? ADMIN_SIGN_IN : '/sign-in';
    signIn.search = '';
    return withHeaders(NextResponse.redirect(signIn));
  }
  return withHeaders(NextResponse.next());
}

// With Clerk, its middleware runs first: it keeps the browser's Clerk session current (the
// development instance's handshake included) for the sign-in pages and the session bridge. The
// app's own pages still go by the server session cookie above, never by Clerk's (toreview §169).
const clerkPages = clerkMiddleware((_auth, request) => pages(request));

/**
 * The scheme the visitor used. CloudFront reaches the load balancer over plain HTTP, so the
 * balancer says `x-forwarded-proto: http`, and Clerk's handshake would send the browser back to
 * an http:// address. CloudFront's own `cloudfront-forwarded-proto` names the visitor's scheme;
 * the balancer only accepts requests from CloudFront (the origin-verify header), so it is trusted.
 */
function withViewerScheme(request: NextRequest): NextRequest {
  const viewer = request.headers.get('cloudfront-forwarded-proto');
  if (viewer !== 'https' && viewer !== 'http') return request;
  const headers = new Headers(request.headers);
  headers.set('x-forwarded-proto', viewer);
  return new NextRequest(request, { headers });
}

const clerkProxy = (request: NextRequest, event: NextFetchEvent) =>
  clerkPages(withViewerScheme(request), event);

// The admin host never runs Clerk: staff sign in with the server's own accounts (TOTP), and
// Clerk's development handshake has no business on the portal's address.
const isAdminHost = (request: NextRequest) =>
  ADMIN_HOST !== undefined && requestHost(request.headers) === ADMIN_HOST;

export const proxy = CLERK_ENABLED
  ? (request: NextRequest, event: NextFetchEvent) =>
      isAdminHost(request) ? pages(request) : clerkProxy(request, event)
  : pages;

export const config = {
  // Pages only: the API sets its own headers, and static assets need none.
  matcher: [
    '/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|jpg|jpeg|webp|ico|txt|woff2?)$).*)',
  ],
};
