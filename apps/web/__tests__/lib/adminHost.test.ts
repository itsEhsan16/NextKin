import { adminHostRedirect, requestHost } from '@/lib/adminHost';

/** The admin portal on its own host (toreview §249). */
const ADMIN = 'admin.app.nextkin.ai';
const at = (host: string, pathname: string, search = '') =>
  adminHostRedirect({ host, pathname, search, adminHost: ADMIN });
const unset = (host: string, pathname: string) =>
  adminHostRedirect({ host, pathname, search: '', adminHost: undefined });

describe('admin host routing', () => {
  it('changes nothing while no admin host is configured', () => {
    expect(unset('app.nextkin.ai', '/admin')).toBeNull();
    expect(unset('localhost', '/admin/sign-in')).toBeNull();
  });

  it('serves only the portal on the admin host', () => {
    expect(at(ADMIN, '/admin')).toBeNull();
    expect(at(ADMIN, '/admin/sign-in')).toBeNull();
    expect(at(ADMIN, '/admin/people/u1')).toBeNull();
    expect(at(ADMIN, '/')).toBe('/admin');
    expect(at(ADMIN, '/jobs')).toBe('/admin');
    expect(at(ADMIN, '/sign-in')).toBe('/admin');
    expect(at(ADMIN, '/administrator')).toBe('/admin');
  });

  it('moves the portal off the app host, keeping the path and query', () => {
    expect(at('app.nextkin.ai', '/admin')).toBe('https://admin.app.nextkin.ai/admin');
    expect(at('app.nextkin.ai', '/admin/sign-in', '?next=%2Fadmin')).toBe(
      'https://admin.app.nextkin.ai/admin/sign-in?next=%2Fadmin',
    );
    expect(at('app.nextkin.ai', '/')).toBeNull();
    expect(at('app.nextkin.ai', '/legal/privacy')).toBeNull();
    expect(at('app.nextkin.ai', '/administrator')).toBeNull();
  });

  it('reads the visitor host from the forwarded header, then Host, without a port', () => {
    expect(requestHost(new Headers({ host: 'Admin.App.NextKin.ai:443' }))).toBe(ADMIN);
    expect(
      requestHost(new Headers({ 'x-forwarded-host': 'admin.app.nextkin.ai, internal', host: 'x' })),
    ).toBe(ADMIN);
    expect(requestHost(new Headers())).toBe('');
  });
});
