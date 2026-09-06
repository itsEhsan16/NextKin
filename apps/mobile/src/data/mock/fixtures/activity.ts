import type { ActivityEntry } from '@/data/models';

import { GENERATING_RESUME_ID } from './resumes';
import { daysAgo, earlierToday } from './time';

/**
 * NextKin V2 spec §7.2 — the audit trail behind Home's "Activities" counter, listed by the
 * History screen (plan phase 9I). No artboard exists, so the copy follows the vocabulary the
 * built screens already use and the `**bold**` run convention of `Notification.body`.
 *
 * EXACTLY 24 entries, because `dashboardStatsFixture.activitiesCount` in ./user.ts is 24 and
 * Home's shortcut grid promises that number before History renders the list. Add or remove a
 * row here and change that counter in the same commit, or the two screens contradict.
 *
 * Every id, company and document title below is cross-checked against ./resumes.ts and
 * ./jobs.ts — an entry never names a document or a job that does not exist. Timestamps are
 * pinned to the fixture the row describes (a resume's `updatedAt`, a job's `savedDaysAgo`, an
 * application's `appliedAt`) so the feed reads as one coherent history rather than 24 unrelated
 * dates, and they spread across ~28 days so all three groups — TODAY / THIS WEEK / EARLIER —
 * are populated (`notificationGroup`: today is the calendar day, "this week" is under 7 days).
 *
 * Every row deep-links to its exact destination, never a tab root, and every destination is a
 * real route. A `deepLink` is a plain string, so the type system cannot tell a stale one from a
 * live one — four of these pointed at placeholder keys for a phase after the screens had shipped.
 * `__tests__/data/deepLinks.test.ts` is the net: it checks every fixture link against the route
 * table, here and in ./notifications.ts, so a route that moves fails a test rather than a tap.
 */
/* prettier-ignore */
export const activityFixture: ActivityEntry[] = [
  // --- TODAY. `earlierToday` clamps to just after midnight so these stay in the TODAY group
  // whatever hour the app (or the suite) happens to run at. ---
  { id: 'act_gen_canva', kind: 'generation', title: 'Generating **Staff Product Designer — Canva** from your base resume', detail: 'Canva · Staff Product Designer', createdAt: earlierToday(0.05), deepLink: `/resumes/${GENERATING_RESUME_ID}`, resumeId: GENERATING_RESUME_ID, jobId: 'job_4' },
  { id: 'act_check_upload', kind: 'ats_check', title: 'Ran an **ATS check** on an uploaded resume', detail: 'Scored 71 — the format is clean, the keywords are thin', createdAt: earlierToday(3), deepLink: '/create/ats-check' },
  // Mirrors `ntf_ats_ready` in ./notifications.ts: same event, same score, same two quick wins.
  { id: 'act_score_stripe', kind: 'score', title: 'Your ATS score for **Stripe — Senior PD** came back **88**', detail: 'Two quick wins left', createdAt: earlierToday(5), deepLink: '/resumes/res_2/score', resumeId: 'res_2' },
  { id: 'act_export_stripe', kind: 'export', title: 'Exported **Stripe — Senior PD** as a PDF', detail: 'stripe-senior-pd.pdf', createdAt: earlierToday(6), deepLink: '/resumes/res_2', resumeId: 'res_2' },
  { id: 'act_profile_skills', kind: 'profile', title: 'Added **3 skills** to your profile', detail: 'Design tokens, Motion design, Workshop facilitation', createdAt: earlierToday(8), deepLink: '/profile/skills' },
  { id: 'act_saved_stripe', kind: 'saved_job', title: 'Saved **Stripe — Senior Product Designer**', detail: 'Bengaluru · Remote · closes in 3 days', createdAt: earlierToday(9), deepLink: '/jobs/job_stripe', jobId: 'job_stripe' },

  // --- THIS WEEK (under 7 days). ---
  { id: 'act_export_base', kind: 'export', title: 'Exported **Product Designer** as a PDF', detail: 'product-designer.pdf · 3 pages', createdAt: daysAgo(1.5), deepLink: '/resumes/res_base', resumeId: 'res_base' },
  // The free-plan meters in `subscriptionFixture`: 2 of 2 resumes used, 5 AI credits left.
  { id: 'act_plan_resumes', kind: 'plan', title: 'You have used **2 of 2 free resumes** this month', detail: 'NextKin Free · 5 AI credits left', createdAt: daysAgo(1.9), deepLink: '/upgrade' },
  { id: 'act_gen_google', kind: 'generation', title: 'Tailored **UX Designer Resume** for Google — Lead UX Designer', detail: 'From your base resume', createdAt: daysAgo(2), deepLink: '/resumes/res_1', resumeId: 'res_1', jobId: 'job_google' },
  // "Four quick wins" is RESUMES 04's own summary line for res_base.
  { id: 'act_score_base', kind: 'score', title: 'Your ATS score for **Product Designer** came back **92**', detail: 'Four quick wins left', createdAt: daysAgo(2.05), deepLink: '/resumes/res_base/score', resumeId: 'res_base' },
  { id: 'act_app_zoho', kind: 'application', title: 'Applied to **Zoho — Product Designer**', detail: 'Chennai · On-site', createdAt: daysAgo(2.1), deepLink: '/jobs/job_zoho', jobId: 'job_zoho' },
  { id: 'act_saved_linear', kind: 'saved_job', title: 'Saved **Linear — Product Designer**', detail: 'Remote (India)', createdAt: daysAgo(2.2), deepLink: '/jobs/job_linear', jobId: 'job_linear' },
  { id: 'act_app_linear', kind: 'application', title: 'Applied to **Linear — Product Designer**', detail: 'Sent with Linear PD', createdAt: daysAgo(3), deepLink: '/jobs/job_linear', jobId: 'job_linear', resumeId: 'res_4' },
  // Timed to `ntf_cover_ready`, not to res_cover_stripe.updatedAt (5.5d): the notification and
  // the History row describe the same event and must not sit two days apart on screen.
  { id: 'act_cover_stripe', kind: 'cover_letter', title: 'Your **Stripe cover letter** is ready to review', detail: 'One page, matched to the Senior Product Designer post', createdAt: daysAgo(3.4), deepLink: '/resumes/res_cover_stripe', resumeId: 'res_cover_stripe', jobId: 'job_stripe' },
  { id: 'act_saved_razorpay', kind: 'saved_job', title: 'Saved **Razorpay — Senior UX Designer**', detail: 'Bengaluru · Hybrid', createdAt: daysAgo(4), deepLink: '/jobs/job_razorpay', jobId: 'job_razorpay' },
  { id: 'act_app_stripe', kind: 'application', title: 'Applied to **Stripe — Senior Product Designer**', detail: 'Sent with Stripe — Senior PD', createdAt: daysAgo(5), deepLink: '/jobs/job_stripe', jobId: 'job_stripe', resumeId: 'res_2' },

  // --- EARLIER (7 days and older). ---
  { id: 'act_saved_freshworks', kind: 'saved_job', title: 'Saved **Freshworks — Design Systems Lead**', detail: 'Bengaluru · Hybrid', createdAt: daysAgo(7), deepLink: '/jobs/job_freshworks', jobId: 'job_freshworks' },
  { id: 'act_score_razorpay', kind: 'score', title: 'Your ATS score for **Razorpay UX** came back **84**', detail: 'Two quick wins left', createdAt: daysAgo(7.2), deepLink: '/resumes/res_5/score', resumeId: 'res_5' },
  { id: 'act_app_freshworks', kind: 'application', title: 'Applied to **Freshworks — Design Systems Lead**', detail: 'Sent with Freshworks DS Lead', createdAt: daysAgo(8), deepLink: '/jobs/job_freshworks', jobId: 'job_freshworks', resumeId: 'res_3' },
  { id: 'act_gen_razorpay', kind: 'generation', title: 'Tailored **Razorpay UX** for Razorpay — Senior UX Designer', detail: 'From your base resume', createdAt: daysAgo(10), deepLink: '/resumes/res_5', resumeId: 'res_5', jobId: 'job_razorpay' },
  { id: 'act_app_razorpay', kind: 'application', title: 'Applied to **Razorpay — Senior UX Designer**', detail: 'Sent with UX Designer Resume', createdAt: daysAgo(12), deepLink: '/jobs/job_razorpay', jobId: 'job_razorpay', resumeId: 'res_1' },
  { id: 'act_score_freshworks', kind: 'score', title: 'Your ATS score for **Freshworks DS Lead** came back **76**', detail: 'Four quick wins left', createdAt: daysAgo(14.2), deepLink: '/resumes/res_3/score', resumeId: 'res_3' },
  { id: 'act_saved_postman', kind: 'saved_job', title: 'Saved **Postman — Product Designer, Growth**', detail: 'Bengaluru · Remote', createdAt: daysAgo(15), deepLink: '/jobs/job_postman', jobId: 'job_postman' },
  { id: 'act_profile_roles', kind: 'profile', title: 'Updated your **desired roles**', detail: 'Senior UX Designer, Senior Product Designer, Design Systems Lead', createdAt: daysAgo(28), deepLink: '/profile/desired-roles' },
];
