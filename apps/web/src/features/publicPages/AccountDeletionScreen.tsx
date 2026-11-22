import type { Route } from 'next';
import Link from 'next/link';

import { cn } from '@/lib/cn';
import { cardSurface } from '@/ui/Card';
import { BUTTON_VARIANT } from '@/ui/buttonStyles';

import { PublicShell } from './PublicShell';

const card = cn(cardSurface, 'rounded-xl p-5.5 shadow-card');

/**
 * Where a deletion request is made without the app. Google Play's Data safety form asks for a
 * public address that explains how to delete an account and its data, reachable by someone who
 * no longer has the app installed. What it says is what the product does: the in-app and web
 * deletions both call the same server delete (`DELETE /me`), which removes the account and every
 * document, job and run that belongs to it.
 *
 * PRIVACY_EMAIL is a placeholder until the owner confirms the inbox (toreview §244).
 */
export const PRIVACY_EMAIL = 'privacy@nextkin.ai';

export function AccountDeletionScreen() {
  return (
    <PublicShell>
      <article className="flex flex-col gap-4">
        <section className={card}>
          <h1 className="text-h2 font-bold text-text-primary">Delete your NextKin account</h1>
          <p className="mt-3 text-body-m text-text-secondary">
            Deleting your account removes your profile, resumes, cover letters, saved jobs,
            applications and assistant history from NextKin. It can’t be undone, so export anything
            you want to keep first.
          </p>
        </section>

        <section className={card}>
          <h2 className="text-title-l font-semibold text-text-primary">In the app</h2>
          <p className="mt-3 text-body-m text-text-secondary">
            Open <strong>Profile</strong>, scroll to the bottom and tap{' '}
            <strong>Delete account</strong>. Confirm, and you are signed out everywhere at once;
            everything in the account is purged within a day.
          </p>
        </section>

        <section className={card}>
          <h2 className="text-title-l font-semibold text-text-primary">On the web</h2>
          <p className="mt-3 text-body-m text-text-secondary">
            Sign in, open <strong>Settings</strong>, then <strong>Delete account</strong>.
          </p>
          <Link
            href={'/settings?tab=delete' as Route}
            className={cn(
              BUTTON_VARIANT.secondary,
              'mt-4 inline-flex h-control-md items-center rounded-md px-4 text-body-m font-semibold',
            )}
          >
            Sign in to delete
          </Link>
        </section>

        <section className={card}>
          <h2 className="text-title-l font-semibold text-text-primary">Can’t sign in?</h2>
          <p className="mt-3 text-body-m text-text-secondary">
            Email{' '}
            <a href={`mailto:${PRIVACY_EMAIL}`} className="font-semibold text-text-brand">
              {PRIVACY_EMAIL}
            </a>{' '}
            from the address on your account and ask us to delete it. We confirm by email and delete
            it within 30 days.
          </p>
        </section>

        <section className={card}>
          <h2 className="text-title-l font-semibold text-text-primary">What is kept</h2>
          <p className="mt-3 text-body-m text-text-secondary">
            Payment records that the law requires us to keep are held for that period and nothing
            else. Crash reports carry no name, email or resume text.
          </p>
        </section>
      </article>
    </PublicShell>
  );
}
