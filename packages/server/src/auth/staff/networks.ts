import { BlockList, isIP } from 'node:net';

/**
 * The admin portal's allowed networks (Settings › Access): when the list is empty, staff may sign
 * in and work from anywhere; otherwise only from an address inside one of its ranges.
 */
export interface AllowedNetwork {
  cidr: string;
  label: string;
}

/** `203.0.113.0/24`, `2001:db8::/32`, or a single address (a /32 or /128). */
export function parseCidr(cidr: string): { address: string; prefix: number; family: 'ipv4' | 'ipv6' } | null {
  const [address = '', prefixText] = cidr.trim().split('/');
  const version = isIP(address);
  if (!version) return null;
  const family = version === 4 ? 'ipv4' : 'ipv6';
  const max = version === 4 ? 32 : 128;
  const prefix = prefixText === undefined ? max : Number(prefixText);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > max) return null;
  return { address, prefix, family };
}

/** Strips the IPv4-mapped IPv6 form (`::ffff:203.0.113.7`) that dual-stack sockets report. */
const plain = (ip: string) => (ip.startsWith('::ffff:') && isIP(ip.slice(7)) === 4 ? ip.slice(7) : ip);

export function networkAllows(networks: readonly AllowedNetwork[], ip: string | null | undefined): boolean {
  if (networks.length === 0) return true;
  if (!ip) return false;
  const address = plain(ip);
  const version = isIP(address);
  if (!version) return false;
  const list = new BlockList();
  for (const network of networks) {
    const parsed = parseCidr(network.cidr);
    if (parsed) list.addSubnet(parsed.address, parsed.prefix, parsed.family);
  }
  return list.check(address, version === 4 ? 'ipv4' : 'ipv6');
}
