import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LlmError, type LlmProvider, type LlmRequest, type LlmResponse } from '../types';

/**
 * `recorded` (ImBackendImplementationPlan P6-08): replays a stored response by the request's
 * content hash. It is the default locally and in CI, so neither needs a credential and every run
 * is reproducible. A request with no recording fails loudly (`no_recording`) rather than inventing
 * an answer.
 *
 * Record mode (AI_RECORD=true, local only) sends the call to a live provider and writes what came
 * back. Fixtures hold synthetic inputs only (L4).
 */

export const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../fixtures/ai'); // not import.meta.dirname: Next's bundle leaves it undefined

/** The hash covers everything that decides the answer, and nothing that does not. */
export function requestKey(request: LlmRequest): string {
  const canonical = JSON.stringify({
    model: request.model,
    maxTokens: request.maxTokens,
    temperature: request.temperature ?? null,
    system: request.system.map((b) => b.text),
    messages: request.messages,
    output: request.output ?? null,
  });
  return createHash('sha256').update(canonical).digest('hex').slice(0, 32);
}

interface Fixture {
  key: string;
  recordedAt: string;
  source: string;
  request: { model: string; firstUserChars: string };
  response: LlmResponse;
}

export function createRecordedProvider(options: { dir?: string; live?: LlmProvider; record?: boolean } = {}): LlmProvider {
  const dir = options.dir ?? FIXTURE_DIR;
  const path = (key: string) => join(dir, `${key}.json`);

  async function messages(request: LlmRequest, signal?: AbortSignal): Promise<LlmResponse> {
    const key = requestKey(request);
    if (options.record) {
      if (!options.live) throw new LlmError('no_recording', 'Record mode needs a live provider.', false);
      const response = await options.live.messages(request, signal);
      mkdirSync(dir, { recursive: true });
      const fixture: Fixture = {
        key,
        recordedAt: new Date().toISOString(),
        source: options.live.name,
        request: { model: request.model, firstUserChars: (request.messages[0]?.content ?? '').slice(0, 120) },
        response,
      };
      writeFileSync(path(key), `${JSON.stringify(fixture, null, 2)}\n`);
      return response;
    }
    let raw: string;
    try {
      raw = readFileSync(path(key), 'utf8');
    } catch {
      throw new LlmError('no_recording', `No recorded response for this request (${key}). Record it with AI_RECORD=true.`, false);
    }
    return (JSON.parse(raw) as Fixture).response;
  }

  return {
    name: 'recorded',
    messages,
    async stream(request, onText, signal) {
      const response = await messages(request, signal);
      for (const word of response.text.split(/(?<= )/)) onText(word);
      return response;
    },
  };
}
