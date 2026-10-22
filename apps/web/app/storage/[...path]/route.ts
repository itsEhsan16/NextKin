/**
 * Local storage, reached through this origin (development only, toreview §131.7–.9). A page opened
 * from another address (a Cloudflare tunnel) cannot call the storage stand-in on 127.0.0.1, so
 * `browserStorageUrl` sends its presigned links here, and this fetches them from storage itself.
 * Fetching (rather than a next.config rewrite) matters: a rewrite forwards the tunnel's Host, and a
 * presigned GET signs storage's own host, so storage refused it. The query string — the signature —
 * and the body pass through untouched. Production never serves this route.
 */

const PASS_REQUEST = ['content-type', 'content-length', 'range'];
const PASS_RESPONSE = [
  'content-type',
  'content-length',
  'content-disposition',
  'content-range',
  'etag',
  'last-modified',
  'accept-ranges',
];

async function forward(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const endpoint = process.env.S3_ENDPOINT;
  if (process.env.NODE_ENV === 'production' || !endpoint)
    return new Response(null, { status: 404 });
  const { path } = await params;
  const target = `${endpoint.replace(/\/$/, '')}/${path.map(encodeURIComponent).join('/')}${new URL(request.url).search}`;
  const headers = new Headers();
  for (const name of PASS_REQUEST) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const upstream = await fetch(target, {
    method: request.method,
    headers,
    ...(hasBody ? { body: request.body, duplex: 'half' } : {}),
    redirect: 'manual',
  } as RequestInit);
  const out = new Headers();
  for (const name of PASS_RESPONSE) {
    const value = upstream.headers.get(name);
    if (value) out.set(name, value);
  }
  return new Response(upstream.body, { status: upstream.status, headers: out });
}

export const GET = forward;
export const HEAD = forward;
export const POST = forward;
