import type { TokenSetWire } from '../../schemas/auth';
import { errorEnvelopeSchema, type ErrorCode } from '../../schemas/envelope';
import { tokenSetSchema } from '../../schemas/auth';
import { ConsentRequiredError, ExportBlockedError, NotFoundError, PlanLockedError } from '../state';
import type { Page } from '../types';

/**
 * The HTTP client core (ImBackendImplementationPlan P5-01, old plan C-02). Every HTTP repository
 * and the auth client send through it. Phone-safe: `fetch`, `AbortController` and zod only.
 *
 * - **Auth.** Web sends the same-origin `__Host-` cookie and stores nothing. Mobile sends a bearer
 *   token from the app's TokenStore (expo-secure-store) and, on a 401, refreshes once and retries.
 *   Refreshes are single-flight: refresh tokens rotate with reuse detection, so two parallel
 *   refreshes with the same token would look like theft and end the session.
 * - **Headers.** `X-Request-Id` (the server adopts it as the correlation id), `X-Client` and
 *   `X-Client-Version` (old store builds get 426).
 * - **Retries.** One jittered retry, only for reads and for writes that carry an
 *   `Idempotency-Key`, and only on a network failure, timeout, 502, 503 or 504. Nothing else is
 *   ever sent twice.
 * - **Errors** become the classes screens already branch on: a real `NotFoundError` and
 *   `PlanLockedError` (mobile uses `instanceof`), otherwise an `ApiError` whose `code` is the
 *   envelope's and whose message is the server's, verbatim (ZERO_BLANK is shown as is).
 */

export interface TokenStore {
  get(): Promise<TokenSetWire | null>;
  set(tokens: TokenSetWire | null): Promise<void>;
}

export interface HttpClientOptions {
  /** API origin, e.g. http://192.168.1.20:3000 for a phone on the LAN; '' for same-origin web. */
  baseUrl: string;
  client: 'web' | 'mobile';
  /** Sent as X-Client; mobile passes `Platform.OS` ('ios' | 'android'). Defaults to `client`. */
  platform?: string;
  /** Required for mobile. */
  tokens?: TokenStore;
  fetch?: typeof fetch;
  /** Sent as X-Client-Version so the server can ask old store builds to update (426). */
  clientVersion?: string;
  /** Per attempt. Default 15 s. */
  timeoutMs?: number;
  /** Called once when the session is gone for good (refresh failed, or the server said 401). */
  onSignedOut?: () => void;
  /** Test seam: how long to wait before the one retry. */
  retryDelayMs?: () => number;
}

export interface HttpRequest {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  /** Lists go out as repeated keys (`?remote=remote&remote=hybrid`); empty lists are left out. */
  query?: Record<string, string | number | readonly string[] | undefined>;
  idempotencyKey?: string;
  /**
   * False for the auth endpoints themselves: a 401 there is a wrong password, not a lost session,
   * so it is neither refreshed nor treated as a sign-out. The bearer token is still sent.
   */
  authenticated?: boolean;
}

export interface HttpResult<T> {
  data: T;
  status: number;
  etag: string | null;
}

/** An API failure in the shared envelope. `code` is what screens branch on. */
export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode | 'NETWORK',
    message: string,
    readonly status: number,
    readonly details: unknown = null,
    readonly requestId: string | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const RETRYABLE_STATUS = new Set([502, 503, 504]);

/** A short random id; not a secret, only a correlation handle. */
export function newRequestId(): string {
  let id = '';
  for (let i = 0; i < 16; i++) id += Math.floor(Math.random() * 16).toString(16);
  return `cli_${id}`;
}

/** An idempotency key for one logical write; reuse it only for the retry of that same write. */
export const newIdempotencyKey = (): string => `idem_${newRequestId().slice(4)}${newRequestId().slice(4)}`;

/** Maps an error envelope onto the client's error classes. */
export function toClientError(code: ErrorCode, message: string, status: number, details: unknown, requestId: string | null): Error {
  if (code === 'NOT_FOUND') {
    const error = new NotFoundError('Resource', '');
    error.message = message;
    return error;
  }
  if (code === 'PLAN_LOCKED') {
    const error = new PlanLockedError('');
    error.message = message;
    const d = (details ?? {}) as { reason?: string; limit?: number; resetsAt?: string };
    if (d.reason) error.reason = d.reason;
    if (typeof d.limit === 'number') error.limit = d.limit;
    if (d.resetsAt) error.resetsAt = d.resetsAt;
    return error;
  }
  if (code === 'CONSENT_REQUIRED') return new ConsentRequiredError(message);
  if (code === 'EXPORT_BLOCKED') {
    const reason = (details as { reason?: string } | null)?.reason;
    return new ExportBlockedError(reason === 'review' || reason === 'email' || reason === 'incomplete' ? reason : 'accuracy', message);
  }
  return new ApiError(code, message, status, details, requestId);
}

export function createHttpClient(options: HttpClientOptions) {
  const doFetch = options.fetch ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));
  const base = options.baseUrl.replace(/\/$/, '');
  const mobile = options.client === 'mobile';
  const timeoutMs = options.timeoutMs ?? 15_000;
  const retryDelay = options.retryDelayMs ?? (() => 200 + Math.floor(Math.random() * 400));
  if (mobile && !options.tokens) throw new Error('A mobile HTTP client needs a TokenStore.');
  let refreshing: Promise<boolean> | null = null;

  function url(path: string, query?: HttpRequest['query']): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value === undefined) continue;
      if (Array.isArray(value)) for (const item of value) params.append(key, String(item));
      else params.set(key, String(value));
    }
    const qs = params.toString();
    return `${base}/api/v1${path}${qs ? `?${qs}` : ''}`;
  }

  async function attempt(path: string, init: HttpRequest, requestId: string, accessToken?: string): Promise<Response> {
    const headers: Record<string, string> = { accept: 'application/json', 'x-request-id': requestId, 'x-client': options.platform ?? options.client, ...init.headers };
    if (init.body !== undefined) headers['content-type'] = 'application/json';
    if (options.clientVersion) headers['x-client-version'] = options.clientVersion;
    if (options.platform) headers['x-client-platform'] = options.platform;
    if (init.idempotencyKey) headers['idempotency-key'] = init.idempotencyKey;
    if (accessToken) headers.authorization = `Bearer ${accessToken}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await doFetch(url(path, init.query), {
        method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        credentials: mobile ? 'omit' : 'include',
        signal: controller.signal,
      });
    } catch {
      const timedOut = controller.signal.aborted;
      throw new ApiError('NETWORK', timedOut ? 'NextKin took too long to answer. Try again.' : 'Could not reach NextKin. Check your connection.', 0, null, requestId);
    } finally {
      clearTimeout(timer);
    }
  }

  /** One request, retried once when it is safe to send twice. */
  async function sendOnce(path: string, init: HttpRequest, accessToken?: string): Promise<Response> {
    const requestId = newRequestId();
    const method = (init.method ?? (init.body === undefined ? 'GET' : 'POST')).toUpperCase();
    const retryable = method === 'GET' || Boolean(init.idempotencyKey);
    try {
      const res = await attempt(path, init, requestId, accessToken);
      if (!retryable || !RETRYABLE_STATUS.has(res.status)) return res;
    } catch (error) {
      if (!retryable) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, retryDelay()));
    return attempt(path, init, requestId, accessToken);
  }

  async function failure(res: Response): Promise<Error> {
    const parsed = errorEnvelopeSchema.safeParse(await res.json().catch(() => null));
    if (parsed.success) {
      const { code, message, details, request_id } = parsed.data.error;
      return toClientError(code, message, res.status, details, request_id);
    }
    return new ApiError(res.status >= 500 ? 'INTERNAL' : 'VALIDATION_FAILED', 'Something went wrong.', res.status);
  }

  async function signedOut() {
    if (mobile) await options.tokens!.set(null);
    options.onSignedOut?.();
  }

  function refresh(): Promise<boolean> {
    refreshing ??= (async () => {
      try {
        const current = await options.tokens!.get();
        if (!current) return false;
        const res = await sendOnce('/auth/token/refresh', { body: { refreshToken: current.refreshToken } });
        if (!res.ok) return false;
        await options.tokens!.set(tokenSetSchema.parse(await res.json()));
        return true;
      } catch {
        return false;
      } finally {
        refreshing = null;
      }
    })();
    return refreshing;
  }

  /** Sends a request; returns the parsed body (null for 204), the status and the ETag. */
  async function send<T = unknown>(path: string, init: HttpRequest = {}): Promise<HttpResult<T>> {
    const authenticated = init.authenticated ?? true;
    // The token always goes along: logout needs it to name the session it ends. Only what a 401
    // means depends on `authenticated`.
    const token = mobile ? (await options.tokens!.get())?.accessToken : undefined;
    let res = await sendOnce(path, init, token);
    if (res.status === 401 && authenticated) {
      if (mobile && token && (await refresh())) res = await sendOnce(path, init, (await options.tokens!.get())?.accessToken);
      if (res.status === 401) {
        const error = await failure(res);
        await signedOut();
        throw error;
      }
    }
    if (!res.ok) throw await failure(res);
    const data = (res.status === 204 ? null : await res.json()) as T;
    return { data, status: res.status, etag: res.headers.get('etag') };
  }

  return {
    client: options.client,
    tokens: options.tokens,
    send,
    request: async <T = unknown>(path: string, init: HttpRequest = {}): Promise<T> => (await send<T>(path, init)).data,
    /** Absolute URL for a browser navigation (federated sign-in, linking). */
    url: (path: string, query?: HttpRequest['query']) => url(path, query),
  };
}

export type HttpClient = ReturnType<typeof createHttpClient>;

/**
 * Reads every page of a cursor-paginated list, up to `maxPages`, for repository methods whose
 * interface still returns a whole list (§2.2: the server paginates every list; the client pages
 * internally, bounded, until each interface migrates).
 */
export async function collectPages<T>(fetchPage: (cursor?: string) => Promise<Page<T>>, maxPages = 20): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const result = await fetchPage(cursor);
    items.push(...result.items);
    if (!result.nextCursor) return items;
    cursor = result.nextCursor;
  }
  return items;
}
