import Anthropic from '@anthropic-ai/sdk';
import { guardedFetch } from '../../net/egress';
import type { LlmProvider } from '../types';
import { fromMessage, toLlmError, toParams } from './messages';

/**
 * `claudeDirect` (ImBackendImplementationPlan P6-08, D-23): live calls to the Claude API with the
 * developer's own key from `.env`. Local and test only (config refuses the key in staging and
 * production), synthetic data only (L4), and capped per developer per day by the gateway.
 *
 * The SDK's own retries are off: the gateway owns retries and failover, so every attempt is traced.
 */
export function createClaudeDirect(apiKey: string, options: { timeoutMs?: number } = {}): LlmProvider {
  // Through the egress allowlist (P11-06): api.anthropic.com is on it only when this provider is.
  const client = new Anthropic({ apiKey, maxRetries: 0, timeout: options.timeoutMs ?? 60_000, fetch: guardedFetch });
  const endpoint = 'api.anthropic.com/v1/messages';
  return {
    name: 'claudeDirect',
    async messages(request, signal) {
      try {
        return fromMessage(await client.messages.create(toParams(request), { signal }), request, endpoint);
      } catch (error) {
        throw toLlmError(error);
      }
    },
    async stream(request, onText, signal) {
      try {
        const stream = client.messages.stream(toParams(request), { signal });
        stream.on('text', (delta) => onText(delta));
        return fromMessage(await stream.finalMessage(), request, endpoint);
      } catch (error) {
        throw toLlmError(error);
      }
    },
  };
}
