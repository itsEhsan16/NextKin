/**
 * Whether sign-up and sign-in go through Clerk (owner, 2026-11-04, toreview §169). It needs the
 * backend (the session is exchanged there) and the publishable key, which Next inlines at build
 * time. Without either, the app keeps the designed sign-in screen: on the mock it opens the app.
 * Self-contained, so the proxy can read it without loading the HTTP client.
 */
const SOURCE = (process.env.NEXT_PUBLIC_DATA_SOURCE ?? '').trim();

export const CLERK_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';
export const CLERK_ENABLED =
  SOURCE !== '' && SOURCE !== 'mock' && CLERK_PUBLISHABLE_KEY.startsWith('pk_');

export const SIGN_UP = '/sign-up';
/** Where Clerk sends the browser after sign-in or sign-up: the server session is made there. */
export const SESSION_BRIDGE = '/session';

/**
 * The Frontend API origin a publishable key names (`pk_test_<base64 "host$">`), for the page CSP.
 */
export function clerkFrontendOrigin(publishableKey: string | undefined): string | null {
  const encoded = publishableKey?.split('_')[2];
  if (!encoded) return null;
  try {
    const host = atob(encoded).replace(/\$$/, '');
    return /^[a-z0-9.-]+$/i.test(host) ? `https://${host}` : null;
  } catch {
    return null;
  }
}
