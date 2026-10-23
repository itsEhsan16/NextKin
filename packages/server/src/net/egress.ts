import type { Config } from '../config';

/**
 * The egress allowlist (ImBackendImplementationPlan P11-06). Every outbound HTTP request the server
 * makes goes through `guardedFetch`, which refuses any host not on the list. The list is built from
 * the adapters this process actually uses: the Claude API only with a developer key, the job
 * providers only when real providers are on, the sign-in issuers that are configured. No URL a user
 * supplies is ever fetched (D-17), and lint bans the global `fetch` anywhere else in `src`.
 *
 * The AWS SDK, the OTLP exporter, SMTP and ClamAV use their own clients, outside this guard; in the
 * cloud they are held by network egress rules (X-04), and the threat model records that.
 */

export class EgressBlockedError extends Error {
  constructor(readonly host: string) {
    super(`outbound request to ${host} is not on the egress allowlist`);
    this.name = 'EgressBlockedError';
  }
}

let allowed: ReadonlySet<string> = new Set();
let base: typeof fetch = (input, init) => globalThis.fetch(input, init);

/** Sets the hosts this process may reach. Called once at start-up from the configuration. */
export function setEgressAllowlist(hosts: Iterable<string>, fetchImpl?: typeof fetch): void {
  allowed = new Set([...hosts].map((h) => h.toLowerCase()));
  if (fetchImpl) base = fetchImpl;
}

export const egressAllowlist = (): string[] => [...allowed];

const hostOf = (input: Parameters<typeof fetch>[0]): string => {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  return new URL(raw).hostname.toLowerCase();
};

/** `fetch`, refusing any host not on the allowlist before a byte leaves the process. */
export const guardedFetch: typeof fetch = async (input, init) => {
  const host = hostOf(input);
  if (!allowed.has(host)) throw new EgressBlockedError(host);
  return base(input, init);
};

/**
 * The LaTeX compile service's host (toreview §111): the worker's allowlist only, never the web
 * process's, since only the worker compiles. Locally 127.0.0.1, the `latex-relay` port.
 */
export function latexEgressHosts(config: Pick<Config, 'LATEX_COMPILER_URL'>): string[] {
  return [new URL(config.LATEX_COMPILER_URL).hostname];
}

const JOB_PROVIDER_HOSTS =['api.adzuna.com', 'jsearch.p.rapidapi.com'];

/** The hosts the configured adapters need, and nothing else. */
export function egressHostsFor(config: Pick<Config, 'LLM_ROUTE' | 'ANTHROPIC_API_KEY' | 'JOBS_ADAPTER' | 'FEDERATION_GOOGLE_ISSUER' | 'FEDERATION_APPLE_ISSUER'> & Partial<Pick<Config, 'OPENROUTER_API_KEY' | 'PAYMENT_ADAPTER' | 'STRIPE_API_BASE' | 'STRIPE_MOCK_URL'>>): string[] {
  const hosts: string[] = [];
  if (config.PAYMENT_ADAPTER === 'stripe' && config.STRIPE_API_BASE) hosts.push(new URL(config.STRIPE_API_BASE).hostname);
  if (config.PAYMENT_ADAPTER === 'stripeMock' && config.STRIPE_MOCK_URL) hosts.push(new URL(config.STRIPE_MOCK_URL).hostname);
  if (config.LLM_ROUTE === 'claudeDirect' || config.ANTHROPIC_API_KEY) hosts.push('api.anthropic.com');
  if (config.LLM_ROUTE === 'openrouter' || config.OPENROUTER_API_KEY) hosts.push('openrouter.ai');
  if (config.JOBS_ADAPTER === 'providers') hosts.push(...JOB_PROVIDER_HOSTS);
  for (const issuer of [config.FEDERATION_GOOGLE_ISSUER, config.FEDERATION_APPLE_ISSUER]) if (issuer) hosts.push(new URL(issuer).hostname);
  return hosts;
}
