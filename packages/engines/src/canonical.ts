/**
 * Canonical JSON and a content fingerprint. A stored run must reproduce byte for byte at its stamped
 * versions (Q-01), so results are compared in one serialization: object keys in code-point order,
 * no undefined, no non-finite numbers. The fingerprint is a 64-bit FNV-1a over that text — an
 * identity for "has this changed", not a security hash (the engines may not touch crypto).
 */

import { compareCodePoints } from './bps';

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

function canonicalise(value: unknown, path: string): Json | undefined {
  if (value === null) return null;
  switch (typeof value) {
    case 'boolean':
    case 'string':
      return value;
    case 'number':
      if (!Number.isFinite(value)) throw new RangeError(`${path} is not a finite number`);
      return Object.is(value, -0) ? 0 : value;
    case 'undefined':
      return undefined;
    case 'object': {
      if (Array.isArray(value)) {
        return value.map((item, index) => canonicalise(item, `${path}[${index}]`) ?? null);
      }
      const out: { [key: string]: Json } = {};
      for (const key of Object.keys(value).sort(compareCodePoints)) {
        const child = canonicalise((value as Record<string, unknown>)[key], `${path}.${key}`);
        if (child !== undefined) out[key] = child;
      }
      return out;
    }
    default:
      throw new TypeError(`${path} cannot be serialised (${typeof value})`);
  }
}

/** The canonical serialization of a value. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalise(value, '$') ?? null);
}

/** FNV-1a, 64 bits, over UTF-16 code units, as 16 hex digits prefixed `f1:`. */
export function fingerprint(value: unknown): string {
  const text = canonicalJson(value);
  // Two 32-bit halves of the 64-bit FNV state; prime 0x100000001b3 = 2^40 + 0x1b3.
  let hi = 0xcbf29ce4;
  let lo = 0x84222325;
  for (let i = 0; i < text.length; i += 1) {
    lo ^= text.charCodeAt(i);
    // (hi:lo) * 0x1b3 + (lo << 40)
    const loMul = lo * 0x1b3;
    const carry = Math.floor(loMul / 0x100000000);
    const newLo = loMul >>> 0;
    const newHi = (Math.imul(hi, 0x1b3) + carry + ((lo << 8) >>> 0)) >>> 0;
    lo = newLo;
    hi = newHi;
  }
  return `f1:${hi.toString(16).padStart(8, '0')}${lo.toString(16).padStart(8, '0')}`;
}

/** Freezes a value and everything inside it: versioned datasets must not change after publish. */
export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}
