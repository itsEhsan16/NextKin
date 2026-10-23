import { ASSISTANT_SCOPE_LINE } from '@/data/models';

/**
 * NextKin V2 spec §7.16 — the assistant's domain lock, as far as a mock can go.
 *
 * §7.16 specifies two layers: a small-model topic classifier that screens every message, and a
 * system prompt that enforces scope as defence in depth. This file is the mock's stand-in for the
 * first, and it is a KEYWORD MATCHER. Be clear about what that cannot do:
 *
 *   - It matches vocabulary, not intent. "Write my sister's wedding speech about her new job"
 *     contains "job" and passes. "How do I explain that I left because my manager was awful"
 *     contains no keyword and is refused, though it is squarely on-topic.
 *   - It does not survive paraphrase or another language.
 *   - It has no notion of prompt injection: pasted text is scored as a query.
 *   - §7.16's ≥95% accuracy criterion is a claim about the real classifier, not about this. The
 *     product must not print that number anywhere.
 *
 * Two design consequences: the refusal is worded so a false refusal is recoverable — it restates
 * what the assistant CAN do and invites a rephrase, never "that is not allowed" — and an allowed
 * question that matches no answer template gets a generic on-topic answer rather than a refusal,
 * because wrong-but-on-topic beats falsely-refused.
 */

export type AssistantTopic = 'resume' | 'ats' | 'interview' | 'job_search' | 'skills' | 'product';

export type TopicVerdict =
  { allowed: true; topic: AssistantTopic } | { allowed: false; reason: 'off_topic' };

/** Per-topic vocabulary. Phrases are matched whole; single words on a word boundary. */
const TOPIC_TERMS: Record<AssistantTopic, readonly string[]> = {
  ats: [
    'ats',
    'score',
    'scored',
    'keyword',
    'keywords',
    'parse',
    'parser',
    'rubric',
    'quick win',
    'quick wins',
  ],
  resume: [
    'resume',
    'résumé',
    'cv',
    'cover letter',
    'bullet',
    'bullets',
    'summary',
    'headline',
    'experience section',
    'work history',
    'format',
    'template',
    'one page',
    'two pages',
  ],
  interview: [
    'interview',
    'interviewer',
    'interviews',
    'star method',
    'tell me about yourself',
    'behavioural',
    'behavioral',
    'technical round',
    'practice question',
    'practice questions',
  ],
  job_search: [
    'job',
    'jobs',
    'job search',
    'apply',
    'applying',
    'application',
    'applications',
    'recruiter',
    'recruiters',
    'hiring',
    'salary',
    'offer',
    'negotiate',
    'referral',
    'career gap',
    'gap in my',
    'notice period',
    'laid off',
    'redundant',
    'remote',
    'hybrid',
    'linkedin',
  ],
  skills: [
    'skill',
    'skills',
    'learn',
    'career path',
    'career change',
    'switch careers',
    'certification',
    'figma',
    'react',
    'typescript',
    'sql',
    'python',
    'design systems',
    'prototyping',
    'upskill',
  ],
  product: [
    'nextkin',
    'pro plan',
    'upgrade',
    'export',
    'docx',
    'pdf',
    'generation',
    'generations',
    'tailor',
  ],
};

/**
 * Off-domain vocabulary that beats a weak allow. "Job" turns up in a lot of sentences that are not
 * about a job search; these are the ones people actually ask an assistant.
 */
const DENY_TERMS: readonly string[] = [
  'weather',
  'recipe',
  'recipes',
  'homework',
  'poem',
  'song lyrics',
  'who won',
  'translate',
  'python script',
  'write me a script',
  'joke',
  'jokes',
  'movie',
  'movies',
  'football',
  'cricket',
  'stock price',
  'bitcoin',
  'crypto',
  'horoscope',
  'girlfriend',
  'boyfriend',
  'medical',
  'lawsuit',
  'sue my',
  'diagnose',
  'symptoms',
];

const normalise = (text: string): string =>
  ` ${text
    .toLowerCase()
    .replace(/[^a-z0-9é\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()} `;

const hits = (haystack: string, terms: readonly string[]): number =>
  terms.reduce((count, term) => (haystack.includes(` ${term} `) ? count + 1 : count), 0);

/** Below this the message is refused. One clear hit is enough; a deny hit needs two to override. */
const ALLOW_FLOOR = 1;

export function classify(text: string): TopicVerdict {
  const hay = normalise(text);
  if (hay.trim().length === 0) return { allowed: false, reason: 'off_topic' };

  const denied = hits(hay, DENY_TERMS);
  let best: { topic: AssistantTopic; count: number } | undefined;
  for (const topic of Object.keys(TOPIC_TERMS) as AssistantTopic[]) {
    const count = hits(hay, TOPIC_TERMS[topic]);
    if (count > (best?.count ?? 0)) best = { topic, count };
  }
  // A deny term outweighs an equal number of allow hits: "write a poem about my job" is a poem.
  if (!best || best.count < ALLOW_FLOOR || denied >= best.count) {
    return { allowed: false, reason: 'off_topic' };
  }
  return { allowed: true, topic: best.topic };
}

/** §7.16: "a brief, polite refusal that restates what the assistant can help with". */
export const REFUSAL_LINE = `That's outside what I can help with. ${ASSISTANT_SCOPE_LINE} Try asking about one of those.`;
