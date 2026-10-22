import { NextResponse } from 'next/server';

import { pageSecurityHeaders } from '@/lib/securityHeaders';

// Page security headers (src/lib/securityHeaders.ts). A proxy rather than next.config `headers()`
// because the storage origin is runtime configuration: the built image runs locally and in the cloud.
const headers = pageSecurityHeaders({
  dev: process.env.NODE_ENV === 'development',
  s3Endpoint: process.env.S3_ENDPOINT,
  awsRegion: process.env.AWS_REGION,
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
});

export function proxy() {
  const response = NextResponse.next();
  for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
  return response;
}

export const config = {
  // Pages only: the API sets its own headers, and static assets need none.
  matcher: ['/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|jpg|jpeg|webp|ico|txt|woff2?)$).*)'],
};
