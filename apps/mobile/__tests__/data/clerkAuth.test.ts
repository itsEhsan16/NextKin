import { ApiError } from '@nextkin/shared/repos';

/**
 * Mobile sign-in through Clerk (toreview §173): what a Clerk refusal says on the designed screens,
 * and when the token store's refresh signs the phone out (only a refusal) or keeps it (an outage).
 */

const mockSession = { getToken: jest.fn<Promise<string | null>, [unknown?]>() };
const mockClerk = {
  loaded: true,
  status: 'ready',
  session: mockSession as typeof mockSession | null,
  signOut: jest.fn(() => Promise.resolve()),
  on: jest.fn(),
  off: jest.fn(),
};

jest.mock('@clerk/expo', () => ({
  getClerkInstance: () => mockClerk,
  useSignIn: jest.fn(),
  useSignUp: jest.fn(),
  useSSO: jest.fn(),
}));
jest.mock('@clerk/expo/token-cache', () => ({ tokenCache: {} }));

// eslint-disable-next-line import/first
import { clerkSignedOut, clerkTokens } from '@/data/clerkSession';
// eslint-disable-next-line import/first
import { fromClerk } from '@/data/queries/useClerkAuth';
// eslint-disable-next-line import/first
import {
  confirmErrorMessage,
  signInErrorMessage,
  signUpErrorMessage,
} from '@/features/auth/authForms';

const apiError = (code: string, message = '') => ({ errors: [{ code, longMessage: message }] });

describe('Clerk refusals on the designed screens', () => {
  it('says a wrong password the way the server did', () => {
    expect(signInErrorMessage(fromClerk(apiError('form_password_incorrect')))).toBe(
      'That email and password don’t match.',
    );
    expect(signInErrorMessage(fromClerk(apiError('form_identifier_not_found')))).toBe(
      'That email and password don’t match.',
    );
  });

  it('asks for a better password, and a fresh code', () => {
    expect(signUpErrorMessage(fromClerk(apiError('form_password_pwned')))).toBe(
      'Choose a longer or less common password.',
    );
    expect(confirmErrorMessage(fromClerk(apiError('form_code_incorrect')))).toBe(
      'That code is wrong or has expired.',
    );
  });

  it('passes on what Clerk says when no designed message fits', () => {
    const said = signUpErrorMessage(fromClerk(apiError('form_identifier_exists')));
    expect(said).toBe('That email already has an account. Sign in instead.');
    expect(signInErrorMessage(fromClerk(apiError('something_new', 'Clerk explains it.')))).toBe(
      'Clerk explains it.',
    );
  });
});

describe('the token store on Clerk', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClerk.session = mockSession;
    mockClerk.status = 'ready';
  });

  it('hands out Clerk’s token as the bearer, and nothing without a session', async () => {
    mockSession.getToken.mockResolvedValue('clerk-jwt');
    const store = clerkTokens(jest.fn());
    await expect(store.get()).resolves.toMatchObject({ accessToken: 'clerk-jwt' });
    mockClerk.session = null;
    await expect(store.get()).resolves.toBeNull();
  });

  it('reopens the server session on refresh', async () => {
    mockSession.getToken.mockResolvedValue('fresh');
    const exchange = jest.fn(() => Promise.resolve());
    await expect(clerkTokens(exchange).refresh!()).resolves.toBe('refreshed');
    expect(exchange).toHaveBeenCalledWith('fresh');
    expect(mockSession.getToken).toHaveBeenCalledWith({ skipCache: true });
  });

  it('signs out only when refused, never for an outage', async () => {
    mockSession.getToken.mockResolvedValue('fresh');
    const refused = clerkTokens(() => Promise.reject(new ApiError('UNAUTHENTICATED', 'no', 401)));
    await expect(refused.refresh!()).resolves.toBe('refused');
    const down = clerkTokens(() => Promise.reject(new ApiError('NETWORK', 'down', 0)));
    await expect(down.refresh!()).resolves.toBe('unreachable');
    mockSession.getToken.mockRejectedValue(new Error('offline'));
    await expect(clerkTokens(jest.fn()).refresh!()).resolves.toBe('unreachable');
    mockClerk.session = null;
    await expect(clerkTokens(jest.fn()).refresh!()).resolves.toBe('refused');
  });

  it('ends the Clerk session when the phone signs out', async () => {
    await clerkTokens(jest.fn()).set(null);
    expect(mockClerk.signOut).toHaveBeenCalled();
  });

  it('counts a launch as signed out only when Clerk loaded and has no session', async () => {
    mockClerk.session = null;
    await expect(clerkSignedOut()).resolves.toBe(true);
    mockClerk.status = 'degraded';
    await expect(clerkSignedOut()).resolves.toBe(false);
  });
});
