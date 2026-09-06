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

    const subscription = await repos.user.upgrade('pro_monthly');
    expect(subscription.plan).toBe('pro');

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
