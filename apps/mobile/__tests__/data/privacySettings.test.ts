import { createMockRepos } from '@/data/repos';
import { createMockStore } from '@/data/repos/state';

/**
 * The web Settings → Privacy & data mockup's settings, and Connected accounts' one linkable
 * account (Google, V2 §7.1). Each privacy control saves on its own, so the repo merges a change in.
 */
describe('UserRepo (mock) — privacy and connected accounts', () => {
  it('merges one privacy change into the set', async () => {
    const store = createMockStore();
    const repos = createMockRepos(store);

    const next = await repos.user.updatePrivacySettings({ searchEngines: true });
    expect(next).toEqual({
      profileVisibility: 'recruiters',
      recruitersCanFind: true,
      searchEngines: true,
      shareAnonymizedData: true,
    });
    expect(store.state.privacySettings.searchEngines).toBe(true);
  });

  it('links Google, then unlinks it', async () => {
    const store = createMockStore();
    const repos = createMockRepos(store);

    const linked = await repos.user.connectAccount('google');
    expect(linked).toEqual([
      { provider: 'google', connected: true, connectedAt: expect.any(String) },
    ]);

    const unlinked = await repos.user.disconnectAccount('google');
    expect(unlinked).toEqual([{ provider: 'google', connected: false }]);
    expect(store.state.connectedAccounts).toEqual(unlinked);
  });
});
