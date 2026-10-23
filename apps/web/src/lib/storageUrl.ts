/** Where `app/storage/[...path]/route.ts` serves local storage in development (toreview §131.9). */
export const STORAGE_PROXY_PATH = '/storage';

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);

/**
 * A storage link the browser can reach (toreview §131.7). Locally, presigned links point at the
 * storage stand-in on this machine (`http://127.0.0.1:8333/...`). A page opened from another
 * address (a Cloudflare tunnel, another device) cannot reach that: Chrome blocks a public page
 * from calling a local address, and storage only allows localhost. Such links are sent through
 * this page's own origin instead, which a dev-only route fetches from storage itself, so the host
 * storage sees is the one that was signed. Anything else — the cloud's own storage, or a page
 * opened on localhost — is left as it is.
 */
export function browserStorageUrl(
  url: string,
  pageHost: string | undefined = typeof window === 'undefined'
    ? undefined
    : window.location.hostname,
): string {
  if (pageHost === undefined) return url;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (!LOOPBACK.has(parsed.hostname) || LOOPBACK.has(pageHost)) return url;
  return `${STORAGE_PROXY_PATH}${parsed.pathname}${parsed.search}`;
}
