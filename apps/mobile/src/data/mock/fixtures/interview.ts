import type { InterviewSet } from '@/data/models/interview';

import { contentsFixture } from './contents';
import { jdDraftsFixture } from './jd';
import { resumesFixture } from './resumes';
import { daysAgo } from './time';
import { buildInterviewSet } from '../interviewBuilder';

/**
 * NextKin V2 spec §7.15 — one practice set seeded at boot, so `/interview` is never empty on
 * first open and the account's `interviewSetsUsed: 1` (fixtures/user.ts) describes a set that
 * exists.
 *
 * Built from the same inputs a real run would use — `res_2` ("Stripe — Senior PD"), its body and
 * the saved Stripe extraction — so the builder's rules hold for the fixture too, and a test can
 * pin that every technical question names a skill the resume claims. Three questions are
 * pre-marked so the "Needs work" filter and the card's summary have something to show before
 * anything has been generated, and so marks-persist is demonstrable without a round trip.
 *
 * Dated inside THIS WEEK, beside the existing Stripe activity cluster.
 */
const STRIPE_RESUME_ID = 'res_2';
const STRIPE_DRAFT_ID = 'jd_stripe';

const resume = resumesFixture.find((item) => item.id === STRIPE_RESUME_ID);
const draft = jdDraftsFixture.find((item) => item.id === STRIPE_DRAFT_ID);
const content = contentsFixture[STRIPE_RESUME_ID];
if (!resume || !draft || !content || content.kind !== 'resume') {
  throw new Error('interview fixture: the Stripe resume, its body or its JD draft is missing');
}

const seeded = buildInterviewSet({
  setId: 'int_stripe',
  now: daysAgo(3.4),
  resume,
  content,
  draft,
});

const MARKS: Record<string, 'confident' | 'needs_work'> = {
  q_tech_0: 'confident',
  q_resp_0: 'confident',
  q_resp_1: 'needs_work',
};

export const interviewSetsFixture: InterviewSet[] = [
  {
    ...seeded,
    questions: seeded.questions.map((question) => ({
      ...question,
      mark: MARKS[question.id] ?? question.mark,
    })),
  },
];
