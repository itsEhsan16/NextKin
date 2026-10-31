import Constants from 'expo-constants';

type Breadcrumb = { category?: string };
type SentryEvent = { user?: unknown; request?: unknown; server_name?: unknown };

type SentryModule = {
  init(options: {
    dsn: string;
    environment: string;
    release?: string;
    sendDefaultPii: boolean;
    tracesSampleRate: number;
    beforeSend(event: SentryEvent): SentryEvent;
    beforeBreadcrumb(crumb: Breadcrumb): Breadcrumb | null;
  }): void;
  captureException(error: unknown, hint?: { extra?: Record<string, unknown> }): void;
};

let sentry: SentryModule | null = null;

/** Trails that can hold what someone typed, or the address of their resume. */
const DROPPED_CRUMBS = new Set(['console', 'xhr', 'fetch', 'ui.input']);

/**
 * Crash reports (V2 §8.9; owner, 2026-10-31). With no DSN, the Expo Go default, nothing loads and
 * this file does nothing. A report says where the code broke and never who it happened to or what
 * they were working on: no user, no request, no typed text. The native side needs a build, so Expo
 * Go only ever reports JavaScript errors.
 */
export function startCrashReports(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn || sentry) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy, so no DSN means no load.
    const module = require('@sentry/react-native') as SentryModule;
    module.init({
      dsn,
      environment: process.env.EXPO_PUBLIC_APP_ENV ?? 'development',
      ...(Constants.expoConfig?.version ? { release: Constants.expoConfig.version } : {}),
      sendDefaultPii: false,
      tracesSampleRate: 0,
      beforeSend: ({ user: _user, request: _request, server_name: _server, ...event }) => event,
      beforeBreadcrumb: (crumb) => (crumb.category && DROPPED_CRUMBS.has(crumb.category) ? null : crumb),
    });
    sentry = module;
  } catch {
    // A report we can't send is no reason to stop the app from starting.
  }
}

/** A caught error worth knowing about: a screen that fell over, a failed background job. */
export function reportError(error: unknown, where: string): void {
  sentry?.captureException(error, { extra: { where } });
}
