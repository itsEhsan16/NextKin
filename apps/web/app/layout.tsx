import type { Metadata } from 'next';
import { Caveat, Plus_Jakarta_Sans } from 'next/font/google';
import type { ReactNode } from 'react';

import '@/theme/theme.css';

import { ClerkProvider } from '@clerk/nextjs';

import { clerkAppearance } from '@/features/auth/clerkAppearance';
import { CLERK_ENABLED, CLERK_PUBLISHABLE_KEY, SESSION_BRIDGE, SIGN_UP } from '@/lib/clerk';
import { cn } from '@/lib/cn';
import { sidebarBootScript } from '@/navigation/sidebarBoot';
import { AppProviders } from '@/providers/AppProviders';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta',
  display: 'swap',
});

/**
 * The Jobs board's one handwritten caption (304:2335, "Better Opportunities Ahead") only. The
 * `next/font` variable is named `-raw` because `theme.css`'s `--font-caveat` (the name the
 * `font-caveat` Tailwind utility actually reads) needs a *different* name to reference — the
 * same two-name split `--font-sans`/`--font-plus-jakarta` already uses below.
 */
const caveat = Caveat({
  subsets: ['latin'],
  variable: '--font-caveat-raw',
  display: 'swap',
  // Not preloaded: every route would otherwise fetch a face only Jobs draws (`toreview.md` §84).
  preload: false,
});

export const metadata: Metadata = {
  title: 'NextKin',
  description:
    'AI resume builder, ATS optimization and job search. Tailor a resume to a role, score it, and track every application in one place.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // `suppressHydrationWarning`: the boot script below may add `data-sidebar` to this element
    // before React hydrates it, which is the point of it.
    <html lang="en" className={cn(plusJakarta.variable, caveat.variable)} suppressHydrationWarning>
      <body className="bg-neutral-100 font-sans text-text-primary antialiased">
        {/* First in the body, so it runs before anything paints: the remembered sidebar state,
            for the CSS to draw from (`toreview.md` §84). */}
        <script dangerouslySetInnerHTML={{ __html: sidebarBootScript }} />
        {/* Clerk only when sign-in goes through it (toreview §169); the mock never loads it. */}
        {CLERK_ENABLED ? (
          <ClerkProvider
            publishableKey={CLERK_PUBLISHABLE_KEY}
            signInUrl="/sign-in"
            signUpUrl={SIGN_UP}
            signInForceRedirectUrl={SESSION_BRIDGE}
            signUpForceRedirectUrl={SESSION_BRIDGE}
            afterSignOutUrl="/sign-in"
            appearance={clerkAppearance}
          >
            <AppProviders>{children}</AppProviders>
          </ClerkProvider>
        ) : (
          <AppProviders>{children}</AppProviders>
        )}
      </body>
    </html>
  );
}
