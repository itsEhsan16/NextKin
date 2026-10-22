import {
  DEFAULT_NOTIFICATION_PREFS,
  DEFAULT_NOTIFICATION_SETTINGS,
  type Notification,
  type NotificationPrefs,
  type NotificationSettings,
} from "../../models/notification";

import { daysAgo, earlierToday } from "./time";

/**
 * NOTIF 01 redesign verbatim (Figma 619:2) — nine cards over TODAY / THIS WEEK / EARLIER, four
 * unread. Each card is a headline plus a grey line; a headline with `**bold**` runs is set medium
 * with those runs bold, a plain one bold throughout. Deep links follow canvas note 1:2497 — the
 * exact destination, never a tab root (the matches digest is the one row whose destination IS the
 * Discover feed).
 */
export const notificationsFixture: Notification[] = [
  // Today
  {
    id: "ntf_digest",
    category: "matches",
    body: "5 new matches for Senior Product Designer",
    description: "We found new roles that match your profile.",
    createdAt: earlierToday(2),
    read: false,
    deepLink: "/jobs",
    visual: { kind: "sparkle" },
    stack: { companies: ["Slack", "Stripe", "Linear", "Notion"], more: 2 },
  },
  {
    id: "ntf_stripe_viewed",
    category: "applications",
    body: "Stripe viewed your application",
    description:
      "Your application for Senior Product Designer was viewed by the hiring team.",
    createdAt: earlierToday(4),
    read: false,
    deepLink: "/jobs/job_stripe",
    visual: { kind: "logo", company: "Stripe" },
  },
  {
    id: "ntf_ats_ready",
    category: "ai",
    body: "Your ATS score is ready",
    description:
      "Your ATS score for Stripe — Senior PD is 88. Two quick wins left to improve.",
    createdAt: earlierToday(5),
    read: false,
    deepLink: "/resumes/res_2/score",
    visual: { kind: "glyph", icon: "chart-bar", tone: "success" },
  },
  // This week
  {
    id: "ntf_razorpay_closing",
    category: "closing",
    body: "**Razorpay** — Senior UX Designer **closes in 3 days**",
    description: "You saved this job 4 days ago.",
    createdAt: daysAgo(2.2),
    read: false,
    deepLink: "/jobs/job_razorpay",
    visual: { kind: "glyph", icon: "clock", tone: "warning", regular: true },
  },
  {
    id: "ntf_freshworks_review",
    category: "applications",
    body: "**Freshworks** moved your application to **In review**",
    description: "Your application is under review by the hiring team.",
    createdAt: daysAgo(3.2),
    read: true,
    deepLink: "/jobs/job_freshworks",
    visual: { kind: "glyph", icon: "file-alt", tone: "brand" },
  },
  {
    id: "ntf_cover_ready",
    category: "ai",
    body: "Your cover letter for Stripe is ready",
    description: "Review and make changes anytime.",
    createdAt: daysAgo(3.4),
    read: true,
    deepLink: "/resumes/res_cover_stripe",
    visual: { kind: "glyph", icon: "envelope", tone: "info" },
  },
  // Earlier
  {
    id: "ntf_cred_closed",
    category: "applications",
    body: "**CRED** is no longer considering your application",
    description: "We appreciate your interest.",
    createdAt: daysAgo(30),
    read: true,
    deepLink: "/jobs/job_cred",
    visual: { kind: "logo", company: "CRED" },
  },
  {
    id: "ntf_zoho_viewed",
    category: "applications",
    body: "**Zoho** viewed your application for Product Designer",
    description: "Your application was viewed by the hiring team.",
    createdAt: daysAgo(34),
    read: true,
    deepLink: "/jobs/job_zoho",
    visual: { kind: "logo", company: "Zoho" },
  },
  {
    id: "ntf_plan_renewal",
    category: "billing",
    body: "Your free plan renews monthly",
    description: "You have used 2 of 2 resumes.",
    createdAt: daysAgo(36),
    read: true,
    deepLink: "/upgrade",
    visual: {
      kind: "glyph",
      icon: "credit-card",
      tone: "neutral",
      regular: true,
    },
  },
];

/** NOTIF 04's switch states: everything on except Plan & billing (Figma 1:2748). */
export const notificationPrefsFixture: NotificationPrefs = DEFAULT_NOTIFICATION_PREFS;

/**
 * The web Settings → Notifications board's switches (Figma 247:1303-1498): every channel on, and
 * every topic on everywhere except Resume insights' push, Product updates' email and push, and
 * Tips & recommendations' push. Shared, since mobile draws no screen for it; "Reset to default"
 * returns to it. Both live in the models so the server starts new accounts on the same values.
 */
export const notificationSettingsFixture: NotificationSettings = DEFAULT_NOTIFICATION_SETTINGS;
