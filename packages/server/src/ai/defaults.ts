import type { Prices, Routing } from './routing';

/**
 * The routing and price tables the seed installs (`app_settings`), and what the eval harness reads
 * when it runs without a database (P9-06). Production reads `app_settings`, never this file.
 */

// P6-07, P9: which providers and models each stage uses. Model ids live only here. Version 2
// moves generation to the 5.5 family (owner's decision, 2026-10-11; toreview §105.16): the
// generation tier on claude-sonnet-5-5, the fast tier on claude-haiku-5-5. The Bedrock ids are
// [verify] until X-10. `hello` stays on the model its P6 fixture was recorded with.
// Version 3 (P11; toreview §105.18): interview sets and assistant replies on the generation tier,
// the assistant's on-topic classifier on the fast tier.
// Version 4 (toreview §110.4): the resume reader copies every bullet word for word, so its answer
// is longer than the fields it read before: 8000 tokens out.
// Version 5 (toreview §153): the job reader places the whole posting, each fact quoted: 8000 out.
export const ROUTING_DEFAULT: Routing = {
  version: 5,
  stages: {
    default: [
      { provider: 'claude', model: 'claude-sonnet-5-5', maxTokens: 4000, inputBudgetTokens: 16000, temperature: 0.3 },
      { provider: 'bedrock', model: 'us.anthropic.claude-sonnet-5-5', maxTokens: 4000, inputBudgetTokens: 16000, temperature: 0.3 },
    ],
    resume_generate: [
      { provider: 'claude', model: 'claude-sonnet-5-5', maxTokens: 6000, inputBudgetTokens: 24000, temperature: 0.3 },
      { provider: 'bedrock', model: 'us.anthropic.claude-sonnet-5-5', maxTokens: 6000, inputBudgetTokens: 24000, temperature: 0.3 },
    ],
    resume_revise: [
      { provider: 'claude', model: 'claude-sonnet-5-5', maxTokens: 4000, inputBudgetTokens: 24000, temperature: 0.2 },
      { provider: 'bedrock', model: 'us.anthropic.claude-sonnet-5-5', maxTokens: 4000, inputBudgetTokens: 24000, temperature: 0.2 },
    ],
    cover_write: [
      { provider: 'claude', model: 'claude-sonnet-5-5', maxTokens: 2000, inputBudgetTokens: 16000, temperature: 0.5 },
      { provider: 'bedrock', model: 'us.anthropic.claude-sonnet-5-5', maxTokens: 2000, inputBudgetTokens: 16000, temperature: 0.5 },
    ],
    zero_generate: [
      { provider: 'claude', model: 'claude-sonnet-5-5', maxTokens: 4000, inputBudgetTokens: 6000, temperature: 0.5 },
      { provider: 'bedrock', model: 'us.anthropic.claude-sonnet-5-5', maxTokens: 4000, inputBudgetTokens: 6000, temperature: 0.5 },
    ],
    interview_write: [
      { provider: 'claude', model: 'claude-sonnet-5-5', maxTokens: 6000, inputBudgetTokens: 12000, temperature: 0.4 },
      { provider: 'bedrock', model: 'us.anthropic.claude-sonnet-5-5', maxTokens: 6000, inputBudgetTokens: 12000, temperature: 0.4 },
    ],
    assistant_reply: [
      { provider: 'claude', model: 'claude-sonnet-5-5', maxTokens: 1200, inputBudgetTokens: 12000, temperature: 0.4 },
      { provider: 'bedrock', model: 'us.anthropic.claude-sonnet-5-5', maxTokens: 1200, inputBudgetTokens: 12000, temperature: 0.4 },
    ],
    assistant_classify: [
      { provider: 'claude', model: 'claude-haiku-5-5', maxTokens: 200, inputBudgetTokens: 3000, temperature: 0 },
      { provider: 'bedrock', model: 'us.anthropic.claude-haiku-5-5', maxTokens: 200, inputBudgetTokens: 3000, temperature: 0 },
    ],
    // The fast tier: extraction and KB candidates, where code verifies what the model read.
    jd_extract: [
      { provider: 'claude', model: 'claude-haiku-5-5', maxTokens: 8000, inputBudgetTokens: 12000, temperature: 0 },
      { provider: 'bedrock', model: 'us.anthropic.claude-haiku-5-5', maxTokens: 8000, inputBudgetTokens: 12000, temperature: 0 },
    ],
    // "Add the result" drafts (toreview §129): one bullet in, one bullet out; code checks it.
    figure_draft: [
      { provider: 'claude', model: 'claude-haiku-5-5', maxTokens: 300, inputBudgetTokens: 1000, temperature: 0.2 },
      { provider: 'bedrock', model: 'us.anthropic.claude-haiku-5-5', maxTokens: 300, inputBudgetTokens: 1000, temperature: 0.2 },
    ],
    resume_extract: [
      { provider: 'claude', model: 'claude-haiku-5-5', maxTokens: 8000, inputBudgetTokens: 12000, temperature: 0 },
      { provider: 'bedrock', model: 'us.anthropic.claude-haiku-5-5', maxTokens: 8000, inputBudgetTokens: 12000, temperature: 0 },
    ],
    kb_candidates: [
      { provider: 'claude', model: 'claude-haiku-5-5', maxTokens: 1000, inputBudgetTokens: 2000, temperature: 0 },
      { provider: 'bedrock', model: 'us.anthropic.claude-haiku-5-5', maxTokens: 1000, inputBudgetTokens: 2000, temperature: 0 },
    ],
    hello: [
      { provider: 'claude', model: 'claude-haiku-4-5', maxTokens: 200, inputBudgetTokens: 2000, temperature: 0 },
      { provider: 'bedrock', model: 'us.anthropic.claude-haiku-4-5-20251001-v1:0', maxTokens: 200, inputBudgetTokens: 2000, temperature: 0 },
    ],
  },
};

// P6-10: US dollars per million tokens. The 5.5 prices are carried over from their
// predecessors [verify against the current price list before relying on the cap]. Cache reads
// 0.1x and cache writes 1.25x the input price.
export const PRICES_DEFAULT: Prices = {
  version: 2,
  models: {
    'claude-opus-5-5': { inputPerMTok: 5, outputPerMTok: 25, cacheReadPerMTok: 0.5, cacheWritePerMTok: 6.25 },
    'claude-sonnet-5-5': { inputPerMTok: 2, outputPerMTok: 10, cacheReadPerMTok: 0.2, cacheWritePerMTok: 2.5 },
    'claude-haiku-5-5': { inputPerMTok: 1, outputPerMTok: 5, cacheReadPerMTok: 0.1, cacheWritePerMTok: 1.25 },
    'claude-opus-5': { inputPerMTok: 5, outputPerMTok: 25, cacheReadPerMTok: 0.5, cacheWritePerMTok: 6.25 },
    'claude-sonnet-5': { inputPerMTok: 2, outputPerMTok: 10, cacheReadPerMTok: 0.2, cacheWritePerMTok: 2.5 },
    'claude-haiku-4-5': { inputPerMTok: 1, outputPerMTok: 5, cacheReadPerMTok: 0.1, cacheWritePerMTok: 1.25 },
  },
};
