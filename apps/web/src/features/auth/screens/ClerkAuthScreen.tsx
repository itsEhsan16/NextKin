'use client';

import { SignIn, SignUp } from '@clerk/nextjs';

import { SESSION_BRIDGE, SIGN_UP } from '@/lib/clerk';
import { SIGN_IN } from '@/lib/dataSource';
import { LogoMarkIllustration } from '@/ui/illustrations';
import { Spinner } from '@/ui/Spinner';

import { clerkAppearance } from '../clerkAppearance';
import { AuthBrandPanel } from '../components/AuthBrandPanel';
import { AuthMobileDecor } from '../components/AuthMobileDecor';

const COPY = {
  'sign-in': {
    title: 'Sign in to your account',
    line: 'Welcome back. Continue where you left off.',
  },
  'sign-up': {
    title: 'Create your account',
    line: 'Tailor a resume to a role and track every application.',
  },
} as const;

/**
 * Sign in and sign up through Clerk (owner, 2026-11-04, toreview §169), in the designed sign-in
 * page's frame: the brand panel on the left and the page's heading, with Clerk's form where the
 * designed one was. Clerk does the email code, password and social steps; when it finishes, the
 * browser goes to the session bridge, which makes the server session.
 */
export function ClerkAuthScreen({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const copy = COPY[mode];
  // Shown until Clerk's script has loaded and drawn the form.
  const fallback = (
    <div role="status" className="flex justify-center py-10 text-text-tertiary">
      <Spinner className="size-6" />
      <span className="sr-only">Loading</span>
    </div>
  );
  return (
    <main
      data-canvas="card"
      className="relative grid min-h-dvh bg-surface-brand lg:grid-cols-2 lg:bg-surface-card"
    >
      <AuthBrandPanel />
      <AuthMobileDecor />

      <section className="relative flex items-center justify-center px-6 py-12">
        <div className="flex w-full max-w-md animate-rise flex-col gap-8">
          <div className="flex items-center gap-3 lg:hidden">
            <LogoMarkIllustration className="h-[30px] w-[29px]" />
            <span className="text-h1 font-bold text-text-primary">NextKin</span>
          </div>

          <div className="flex flex-col gap-2">
            <h1 className="text-hero text-text-primary lg:text-h1 lg:font-bold">{copy.title}</h1>
            <p className="text-body-l text-text-secondary">{copy.line}</p>
          </div>

          {mode === 'sign-in' ? (
            <SignIn
              routing="path"
              path={SIGN_IN}
              signUpUrl={SIGN_UP}
              forceRedirectUrl={SESSION_BRIDGE}
              fallback={fallback}
              appearance={clerkAppearance}
            />
          ) : (
            <SignUp
              routing="path"
              path={SIGN_UP}
              signInUrl={SIGN_IN}
              forceRedirectUrl={SESSION_BRIDGE}
              fallback={fallback}
              appearance={clerkAppearance}
            />
          )}
        </div>
      </section>
    </main>
  );
}
