import { BlockList, isIP } from 'node:net';

/**
 * What may be fetched (owner, 2026-10-18: links for every website; toreview §144.3). A link comes
 * from a user, so everything here assumes it was written to reach something it should not: the
 * cloud metadata endpoint, the database, the host. Only a public address on the normal web ports
 * passes, and the check runs again on every redirect and every address DNS returns.
 */

export type LinkFailure =
  /** Not a web address we can use. */
  | 'invalid'
  /** It points at a private or local address. */
  | 'private'
  /** The site's robots.txt asks us not to read this page. */
  | 'robots'
  /** The site refused us: a 401, 403, 429, 503 or a bot check. We stop here. */
  | 'refused'
  /** A 404 or 410: the posting is gone. */
  | 'gone'
  /** A file, not a page: a PDF or a Word document. */
  | 'unsupported'
  | 'too_large'
  | 'timeout'
  /** The site could not be reached, or answered with an error of its own. */
  | 'unreachable'
  /** The page held too little to be a job posting. */
  | 'empty'
  /** A list of jobs or a search page, not one posting (toreview §206). */
  | 'listing'
  /** The posting was taken down: the page says so, and holds no description. */
  | 'removed';

export class LinkError extends Error {
  constructor(
    readonly reason: LinkFailure,
    message: string = reason,
  ) {
    super(message);
    this.name = 'LinkError';
  }
}

const BLOCKED = new BlockList();
const V4: [string, number][] = [
  ['0.0.0.0', 8], // "this network"
  ['10.0.0.0', 8],
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8],
  ['169.254.0.0', 16], // link-local, and the cloud metadata endpoints
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4],
];
const V6: [string, number][] = [
  ['::', 128],
  ['::1', 128],
  ['64:ff9b::', 96], // NAT64
  ['100::', 64],
  ['2001:db8::', 32],
  ['fc00::', 7], // unique local
  ['fe80::', 10], // link-local
  ['ff00::', 8],
];
for (const [net, prefix] of V4) BLOCKED.addSubnet(net, prefix, 'ipv4');
for (const [net, prefix] of V6) BLOCKED.addSubnet(net, prefix, 'ipv6');

/** BlockList also applies the IPv4 rules to an IPv4-mapped IPv6 address such as ::ffff:7f00:1. */
export function isPublicAddress(ip: string): boolean {
  const family = isIP(ip);
  if (family === 0) return false;
  return !BLOCKED.check(ip, family === 4 ? 'ipv4' : 'ipv6');
}

/** Where a read may go. Everything outside the tests uses `PUBLIC_WEB`. */
export interface LinkPolicy {
  allowAddress(ip: string): boolean;
  allowPort(port: number): boolean;
}

export const PUBLIC_WEB: LinkPolicy = { allowAddress: isPublicAddress, allowPort: (port) => port === 80 || port === 443 };

const LOCAL_NAME = /(^|\.)(localhost|local|internal|intranet|lan|home|corp|home\.arpa)$/i;

/** A link as a URL we may try, or a LinkError saying why not. A bare "site.com/job" gets https. */
export function parseLink(raw: string, policy: LinkPolicy = PUBLIC_WEB): URL {
  const text = raw.trim();
  if (!text || text.length > 2000) throw new LinkError('invalid');
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    throw new LinkError('invalid');
  }
  if ((url.protocol !== 'https:' && url.protocol !== 'http:') || url.username || url.password) throw new LinkError('invalid');
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (isIP(host)) {
    if (!policy.allowAddress(host)) throw new LinkError('private');
  } else if (!host.includes('.') || LOCAL_NAME.test(host)) {
    throw new LinkError('private');
  }
  if (!policy.allowPort(Number(url.port || (url.protocol === 'https:' ? 443 : 80)))) throw new LinkError('invalid');
  url.hash = '';
  return url;
}
