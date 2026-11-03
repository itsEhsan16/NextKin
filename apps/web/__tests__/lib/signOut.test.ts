import { auth } from '@/lib/dataSource';
import { signOut } from '@/lib/signOut';
import { showToast } from '@/lib/toast';

/** Sign out (owner, toreview §164): the server ends the session; a failure says so and stays. */

jest.mock('@/lib/dataSource', () => ({
  USES_BACKEND: true,
  SIGN_IN: '/sign-in',
  auth: { logout: jest.fn() },
}));
jest.mock('@/lib/toast', () => ({ showToast: jest.fn() }));

describe('signOut', () => {
  beforeEach(() => jest.clearAllMocks());

  it('ends the session on the server', async () => {
    jest.mocked(auth.logout).mockResolvedValue(undefined);
    // jsdom cannot navigate; the call to the sign-in screen is what follows.
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await signOut();
    expect(auth.logout).toHaveBeenCalledTimes(1);
    expect(showToast).not.toHaveBeenCalled();
  });

  it('says so and stays when the request fails', async () => {
    jest.mocked(auth.logout).mockRejectedValue(new Error('offline'));
    await signOut();
    expect(showToast).toHaveBeenCalledWith(expect.stringMatching(/weren't signed out/), {
      tone: 'error',
    });
  });
});
