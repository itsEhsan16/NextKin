import type { DocumentContent, ResumeContent } from '@/data/models/resumeContent';

import { BASE_SKILLS, buildCoverLetterContent, buildResumeContent } from '../documentBuilder';

/**
 * NextKin V2 spec §7.11 — the body of every finished document in `resumesFixture`.
 *
 * Keyed by resume id; each resume's `versionId` is its `currentVersionId`, so the editor and the
 * version list agree about which draft is on screen. (A cover letter is the exception — see
 * `res_cover_stripe`.) The seeded summaries name the role and company the document was tailored
 * for, and carry that document's matched ATS keywords (`atsScoresFixture`) so the score panel's
 * "appears twice" lines are true of the body; everything below the summary is George's real
 * history (§7.9), which is why the targeted documents differ only in their opening lines.
 *
 * `res_6` is deliberately absent: it is mid-generation, and the generations repo writes its
 * content when the run completes (plan Phase 9B). Reading a document that is still generating
 * must miss here, not find a half-written body.
 */

/**
 * §7.9: one assumed role holds the download gate shut until the user confirms it. The gate reads
 * `contentNeedsReview(content)`, not `Resume.needsReview` — `resumesFixture.res_zoho` carries no
 * flag of its own, so Phase 9C must derive the gate from the body or the card and the editor will
 * disagree about the same document.
 */
const withAssumedRole = (content: ResumeContent, roleId: string): ResumeContent => ({
  ...content,
  experience: content.experience.map((role) =>
    role.id === roleId ? { ...role, company: '[Company Name]', needsReview: true } : role,
  ),
});

export const contentsFixture: Record<string, DocumentContent> = {
  res_1: buildResumeContent({
    resumeId: 'res_1',
    versionId: 'ver_1_3',
    summary:
      'Eight years of consumer product design at Flipkart, Swiggy and PhonePe, most of it on ' +
      'design systems and search: search ranking, filters and result pages. Written for Lead ' +
      'UX Designer at Google.',
    // The ATS panel flags "accessibility" as a missing keyword, so the document must not list it.
    skills: BASE_SKILLS.filter((skill) => skill !== 'Accessibility'),
  }),
  // The base resume has no target, so it carries the builder's untargeted summary.
  res_base: buildResumeContent({ resumeId: 'res_base', versionId: 'ver_base_5' }),
  res_2: buildResumeContent({
    resumeId: 'res_2',
    versionId: 'ver_2_2',
    summary:
      'Product designer with eight years in India, two of them on payment flows at PhonePe. ' +
      'Written for Senior Product Designer at Stripe.',
  }),
  // The letter is its own document, keyed here by its own id; `resumeId`/`versionId` are the
  // §7.10 link back to the resume version it was written from (res_2, targeting the same job),
  // which is what the model documents them as — not a self-reference.
  res_cover_stripe: buildCoverLetterContent({
    resumeId: 'res_2',
    versionId: 'ver_2_2',
    tone: 'professional',
    company: 'Stripe',
    role: 'Senior Product Designer',
  }),
  res_5: buildResumeContent({
    resumeId: 'res_5',
    versionId: 'ver_5_1',
    summary:
      'Eight years of product design, two on UPI flows at PhonePe and three research-led at ' +
      'Swiggy. Written for Senior UX Designer at Razorpay.',
  }),
  res_3: buildResumeContent({
    resumeId: 'res_3',
    versionId: 'ver_3_2',
    summary:
      'Runs a design system across six squads at Flipkart, after eight years of product design ' +
      'in India. Written for Design Systems Lead at Freshworks.',
  }),
  res_4: buildResumeContent({
    resumeId: 'res_4',
    versionId: 'ver_4_1',
    summary:
      'Eight years of product design across Flipkart, Swiggy and PhonePe, prototyping-first ' +
      'throughout, building the internal tools other designers work in. Written for Product ' +
      'Designer at Linear, where the tools are the product.',
  }),
  res_zoho: withAssumedRole(
    buildResumeContent({
      resumeId: 'res_zoho',
      versionId: 'ver_zoho_1',
      // "enterprise", "dashboards" and "onboarding" are this panel's missing keywords, so the
      // summary must not use them.
      summary:
        'Eight years of product design in Indian consumer teams, from UPI payments at PhonePe ' +
        'to marketplace work at Flipkart. Written for Product Designer at Zoho, taking that ' +
        'product design practice from consumer scale to SaaS — SaaS admin, billing and ' +
        'reporting screens.',
    }),
    'role_obvious',
  ),
  // Kept in step with `currentVersionId`, which `versionsFor` in resumes.ts does not mint —
  // that fixture builds `ver_atlassian_1`. Re-sync here when resumes.ts is corrected.
  res_atlassian: buildResumeContent({
    resumeId: 'res_atlassian',
    versionId: 'ver_atl_1',
    summary:
      'Eight years of product design, the last three leading design systems work across six ' +
      'squads and the collaboration rituals that keep them aligned. Written for Staff Product ' +
      'Designer at Atlassian, on collaboration tools.',
  }),
};
