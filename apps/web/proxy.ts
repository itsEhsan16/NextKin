import { NextResponse, type NextRequest } from 'next/server';

import { pageSecurityHeaders } from '@/lib/securityHeaders';

// Page security headers (src/lib/securityHeaders.ts). A proxy rather than next.config `headers()`
// because the storage origin is runtime configuration: the built image runs locally and in the cloud.
const headers = pageSecurityHeaders({
  dev: process.env.NODE_ENV === 'development',
  // Where a browser reaches storage, when the server reaches it by a container name (Docker).
  s3Endpoint: process.env.S3_PUBLIC_ENDPOINT ?? process.env.S3_ENDPOINT,
  awsRegion: process.env.AWS_REGION,
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
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

export function proxy(request: NextRequest) {
  if (USES_BACKEND && needsSession(request.nextUrl.pathname) && !request.cookies.has(SESSION_COOKIE)) {
    const signIn = request.nextUrl.clone();
    signIn.pathname = request.nextUrl.pathname.startsWith('/admin') ? ADMIN_SIGN_IN : '/sign-in';
    signIn.search = '';
    return withHeaders(NextResponse.redirect(signIn));
  }
  return withHeaders(NextResponse.next());
}

export const config = {
  // Pages only: the API sets its own headers, and static assets need none.
  matcher: ['/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|jpg|jpeg|webp|ico|txt|woff2?)$).*)'],
};
