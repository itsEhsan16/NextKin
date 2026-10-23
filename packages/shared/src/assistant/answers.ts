import { ASSISTANT_SCOPE_LINE, ATS_BAND_LABEL, SCORE_LABEL } from '../models';

import type { AssistantContext } from './context';
import type { AssistantTopic, GreetingKind } from './domain';

/**
 * NextKin V2 spec §7.16 — what the mock assistant says.
 *
 * Canned answers keyed by topic, and when a document is open, written against that document's
 * REAL numbers: the score, the quick wins the panel actually lists, the gaps it names. That is
 * the acceptance criterion "when invoked from a resume or ATS report, answers reference that
 * document's actual content", met with real data rather than a placeholder sentence.
 *
 * Every answer stays inside §7.8: the score is described as a measurement against NextKin's own
 * rubric, never as a prediction about any employer's software, and no third-party ATS is named.
 */

const quickWinLine = (context: AssistantContext): string => {
  if (context.quickWins.length === 0)
    return 'Nothing on it is left to fix — every check we can act on has passed.';
  const wins = context.quickWins.map((win) => win.suggestion ?? win.label);
  const opener =
    wins.length === 1 ? 'One quick win is open:' : `${wins.length} quick wins are open:`;
  return `${opener} ${wins.map((win) => win.replace(/\.$/, '')).join('; ')}.`;
};

const gapLine = (context: AssistantContext): string | undefined => {
  if (context.gaps.length === 0) return undefined;
  const list = context.gaps.map((gap) => `"${gap}"`).join(', ');
  return `The description also asks for ${list}, which nothing on your profile backs. I won't suggest adding a claim you can't stand behind — if it is true, add it to your profile first and it will show up here.`;
};

function scoreAnswer(context: AssistantContext | undefined): string {
  if (!context || context.score == null || !context.band) {
    return `I don't have a scored document open. Ask me from a resume's ${SCORE_LABEL} panel and I'll answer about that one — the score there is measured against NextKin's own published rubric, so I can tell you exactly which check is holding it down.`;
  }
  const where = context.targetRole
    ? `your **${context.documentTitle}** (for ${context.targetRole}${context.targetCompany ? ` at ${context.targetCompany}` : ''})`
    : `your **${context.documentTitle}**`;
  return [
    `${where} scores **${context.score}**, which is ${ATS_BAND_LABEL[context.band].toLowerCase()} against NextKin's rubric.`,
    quickWinLine(context),
    gapLine(context),
    'The rubric is ours, not any employer’s — it measures the document, it does not predict how a particular company’s software will read it.',
  ]
    .filter(Boolean)
    .join(' ');
}

const ANSWERS: Record<AssistantTopic, (context: AssistantContext | undefined) => string> = {
  ats: scoreAnswer,
  resume: (context) =>
    [
      context
        ? `For **${context.documentTitle}**: lead the summary with the outcome the role cares about, and make every experience bullet carry a number where you honestly have one.`
        : 'Lead the summary with the outcome the role cares about, and make every experience bullet carry a number where you honestly have one.',
      'Keep dates, employers and titles exactly as they were — tailoring changes emphasis, never history. One page for under ten years of experience, two at most after that.',
      context?.sections.length
        ? `You have ${context.sections.join(', ')} filled in; the section editor can rework any of them.`
        : undefined,
    ]
      .filter(Boolean)
      .join(' '),
  interview: () =>
    'Prepare three stories you can tell in under two minutes each — a win, a failure you learned from, a disagreement you handled well — and practise saying them out loud. For technical questions, be ready to defend every skill your resume claims with one concrete example. The Interview prep screen can build you a set from a specific resume.',
  job_search: () =>
    "Apply to fewer roles, better: a tailored resume for a job you actually match beats twenty generic ones. Save the listings you care about, tailor to each, and keep a note of who you spoke to. A career gap is best explained in one honest sentence in the summary — what you did, and what you're moving towards.",
  skills: () =>
    "Add a skill to your profile only if you can defend it in an interview. The ones worth learning are the ones the job descriptions you save keep asking for and your profile doesn't have yet — the ATS panel names those as gaps for exactly that reason.",
  product: () =>
    'PDF and plain-text export are free on every plan, always clean and never watermarked. DOCX is a Pro format. Tailoring a resume to a job description counts as one of your monthly generations; every cap is published before you start, on the screen that starts the work.',
};

/** The reply for an on-topic message, written against the open document when there is one. */
export const answerFor = (topic: AssistantTopic, context: AssistantContext | undefined): string =>
  ANSWERS[topic](context);

/** A short hello back (no model call): what the assistant can do, and the open document if any. */
export function greetingAnswer(kind: GreetingKind, context?: AssistantContext): string {
  const opener =
    kind === 'thanks' ? 'You’re welcome — happy to help.' : 'Hi! I’m NextKin’s career assistant.';
  const document = context
    ? `I have your **${context.documentTitle}** open — ask me what to improve, or what its score means.`
    : 'What would you like to work on?';
  return `${opener} ${ASSISTANT_SCOPE_LINE} ${document}`;
}
