import type { IdentityProvider } from '../ports/identity';

/**
 * Staff sessions never came from the users' identity provider (toreview §171.13), so ending one
 * must not reach it: under Clerk a staff `sessionRef` would be sent to Clerk's API as if it were
 * a Clerk session. Every caller that ends sessions (logout, sign-out everywhere, suspension,
 * deletion) goes through this wrapper, which skips staff refs and staff subs.
 */
export const isStaffSessionRef = (ref: string) => ref.startsWith('staff:');
export const isStaffSub = (sub: string) => sub.startsWith('staff|') || sub.startsWith('staff:');

export function staffAware(idp: IdentityProvider): IdentityProvider {
  // Some entrypoints (the OpenAPI document) wire a stand-in with no provider at all.
  if (typeof idp !== 'object' || idp === null) return idp;
  return new Proxy(idp, {
    get(target, property, receiver) {
      if (property === 'revokeSession') return (ref: string) => (isStaffSessionRef(ref) ? Promise.resolve() : target.revokeSession(ref));
      if (property === 'globalSignOut') return (sub: string) => (isStaffSub(sub) ? Promise.resolve() : target.globalSignOut(sub));
      const value = Reflect.get(target, property, receiver) as unknown;
      return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(target) : value;
    },
  });
}
