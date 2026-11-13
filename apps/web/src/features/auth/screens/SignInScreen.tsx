'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { cn } from '@/lib/cn';
import { auth, USES_BACKEND } from '@/lib/dataSource';
import { Button, buttonClass } from '@/ui/Button';
import { CompanyGoogleIllustration, LogoMarkIllustration } from '@/ui/illustrations';
import { ArrowRight, Eye, EyeOff, Lock01, LogIn01, Mail01, iconSize } from '@/ui/lineIcons';
import { Soon, soonControl } from '@/ui/Soon';

import { AuthBrandPanel } from '../components/AuthBrandPanel';
import { AuthField } from '../components/AuthField';
import { AuthMobileDecor } from '../components/AuthMobileDecor';
import { signInErrorMessage, validateSignIn, type SignInErrors } from '../signInForm';

const linkButton =
  'rounded-sm font-semibold text-text-brand transition-colors duration-press ease-standard ' +
  'not-aria-disabled:hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2';

/**
 * Sign in (V2 §7.1), laid out after the owner's reference shot: the brand panel on the left, the
 * form on the right. Below the laptop breakpoint it follows the owner's phone mockup instead: a
 * pale brand page with decorative arcs, a hero heading, taller fields named by their placeholders
 * and a gradient Sign in. On the mock any details open the app, as mobile's sign-in does; on the
 * backend it signs in through the identity provider. Sign-up, password reset and Google have no
 * web flow yet, so they say "Coming soon" rather than going nowhere.
 */
export function SignInScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<SignInErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const found = validateSignIn({ email, password });
    setErrors(found);
    setFailure(null);
    if (Object.keys(found).length > 0) {
      // Focus goes to the first field to fix (redesign R7d, audit AU-04), once it says so.
      const form = event.currentTarget as HTMLFormElement;
      requestAnimationFrame(() =>
        form.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus(),
      );
      return;
    }
    setBusy(true);
    try {
      if (USES_BACKEND) {
        await auth.login(email.trim(), password);
        queryClient.clear();
      }
      router.replace('/');
    } catch (cause) {
      setFailure(signInErrorMessage(cause));
      setBusy(false);
    }
  };

  return (
    <main
      data-canvas="card"
      className="relative grid min-h-dvh bg-surface-brand lg:grid-cols-2 lg:bg-surface-card"
    >
      <AuthBrandPanel />
      <AuthMobileDecor />

      <section className="relative flex items-center justify-center px-6 py-12">
        <div className="flex w-full max-w-md animate-rise flex-col gap-8">
          {/* The brand panel hides below the laptop breakpoint; the mark stays with the form. */}
          <div className="flex items-center gap-3 lg:hidden">
            <LogoMarkIllustration className="h-[30px] w-[29px]" />
            <span className="text-h1 font-bold text-text-primary">NextKin</span>
          </div>

          <div className="flex flex-col gap-2">
            <h1 className="text-hero text-text-primary lg:text-h1 lg:font-bold">
              Sign in to your account
            </h1>
            <p className="text-body-l text-text-secondary">
              Welcome back. Continue where you left off.
            </p>
          </div>

          <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-5">
            <AuthField
              label="Email address"
              icon={Mail01}
              type="email"
              autoComplete="username"
              placeholder="Email address"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                // A fixed field stops saying it is wrong (AU-04).
                if (errors.email) setErrors((current) => ({ ...current, email: undefined }));
              }}
              error={errors.email}
            />
            <div className="flex flex-col gap-3">
              <AuthField
                label="Password"
                icon={Lock01}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (errors.password)
                    setErrors((current) => ({ ...current, password: undefined }));
                }}
                error={errors.password}
                trailing={
                  <button
                    type="button"
                    onClick={() => setShowPassword((shown) => !shown)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    className="flex size-control-md shrink-0 items-center justify-center rounded-full text-text-tertiary transition-colors duration-press ease-standard hover:bg-surface-muted hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    {showPassword ? (
                      <EyeOff className={iconSize.md} />
                    ) : (
                      <Eye className={iconSize.md} />
                    )}
                  </button>
                }
              />
              <Soon>
                <button
                  type="button"
                  aria-disabled="true"
                  className={cn(linkButton, soonControl, 'self-end text-body-m')}
                >
                  Forgot password?
                </button>
              </Soon>
            </div>

            {failure && (
              <p role="alert" className="animate-reveal text-body-m text-danger-text">
                {failure}
              </p>
            )}

            <Button
              type="submit"
              size="xl"
              pill
              loading={busy}
              className="mt-1 w-full max-lg:h-14 max-lg:bg-linear-to-r max-lg:from-brand-600 max-lg:to-border-selected max-lg:shadow-brand-glow"
            >
              {busy ? 'Signing in…' : 'Sign in'}
              {!busy && <ArrowRight className={cn(iconSize.md, 'lg:hidden')} />}
              {!busy && <LogIn01 className={cn(iconSize.md, 'max-lg:hidden')} />}
            </Button>
          </form>

          <p className="text-center text-body-m text-text-secondary">
            Don’t have an account?{' '}
            <Soon>
              <button type="button" aria-disabled="true" className={cn(linkButton, soonControl)}>
                Sign up
              </button>
            </Soon>
          </p>

          <div className="flex items-center gap-4 text-caption-m uppercase text-text-tertiary">
            <span className="h-px flex-1 bg-border-default" />
            or
            <span className="h-px flex-1 bg-border-default" />
          </div>

          <Soon>
            <button
              type="button"
              aria-disabled="true"
              className={cn(
                buttonClass({ variant: 'secondary', size: 'xl', pill: true }),
                soonControl,
                'w-full max-lg:h-14 max-lg:rounded-lg',
              )}
            >
              <CompanyGoogleIllustration className={iconSize.md} />
              Continue with Google
            </button>
          </Soon>
        </div>
      </section>
    </main>
  );
}
