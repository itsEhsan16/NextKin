'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';

import { useResetSession } from '@nextkin/shared/queries';

import { cn } from '@/lib/cn';
import { auth } from '@/lib/dataSource';
import { cardSurface } from '@/ui/Card';
import { fieldBox } from '@/ui/fieldBox';
import { BUTTON_VARIANT } from '@/ui/buttonStyles';

/**
 * Development-only sign-in for the seeded accounts (ImBackendImplementationPlan P5-07). Web's sign-in
 * screens are design-gated (CLAUDE.md rule 7), so this is the only way into the app while it runs
 * on the backend locally. The route 404s in a production build; the local identity provider behind
 * it is refused outside `local` and `test` (L3). Built from existing primitives only.
 */

// Published on purpose: the seed's one local password (packages/server/src/seed/identities.ts).
const LOCAL_PASSWORD = 'NextKin-local-2026';

const ACCOUNTS = [
  {
    email: 'george.smith@gmail.com',
    label: 'George Smith',
    note: 'the web persona, with the boards’ data',
  },
  { email: 'free@nextkin.test', label: 'Fran Free', note: 'an empty Free account' },
  { email: 'pro@nextkin.test', label: 'Priya Pro', note: 'an empty Pro account' },
];

export function DevSignIn() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const resetSession = useResetSession();
  const [email, setEmail] = useState(ACCOUNTS[0]!.email);
  const [password, setPassword] = useState(LOCAL_PASSWORD);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState<string | null>(null);

  useEffect(() => {
    auth.hasSession().then(async (live) => setSignedIn(live ? (await auth.session()).email : null));
  }, []);

  const signIn = async (address: string, secret: string) => {
    setBusy(true);
    setError(null);
    try {
      await auth.login(address, secret);
      queryClient.clear();
      router.replace('/');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign-in failed.');
      setBusy(false);
    }
  };

  const signOut = async () => {
    await auth.logout();
    resetSession();
    setSignedIn(null);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void signIn(email, password);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-6">
      <div className={cn(cardSurface, 'flex w-full max-w-md flex-col gap-5 p-6')}>
        <div className="flex flex-col gap-1">
          <p className="text-caption-m font-semibold text-text-brand">Local development</p>
          <h1 className="text-h1 text-text-primary">Sign in to the local backend</h1>
          <p className="text-body-m text-text-secondary">
            A seeded account, signed in through the local identity provider. This page does not
            exist in a production build.
          </p>
        </div>

        {signedIn && (
          <div className="flex items-center justify-between gap-3 rounded-md bg-neutral-100 px-3 py-2 text-body-m text-text-secondary">
            <span className="truncate">Signed in as {signedIn}</span>
            <button
              type="button"
              onClick={() => void signOut()}
              className={cn(BUTTON_VARIANT.secondary, 'h-control-sm rounded-md px-3')}
            >
              Sign out
            </button>
          </div>
        )}

        <ul className="flex flex-col gap-2">
          {ACCOUNTS.map((account) => (
            <li key={account.email}>
              <button
                type="button"
                disabled={busy}
                onClick={() => void signIn(account.email, LOCAL_PASSWORD)}
                className={cn(
                  BUTTON_VARIANT.secondary,
                  'flex h-auto w-full flex-col items-start rounded-md px-3 py-2 text-left',
                )}
              >
                <span className="text-body-m font-semibold text-text-primary">{account.label}</span>
                <span className="text-caption-m text-text-secondary">
                  {account.email} · {account.note}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-caption-m text-text-secondary">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={cn(fieldBox, 'px-3')}
              autoComplete="username"
            />
          </label>
          <label className="flex flex-col gap-1 text-caption-m text-text-secondary">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={cn(fieldBox, 'px-3')}
              autoComplete="current-password"
            />
          </label>
          {error && (
            <p role="alert" className="text-body-m text-danger-600">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className={cn(BUTTON_VARIANT.primary, 'h-control-md rounded-md px-4 font-semibold')}
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  );
}
