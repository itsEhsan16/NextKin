import { landingHostRoute, parseHosts } from '@/lib/landingHost';

/** nextkin.ai shows the landing page; app paths belong to app.nextkin.ai. */
const LANDING = ['nextkin.ai', 'www.nextkin.ai'];
const at = (
  host: string,
  pathname: string,
  search = '',
  appHost: string | null = 'app.nextkin.ai',
) =>
  landingHostRoute({
    host,
    pathname,
    search,
    landingHosts: LANDING,
    appHost: appHost ?? undefined,
  });

describe('landing host routing', () => {
  it('changes nothing while no landing host is configured', () => {
    expect(
      landingHostRoute({
        host: 'nextkin.ai',
        pathname: '/',
        search: '',
        landingHosts: [],
        appHost: undefined,
      }),
    ).toBeNull();
  });

  it('serves the landing page at the root of every landing host', () => {
    expect(at('nextkin.ai', '/')).toEqual({ kind: 'rewrite', pathname: '/landing' });
    expect(at('www.nextkin.ai', '/')).toEqual({ kind: 'rewrite', pathname: '/landing' });
  });

  it('serves legal pages and the landing page itself as they are', () => {
    expect(at('nextkin.ai', '/landing')).toBeNull();
    expect(at('nextkin.ai', '/legal/privacy')).toBeNull();
    expect(at('nextkin.ai', '/account-deletion')).toBeNull();
  });

  it('moves app paths to the app host, keeping the query', () => {
    expect(at('nextkin.ai', '/sign-up', '?jd=x')).toEqual({
      kind: 'redirect',
      location: 'https://app.nextkin.ai/sign-up?jd=x',
    });
    expect(at('nextkin.ai', '/jobs')).toEqual({
      kind: 'redirect',
      location: 'https://app.nextkin.ai/jobs',
    });
    expect(at('nextkin.ai', '/legalese')).toEqual({
      kind: 'redirect',
      location: 'https://app.nextkin.ai/legalese',
    });
  });

  it('leaves app paths alone when the app host is unknown', () => {
    expect(at('nextkin.ai', '/jobs', '', null)).toBeNull();
  });

  it('never touches the app host', () => {
    expect(at('app.nextkin.ai', '/')).toBeNull();
    expect(at('app.nextkin.ai', '/jobs')).toBeNull();
  });

  it('parses a comma-separated host list', () => {
    expect(parseHosts(' NextKin.ai, www.nextkin.ai ,')).toEqual(LANDING);
    expect(parseHosts(undefined)).toEqual([]);
  });
});
