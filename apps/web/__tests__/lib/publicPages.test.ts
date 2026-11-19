import { isAuthPage } from '@/lib/dataSource';

/**
 * A 401 from a background call (the AI-consent read, for one) sends the browser to sign-in unless
 * the visitor is meant to be signed out where they are. The public pages the Play listing links to
 * were sent away a few seconds after opening (toreview §248).
 */
describe('pages a signed-out visitor is meant to be on', () => {
  it.each([
    '/legal/privacy',
    '/legal/terms',
    '/account-deletion',
    '/r/abc123',
    '/sign-in',
    '/sign-up',
    '/session',
  ])('%s stays put on a 401', (path) => expect(isAuthPage(path)).toBe(true));

  it.each(['/', '/jobs', '/settings', '/legalese', '/resumes'])('%s goes to sign-in', (path) =>
    expect(isAuthPage(path)).toBe(false),
  );
});
