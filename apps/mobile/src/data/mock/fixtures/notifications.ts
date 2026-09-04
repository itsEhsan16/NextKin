import type { Notification, NotificationPrefs } from '@/data/models';

import { daysAgo, earlierToday } from './time';

/**
 * NOTIF 01 verbatim — nine rows over TODAY / THIS WEEK / EARLIER, four unread. Bodies are
 * rich lines: `**bold**` runs render semibold. Deep links follow canvas note 1:2497 — the
 * exact destination, never a tab root (the matches digest is the one row whose destination
 * IS the Discover feed).
 */
export const notificationsFixture: Notification[] = [
  // Today
  {
    id: 'ntf_digest',
    category: 'matches',
    body: '**5 new matches** for Senior Product Designer',
    createdAt: earlierToday(2),
    read: false,
    deepLink: '/jobs',
    visual: { kind: 'sparkle' },
    stack: { initials: ['S', 'L', 'R'], more: 2 },
  },
  {
    id: 'ntf_stripe_viewed',
    category: 'applications',
    body: '**Stripe** viewed your application for Senior Product Designer',
    createdAt: earlierToday(4),
    read: false,
    deepLink: '/jobs/job_stripe',
    visual: { kind: 'logo', company: 'Stripe' },
  },
  {
    id: 'ntf_ats_ready',
    category: 'ai',
    body: 'Your **ATS score** for Stripe — Senior PD is ready. It scored **88** — two quick wins left.',
    createdAt: earlierToday(5),
    read: false,
    deepLink: '/resumes/res_2/score',
    visual: { kind: 'glyph', icon: 'tasks', tone: 'brand' },
  },
  // This week
  {
    id: 'ntf_razorpay_closing',
    category: 'closing',
    body: '**Razorpay** — Senior UX Designer **closes in 3 days**. You saved it 4 days ago.',
    createdAt: daysAgo(2.2),
    read: false,
    deepLink: '/jobs/job_razorpay',
    visual: { kind: 'glyph', icon: 'clock', tone: 'warning' },
  },
  {
    id: 'ntf_freshworks_review',
    category: 'applications',
    body: '**Freshworks** moved your application to **In review**',
    createdAt: daysAgo(3.2),
    read: true,
    deepLink: '/jobs/job_freshworks',
    visual: { kind: 'logo', company: 'Freshworks' },
  },
  {
    id: 'ntf_cover_ready',
    category: 'ai',
    body: 'Your **cover letter** for Stripe is ready to review',
    createdAt: daysAgo(3.4),
    read: true,
    // The cover-letter editor is undesigned; its placeholder is the honest destination.
    deepLink: '/placeholder/resume-detail',
    visual: { kind: 'glyph', icon: 'envelope', tone: 'brand' },
  },
  // Earlier
  {
    id: 'ntf_cred_closed',
    category: 'applications',
    body: '**CRED** is no longer considering your application',
    createdAt: daysAgo(30),
    read: true,
    deepLink: '/jobs/job_cred',
    visual: { kind: 'logo', company: 'CRED' },
  },
  {
    id: 'ntf_zoho_viewed',
    category: 'applications',
    body: '**Zoho** viewed your application for Product Designer',
    createdAt: daysAgo(34),
    read: true,
    deepLink: '/jobs/job_zoho',
    visual: { kind: 'logo', company: 'Zoho' },
  },
  {
    id: 'ntf_plan_renewal',
    category: 'billing',
    body: 'Your free plan renews monthly. You have used **2 of 2 resumes**.',
    createdAt: daysAgo(36),
    read: true,
    deepLink: '/placeholder/upgrade',
    visual: { kind: 'glyph', icon: 'credit-card', tone: 'neutral' },
  },
];

/** NOTIF 04's switch states: everything on except Plan & billing (Figma 1:2748). */
export const notificationPrefsFixture: NotificationPrefs = {
  categories: {
    matches: true,
    closing: true,
    applications: true,
    ai: true,
    billing: false,
  },
  quietHours: true,
  weeklyDigest: true,
};
