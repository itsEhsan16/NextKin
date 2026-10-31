import { LinkError } from './address';
import { fetchPage, READER_AGENT, type FetchOptions } from './fetchPage';

/**
 * robots.txt (RFC 9309), read for our own name, then `*`. A site that asks us not to read a page is
 * a site refusing, and the reader stops there. A file that cannot be had asks nothing of us; the
 * page itself will tell us if the site is down.
 */

interface Rule {
  allow: boolean;
  path: string;
}

const CACHE_MS = 60 * 60 * 1000;
const CACHE_ENTRIES = 500;
const MAX_ROBOTS_BYTES = 64 * 1024;

/** The rules that apply to our agent: its own group if it has one, else the `*` group. */
export function rulesFor(text: string, agent: string): Rule[] {
  const name = agent.toLowerCase();
  const own: Rule[] = [];
  const any: Rule[] = [];
  let agents: string[] = [];
  let inRules = false;
  let namedUs = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (key === 'user-agent') {
      if (inRules) {
        agents = [];
        inRules = false;
      }
      agents.push(value.toLowerCase());
      if (agents.includes(name)) namedUs = true;
    } else if (key === 'allow' || key === 'disallow') {
      inRules = true;
      if (!value) continue;
      const rule = { allow: key === 'allow', path: value };
      if (agents.includes(name)) own.push(rule);
      if (agents.includes('*')) any.push(rule);
    }
  }
  return namedUs ? own : any;
}

const matches = (rule: string, path: string): boolean => {
  const anchored = rule.endsWith('$');
  const source = (anchored ? rule.slice(0, -1) : rule)
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${source}${anchored ? '$' : ''}`).test(path);
};

/** The longest matching rule wins, and Allow wins a tie. No rule matching means allowed. */
export function allowedBy(rules: Rule[], path: string): boolean {
  let best: Rule | null = null;
  for (const rule of rules) {
    if (!matches(rule.path, path)) continue;
    if (!best || rule.path.length > best.path.length || (rule.path.length === best.path.length && rule.allow)) best = rule;
  }
  return best?.allow ?? true;
}

export function createRobotsCheck(options: Pick<FetchOptions, 'timeoutMs' | 'policy'>) {
  const cache = new Map<string, { rules: Rule[]; until: number }>();

  async function rulesOf(url: URL): Promise<Rule[]> {
    const cached = cache.get(url.origin);
    if (cached && cached.until > Date.now()) return cached.rules;
    let rules: Rule[] = [];
    try {
      const page = await fetchPage(new URL('/robots.txt', url.origin), { ...options, maxBytes: MAX_ROBOTS_BYTES, accept: 'text/plain,*/*;q=0.1' });
      if (page.status >= 200 && page.status < 300) rules = rulesFor(page.body.toString('utf8'), READER_AGENT);
    } catch {
      // Nothing to read: the rules are empty, and the page's own answer decides.
    }
    if (cache.size >= CACHE_ENTRIES) cache.delete(cache.keys().next().value!);
    cache.set(url.origin, { rules, until: Date.now() + CACHE_MS });
    return rules;
  }

  /** Throws when the site asks us not to read this address. */
  return async function assertAllowed(url: URL): Promise<void> {
    if (url.pathname === '/robots.txt') return;
    if (!allowedBy(await rulesOf(url), `${url.pathname}${url.search}`)) throw new LinkError('robots');
  };
}
