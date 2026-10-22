/**
 * AI consent (ImBackendImplementationPlan P12-12; C-14; V2 §8.5). Before the first AI action a user
 * gives explicit consent naming the AI providers their content goes to. The consent records the
 * version of this list, so a change to the providers asks again.
 */

export type AiProvider = { name: string; purpose: string };

export const AI_PROVIDER_LIST = {
  version: 'providers-v1',
  providers: [
    {
      name: 'Anthropic',
      purpose: 'Reads job descriptions and resumes, and writes resumes, cover letters, interview questions and assistant replies.',
    },
  ] as readonly AiProvider[],
};

export type AiConsent = {
  granted: boolean;
  /** The provider-list version consented to, when granted. */
  version?: string;
  /** ISO-8601 */
  grantedAt?: string;
  /** The list in force now: what the dialog shows. */
  current: { version: string; providers: readonly AiProvider[] };
};
