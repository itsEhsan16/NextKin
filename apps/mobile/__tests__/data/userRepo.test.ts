import { createMockRepos } from '@/data/repos';
import { createMockStore } from '@/data/repos/state';

/**
 * The plan upgrade (V2 §13). Both records it writes — the audit-trail entry and the welcome
 * notification — are things a person taps, so where they land is part of the contract. Both
 * pointed at `/placeholder/upgrade` for two phases after the plan screen shipped.
 */
describe('UserRepo (mock) — upgrade', () => {
  it('moves the plan, records it in History and the inbox, and both records open the plan screen', async () => {
    const store = createMockStore();
    const repos = createMockRepos(store);
    const activities = store.state.activity.length;
    const counted = store.state.dashboardStats.activitiesCount;

    // The mock upgrades at once; the backend answers with a checkout to open (P12-06).
    const result = await repos.user.upgrade('pro_monthly');
    expect(result.kind === 'done' && result.subscription.plan).toBe('pro');

    const entry = store.state.activity[0];
    expect(entry?.kind).toBe('plan');
    expect(entry?.deepLink).toBe('/upgrade');
    // The trail grew by one, and so did the counter Home derives from it — every other writer
    // of the trail bumps both, and this one had been leaving the tile one short.
    expect(store.state.activity).toHaveLength(activities + 1);
    expect(store.state.dashboardStats.activitiesCount).toBe(counted + 1);

    const welcome = store.state.notifications[0];
    expect(welcome?.category).toBe('billing');
    expect(welcome?.deepLink).toBe('/upgrade');
  });
});

/**
 * The signed-in devices the web Settings board lists (Figma 254:555). V2 §7.1 ends every other
 * session on "sign out everywhere" and on a password change; the list has to follow both, or the
 * web page keeps showing devices the account page just signed out.
 */
describe('UserRepo (mock) — sessions', () => {
  it('keeps only this device on "sign out everywhere"', async () => {
    const store = createMockStore();
    const repos = createMockRepos(store);
    expect(store.state.security.sessions).toHaveLength(3);

    await repos.user.signOutEverywhere();

    expect(store.state.security.sessions.map((session) => session.current)).toEqual([true]);
  });

  it('stamps a password change and ends the other sessions with it', async () => {
    const store = createMockStore();
    const repos = createMockRepos(store);
    const before = store.state.security.passwordChangedAt;

    await repos.user.changePassword('old-secret', 'new-secret');

    expect(store.state.security.passwordChangedAt).not.toBe(before);
    expect(store.state.security.sessions.map((session) => session.current)).toEqual([true]);
  });
});

/**
 * The web Settings → Preferences board's app settings (Figma 356:85). Each control saves one
 * value, so a write has to merge into the rest rather than replace them.
 */
describe('UserRepo (mock) — app settings', () => {
  it('merges one change into the rest', async () => {
    const store = createMockStore();
    const repos = createMockRepos(store);

    const settings = await repos.user.updateAppSettings({ experimentalFeatures: true });

    expect(settings.experimentalFeatures).toBe(true);
    expect(settings.aiSuggestions).toBe(true);
    expect(store.state.appSettings.theme).toBe('light');
  });
});
