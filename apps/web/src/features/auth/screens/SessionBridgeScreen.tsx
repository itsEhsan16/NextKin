'use client';

import { useAuth } from '@clerk/nextjs';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { auth, SIGN_IN } from '@/lib/dataSource';
import { Button } from '@/ui/Button';
import { Spinner } from '@/ui/Spinner';

import { AuthBrandPanel } from '../components/AuthBrandPanel';
import { AuthMobileDecor } from '../components/AuthMobileDecor';

/**
 * Where Clerk sends the browser after sign-in or sign-up (toreview §169). The Clerk session token
 * is exchanged once for the server's session cookie, then the app opens; a first visit creates
 * the account on the server too. Without a Clerk session it goes back to sign-in; a failed
 * exchange says so and offers a retry or another account, never a blank page.
 */
export function SessionBridgeScreen() {
  const { isLoaded, isSignedIn, getToken, signOut } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const started = useRef(false);

  const exchange = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      if (!token) throw new Error('no Clerk session token');
      return auth.clerkExchange(token);
    },
    onSuccess: () => {
      queryClient.clear();
      router.replace('/');
    },
  });
  const { mutate } = exchange;

  useEffect(() => {
    if (!isLoaded || started.current) return;
    started.current = true;
    if (!isSignedIn) router.replace(SIGN_IN);
    else mutate();
  }, [isLoaded, isSignedIn, mutate, router]);

  return (
    <main
      data-canvas="card"
      className="relative grid min-h-dvh bg-surface-brand lg:grid-cols-2 lg:bg-surface-card"
    >
      <AuthBrandPanel />
      <AuthMobileDecor />
      <section className="relative flex items-center justify-center px-6 py-12">
        {exchange.isError ? (
          <div role="alert" className="flex w-full max-w-md animate-reveal flex-col gap-5">
            <h1 className="text-h1 font-bold text-text-primary">We couldn’t sign you in</h1>
            <p className="text-body-l text-text-secondary">
              We couldn’t finish signing you in. Check your connection and try again.
            </p>
            <div className="flex flex-col gap-3">
              <Button size="xl" pill className="w-full" onClick={() => mutate()}>
                Try again
              </Button>
              <Button
                size="xl"
                pill
                variant="secondary"
                className="w-full"
                onClick={() => void signOut({ redirectUrl: SIGN_IN })}
              >
                Use another account
              </Button>
            </div>
          </div>
        ) : (
          <div role="status" className="flex flex-col items-center gap-4 text-text-secondary">
            <Spinner className="size-6" />
            <p className="text-body-l">Signing you in…</p>
          </div>
        )}
      </section>
    </main>
  );
}
