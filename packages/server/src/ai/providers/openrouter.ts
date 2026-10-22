import Anthropic from '@anthropic-ai/sdk';
import { guardedFetch } from '../../net/egress';
import type { LlmProvider, LlmRequest } from '../types';
import { fromMessage, toLlmError, toParams } from './messages';

/**
 * `openrouter` (toreview §108): the `claude` family through OpenRouter's Anthropic-compatible
 * Messages endpoint, with the developer's own OpenRouter key. A stand-in for `claudeDirect` while
 * no Claude API key is at hand: local and test only, synthetic data only (L4), capped per
 * developer per day by the gateway like any developer key (D-23).
 *
 * Only the client's endpoint, auth and model ids differ from `claudeDirect`; the request and
 * response code is shared. Routing, prices and recordings keep the Claude ids — the translation
 * happens here, on the wire — so a recording made through OpenRouter replays for `claudeDirect`.
 */

export const OPENROUTER_HOST = 'openrouter.ai';

/** `claude-sonnet-5-5` → `anthropic/claude-sonnet-5.5`; `claude-opus-5` is unchanged but prefixed. */
export function openRouterModel(model: string): string {
  return `anthropic/${model.replace(/-(\d+)-(\d+)$/, '-$1.$2')}`;
}

export function createOpenRouter(apiKey: string, options: { timeoutMs?: number } = {}): LlmProvider {
  // OpenRouter takes the key as a bearer token; the x-api-key header must stay empty.
  const client = new Anthropic({ apiKey: null, authToken: apiKey, baseURL: `https://${OPENROUTER_HOST}/api`, maxRetries: 0, timeout: options.timeoutMs ?? 60_000, fetch: guardedFetch });
  const endpoint = `${OPENROUTER_HOST}/api/v1/messages`;
  const params = (request: LlmRequest) => ({ ...toParams(request), model: openRouterModel(request.model) });
  return {
    name: 'openrouter',
    async messages(request, signal) {
      try {
        return fromMessage(await client.messages.create(params(request), { signal }), request, endpoint);
      } catch (error) {
        throw toLlmError(error);
      }
    },
    async stream(request, onText, signal) {
      try {
        const stream = client.messages.stream(params(request), { signal });
        stream.on('text', (delta) => onText(delta));
        return fromMessage(await stream.finalMessage(), request, endpoint);
      } catch (error) {
        throw toLlmError(error);
      }
    },
  };
}
